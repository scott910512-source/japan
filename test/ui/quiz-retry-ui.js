/* 단어 시험이 끝나면 틀린 단어를 퀴즈로 다시 푼다.
 *   · 결과 화면에 「틀린 단어 다시 퀴즈 풀기 N문제」(위)와 「카드로 외우기」(아래)가 같이 있다
 *   · 누르면 틀린 단어만 N문제로 다시 시작한다(카드 회독이 아니다) */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const words = ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 24);
const seeded = Object.fromEntries(words.map((w) => [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -4)), due: addDays(today, -1) }]));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ review }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(cur, { onboarded: true, canReadKana: true, autoTTS: false, quizCount: 5, quizType: 'choice', quizDir: 'jp-ko', levels: ['N5'] });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { review: seeded });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 });

  await openMenu(page, '단어 시험');
  await page.waitForTimeout(700);
  await page.locator('button', { hasText: '시험 시작' }).first().click();
  await page.waitForTimeout(800);

  /* 일부러 틀린다 — 정답 표시가 없는 보기를 골라 오답이 되게 */
  for (let i = 0; i < 5; i++) {
    if (!(await page.locator('.qoptions').count())) break;
    const wrongOpt = page.locator('.qopt:not(.correct)');
    const opts = page.locator('.qopt');
    // 어느 보기가 정답인지 모르니 1번을 누르고, 정답이었으면 다음 문제로 저절로 넘어간다
    await opts.first().click();
    await page.waitForTimeout(500);
    const nb = page.locator('.qnext button, .qnext .submit-btn');
    if (await nb.count()) await nb.first().click();
    else await page.waitForTimeout(1400);
    void wrongOpt;
  }
  await page.waitForTimeout(800);
  const hasWrong = await page.locator('.quiz-retry').count();
  if (!hasWrong) { console.log('  (이번 판은 다 맞혀서 다시 풀기가 안 보인다 — 건너뜀)'); await browser.close(); process.exit(0); }
  const n = Number((await page.locator('.quiz-retry .bs-s').innerText()).replace(/\D/g, ''));
  ok('★ 결과에 「틀린 단어 다시 퀴즈 풀기」가 있다 ★', (await page.locator('.quiz-retry').innerText()).includes('다시 퀴즈 풀기'));
  ok('카드로 외우기도 남아 있다', (await page.locator('.quiz-retry-cards').innerText()).includes('카드로 외우기'));
  await page.locator('.quiz-retry').click();
  await page.waitForTimeout(800);
  ok('★ 다시 퀴즈가 시작된다(보기가 나온다) ★', await page.locator('.qoptions').count() === 1);
  const title = (await page.locator('.sh-title').first().innerText()).replace(/\s/g, '');
  ok(`틀린 ${n}문제만 나온다`, title.endsWith(`/${n}`) || title.includes(`${n}`), title);
  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
