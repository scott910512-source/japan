/* 하루 흐름 — 약점 퀴즈에서 틀린 단어를 다시 풀거나 카드로 외워도 다음 단계(쭉 퀴즈)로 이어진다.
 *
 * 약점 퀴즈 결과에는 「틀린 단어 다시 퀴즈 풀기」와 「카드로 외우기」가 「다음: 쭉 퀴즈」보다 위에 있다.
 * 그 둘로 들어가면 끝난 뒤 「시험 설정으로」/「오늘로」만 남아서 흐름이 끊겼다 — 쭉 퀴즈로 안 넘어가고 엉뚱한 화면에 떨어졌다.
 *   · 틀린 단어를 다시 푼 결과에도 「다음: 쭉 퀴즈로 이어서」가 있다
 *   · 틀린 단어를 카드로 외운 뒤 완주 화면의 첫 단추가 「다음: 쭉 퀴즈」다
 *   · 한 번 마친 퀘스트는 뒤에서 몫이 늘어도(10개 더 배우기 · 새로 생긴 약점) 그날은 마친 것으로 남는다
 *   · 쭉 퀴즈는 오늘 몫을 채운 그 자리에서 「다음: 새로 배우기」와 「홈으로」를 내민다(한 묶음이 끝나길 기다리지 않는다) */
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

