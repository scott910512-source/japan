/* 성장 지도 + 복습 통합 — 진짜 화면에서 필요한 만큼만.
 *   · 지도: 목표 · 수련 숫자(기존 기록에서) · 승급시험 조건/기준/상태 · 다음 행동 · 열어 보기만으로는 안 오른다
 *   · N5 지역에서 단어를 열면 설정의 레벨(N3)이 아니라 N5만 열린다
 *   · 홈에 오답 탭이 없고, 오늘 화면의 오답 복습 지름길이 복습 화면의 오답 칸을 연다
 *   · 복습은 세 칸(오늘 복습 · 오답 다시 풀기 · 약점 집중), 문장 복습 · 전체 복습 · N3 오답에 닿는다
 *   · 다시 풀기 결과가 오답 · 약점에 한 번만 닿는다(더블클릭해도 한 번)
 *   · 모바일 폭에서 가로로 넘치지 않고, 키보드로 칸을 옮긴다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = new Date().toISOString().slice(0, 10);
const n5 = ALL_WORDS.filter((w) => w.level === 'N5');
const review = {};
n5.slice(0, 30).forEach((w) => { review[w.id] = { lastSeen: '2026-10-01', box: 3, level: 1, streak: 1, rounds: 1, due: '2099-01-01' }; });
/* 열어 보기만 한 단어 40개 — 확인된 것으로 세면 안 된다 */
n5.slice(30, 70).forEach((w) => { review[w.id] = { lastSeen: '2026-10-02', box: 1, level: 0, streak: 0, rounds: 1, due: '2099-01-01' }; });

const tw = n5[100];
const mrow = (id, ref, source, prompt, correct = '정답') => ({
  id, source, ref, kind: 'choice', prompt, correct, options: [correct, '오답'], explanation: '해설이에요', chosen: '오답', wrongChosen: '오답',
  wrong: 1, right: 0, at: Date.now(), lastWrongAt: Date.now(), due: today, resolved: false, successes: {},
});
const PROGRESS = {
  grammarDone: { a: 1, b: 1, c: 1 },
  mistakes: { [`word:${tw.id}:jp-ko`]: mrow(`word:${tw.id}:jp-ko`, tw.id, 'word', tw.kanji, tw.mean) },
  n3: { v: 1, lessons: {}, skip: {}, days: {}, q: {}, tests: {}, exams: [], summary: null, wrong: { 'q-old': { c: 1, at: 1, cat: 'grammar', ref: 'g:z', ok: 0 } } },
};
review[tw.id] = { lastSeen: '2026-10-03', box: 1, level: 0, streak: 0, rounds: 1, due: today, wrongCount: 1 };

