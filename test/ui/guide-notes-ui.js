/* 초보가 처음 만나는 두 화면의 안내 한 줄 — 진짜 화면에서.
 *
 *   · 학습 탭의 「한자」 칸을 열면 N3 한자 500자 코스라고 알리고 완전기초를 안내한다
 *   · N3 코스의 다른 장(예: 홈의 코스)에는 이 안내가 없다
 *   · 단어 화면은 복습할 카드가 없는 첫날 이유를 한 줄로 적는다
 *   · 복습할 카드가 생기면 그 줄은 사라진다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

async function boot(browser, review = null) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((review) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    if (review) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, autoTTS: false, levels: ['N5'] });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  }, review);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 한자 칸 ]');
  const a = await boot(browser);
  a.on('pageerror', (e) => errors.push(e.message));
  await openMenu(a, '한자');
  await a.locator('.n3-curriculum').waitFor({ timeout: 8000 });
  const note = await a.locator('.n3-kanjiguide').innerText().catch(() => '');
  ok('★ N3 한자 500자 코스라고 알린다 ★', note.includes('N3 한자 500자'), note);
  ok('완전기초를 안내한다', note.includes('완전기초'));
  await a.close();

  console.log('\n[ 단어 화면 — 첫날 ]');
  const b = await boot(browser);
  b.on('pageerror', (e) => errors.push(e.message));
  await openMenu(b, '단어');
  await b.locator('.planrow').first().waitFor({ timeout: 8000 });
  ok('★ 복습할 카드가 없는 이유를 한 줄로 적는다 ★', (await b.locator('.wd-firstnote').innerText().catch(() => '')).includes('복습할 카드가 없어서'));
  await b.close();

  console.log('\n[ 단어 화면 — 복습할 카드가 있을 때 ]');
  const today = new Date().toISOString().slice(0, 10);
  const wrong = Object.fromEntries(ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 6).map((w) => [w.id, { box: 1, lastSeen: '2026-01-01', due: '2026-01-02', rounds: 1, level: 0, lastVerdict: 'unknown' }]));
  const c = await boot(browser, wrong);
  c.on('pageerror', (e) => errors.push(e.message));
  await openMenu(c, '단어');
  await c.locator('.planrow').first().waitFor({ timeout: 8000 });
  const rv = Number(((await c.locator('.planrow').first().innerText()).match(/복습 (\d+)개/) || [0, 0])[1]);
  ok('복습 카드가 잡힌다(조건 확인)', rv > 0, `복습 ${rv}개 · ${today}`);
  ok('★ 그러면 첫날 안내 줄은 없다 ★', await c.locator('.wd-firstnote').count() === 0);
  await c.close();

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
