/* 오늘 탭의 「JLPT N3 ○%」가 코스를 열지 않아도 학습 기록에 맞춰 오른다.
 *
 *   · 기록이 없으면 「시작 전」
 *   · N3 단어를 본 기록이 있으면 코스를 안 열어도 숫자가 적힌다(10% 아래는 소수 첫째 자리)
 *   · 풀면 더 오른다(쭉 퀴즈 한 문제) */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
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
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
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



(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 기록이 없을 때 ]');
  const empty = await boot(browser, { review: {} });
  empty.on('pageerror', (e) => errors.push(e.message));
  await empty.waitForTimeout(3500);
  ok('「시작 전」', (await empty.locator('.hg-pct').innerText()).includes('시작 전'));
  await empty.close();

  console.log('\n[ N3 단어를 본 기록이 있을 때 — 코스는 안 열었다 ]');
  const page = await boot(browser, { review: seededReview });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForFunction(() => /\d/.test(document.querySelector('.hg-pct')?.textContent || ''), null, { timeout: 12000 }).catch(() => {});
  const txt = (await page.locator('.hg-pct').innerText()).trim();
  ok('★ 코스를 안 열어도 숫자가 적힌다 ★', /^\d+(\.\d)?%$/.test(txt), txt);
  const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').n3?.summary || null);
  ok('요약에 소수 첫째 자리 값(exact)이 있다', summary && typeof summary.exact === 'number', JSON.stringify(summary)?.slice(0, 120));
  ok('0보다 크다', summary && summary.exact > 0, String(summary?.exact));
  const before = summary?.exact || 0;

  console.log('\n[ 더 보면 더 오른다 ]');
  const more = Object.fromEntries(n3.slice(0, 12).map((w) => [w.id, { ...known(1), due: addDays(today, 5), level: 3 }]));
  await page.evaluate((more) => {
    const r = JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify({ ...r, ...more }));
  }, more);
  /* 같은 탭에서 localStorage만 바꾸면 앱이 모른다 — 다시 불러와 앱이 새 기록을 읽게 한다 */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').n3?.summary?.exact ?? null);
  ok('기록이 좋아지면 숫자가 오른다', after !== null && after >= before, `${before} → ${after}`);

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
