/* 전체 단어 지도(기록 화면) + 새로 배우기 최소 20개 — 2026-11-16
 *   · 모든 낱말이 한 칸씩, 기억 상태 색으로(안 봄 · 처음 봄 · 약점 · 확인 1~3 · 외움)
 *   · 레벨 탭으로 걸러 보고, 칸을 누르면 그 낱말이 뜬다
 *   · 오늘 계획의 새로 배우기는 한 번도 안 본 낱말 최소 20개 — 고른 레벨에 모자라면 다음 레벨에서 */
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const today = new Date().toISOString().slice(0, 10);
const n5 = ALL_WORDS.filter((w) => w.level === 'N5');
/* N5를 거의 다 본 사람 — 안 본 N5가 5개뿐이다(새로 배우기가 N4로 넘어가야 한다) */
const review = {};
n5.slice(0, n5.length - 5).forEach((w, i) => {
  const lv = i % 6;
  review[w.id] = { lastSeen: '2026-11-01', seenAt: 1, level: lv === 5 ? 4 : lv, rounds: 3, wrongCount: i % 17 === 0 ? 5 : 0, vagueCount: 0, due: '2026-12-30' };
});

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(([r]) => {
  if (localStorage.getItem('qa_seeded')) return;
  localStorage.setItem('qa_seeded', '1');
  localStorage.setItem('jp_manabu_guest_v1', '1');
  localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, levels: ['N5'], goals: { fresh: 5, review: 10, weak: 2 }, goalsV: 3 }));
  localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r));
}, [review]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
await page.waitForTimeout(1500);

console.log('\n[ 새로 배우기 — 한 번도 안 본 낱말 최소 20개 ]');
const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_plan_v1') || 'null'));
const fresh = (plan?.assigned || []).filter((x) => x.bucket === 'fresh' && x.kind === 'word');
ok('★ 목표를 5로 골라도 새 낱말은 20개 ★', fresh.length === 20, `${fresh.length}`);
const rv = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'));
ok('★ 전부 한 번도 안 본 낱말 ★', fresh.every((x) => !rv[x.id]?.lastSeen));
const lvOf = new Map(ALL_WORDS.map((w) => [w.id, w.level]));
ok('★ N5에 남은 새 낱말(5개)이 모자라 N4에서 채운다 ★', fresh.filter((x) => lvOf.get(x.id) === 'N5').length === 5 && fresh.filter((x) => lvOf.get(x.id) === 'N4').length === 15,
  `N5 ${fresh.filter((x) => lvOf.get(x.id) === 'N5').length} · N4 ${fresh.filter((x) => lvOf.get(x.id) === 'N4').length}`);

console.log('\n[ 전체 단어 지도 ]');
await goTab(page, '내 학습');
const map = page.locator('.wmap');
await map.waitFor({ timeout: 10000 });
/* 처음엔 지금 공부 중인 레벨 하나 — N5에 안 본 낱말이 5개 남았으니 N5 */
ok('처음엔 지금 공부 중인 레벨(N5)만 보인다', await page.locator('.wmap-tabs .chip.active').innerText() === 'N5' && await page.locator('.wmap .wmap-grid .wm-cell').count() === n5.length);
await page.locator('.wmap-tabs .chip', { hasText: '전체' }).click();
await page.waitForTimeout(200);
const cells = await page.locator('.wmap .wmap-grid .wm-cell').count();
ok('★ 전체를 고르면 모든 낱말이 한 칸씩 ★', cells === ALL_WORDS.length, `${cells} / ${ALL_WORDS.length}`);
const cnt = (s) => page.locator(`.wmap .wmap-grid .wm-cell.s-${s}`).count();
ok('본 것 · 외운 것 · 약점이 색으로 갈린다', await cnt('master') > 0 && await cnt('weak') > 0 && await cnt('l2') > 0 && await cnt('new') > 0);
ok('요약에 만난 수가 맞다', (await page.locator('.wmap-sum').innerText()).includes(`${n5.length - 5} / ${ALL_WORDS.length}`), await page.locator('.wmap-sum').innerText());
await page.locator('.wmap-tabs .chip', { hasText: 'N5' }).click();
await page.waitForTimeout(200);
ok('레벨 탭으로 걸러 본다', await page.locator('.wmap .wmap-grid .wm-cell').count() === n5.length);
await page.locator('.wmap .wmap-grid .wm-cell').first().click();
await page.waitForTimeout(150);
ok('★ 칸을 누르면 그 낱말이 뜬다 ★', await page.locator('.wmap-pick').count() === 1 && (await page.locator('.wmap-pick b').innerText()).length > 0, await page.locator('.wmap-pick').innerText().catch(() => ''));
ok('오류 없음', errors.length === 0, errors[0]);

await browser.close();
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
