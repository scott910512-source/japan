/* 오늘 퀘스트의 쭉 퀴즈(열 문제) — 진짜 화면에서.
 *
 *   · 외운 낱말이 있으면 퀘스트에 「쭉 퀴즈」 줄(0 / 10)이 뜬다. 없으면 안 뜬다
 *   · 누르면 쭉 퀴즈가 열리고, 한 문제 풀 때마다 오늘 몫이 오른다
 *   · 열 문제를 채우면 마쳤다고 바뀐다 */
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
const N5 = WORDS.filter((w) => String(w.level).toUpperCase() === 'N5').slice(0, 14);
const review = Object.fromEntries(N5.map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1) }]));

async function boot(browser, { rv = null, progress = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ rv, progress }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');   // 보기 상세는 접어 둔다 — 맞히면 저절로 넘어가는 흐름을 본다 (펼친 상태: option-info-ui)
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (rv) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
    if (progress) localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(progress));
  }, { rv, progress });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error('앱이 안 열렸어요');
  return page;
}
const questsOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').quests || null);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 쭉 퀴즈 퀘스트 ]');
  const page = await boot(browser, { rv: review });
  page.on('pageerror', (e) => errors.push(e.message));
  await goTab(page, '오늘');
  const row = page.locator('.tdq-row', { hasText: '쭉 퀴즈' });
  ok('★ 퀘스트에 「쭉 퀴즈」 줄이 있다 ★', await row.count() === 1);
  ok('처음엔 열 문제가 남았다고 적힌다', (await row.innerText()).includes('10문제 남았어요'), (await row.innerText()).replace(/\s+/g, ' '));
  await row.click();
  await page.waitForTimeout(900);
  ok('쭉 퀴즈 소개가 열린다', await page.locator('.st-intro').count() === 1);
  await page.locator('.st-start').click();
  await page.waitForTimeout(700);
  let answered = 0;
  for (let i = 0; i < 3; i++) {
    const run = page.locator('.st-run');
    if (!(await run.count())) break;
    const mode = await run.getAttribute('data-mode');
    if (mode === 'typing') { await page.locator('.st-input').fill('ㅋㅋㅋ'); await page.locator('.st-submit').click(); } else { await page.locator('.st-opt').first().click(); }
    answered += 1;
    await page.waitForTimeout(300);
    if (await page.locator('.st-accept').count()) { await page.locator('.st-reject').click(); await page.waitForTimeout(200); }
    if (await page.locator('.st-next').count()) await page.locator('.st-next').click(); else await page.waitForTimeout(1000);
    await page.waitForTimeout(250);
  }
  const q = await questsOf(page);
  ok('★ 푼 만큼 오늘 몫에 적힌다 ★', q && q.day === today && q.stream === answered, JSON.stringify(q));
  await goTab(page, '오늘');
  const mid = page.locator('.tdq-row', { hasText: '쭉 퀴즈' });
  ok('오늘 탭에 남은 문제 수가 줄어 있다', (await mid.innerText()).includes(`${10 - answered}문제 남았어요`), (await mid.innerText()).replace(/\s+/g, ' '));
  await page.close();

  console.log('\n[ 열 문제를 채우면 ]');
  const full = await boot(browser, { rv: review, progress: { quests: { day: today, stream: 10 } } });
  full.on('pageerror', (e) => errors.push(e.message));
  await goTab(full, '오늘');
  const done = full.locator('.tdq-row', { hasText: '쭉 퀴즈' });
  ok('★ 마쳤다고 바뀐다 ★', (await done.innerText()).includes('마쳤어요') && await done.evaluate((e) => e.classList.contains('complete')), (await done.innerText()).replace(/\s+/g, ' '));
  await full.close();

  console.log('\n[ 외운 게 없으면 ]');
  const empty = await boot(browser, {});
  empty.on('pageerror', (e) => errors.push(e.message));
  await goTab(empty, '오늘');
  ok('★ 줄이 안 뜬다(채울 수 없는 몫) ★', await empty.locator('.tdq-row', { hasText: '쭉 퀴즈' }).count() === 0);
  await empty.close();

  console.log('\n[ 어제 것은 오늘 0 ]');
  const old = await boot(browser, { rv: review, progress: { quests: { day: '2000-01-01', stream: 10 } } });
  old.on('pageerror', (e) => errors.push(e.message));
  await goTab(old, '오늘');
  ok('어제 열 문제를 풀었어도 오늘은 처음부터', (await old.locator('.tdq-row', { hasText: '쭉 퀴즈' }).innerText()).includes('10문제 남았어요'));
  await old.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
