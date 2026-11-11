/* 하루 흐름 — 진짜 화면에서.
 *
 *   복습 미션 → 약점 퀴즈 → 쭉 퀴즈 → 새로 배우기(끝에 10개 더) → 오늘 랜덤 테스트
 *
 *   · 오늘 탭에 다섯 줄이 이 순서로 있고, 양이 늘었다(복습 30 이상 · 약점 30 · 쭉 20 · 새로 10)
 *   · 약점 퀴즈를 마치면 「다음: 쭉 퀴즈」, 쭉 퀴즈 20문제를 채우면 「다음: 새로 배우기」가 뜬다
 *   · 새로 배우기를 끝내면 「10개 더 배우기」와 「다음: 오늘 랜덤 테스트」, 랜덤 테스트를 마치면 「다음: 오늘의 N3」(퀘스트 줄을 다 마친 뒤)
 *   · 랜덤 테스트는 쉰 문제(모자라면 있는 만큼)고 끝나면 오늘 몫이 적힌다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const WORDS = allWords.ALL_WORDS || allWords.default;
const N5 = WORDS.filter((w) => String(w.level).toUpperCase() === 'N5');
/* 복습 차례가 된 낱말 45개 + 약한 낱말 40개 — 양을 키운 기본값(복습 30 · 약점 30)이 다 채워진다 */
const due = N5.slice(0, 45);
const weak = N5.slice(45, 85);
const review = {
  ...Object.fromEntries(due.map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1) }])),
  ...Object.fromEntries(weak.map((w) => [w.id, { box: 1, streak: 0, lastSeen: addDays(today, -4), rounds: 3, wrongCount: 3, vagueCount: 1, seenAt: 1, due: addDays(today, 5) }])),
};

async function boot(browser, progress = null, extraSettings = {}) {
  /* 이 검사는 문장 퀘스트 말고의 흐름을 본다 — 오늘 문장 퀘스트는 건너뛴 것으로 심는다(문장 퀘스트는 sentence-quest-ui가 본다) */
  progress = { quests: { day: todayKey(), sentenceSkip: true }, ...(progress || {}) };
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ rv, progress, extraSettings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    /* 옛 설정(번호 없음, 복습 9 · 새로 8)에서 시작한다 — 새 수량으로 바뀌는지도 같이 본다 */
    const s = { onboarded: true, canReadKana: true, autoTTS: false, goals: { fresh: 8, review: 9, weak: 3 }, ...extraSettings };
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
    if (progress) localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(progress));
  }, { rv: review, progress, extraSettings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  /* 라이브 주소에서 돌릴 때는 서비스워커가 모든 화면 조각을 내려받을 시간을 준다(SW_WAIT=밀리초) */
  if (process.env.SW_WAIT) await page.waitForTimeout(Number(process.env.SW_WAIT));
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error('앱이 안 열렸어요');
  return page;
}
const progressOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}'));
const rowText = async (page, title) => (await page.locator('.tdq-row', { hasText: title }).first().innerText()).replace(/\s+/g, ' ');

/* 시험을 끝까지 푼다 — 고르면 저절로 넘어가거나 「다음」이 뜬다 */
async function finishQuiz(page, cap = 140) {
  let steps = 0;
  while (steps < cap && await page.locator('.quizscore').count() === 0) {
    steps += 1;
    if (await page.locator('.qoptions').count()) { await page.locator('.qopt').first().click(); await page.waitForTimeout(260); }
    else if (await page.locator('.qtyping input').count()) {
      await page.locator('.qtyping input').fill('ㅋ'); await page.locator('.qtyping .submit-btn').click(); await page.waitForTimeout(260);
    }
    const nextBtn = page.locator('.qnext .submit-btn');
    if (await nextBtn.count()) { await nextBtn.click(); await page.waitForTimeout(220); } else await page.waitForTimeout(700);
  }
  return steps;
}

