/* 약점 한 곳 + 오늘 퀘스트의 약점 퀴즈 — 진짜 화면에서.
 *
 *   · 오늘 퀘스트에 「약점 퀴즈」가 뜬다(약한 낱말이 있을 때만)
 *   · 누르면 약한 낱말 다섯으로 단어 시험이 열린다. 푼 만큼 퀘스트가 오른다
 *   · 약점을 보는 곳은 한 화면: 복습&내기록 › 약점, 복습 화면 › 약점이 같은 곳을 연다
 *   · 복습 화면에 「취약 단어」 「취약 문법」 줄이 따로 없다
 *   · 약한 게 없으면 줄이 안 뜨고 약점 줄은 잠긴다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';

/* 실제 단어 id여야 약점으로 잡힌다 — 기본 레벨(N5)의 앞 낱말들 */
const N5_IDS = (allWords.ALL_WORDS || allWords.default).filter((w) => String(w.level).toUpperCase() === 'N5').map((w) => w.id);

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const weakReview = (n) => Object.fromEntries(N5_IDS.slice(0, n).map((id) => [
  id, { box: 1, streak: 0, lastSeen: day(4), rounds: 3, wrongCount: 3, vagueCount: 1, seenAt: 1 },
]));

async function boot(browser, review) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((r) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    if (r) localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r));
  }, review);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error('앱이 안 열렸어요');
  return page;
}
const progressOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}'));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 오늘 퀘스트의 약점 퀴즈 ]');
  const page = await boot(browser, weakReview(8));
  page.on('pageerror', (e) => errors.push(e.message));
  await goTab(page, '오늘');
  const quest = page.locator('.tdq-row', { hasText: '약점 퀴즈' });
  ok('★ 퀘스트에 「약점 퀴즈」 줄이 있다 ★', await quest.count() === 1);
  ok('처음엔 0 / 5이고 남은 문제 수가 적힌다', (await quest.innerText()).includes('5문제 남았어요'), (await quest.innerText()).replace(/\s+/g, ' '));

  await quest.click();
  await page.waitForTimeout(1000);
  ok('★ 눌러서 단어 시험이 열린다 ★', (await page.locator('.subscreen.open .sub-title').innerText().catch(() => '')).includes('단어 시험'));
  const start = page.locator('button', { hasText: '시험 시작' }).first();
  if (await start.count()) { await start.click(); await page.waitForTimeout(900); }
  ok('시험이 시작된다', await page.locator('.qoptions').count() === 1);
  ok('★ 다섯 문제다 ★', /\/\s*5/.test((await page.locator('.subscreen.open').innerText()).replace(/\s+/g, ' ')), (await page.locator('.subscreen.open').innerText()).replace(/\s+/g, ' ').slice(0, 60));

  let steps = 0;
  while (steps < 30 && await page.locator('.quizscore').count() === 0) {
    steps += 1;
    if (await page.locator('.qoptions').count()) { await page.locator('.qopt').first().click(); await page.waitForTimeout(420); }
    const nextBtn = page.locator('.qnext .submit-btn');
    if (await nextBtn.count()) { await nextBtn.click(); await page.waitForTimeout(350); } else await page.waitForTimeout(900);
  }
  ok('결과 화면이 뜬다', await page.locator('.quizscore').count() === 1, `${steps}걸음`);
  const pg = await progressOf(page);
  ok('★ 푼 낱말 다섯이 오늘 몫에 적힌다 ★', pg.weakQuiz && pg.weakQuiz.ids && pg.weakQuiz.ids.length === 5, JSON.stringify(pg.weakQuiz));

  await goTab(page, '오늘');
  const done = page.locator('.tdq-row', { hasText: '약점 퀴즈' });
  ok('★ 퀘스트가 완료로 바뀐다 ★', (await done.innerText()).includes('마쳤어요') && await done.evaluate((e) => e.classList.contains('complete')), (await done.innerText()).replace(/\s+/g, ' '));
  ok('콘솔 오류 없음(시험 중)', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');

  console.log('\n[ 약점은 한 화면 ]');
  await goTab(page, '내 학습');
  const meRow = page.locator('.me-row[data-row="weak"]');
  ok('복습&내기록에 약점 줄과 개수', await meRow.count() === 1 && Number(await meRow.locator('.rv-cnt').innerText()) > 0, await meRow.locator('.rv-cnt').innerText());
  await meRow.click();
  await page.waitForTimeout(800);
  ok('제목이 약점', (await page.locator('.subscreen.open .sub-title').innerText()).includes('약점'));
  ok('합계 카드', await page.locator('.wk-sum').count() === 1);
  ok('★ 약점 퀴즈 · 외우기 · 문법 세 가지가 한 화면에 ★', await page.locator('.wk-quiz').count() === 1 && await page.locator('.wk-deck').count() === 1 && await page.locator('.wk-grammar').count() === 1);
  ok('약점 장부(왜 약한지)가 같은 화면에 있다', await page.locator('.subscreen.open .wb-row').count() > 0);
  ok('오늘 몫을 마쳤다고 알린다', (await page.locator('.wk-quizsub').innerText()).includes('마쳤어요'));
  ok('취약 문법이 없으니 문법 버튼은 잠겨 있다', await page.locator('.wk-grammar:disabled').count() === 1);
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);

  console.log('\n[ 복습 화면에서도 같은 곳 ]');
  await page.locator('.me-row[data-row="review"]').click();
  await page.waitForTimeout(700);
  ok('★ 복습 화면에 취약 단어 · 취약 문법 줄이 따로 없다 ★', await page.locator('.rv-row[data-row="weak-words"], .rv-row[data-row="weak-grammar"]').count() === 0);
  ok('★ 복습 화면에 약점 장부도 없다(약점 화면으로 옮겼다) ★', await page.locator('.subscreen.open .wb-card').count() === 0);
  ok('복습 화면은 줄 넷: 오답노트 · 약점 · 문장 복습 · 전체 복습', await page.locator('.rv-row').count() === 4, `${await page.locator('.rv-row').count()}줄`);
  await page.locator('.rv-row[data-row="weak"]').click();
  await page.waitForTimeout(700);
  ok('★ 같은 약점 화면이 열린다 ★', await page.locator('.wk-sum').count() === 1);
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);
  ok('뒤로 가면 복습 화면', await page.locator('.rv-top').count() === 1);
  await page.close();

  console.log('\n[ 약한 게 없을 때 ]');
  const empty = await boot(browser, null);
  empty.on('pageerror', (e) => errors.push(e.message));
  await goTab(empty, '오늘');
  ok('★ 퀘스트에 약점 퀴즈 줄이 없다 ★', await empty.locator('.tdq-row', { hasText: '약점 퀴즈' }).count() === 0);
  await goTab(empty, '내 학습');
  ok('약점 숫자 0', (await empty.locator('.me-row[data-row="weak"] .rv-cnt').innerText()) === '0');
  await empty.locator('.me-row[data-row="weak"]').click();
  await empty.waitForTimeout(700);
  ok('퀴즈 버튼은 잠겨 있고 이유를 말한다', await empty.locator('.wk-quiz:disabled').count() === 1 && (await empty.locator('.wk-quizsub').innerText()).includes('아직 없어요'));
  await empty.close();

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
