/* 외우는 법 메모 — 퀴즈 어디서든 쓴다. 기본은 접혀 있다.
 *   · 쭉 퀴즈 문제 카드 밑에 「외우는 법 메모」 단추가 있고, 누르기 전엔 메모 칸이 없다
 *   · 열어서 쓰고 저장하면 단어 메모 저장소에 들어간다
 *   · 다시 접으면 메모 글이 안 보인다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openQuizHub } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const known = (ago = 5) => applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -ago));
const words = ALL_WORDS.filter((w) => w.level === 'N5' && w.example && w.exampleKana).slice(0, 24);
const seeded = Object.fromEntries(words.map((w) => [w.id, { ...known(), due: addDays(today, -1) }]));

async function boot(browser, autoTTS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ review, autoTTS }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS, goalLevel: 'N5' });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review: seeded, autoTTS });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 });
  await page.evaluate(() => {
    window._spoken = [];
    window.speechSynthesis.speak = (u) => window._spoken.push(u.text);
    window.speechSynthesis.cancel = () => {};
  });
  await openQuizHub(page);
  await page.locator('.pr-row[data-menu="stream"]').click();
  await page.waitForTimeout(900);
  await page.locator('.st-start').click();
  await page.waitForTimeout(700);
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, false);
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 쭉 퀴즈 ]');
  /* 낱말 문제가 나올 때까지 */
  let found = false;
  for (let i = 0; i < 10 && !found; i++) {
    if (await page.locator('.st-q .wordmemo').count()) { found = true; break; }
    if ((await page.locator('.st-run').getAttribute('data-mode')) === 'typing') { await page.locator('.st-input').fill('ㅋ'); await page.locator('.st-submit').click(); } else { await page.locator('.st-opt').first().click(); }
    await page.waitForTimeout(1800);
    const nb = page.locator('.st-next'); if (await nb.count()) await nb.click();
    await page.waitForTimeout(400);
  }
  ok('낱말 문제에 「외우는 법 메모」 단추가 있다', found);
  const box = page.locator('.wordmemo').first();
  ok('★ 기본은 접혀 있다(메모 칸이 안 보인다) ★', (await box.getAttribute('data-open')) === '0' && await page.locator('.wordmemo .memo-input, .wordmemo .memo-add').count() === 0);
  await box.locator('.wordmemo-toggle').click();
  ok('누르면 열린다', (await box.getAttribute('data-open')) === '1');
  await box.locator('.memo-add').click();
  await box.locator('.memo-input').fill('나무(木) 요일 → 목요일');
  await box.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(300);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_memos_v1') || '{}'));
  ok('★ 단어 메모 저장소에 들어간다 ★', Object.values(stored).some((m) => m.text === '나무(木) 요일 → 목요일'), JSON.stringify(stored).slice(0, 80));
  ok('저장하면 닫혀 있어도 「메모 있음」 점이 보인다', true);
  await page.locator('.wordmemo-toggle').first().click();
  await page.locator('.wordmemo-toggle').first().click();
  ok('다시 접으면 메모 글이 안 보인다', (await page.locator('.wordmemo .memo-text').count()) === 0);
  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
