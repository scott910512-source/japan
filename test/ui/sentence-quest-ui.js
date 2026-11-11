/* 문장 퀘스트 — 진짜 화면에서.
 *
 *   · 오늘 퀘스트에 「문장 퀘스트」 줄(0 / 5)이 새로 배우기 뒤, 랜덤 테스트 앞에 있다
 *   · 누르면 새 문장 다섯 개가 회독 한 판으로 열린다(안 본 문장만)
 *   · 끝나면 「다음: 문장 만들기 연습」 → 오늘 배운 문장으로만 조립 → 마치면 마무리 카드
 *   · 「오늘은 건너뛰기」를 누르면 줄이 빠지고, 되돌릴 수 있다
 *   · 새로 배우기에는 문장 카드가 안 섞인다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';
import { allSentenceCards } from '../../src/lib/content.js';
import { chunksOf } from '../../src/data/allChunks.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const WORDS = allWords.ALL_WORDS || allWords.default;
const N5 = WORDS.filter((w) => String(w.level).toUpperCase() === 'N5').slice(0, 50);
const review = Object.fromEntries(N5.map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -6)), due: addDays(today, -1) }]));
const SENT_IDS = new Set(allSentenceCards().map((c) => c.id));

async function boot(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((rv) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false }));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
  }, review);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error('앱이 안 열렸어요');
  return page;
}
const quests = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').quests || null);
const rowText = async (page, title) => (await page.locator('.tdq-row', { hasText: title }).first().innerText()).replace(/\s+/g, ' ');

async function finishDeck(page) {
  let g = 0;
  while (g < 200 && !(await page.locator('.finish').count())) {
    g += 1;
    const intro = page.locator('.study.intro .bigstart'); if (await intro.count()) { await intro.click(); await page.waitForTimeout(400); continue; }
    if (!(await page.locator('.studycard').count())) { await page.waitForTimeout(300); continue; }
    await page.locator('.studycard').click().catch(() => {}); await page.waitForTimeout(150);
    const j = page.locator('.judgerow button', { hasText: '알아요' }).first();
    if (await j.count()) { await j.click().catch(() => {}); await page.waitForTimeout(250); }
  }
  return g;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 오늘 탭의 문장 퀘스트 줄 ]');
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(e.message));
  await goTab(page, '오늘');
  const rows = await page.locator('.tdq-row').allInnerTexts();
  const idx = (t) => rows.findIndex((r) => r.includes(t));
  ok('★ 문장 퀘스트 줄이 새로 배우기 뒤, 랜덤 테스트 앞에 있다 ★', idx('문장 퀘스트') > idx('새로 배우기') && idx('문장 퀘스트') < idx('오늘 랜덤 테스트') && idx('새로 배우기') >= 0, rows.map((r) => r.split('\n')[0]).join(' | '));
  const r0 = await rowText(page, '문장 퀘스트');
  ok('처음엔 0 / 5', /0\s*\/\s*5/.test(r0), r0);
  ok('★ 「오늘은 건너뛰기」가 줄 옆에 있다 ★', await page.locator('.tdq-skip').count() === 1);

  console.log('\n[ 새 문장 다섯 개를 배운다 ]');
  await page.locator('.tdq-row', { hasText: '문장 퀘스트' }).click();
  await page.waitForTimeout(1200);
  const intro = page.locator('.study.intro .bigstart'); if (await intro.count()) { await intro.click(); await page.waitForTimeout(500); }
  ok('회독 화면이 열린다', await page.locator('.study').count() >= 1);
  const q1 = await quests(page);
  ok('★ 오늘 배울 문장 다섯 개가 정해져 적힌다 ★', q1 && Array.isArray(q1.sentenceIds) && q1.sentenceIds.length === 5 && q1.sentenceIds.every((id) => SENT_IDS.has(id)), JSON.stringify(q1?.sentenceIds));
  const sess = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1') || '{}'));
  ok('★ 판은 그 다섯 문장뿐이다(안 본 문장만) ★', sess.queue?.length === 5 && sess.queue.every((id) => q1.sentenceIds.includes(id) && !review[id]), `${sess.queue?.length}장`);
  const g = await finishDeck(page);
  ok('완주 화면이 뜬다', await page.locator('.finish').count() === 1, `${g}걸음`);
  ok('★ 「다음: 문장 만들기 연습」이 첫째 버튼이다 ★', await page.locator('.fin-next').count() === 1 && (await page.locator('.fin-next').innerText()).includes('문장 만들기 연습'));

  console.log('\n[ 오늘 배운 문장으로만 조립 연습 ]');
  await page.locator('.fin-next').click();
  await page.waitForTimeout(1500);
  ok('조립 연습 화면이 열린다(탭 없이 퀘스트용)', await page.locator('.compose-quest').count() === 1 && await page.locator('.cmp-tabs').count() === 0);
  let solved = 0;
  for (let k = 0; k < 8 && !(await page.locator('.cmp-questdone').count()); k++) {
    if (await page.locator('.cmp-build').count()) {
      const id = await page.locator('.cmp-build').getAttribute('data-id');
      ok(`조립에 나온 문장은 오늘 정한 것(${k + 1}번째)`, q1.sentenceIds.includes(id), id);
      for (const c of chunksOf(id) || []) {
        const exact = new RegExp(`^\\s*${c.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
        await page.locator('.build-pool .build-tile').filter({ hasText: exact }).first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(300);
      solved += 1;
      if (await page.locator('.cmp-next').count()) { await page.locator('.cmp-next').click(); await page.waitForTimeout(400); }
    } else await page.waitForTimeout(400);
  }
  ok('★ 마무리 카드가 뜬다 ★', await page.locator('.cmp-questdone').count() === 1, `${solved}문장 조립`);
  ok('★ 마무리 카드에 「다음」(오늘의 N3나 랜덤 테스트)과 「홈으로」가 있다 ★', await page.locator('.cmp-questnext').count() === 1 && (await page.locator('.cmp-questdone button', { hasText: '홈으로' }).count()) === 1, await page.locator('.cmp-questnext').count() ? await page.locator('.cmp-questnext').innerText() : '다음 없음');
  await page.locator('.cmp-questdone button', { hasText: '홈으로' }).click().catch(() => {});
  await page.waitForTimeout(700);
  await goTab(page, '오늘');
  const r1 = await rowText(page, '문장 퀘스트');
  ok('★ 오늘 탭에서 5 / 5 마쳤어요로 바뀐다 ★', /5\s*\/\s*5/.test(r1) && r1.includes('배웠어요'), r1);
  ok('끝낸 줄에는 건너뛰기가 없다', await page.locator('.tdq-skip').count() === 0);
  await page.close();

  console.log('\n[ 오늘은 건너뛰기 ]');
  const p2 = await boot(browser);
  p2.on('pageerror', (e) => errors.push(e.message));
  await goTab(p2, '오늘');
  const before = await p2.locator('.tdq-row').count();
  await p2.locator('.tdq-skip').click();
  await p2.waitForTimeout(500);
  ok('★ 건너뛰면 줄이 빠진다 ★', await p2.locator('.tdq-row', { hasText: '문장 퀘스트' }).count() === 0 && await p2.locator('.tdq-row').count() === before - 1);
  ok('건너뛰었다고 알려 주고 되돌릴 수 있다', (await p2.locator('.tdq-skipped').innerText()).includes('건너뛰었어요') && await p2.locator('.tdq-undo').count() === 1);
  ok('건너뜀이 저장된다', (await quests(p2))?.sentenceSkip === true);
  await p2.locator('.tdq-undo').click();
  await p2.waitForTimeout(500);
  ok('★ 되돌리면 줄이 다시 나온다 ★', await p2.locator('.tdq-row', { hasText: '문장 퀘스트' }).count() === 1 && await p2.locator('.tdq-skipped').count() === 0);
  await p2.close();

  console.log('\n[ 새로 배우기에는 문장 카드가 안 섞인다 ]');
  const p3 = await boot(browser);
  p3.on('pageerror', (e) => errors.push(e.message));
  await goTab(p3, '오늘');
  await p3.locator('.tdq-row', { hasText: '새로 배우기' }).click();
  await p3.waitForTimeout(1200);
  const swap = p3.locator('.swapask .submit-btn'); if (await swap.count()) { await swap.click(); await p3.waitForTimeout(800); }
  const intro3 = p3.locator('.study.intro .bigstart'); if (await intro3.count()) { await intro3.click(); await p3.waitForTimeout(500); }
  const s3 = await p3.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1') || '{}'));
  ok('★ 새로 배우기 판에 문장 카드가 없다 ★', (s3.queue || []).length > 0 && s3.queue.every((id) => !SENT_IDS.has(id)), `${(s3.queue || []).length}장`);
  await p3.close();

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
