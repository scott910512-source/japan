/* 전체 단어 지도(기록 화면) + 새로 배우기 최소 20개 — 2026-11-16
 *   · 모든 낱말이 한 칸씩, 기억 상태 색으로(안 봄 · 처음 봄 · 약점 · 확인 1~3 · 외움)
 *   · 레벨 탭으로 걸러 보고, 칸을 누르면 그 낱말이 뜬다
 *   · 오늘 계획의 새로 배우기는 한 번도 안 본 낱말 최소 20개 — 고른 레벨에 모자라면 다음 레벨에서 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { goTab } from './_nav.js';
import { allFacets } from './_seed.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* CI에는 이 경로가 없다 — 있을 때만 쓰고, 없으면 playwright가 받아 둔 브라우저를 쓴다(다른 검사와 같다) */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const today = new Date().toISOString().slice(0, 10);
/* 문법 카드(grammar: true)는 레벨 묶음이 아니라 「문법」 묶음이다 */
const n5 = ALL_WORDS.filter((w) => w.level === 'N5' && !w.grammar);
/* N5를 거의 다 본 사람 — 안 본 N5가 5개뿐이다(새로 배우기가 N4로 넘어가야 한다) */
const review = {};
n5.slice(0, n5.length - 5).forEach((w, i) => {
  const lv = i % 6;
  review[w.id] = allFacets({ lastSeen: '2026-11-01', seenAt: 1, level: lv === 5 ? 4 : lv, rounds: 3, wrongCount: i % 17 === 0 ? 5 : 0, vagueCount: 0, due: '2026-12-30' });
});

/* 세 칸이 고르지 않은 낱말 둘 — 한자 낱말(뜻 3 · 읽기 0 · 떠올리기 1)과 가나로만 쓰는 낱말(읽기 칸 없음) */
const HAS_KANJI = /[\u3400-\u9fff]/;
const kanjiW = n5.slice(0, n5.length - 5).find((w) => HAS_KANJI.test(w.kanji || ''));
const kanaW = n5.slice(0, n5.length - 5).find((w) => !HAS_KANJI.test(w.kanji || ''));
review[kanjiW.id] = { lastSeen: '2026-11-01', seenAt: 1, level: 0, rounds: 3, wrongCount: 0, vagueCount: 0, due: '2026-11-02',
  fx: { mean: { lv: 3, due: '2026-12-30', on: null }, read: { lv: 0, due: '2026-11-02', on: null }, prod: { lv: 1, due: '2026-12-01', on: null } } };
review[kanaW.id] = { lastSeen: '2026-11-01', seenAt: 1, level: 2, rounds: 3, wrongCount: 0, vagueCount: 0, due: '2026-12-30',
  fx: { mean: { lv: 2, due: '2026-12-30', on: null }, read: { na: 1 }, prod: { lv: 2, due: '2026-12-30', on: null } } };

/* N5 문법 카드도 이미 본 것으로 — 이 사람은 N5를 거의 다 했다(남은 건 낱말 5개뿐) */
ALL_WORDS.filter((w) => w.level === 'N5' && w.grammar).forEach((w) => {
  review[w.id] = { lastSeen: '2026-11-01', seenAt: 1, level: 2, rounds: 3, wrongCount: 0, vagueCount: 0, due: '2026-12-30' };
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
ok('본 것 · 외운 것 · 약점이 색으로 갈린다', await cnt('done') > 0 && await cnt('weak') > 0 && await cnt('round2') > 0 && await cnt('fresh') > 0);
ok('요약에 만난 수가 맞다', (await page.locator('.wmap-sum').innerText()).includes(`${n5.length - 5 + ALL_WORDS.filter((w) => w.level === 'N5' && w.grammar).length} / ${ALL_WORDS.length}`), await page.locator('.wmap-sum').innerText());
await page.locator('.wmap-tabs .chip', { hasText: 'N5' }).click();
await page.waitForTimeout(200);
ok('레벨 탭으로 걸러 본다', await page.locator('.wmap .wmap-grid .wm-cell').count() === n5.length);
await page.locator('.wmap .wmap-grid .wm-cell').first().click();
await page.waitForTimeout(150);
ok('★ 칸을 누르면 그 낱말이 뜬다 ★', await page.locator('.wmap-pick').count() === 1 && (await page.locator('.wmap-pick b').innerText()).length > 0, await page.locator('.wmap-pick').innerText().catch(() => ''));
console.log('\n[ 세 칸(뜻 · 읽기 · 떠올리기) 따로 보기 ]');
{
  const cell = (id) => page.locator(`.wmap .wm-cell[data-id="${id}"]`);
  ok('지도 위에 칸 색 기준 단추 넷(세 칸 모두 · 뜻 · 읽기 · 떠올리기)', await page.locator('.wmap-facets button').count() === 4);
  ok('세 칸 모두 = 가장 낮은 칸(읽기 0)으로 칠한다', (await cell(kanjiW.id).getAttribute('class')).includes('s-round1'));
  await page.locator('.wmap-facets [data-facet="mean"]').click(); await page.waitForTimeout(200);
  ok('★ 뜻 기준 → 뜻 3단계 색 ★', (await cell(kanjiW.id).getAttribute('class')).includes('s-round3'), await cell(kanjiW.id).getAttribute('class'));
  await page.locator('.wmap-facets [data-facet="read"]').click(); await page.waitForTimeout(200);
  ok('★ 읽기 기준 → 읽기 0(확인 1단계 색) ★', (await cell(kanjiW.id).getAttribute('class')).includes('s-round1'));
  ok('★ 가나 단어는 읽기 칸 없음(빗금) ★', (await cell(kanaW.id).getAttribute('class')).includes('s-na'));
  await page.locator('.wmap-facets [data-facet="all"]').click(); await page.waitForTimeout(200);
  await cell(kanjiW.id).click(); await page.waitForTimeout(150);
  const fx = page.locator('.wmap-pick .wmap-fx li');
  const txt = await page.locator('.wmap-pick .wmap-fx').innerText();
  ok('★ 칸을 누르면 뜻 · 읽기 · 떠올리기가 따로 보인다 ★', await fx.count() === 3, txt.replace(/\s+/g, ' '));
  ok('뜻 확인 3번 · 읽기 확인 0번 · 떠올리기 확인 1번',
    (await fx.nth(0).innerText()).includes('확인 3번') && (await fx.nth(1).innerText()).includes('확인 0번') && (await fx.nth(2).innerText()).includes('확인 1번'));
  await cell(kanaW.id).click(); await page.waitForTimeout(150);
  ok('가나 단어는 「읽기: 가나 단어라 없음」', (await page.locator('.wmap-pick .wmap-fx li[data-facet="read"]').innerText()).includes('가나 단어라 없음'));
}

console.log('\n[ 가장 약한 TOP 10 · 반복 학습 ]');
const topRows = await page.locator('.wmap-top-row').count();
ok('★ 가장 약한 단어 TOP 10이 보인다 ★', topRows > 0 && topRows <= 10, `${topRows}줄`);
await page.locator('.wmap-top-row').first().click();
await page.waitForTimeout(150);
ok('줄을 누르면 그 낱말이 아래에 뜬다', await page.locator('.wmap-pick').count() === 1);
await page.locator('.wmap-top-go').click();
await page.waitForTimeout(1200);
ok('★ 「반복 학습」을 누르면 그 낱말들로 한 판이 열린다 ★', await page.locator('.studycard, .study.intro').count() >= 1);
ok('오류 없음', errors.length === 0, errors[0]);

await browser.close();
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
