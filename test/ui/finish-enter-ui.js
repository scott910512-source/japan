/* 끝 화면의 단축키 — Enter로 다음 단계로 넘어간다
 *
 *   · 카드 학습 끝 화면(오늘은 여기까지 · 완주): 가장 큰 단추에 Enter 표시가 있고, Enter를 누르면 그 단추와 같은 일을 한다
 *   · ←는 마지막 판정 되돌리기(카드로 돌아간다)
 *   · 약점 퀴즈 결과 화면의 「다음: ○○」에도 Enter 표시가 있고 Enter로 넘어간다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const WORDS = allWords.ALL_WORDS || allWords.default;
const N5 = WORDS.filter((w) => String(w.level).toUpperCase() === 'N5');
/* 복습 차례가 된 낱말 45개 + 약한 낱말 40개 — 양을 키운 기본값(복습 30 · 약점 30)이 다 채워진다 */
const due = N5.slice(0, 45);
const weak = N5.slice(45, 85);
const review = {
  ...Object.fromEntries(due.map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1) }])),
  ...Object.fromEntries(weak.map((w) => [w.id, { box: 1, streak: 0, lastSeen: addDays(today, -4), rounds: 3, wrongCount: 3, vagueCount: 1, seenAt: 1, due: addDays(today, 5) }])),
};

async function boot(browser, progress = null, extraSettings = {}) {
  /* 이 검사는 문장 퀘스트 말고의 흐름을 본다 — 오늘 문장 퀘스트는 건너뛴 것으로 심는다(문장 퀘스트는 sentence-quest-ui가 본다) */
  progress = { quests: { day: todayKey(), sentenceSkip: true }, ...(progress || {}) };
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ rv, progress, extraSettings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    /* 옛 설정(번호 없음, 복습 9 · 새로 8)에서 시작한다 — 새 수량으로 바뀌는지도 같이 본다 */
    const s = { onboarded: true, canReadKana: true, autoTTS: false, goals: { fresh: 8, review: 9, weak: 3 }, ...extraSettings };
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
    if (progress) localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(progress));
  }, { rv: review, progress, extraSettings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  /* 라이브 주소에서 돌릴 때는 서비스워커가 모든 화면 조각을 내려받을 시간을 준다(SW_WAIT=밀리초) */
  if (process.env.SW_WAIT) await page.waitForTimeout(Number(process.env.SW_WAIT));
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  const up = await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).then(() => true).catch(() => false);
  if (!up) throw new Error('앱이 안 열렸어요');
  return page;
}
const progressOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}'));
const rowText = async (page, title) => (await page.locator('.tdq-row', { hasText: title }).first().innerText()).replace(/\s+/g, ' ');

/* 시험을 끝까지 푼다 — 고르면 저절로 넘어가거나 「다음」이 뜬다 */
async function finishQuiz(page, cap = 140) {
  let steps = 0;
  while (steps < cap && await page.locator('.quizscore').count() === 0) {
    steps += 1;
    if (await page.locator('.qoptions').count()) { await page.locator('.qopt').first().click(); await page.waitForTimeout(260); }
    else if (await page.locator('.qtyping input').count()) {
      await page.locator('.qtyping input').fill('ㅋ'); await page.locator('.qtyping .submit-btn').click(); await page.waitForTimeout(260);
    }
    const nextBtn = page.locator('.qnext .submit-btn');
    if (await nextBtn.count()) { await nextBtn.click(); await page.waitForTimeout(220); } else await page.waitForTimeout(700);
  }
  return steps;
}

/* 회독 화면: 모두 「알아요」로 넘긴다 */
async function finishDeck(page) {
  let g = 0;
  while (g < 260 && !(await page.locator('.finish').count())) {
    g += 1;
    const go = page.locator('.study .st-go, .study .ph-btn, .study [data-verdict="known"], .study button.known').first();
    if (await page.locator('.study .start-btn, .study .intro-start, .study .study-start').count()) { await page.locator('.study .start-btn, .study .intro-start, .study .study-start').first().click(); await page.waitForTimeout(400); continue; }
    if (await go.count()) { await go.click(); await page.waitForTimeout(220); continue; }
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
    await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  }
  return g;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser, null, { goals: { fresh: 5, review: 6, weak: 2 }, goalsV: 3 });
  page.on('pageerror', (e) => errors.push(e.message));
  await goTab(page, '오늘');
  await page.locator('.bigcta').first().click();
  await page.waitForTimeout(1200);
  await finishDeck(page);

  console.log('\n[ 카드 학습 끝 화면 ]');
  ok('끝 화면이 뜬다', await page.locator('.finish').count() === 1);
  ok('★ 가장 큰 단추(다음: 약점 퀴즈)에 Enter 표시가 있다 ★', (await page.locator('.fin-next').innerText()).includes('약점 퀴즈') && await page.locator('.fin-next kbd').innerText() === 'Enter', await page.locator('.fin-next').innerText());
  ok('되돌리기에는 ← 표시가 있다', await page.locator('.fin-undo kbd').innerText() === '←');

  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(700);
  ok('★ ←를 누르면 마지막 판정을 되돌려 카드로 돌아간다 ★', await page.locator('.finish').count() === 0 && await page.locator('.study').count() === 1);
  await finishDeck(page);
  ok('다시 끝내면 끝 화면이 또 뜬다', await page.locator('.finish').count() === 1);

  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  ok('★ Enter를 누르면 다음 단계(약점 퀴즈)가 바로 열린다 ★', await page.locator('.finish').count() === 0 && await page.locator('.qoptions, .qtyping').count() >= 1, (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80));

  console.log('\n[ 약점 퀴즈 결과 화면 ]');
  await finishQuiz(page, 200);
  ok('약점 퀴즈 결과가 뜬다', await page.locator('.wk-result').count() === 1);
  const nextText = await page.locator('.wk-next').innerText().catch(() => '');
  ok('★ 「다음: ○○」에 Enter 표시가 있다 ★', nextText.includes('다음:') && await page.locator('.wk-next kbd').count() === 1, nextText);
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  ok('★ Enter를 누르면 다음 단계로 넘어간다(결과 화면이 닫힌다) ★', await page.locator('.wk-result').count() === 0 && await page.locator('.stream, .study, .qoptions, .subscreen.open').count() >= 1, (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 80));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