/* 회독 화면: 모두 「알아요」로 넘긴다 */
async function finishDeck(page) {
  let g = 0;
  while (g < 260 && !(await page.locator('.finish').count())) {
    g += 1;
    const go = page.locator('.study .st-go, .study .ph-btn, .study [data-verdict="known"], .study button.known').first();
    if (await page.locator('.study .start-btn, .study .intro-start, .study .study-start').count()) { await page.locator('.study .start-btn, .study .intro-start, .study .study-start').first().click(); await page.waitForTimeout(400); continue; }
    if (await go.count()) { await go.click(); await page.waitForTimeout(220); continue; }
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
    await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  }
  return g;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 오늘 탭 — 다섯 줄과 늘어난 양 ]');
  await goTab(page, '오늘');
  const titles = await page.locator('.tdq-row .tdq-title, .tdq-row b').allInnerTexts().catch(() => []);
  const rows = await page.locator('.tdq-row').allInnerTexts();
  const order = ['복습 미션', '약점 퀴즈', '쭉 퀴즈', '새로 배우기', '오늘 랜덤 테스트'];
  const at = order.map((t) => rows.findIndex((r) => r.includes(t)));
  ok('★ 다섯 줄이 이 순서로 있다(오늘의 N3는 줄이 아니라 다음 버튼으로만 이어진다) ★', at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]), at.join());
  const review1 = await rowText(page, '복습 미션');
  ok('★ 복습 미션은 서른 개 이상 ★', Number((review1.match(/남은 (\d+)개/) || [])[1]) >= 30, review1);
  ok('★ 약점 퀴즈는 서른 문제 ★', (await rowText(page, '약점 퀴즈')).includes('30문제 남았어요'), await rowText(page, '약점 퀴즈'));
  ok('★ 쭉 퀴즈는 스무 문제 ★', (await rowText(page, '쭉 퀴즈')).includes('20문제 남았어요'), await rowText(page, '쭉 퀴즈'));
  ok('★ 새로 배우기는 스무 개 ★', /20/.test(await rowText(page, '새로 배우기')), await rowText(page, '새로 배우기'));
  ok('오늘 랜덤 테스트 줄이 있다', (await rowText(page, '오늘 랜덤 테스트')).includes('쉰 문제'));
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}'));
  ok('★ 옛 설정(9·8·3)이 새 수량(복습 30 · 새로 20)으로 맞춰진다 ★', st.goals?.review === 30 && st.goals?.fresh === 20 && st.goalsV === 3, JSON.stringify(st.goals));

  console.log('\n[ 약점 퀴즈 30문제 → 다음: 쭉 퀴즈 ]');
  await page.locator('.tdq-row', { hasText: '약점 퀴즈' }).click();
  await page.waitForTimeout(1000);
  const start = page.locator('button', { hasText: '시험 시작' }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(900); }
  ok('★ 서른 문제로 시작한다 ★', /\/\s*30/.test((await page.locator('.subscreen.open').innerText()).replace(/\s+/g, ' ')), (await page.locator('.subscreen.open').innerText()).replace(/\s+/g, ' ').slice(0, 60));
  await finishQuiz(page);
  ok('결과 화면', await page.locator('.quizscore').count() === 1);
  ok('★ 「다음: 쭉 퀴즈로 이어서」가 뜬다 ★', await page.locator('.wk-next').count() === 1 && (await page.locator('.wk-next').innerText()).includes('쭉 퀴즈'));
  await page.locator('.wk-next').click();
  await page.waitForTimeout(900);
  ok('쭉 퀴즈가 열린다', await page.locator('.st-intro, .st-run').count() === 1);

  console.log('\n[ 쭉 퀴즈 20문제 → 다음: 새로 배우기 ]');
  if (await page.locator('.st-start').count()) { await page.locator('.st-start').click(); await page.waitForTimeout(700); }
  const weakDone = new Set((await progressOf(page)).weakQuiz?.ids || []);
  const streamIds = [];
  let n = 0;
  while (n < 80 && !(await page.locator('.st-checkpoint').count())) {
    n += 1;
    const run = page.locator('.st-run');
    if (!(await run.count())) break;
    const head = (await page.locator('.st-score').innerText()).replace(/\s/g, '');
    if (n === 1) ok('★ 머리 줄은 진행 현황(1 / 20)이다 ★', head === '1/20', head);
    streamIds.push(await run.getAttribute('data-id'));
    const mode = await run.getAttribute('data-mode');
    if (mode === 'typing') { await page.locator('.st-input').fill('ㅋ'); await page.locator('.st-submit').click(); } else { await page.locator('.st-opt').first().click(); }
    await page.waitForTimeout(280);
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click(); else await page.waitForTimeout(1000);
    await page.waitForTimeout(220);
  }
  ok('★ 오늘 약점 퀴즈로 푼 낱말은 쭉 퀴즈에 또 나오지 않는다(반복 줄이기) ★', weakDone.size >= 30 && streamIds.length >= 10 && streamIds.every((id) => !weakDone.has(id)), `약점 ${weakDone.size}개 · 쭉 ${streamIds.length}문제`);
  ok('스무 문제에서 멈춘다', await page.locator('.st-checkpoint').count() === 1, `${n}걸음`);
  const next = page.locator('.st-checkpoint .st-next');
  ok('★ 「다음: 새로 배우기」가 뜬다 ★', await next.count() === 1 && (await next.innerText()).includes('새로 배우기'), await next.count() ? await next.innerText() : '없음');
  await next.click();
  await page.waitForTimeout(1200);
  ok('★ 새로 배우기(회독) 판이 열린다 ★', await page.locator('.study').count() >= 1, '');

  console.log('\n[ 새로 배우기 → 10개 더 · 다음: 오늘 랜덤 테스트 ]');
  const g = await finishDeck(page);
  ok('완주 화면이 뜬다', await page.locator('.finish').count() === 1, `${g}걸음`);
  if (await page.locator('.finish').count()) {
    ok('★ 「10개 더 배우기」가 있다 ★', await page.locator('.fin-more').count() === 1);
    ok('★ 「다음: 오늘 랜덤 테스트」가 있다(퀘스트 줄의 다음 칸 — N3 코스로 새지 않는다) ★', await page.locator('.fin-next').count() === 1 && (await page.locator('.fin-next').innerText()).includes('오늘 랜덤 테스트'), await page.locator('.fin-next').innerText().catch(() => '없음'));
    /* ★ 「10개 더 배우기」를 누르면 새 판이 열리고, 그 판을 끝내면 또 같은 두 버튼이 뜬다 ★ */
    await page.locator('.fin-more').click();
    await page.waitForTimeout(1200);
    ok('★ 10개 더: 완주 화면이 내려가고 새 판이 열린다 ★', await page.locator('.finish').count() === 0 && await page.locator('.study').count() >= 1);
    const g2 = await finishDeck(page);
    ok('더 배운 판도 끝나면 완주 화면', await page.locator('.finish').count() === 1, `${g2}걸음`);
    ok('★ 끝나면 또 「10개 더」와 「다음: 오늘 랜덤 테스트」 ★', await page.locator('.fin-more').count() === 1 && await page.locator('.fin-next').count() === 1 && (await page.locator('.fin-next').innerText()).includes('오늘 랜덤 테스트'));
    await page.locator('.fin-next').click();
    await page.waitForTimeout(1200);

    console.log('\n[ 오늘 랜덤 테스트 ]');
    ok('★ 설정을 안 묻고 바로 시작한다 ★', await page.locator('.qoptions, .qinput').count() >= 1);
    const total = (await page.locator('.subscreen.open').innerText()).replace(/\s+/g, ' ');
    ok('★ 쉰 문제다 ★', /\/\s*50/.test(total), total.slice(0, 60));
    await finishQuiz(page, 260);
    ok('끝나면 랜덤 테스트 결과', await page.locator('.wk-result[data-flow="random"]').count() === 1);
    const pg = await progressOf(page);
    ok('★ 오늘 몫(random)이 적힌다 ★', pg.quests?.random === 1, JSON.stringify(pg.quests));
    /* 퀘스트 줄을 다 마친 뒤에야 오늘의 N3(학습 탭의 코스)를 내민다. 홈으로 가는 단추도 같이 있다 */
    ok('★ 랜덤 테스트 뒤에 「다음: 오늘의 N3」와 「홈으로」가 있다 ★', (await page.locator('.flow-next').innerText().catch(() => '')).includes('오늘의 N3') && (await page.locator('.flow-done').innerText()).includes('홈으로'));
    await page.locator('.flow-next').click();
    await page.waitForTimeout(1500);
    ok('★ 오늘의 N3(코스의 오늘 순서)가 열린다 ★', await page.locator('.n3-today').count() === 1, (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80));
    ok('오늘 순서 줄이 있다', await page.locator('.n3-steprow').count() >= 1);
    await goTab(page, '오늘');
    ok('★ 오늘 탭에서 랜덤 테스트가 마쳤어요로 바뀐다 ★', (await rowText(page, '오늘 랜덤 테스트')).includes('마쳤어요'), await rowText(page, '오늘 랜덤 테스트'));
  }

  console.log('\n[ 홈의 큰 단추(오늘의 학습 한 판)를 끝내도 다음 단계로 이어진다 ]');
  {
    /* 양을 줄여 돌린다(번호 3을 같이 적어야 직접 정한 값으로 읽힌다) — 흐름 확인이 목적이라 쉰세 장을 다 돌 필요가 없다 */
    const p3 = await boot(browser, null, { goals: { fresh: 5, review: 6, weak: 2 }, goalsV: 3 });
    p3.on('pageerror', (e) => errors.push(e.message));
    await goTab(p3, '오늘');
    await p3.locator('.bigcta').first().click();
    await p3.waitForTimeout(1200);
    const g3 = await finishDeck(p3);
    ok('오늘의 학습 한 판이 끝나 완주 화면이 뜬다', await p3.locator('.finish').count() === 1, `${g3}걸음`);
    ok('★ 「오늘로」만 있지 않고 「다음: 약점 퀴즈」가 첫째 버튼이다 ★', await p3.locator('.fin-next').count() === 1 && (await p3.locator('.fin-next').innerText()).includes('약점 퀴즈'), await p3.locator('.finish').count() ? (await p3.locator('.finish .submit-btn').first().innerText()) : '');
    await p3.locator('.fin-next').click();
    await p3.waitForTimeout(1200);
    ok('★ 누르면 약점 퀴즈가 바로 열린다 ★', await p3.locator('.qoptions, .qtyping').count() >= 1);
    await p3.close();
  }

  console.log('\n[ 오늘의 N3를 다 하면 → 흐름의 끝: 홈으로 ]');
  {
    const p2 = await boot(browser, { n3: { v: 1, days: { [todayKey()]: { steps: [{ kind: 'review', ids: [], done: true }], built: 1, answered: 0, right: 0 } } } });
    p2.on('pageerror', (e) => errors.push(e.message));
    await goTab(p2, '오늘');
    ok('오늘 탭에는 N3 입구 줄이 없다(학습 탭 하나)', await p2.locator('.tdq-row', { hasText: '오늘의 N3' }).count() === 0);
    await openMenu(p2, '한 권으로 끝내는 N3');
    await p2.locator('.n3-hub').waitFor({ timeout: 8000 });
    await p2.locator('.n3-cta').click();
    await p2.waitForTimeout(1200);
    ok('★ 끝낸 오늘의 N3는 흐름의 마지막이다 — 「다음」 없이 「홈으로」 ★', await p2.locator('.n3-daydone').count() === 1 && await p2.locator('.n3-flownext').count() === 0 && await p2.locator('.n3-home').count() === 1);
    await p2.locator('.n3-home').click();
    await p2.waitForTimeout(800);
    ok('★ 홈으로를 누르면 오늘 화면이다 ★', await p2.locator('.tdhead').count() === 1 && await p2.locator('.subscreen.open').count() === 0);
    await p2.close();
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
