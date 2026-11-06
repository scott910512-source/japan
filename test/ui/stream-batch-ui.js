/* 쭉 퀴즈 한 묶음 — 정해 두지 않으면 20문제, 다 풀면 「계속하기 / 오늘은 여기까지」.
 *
 *   · 소개 화면에 한 번에 풀 문제 수 고르기(10 · 20 · 30 · 끝없이), 기본은 20
 *   · 묶음을 다 풀면 멈춰서 묻는다
 *   · 계속하기 → 이어서 풀린다(같은 판) / 오늘은 여기까지 → 평가 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openQuizHub } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const today = todayKey();
const known = (ago = 5) => applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -ago));
const n5 = ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 12);
const n3 = ALL_WORDS.filter((w) => w.level === 'N3').slice(0, 12);
const seededReview = Object.fromEntries([...n5, ...n3].map((w) => [w.id, { ...known(), due: addDays(today, -1) }]));

async function boot(browser, { review = {}, settings = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  /* 기존 검사(menu2-ui)가 쓰는 시작 방법 — 첫 로드로 서비스워커를 깔고, 심은 뒤 한 번 더 불러 온 다음,
     오프라인으로 돌려 로그인 관문의 「이 기기 기록으로 계속하기」로 들어간다. 오프라인으로 새로고침하면
     서비스워커가 준비되기 전의 느린 러너에서 화면이 안 뜬다(CI에서 그랬다). */
  await page.evaluate(({ review, settings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS: false }, settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review, settings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error(`앱이 안 열렸어요 — 화면: ${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)}`);
  return page;
}
const reviewOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
const countsOf = async (page) => Object.fromEntries(await page.locator('.st-count').evaluateAll((els) => els.map((e) => [e.dataset.kind, Number(e.querySelector('b').textContent)])));


/* 보기가 있는(직접 쓰기가 아닌) 문제가 나올 때까지 넘긴다 */
async function toChoice(page) {
  for (let i = 0; i < 14; i++) {
    const run = page.locator('.st-run');
    if (!(await run.count())) return false;
    if ((await run.getAttribute('data-mode')) === 'choice') return true;
    await page.locator('.st-input').fill('ㅋㅋㅋ');
    await page.locator('.st-submit').click();
    await page.waitForTimeout(200);
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click();
    await page.waitForTimeout(300);
  }
  return false;
}


(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, { review: seededReview });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.evaluate(() => { localStorage.setItem('jp_optrev_open', '0'); });
  await openQuizHub(page);
  await page.locator('.pr-row[data-menu="stream"]').click();
  await page.waitForTimeout(900);

  console.log('\n[ 소개 — 기본은 20 ]');
  ok('칩 넷: 10 · 20 · 30 · 끝없이', (await page.locator('.st-batch .chip').allInnerTexts()).join(',') === '10문제,20문제,30문제,끝없이');
  ok('★ 정하지 않으면 20문제가 눌려 있다 ★', (await page.locator('.st-batch .chip.active').getAttribute('data-n')) === '20');
  await page.locator('.st-batch .chip[data-n="10"]').click();
  ok('10으로 바꾼다', (await page.locator('.st-batch .chip.active').getAttribute('data-n')) === '10');
  ok('고른 것을 기억한다', await page.evaluate(() => localStorage.getItem('jp_stream_batch')) === '10');
  await page.locator('.st-start').click();
  await page.waitForTimeout(700);

  console.log('\n[ 열 문제를 풀면 멈춰서 묻는다 ]');
  let guard = 0;
  while (!(await page.locator('.st-checkpoint').count()) && guard++ < 40) {
    if (!(await page.locator('.st-run').count())) break;
    const mode = await page.locator('.st-run').getAttribute('data-mode');
    if (mode === 'typing') { await page.locator('.st-input').fill('ㅋㅋ'); await page.locator('.st-submit').click(); }
    else await page.locator('.st-opt').first().click();
    await page.waitForTimeout(250);
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click();
    else await page.waitForTimeout(1000);
    await page.waitForTimeout(300);
  }
  ok('★ 묶음을 다 풀면 멈춘다 ★', await page.locator('.st-checkpoint').count() === 1);
  ok('열 문제를 풀었다고 알린다', (await page.locator('.st-checkpoint').getAttribute('data-total')) === '10');
  ok('「계속하기」와 「오늘은 여기까지」가 있다', await page.locator('.st-continue').count() === 1 && await page.locator('.st-enough').count() === 1);

  console.log('\n[ 계속하기 ]');
  await page.locator('.st-continue').click();
  await page.waitForTimeout(600);
  ok('★ 같은 판에서 이어서 문제가 나온다 ★', await page.locator('.st-run').count() === 1 && await page.locator('.st-checkpoint').count() === 0);
  const scoreTxt = (await page.locator('.st-score').innerText()).replace(/\s/g, '');
  ok('★ 이어서 풀면 진행 현황이 1 / 10부터 다시 센다 ★', scoreTxt === '1/10', scoreTxt);

  console.log('\n[ 오늘은 여기까지 ]');
  guard = 0;
  while (!(await page.locator('.st-checkpoint').count()) && guard++ < 40) {
    if (!(await page.locator('.st-run').count())) break;
    const mode = await page.locator('.st-run').getAttribute('data-mode');
    if (mode === 'typing') { await page.locator('.st-input').fill('ㅋㅋ'); await page.locator('.st-submit').click(); }
    else await page.locator('.st-opt').first().click();
    await page.waitForTimeout(250);
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click();
    else await page.waitForTimeout(1000);
    await page.waitForTimeout(300);
  }
  ok('스무 문제째에서 다시 묻는다', (await page.locator('.st-checkpoint').getAttribute('data-total')) === '20');
  await page.locator('.st-enough').click();
  await page.waitForTimeout(600);
  ok('★ 오늘은 여기까지 → 평가 화면 ★', await page.locator('.st-sum').count() === 1);

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