async function boot(browser, progress = null, extraSettings = {}, store = null) {
  /* 이 검사는 문장 퀘스트 말고의 흐름을 본다 — 오늘 문장 퀘스트는 건너뛴 것으로 심는다(문장 퀘스트는 sentence-quest-ui가 본다) */
  progress = { quests: { day: todayKey(), sentenceSkip: true }, ...(progress || {}) };
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ rv, progress, extraSettings, store }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    /* 옛 설정(번호 없음, 복습 9 · 새로 8)에서 시작한다 — 새 수량으로 바뀌는지도 같이 본다 */
    const s = { onboarded: true, canReadKana: true, autoTTS: false, goals: { fresh: 8, review: 9, weak: 3 }, ...extraSettings };
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
    if (progress) localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(progress));
    /* 그 밖에 심어 둘 것(오늘의 계획 등) — 여기서 같이 심어야 다시 불러올 일이 없다 */
    for (const [k, v] of Object.entries(store || {})) localStorage.setItem(k, JSON.stringify(v));
  }, { rv: review, progress, extraSettings, store });
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

  console.log('\n[ 약점 퀴즈 → 틀린 단어 다시 퀴즈 → 다음: 쭉 퀴즈 ]');
  await goTab(page, '오늘');
  await page.locator('.tdq-row', { hasText: '약점 퀴즈' }).click();
  await page.waitForTimeout(1000);
  const start = page.locator('button', { hasText: '시험 시작' }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(900); }
  await finishQuiz(page);
  ok('약점 퀴즈 결과 화면', await page.locator('.quizscore').count() === 1 && await page.locator('.wk-next').count() === 1);
  /* 첫 보기만 눌러서 서른 문제를 다 맞힐 일은 없다 — 그래도 다 맞혔으면 이을 것이 없으니 건너뛴다 */
  if (!(await page.locator('.quiz-retry').count())) {
    console.log('  (이번 판은 다 맞혀서 다시 풀기가 안 보인다 — 건너뜀)');
  } else {
    await page.locator('.quiz-retry').click();
    await page.waitForFunction(() => !document.querySelector('.quizscore'), null, { timeout: 8000 });
    await finishQuiz(page);
    ok('다시 푼 결과 화면', await page.locator('.quizscore').count() === 1 && await page.locator('.retry-result').count() === 1, (await page.locator('.retry-result').innerText().catch(() => '')).replace(/\s+/g, ' '));
    ok('★ 틀린 단어를 다시 푼 뒤에도 「다음: 쭉 퀴즈로 이어서」가 있다 ★', await page.locator('.wk-next').count() === 1 && (await page.locator('.wk-next').innerText()).includes('쭉 퀴즈'),
      (await page.locator('.subscreen.open button').allInnerTexts()).slice(-4).join(' | ').replace(/\s+/g, ' '));
    ok('「시험 설정으로」로 떨어뜨리지 않는다', await page.locator('.subscreen.open button', { hasText: '시험 설정으로' }).count() === 0);

    if (await page.locator('.quiz-retry-cards').count()) {
      console.log('\n[ 틀린 단어 카드로 외우기 → 완주 → 다음: 쭉 퀴즈 ]');
      await page.locator('.quiz-retry-cards').click();
      await page.waitForTimeout(1200);
      const g = await finishDeck(page);
      ok('틀린 단어 판이 끝나 완주 화면이 뜬다', await page.locator('.finish').count() === 1, `${g}걸음`);
      ok('★ 완주 화면의 첫 단추가 「다음: 쭉 퀴즈」다 ★', await page.locator('.fin-next').count() === 1 && (await page.locator('.fin-next').innerText()).includes('쭉 퀴즈'), (await page.locator('.finish').innerText()).replace(/\s+/g, ' ').slice(-80));
      await page.locator('.fin-next').click();
      await page.waitForTimeout(1200);
      ok('★ 누르면 쭉 퀴즈가 열린다 ★', await page.locator('.st-intro, .st-run').count() === 1);
    } else {
      await page.locator('.wk-next').click();
      await page.waitForTimeout(900);
      ok('★ 누르면 쭉 퀴즈가 열린다 ★', await page.locator('.st-intro, .st-run').count() === 1);
    }
  }

  console.log('\n[ 쭉 퀴즈 — 오늘 몫을 채운 그 자리에서 다음 단계를 내민다 ]');
  {
    /* 앞서 17문제를 풀어 둔 날 + 한 번에 30문제로 둔 사람. 전에는 30문제를 다 풀 때까지 「다음」이 안 나왔다 */
    const p2 = await boot(browser, { quests: { day: todayKey(), sentenceSkip: true, stream: 17 } });
    p2.on('pageerror', (e) => errors.push(e.message));
    await p2.evaluate(() => localStorage.setItem('jp_stream_batch', '30'));
    await goTab(p2, '오늘');
    await p2.locator('.tdq-row', { hasText: '쭉 퀴즈' }).click();
    await p2.waitForTimeout(900);
    if (await p2.locator('.st-start').count()) { await p2.locator('.st-start').click(); await p2.waitForTimeout(700); }
    let n = 0;
    while (n < 12 && !(await p2.locator('.st-checkpoint').count())) {
      n += 1;
      const run = p2.locator('.st-run');
      if (!(await run.count())) break;
      const mode = await run.getAttribute('data-mode');
      if (mode === 'typing') { await p2.locator('.st-input').fill('ㅋ'); await p2.locator('.st-submit').click(); } else { await p2.locator('.st-opt').first().click(); }
      await p2.waitForTimeout(280);
      if (await p2.locator('.st-accept').count()) { await p2.locator('.st-reject').click(); await p2.waitForTimeout(200); }
      if (await p2.locator('.st-next').count()) await p2.locator('.st-next').click(); else await p2.waitForTimeout(1000);
      await p2.waitForTimeout(220);
    }
    const cp = p2.locator('.st-checkpoint');
    ok('★ 세 문제째(오늘 몫 20을 채운 자리)에서 멈춘다 — 30문제를 기다리지 않는다 ★', await cp.count() === 1 && (await cp.getAttribute('data-total')) === '3', `${n}걸음 · ${await cp.count() ? await cp.getAttribute('data-total') : '안 멈춤'}문제`);
    ok('★ 「다음: 새로 배우기」와 「홈으로」가 같이 있다 ★', (await cp.locator('.st-next').innerText().catch(() => '')).includes('새로 배우기') && await cp.locator('.st-home').count() === 1 && (await cp.innerText()).includes('오늘 쭉 퀴즈를 마쳤어요'));
    await cp.locator('.st-home').click();
    await p2.waitForTimeout(800);
    ok('★ 홈으로를 누르면 오늘 화면이다 ★', await p2.locator('.tdhead').count() === 1 && await p2.locator('.subscreen.open').count() === 0);
    ok('쭉 퀴즈 줄이 마쳤어요로 바뀌어 있다', (await rowText(p2, '쭉 퀴즈')).includes('마쳤어요'), await rowText(p2, '쭉 퀴즈'));
    await p2.close();
  }

  console.log('\n[ 마친 퀘스트는 뒤에서 몫이 늘어도 마친 것으로 남는다 ]');
  {
    /* 약점 퀴즈 — 약한 낱말이 열둘뿐이던 때 12 / 12로 마쳤다(sealWeak). 지금은 약한 낱말이 마흔 개 있다 */
    const done12 = due.slice(0, 12).map((w) => w.id);
    const p3 = await boot(browser, { quests: { day: todayKey(), sentenceSkip: true, sealWeak: 12 }, weakQuiz: { day: todayKey(), ids: done12 } });
    p3.on('pageerror', (e) => errors.push(e.message));
    await goTab(p3, '오늘');
    const wr = await rowText(p3, '약점 퀴즈');
    ok('★ 약점 퀴즈가 12 / 30으로 돌아가지 않고 12 / 12 마쳤어요다 ★', wr.includes('마쳤어요') && /12\s*\/\s*12/.test(wr), wr);
    await p3.close();

    /* 새로 배우기 — 오늘 몫 다섯을 마친 뒤 「10개 더 배우기」를 눌러 몫이 열다섯이 됐다 */
    const p4 = await boot(browser, null, { goals: { fresh: 5, review: 6, weak: 2 }, goalsV: 3 });
    p4.on('pageerror', (e) => errors.push(e.message));
    await goTab(p4, '오늘');
    await p4.locator('.tdq-row', { hasText: '새로 배우기' }).click();
    await p4.waitForTimeout(1200);
    const g = await finishDeck(p4);
    ok('새로 배우기 다섯 장을 마친다', await p4.locator('.finish').count() === 1 && await p4.locator('.fin-more').count() === 1, `${g}걸음`);
    const sealed = await p4.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').quests || {});
    ok('★ 마친 순간의 몫(5)을 적어 둔다 ★', sealed.sealFresh === 5, JSON.stringify(sealed));
    await p4.locator('.fin-more').click();
    await p4.waitForTimeout(1200);
    ok('10개 더 — 새 판이 열린다', await p4.locator('.finish').count() === 0 && await p4.locator('.study').count() >= 1);
    await goTab(p4, '오늘');
    await p4.waitForTimeout(600);
    const fr = await rowText(p4, '새로 배우기');
    ok('★ 더 배우는 중에도 새로 배우기 줄은 5 / 5 마쳤어요다(5 / 15로 안 돌아간다) ★', fr.includes('마쳤어요') && /5\s*\/\s*5/.test(fr), fr);
    ok('더 붙은 것은 덤으로 적는다', /더 배운 것\s*\d+\s*\/\s*10/.test(fr), fr);
    const score = (await p4.locator('.tdq-score').innerText()).replace(/\s/g, '');
    const rows = await p4.locator('.tdq-row').count();
    const doneRows = await p4.locator('.tdq-row', { hasText: '마쳤어요' }).count();
    ok('퀘스트 머리 숫자도 그 줄을 마친 것으로 센다', Number(score.split('/')[0]) === doneRows, `${score} · 마쳤어요 ${doneRows} / ${rows}줄`);
    await p4.close();
  }

  console.log('\n[ 날이 바뀐 첫 화면 — 어제 다 마친 계획의 몫을 오늘 것으로 적지 않는다 ]');
  {
    /* 어제: 복습 2 · 새 낱말 1을 다 마친 작은 하루. 오늘은 새 낱말이 스무 개쯤 잡힌다.
       처음부터 심어 둔다 — 오프라인에서 다시 불러오면 느린 러너에서는 화면이 안 뜰 때가 있다(서비스워커가 덜 받은 채). */
    const d = new Date(Date.now() - 86400000);
    const y = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const p5 = await boot(browser, { quests: { day: y, stream: 20, sealReview: 2, sealFresh: 1 } }, {}, {
      jp_manabu_plan_v1: { v: 1, date: y, goals: { fresh: 20, review: 30, weak: 3 }, reps: 3, extra: 0, sizes: {},
        assigned: [{ id: 'x1', kind: 'word', bucket: 'review' }, { id: 'x2', kind: 'word', bucket: 'review' }, { id: 'x3', kind: 'word', bucket: 'fresh' }], done: { x1: true, x2: true, x3: true } },
    });
    p5.on('pageerror', (e) => errors.push(e.message));
    await p5.waitForTimeout(1500);
    await goTab(p5, '오늘');
    const q = await p5.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').quests || {});
    ok('★ 오늘 것으로 적힌 몫이 없다(어제의 1 · 2가 넘어오지 않는다) ★', !(q.day === todayKey() && (q.sealFresh || q.sealReview)), JSON.stringify(q));
    const fr5 = await rowText(p5, '새로 배우기');
    ok('★ 새로 배우기 줄이 「마쳤어요」로 시작하지 않는다 ★', !fr5.includes('마쳤어요') && /0\s*\/\s*\d+/.test(fr5), fr5);
    await p5.close();
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