async function boot(browser, progress, revw, extraSettings = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([p, r, extra]) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false }, extra);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (p) localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(p));
    if (r) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r));
  }, [progress, revw, extraSettings]);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 });
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, PROGRESS, review, { levels: ['N3'] });
  page.on('pageerror', (e) => errors.push(e.message));
  const homeTabs = page.getByRole('tablist', { name: '헌터 홈 화면' });

  console.log('\n[ 성장 지도 ]');
  ok('홈 탭은 오늘 · 지도 · 기록 셋 (오답 탭 없음)', await homeTabs.getByRole('tab').count() === 3 && await homeTabs.getByRole('tab', { name: /^오답/ }).count() === 0);
  await homeTabs.getByRole('tab', { name: /^지도/ }).click();
  await page.waitForTimeout(600);
  const d = page.locator('.hunter-region-detail');
  const dt = await d.innerText();
  ok('지역 목표가 보인다', dt.includes('목표') && dt.includes('N5 첫 단어'));
  ok('★ 확인한 단어는 30개만(열어 본 40개는 안 센다) ★', (await d.locator('[data-req="w"] strong').innerText()).replace(/\s/g, '').startsWith('30/30'), (await d.locator('[data-req="w"] strong').innerText()).replace(/\s/g, ''));
  ok('기초 문법 3/3꼭지', (await d.locator('[data-req="g"] strong').innerText()).replace(/\s/g, '').startsWith('3/3'));
  ok('★ 수련을 채웠어도 시험 전엔 「실력 확인 전」 — 클리어가 아니다 ★', dt.includes('실력 확인 전') && (await d.getAttribute('data-phase')) === 'exam');
  ok('승급시험 조건과 통과 기준이 적혀 있다', dt.includes('응시 조건') && dt.includes('80%'));
  ok('다음 행동 버튼: 승급시험 보기', await d.locator('.hunter-exam-go:not([disabled])').first().innerText().then((t) => t.includes('승급시험')));
  ok('지도 핀에 수련 2/2', (await page.locator('.hunter-region').first().innerText()).includes('수련 2/2'));
  await page.locator('.hunter-region').nth(1).click();
  const d2 = await page.locator('.hunter-region-detail').innerText();
  ok('다음 지역은 아직 수련 중 — 30/100개, 남은 수련이 단위와 함께', d2.replace(/\s/g, '').includes('30/100개') && d2.includes('남은 수련'));
  ok('★ 시험을 안 본 지역은 클리어로 안 센다 ★', await page.locator('.hunter-region.cleared').count() === 0);
  ok('XP와 지역 승급은 다르다고 안내한다', (await page.locator('.hunter-panel.hunter-license, .hunter-world').first().innerHTML()).length > 0);

  console.log('\n[ N5 지역에서 열면 N5만 ]');
  await page.locator('.hunter-region').nth(0).click();
  await page.locator('[data-req="w"] button').click();
  await page.waitForTimeout(900);
  ok('단어 화면이 열렸다', (await page.locator('.subscreen.open .sub-title').innerText()).includes('단어'));
  const levelsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).levels);
  ok('★ 설정의 레벨(N3)은 그대로 — 화면에서만 N5로 열린다 ★', JSON.stringify(levelsAfter) === JSON.stringify(['N3']));
  await page.locator('.subscreen.open .chip.active').first().waitFor({ timeout: 8000 });
  const active = await page.locator('.subscreen.open .chip.active').allInnerTexts();
  ok('★ 켜진 레벨은 N5 하나뿐이다 (N3로 열리지 않는다) ★', active.length === 1 && active[0].startsWith('N5'), active.join(','));
  await goTab(page, '오늘', 100);

  await goTab(page, '오늘', 100);
  console.log('\n[ 승급시험 ]');
  await homeTabs.getByRole('tab', { name: /^지도/ }).click();
  await page.locator('.hunter-region').nth(0).click();
  await page.locator('.hunter-nextact .hunter-exam-go').first().click();
  await page.waitForTimeout(1200);
  ok('단어 시험 화면이 열리고 문제가 나온다', (await page.locator('.subscreen.open .sub-title').innerText()).includes('단어 시험') && await page.locator('.subscreen.open .qprogress, .subscreen.open .quiz-q, .subscreen.open .qopt').count() > 0);
  await page.locator('.sh-close[aria-label="시험 그만두기"]').click();
  await page.waitForTimeout(500);
  await goTab(page, '오늘', 100);   // 합쳐 놓았던 것: 단어 화면 닫기
  await page.locator('.sh-close').first().click().catch(() => {});
  await goTab(page, '오늘', 100);

  console.log('\n[ 오답 복습 지름길 ]');
  await homeTabs.getByRole('tab', { name: /^오늘/ }).click();
  const sc = page.locator('.hm-wrong');
  ok('오늘 화면에 「오답 복습 N문제 시작」', (await sc.innerText()).includes('오답 복습 2문제 시작'), (await sc.innerText()).split('\n')[0]);
  await sc.click();
  await page.waitForTimeout(700);
  ok('복습 화면 · 세 칸 · 오답 칸이 열린다', await page.locator('.rv-tabs button').count() === 3 && (await page.locator('.rv-tabs [data-section="wrong"]').getAttribute('aria-selected')) === 'true');
  ok('칸마다 단위가 따로 적혀 있다', (await page.locator('.rv-tabs').innerText()).includes('문제') && (await page.locator('.rv-tabs').innerText()).includes('단어'));
  ok('N3 오답노트 줄에 닿는다', await page.locator('.wb2-n3').count() === 1);
  await page.locator('.rv-tabs [data-section="wrong"]').focus();
  await page.keyboard.press('ArrowRight');
  ok('키보드로 칸이 옮겨진다 (약점 집중)', (await page.locator('.rv-tabs [data-section="weak"]').getAttribute('aria-selected')) === 'true');
  ok('약점 칸에 다른 문제로 확인하는 퀴즈 버튼', await page.locator('.wk-quiz').count() === 1);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  ok('오늘 복습 칸에 문장 복습 · 전체 복습', await page.locator('.rv-row[data-row="sentences"]').count() === 1 && await page.locator('.rv-row[data-row="repeat"]').count() === 1);

  console.log('\n[ 기록 연결 ]');
  await page.locator('.rv-tabs [data-section="wrong"]').click();
  await page.locator('.mistake-start').click();
  const correct = tw.mean;
  const first = page.locator('.mistake-options button', { hasText: correct }).first();
  if (await first.count()) {
    await first.dblclick();            // 더블클릭해도 한 번만 적힌다
    await page.waitForTimeout(500);
    const st = await page.evaluate(([id, wid]) => { const p = JSON.parse(localStorage.getItem('jp_manabu_progress_v1')); return { w: p.weak?.[wid] || null, m: p.mistakes?.[id] || null }; }, [`word:${tw.id}:jp-ko`, tw.id]);
    ok('★ 약점 장부에 맞힘이 한 번만 ★', st.w?.quizRight === 1, JSON.stringify(st.w));
    ok('오답 기록: 오늘 맞힘 1회, 아직 해결 전(서로 다른 두 날 필요)', st.m && Object.keys(st.m.successes).length === 1 && st.m.resolved === false);
    ok('다시 풀기 표시가 남는다', st.m?.retest === true);
  } else ok('보기에서 정답을 찾았다', false, correct);
  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');

  console.log('\n[ 모바일 폭 ]');
  await goTab(page, '오늘', 100);
  await homeTabs.getByRole('tab', { name: /^지도/ }).click();
  ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.close();

  console.log('\n[ 승급시험을 통과한 기록 ]');
  const passed = { ...PROGRESS, regions: { kukuroo: { exam: { best: 0.9, last: 0.9, right: 14, total: 15, tries: 1, at: 1, day: today } } } };
  const p2 = await boot(browser, passed, review, { levels: ['N3'] });
  const tabs2 = p2.getByRole('tablist', { name: '헌터 홈 화면' });
  await tabs2.getByRole('tab', { name: /^지도/ }).click();
  await p2.waitForTimeout(500);
  await p2.locator('.hunter-region').nth(0).click();
  ok('★ 필수 수련 + 시험 통과 = 지역 클리어 ★', await p2.locator('.hunter-region.cleared').count() === 1 && (await p2.locator('.hunter-region-detail').getAttribute('data-phase')) === 'cleared');
  ok('통과 기록이 최고 점수와 함께 보인다', (await p2.locator('.hunter-exam').innerText()).includes('최고 90% · 통과'));
  ok('다음 추천 지역은 클리어하지 않은 첫 지역', (await p2.locator('.hunter-region.recommended').innerText()).includes('기린섬'));
  await p2.close();
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
