/* 하루 흐름 — 진짜 화면에서.
 *
 *   복습 미션 → 약점 퀴즈 → 쭉 퀴즈 → 새로 배우기(끝에 10개 더) → 오늘 랜덤 테스트
 *
 *   · 오늘 탭에 다섯 줄이 이 순서로 있고, 양이 늘었다(복습 30 이상 · 약점 30 · 쭉 20 · 새로 10)
 *   · 약점 퀴즈를 마치면 「다음: 쭉 퀴즈」, 쭉 퀴즈 20문제를 채우면 「다음: 새로 배우기」가 뜬다
 *   · 새로 배우기를 끝내면 「10개 더 배우기」와 「다음: 오늘 랜덤 테스트」
 *   · 랜덤 테스트는 쉰 문제(모자라면 있는 만큼)고 끝나면 오늘 몫이 적힌다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';
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

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((rv) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    /* 옛 설정(번호 없음, 복습 9 · 새로 8)에서 시작한다 — 새 수량으로 바뀌는지도 같이 본다 */
    const s = { onboarded: true, canReadKana: true, autoTTS: false, goals: { fresh: 8, review: 9, weak: 3 } };
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
  }, review);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
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
  while (g < 160 && !(await page.locator('.finish').count())) {
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
  ok('★ 다섯 줄이 이 순서로 있다 ★', at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]), at.join());
  const review1 = await rowText(page, '복습 미션');
  ok('★ 복습 미션은 서른 개 이상 ★', Number((review1.match(/남은 (\d+)개/) || [])[1]) >= 30, review1);
  ok('★ 약점 퀴즈는 서른 문제 ★', (await rowText(page, '약점 퀴즈')).includes('30문제 남았어요'), await rowText(page, '약점 퀴즈'));
  ok('★ 쭉 퀴즈는 스무 문제 ★', (await rowText(page, '쭉 퀴즈')).includes('20문제 남았어요'), await rowText(page, '쭉 퀴즈'));
  ok('★ 새로 배우기는 열 개 ★', /10/.test(await rowText(page, '새로 배우기')), await rowText(page, '새로 배우기'));
  ok('오늘 랜덤 테스트 줄이 있다', (await rowText(page, '오늘 랜덤 테스트')).includes('쉰 문제'));
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}'));
  ok('★ 옛 설정(9·8·3)이 새 수량(복습 30 · 새로 10)으로 맞춰진다 ★', st.goals?.review === 30 && st.goals?.fresh === 10 && st.goalsV === 2, JSON.stringify(st.goals));

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
  let n = 0;
  while (n < 80 && !(await page.locator('.st-checkpoint').count())) {
    n += 1;
    const run = page.locator('.st-run');
    if (!(await run.count())) break;
    const head = (await page.locator('.st-score').innerText()).replace(/\s/g, '');
    if (n === 1) ok('★ 머리 줄은 진행 현황(1 / 20)이다 ★', head === '1/20', head);
    const mode = await run.getAttribute('data-mode');
    if (mode === 'typing') { await page.locator('.st-input').fill('ㅋ'); await page.locator('.st-submit').click(); } else { await page.locator('.st-opt').first().click(); }
    await page.waitForTimeout(280);
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click(); else await page.waitForTimeout(1000);
    await page.waitForTimeout(220);
  }
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
    ok('★ 「다음: 오늘 랜덤 테스트」가 있다 ★', await page.locator('.fin-next').count() === 1 && (await page.locator('.fin-next').innerText()).includes('오늘 랜덤 테스트'));
    /* ★ 「10개 더 배우기」를 누르면 새 판이 열리고, 그 판을 끝내면 또 같은 두 버튼이 뜬다 ★ */
    await page.locator('.fin-more').click();
    await page.waitForTimeout(1200);
    ok('★ 10개 더: 완주 화면이 내려가고 새 판이 열린다 ★', await page.locator('.finish').count() === 0 && await page.locator('.study').count() >= 1);
    const g2 = await finishDeck(page);
    ok('더 배운 판도 끝나면 완주 화면', await page.locator('.finish').count() === 1, `${g2}걸음`);
    ok('★ 끝나면 또 「10개 더」와 「다음: 오늘 랜덤 테스트」 ★', await page.locator('.fin-more').count() === 1 && await page.locator('.fin-next').count() === 1);
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
    await page.locator('.flow-done').click();
    await page.waitForTimeout(700);
    await goTab(page, '오늘');
    ok('★ 오늘 탭에서 랜덤 테스트가 마쳤어요로 바뀐다 ★', (await rowText(page, '오늘 랜덤 테스트')).includes('마쳤어요'), await rowText(page, '오늘 랜덤 테스트'));
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
