/* 중급자 109명 시험에서 나온 작은 문제 셋 — 진짜 화면에서.
 *
 *   A 오늘 화면 머리 밑 줄의 이름이 내가 고른 목표 레벨을 따른다(N4·N5인데 「JLPT N3」로 뜨던 것)
 *   B 오늘 퀘스트의 약점 퀴즈는 설정 화면 없이 바로 문제가 뜬다(객관식), 그만두면 설정이 아니라 온 곳으로 돌아간다
 *   C 쭉 퀴즈 소개: 한자·문법이 0일 때(목표 N3 이상) 어디서 배우는지 한 줄 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';
import { openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const today = todayKey();
const n5 = ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 40);
/* 앞 여섯은 세 번 몰라요(약점), 나머지는 외운 것 */
const seeded = Object.fromEntries(n5.map((w, i) => {
  if (i < 6) {
    let s; for (let k = 0; k < 3; k++) s = applyVerdict(s, VERDICT.UNKNOWN, addDays(today, -(5 - k)));
    return [w.id, s];
  }
  return [w.id, { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, 3) }];
}));

async function boot(browser, settings = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(({ review, settings }) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_optrev_open', '0');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false, levels: ['N5'] }, settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  }, { review: seeded, settings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ A 머리 밑 줄은 내 목표 레벨 이름 ]');
  for (const goal of ['N5', 'N4', 'N3']) {
    const page = await boot(browser, { goalLevel: goal });
    page.on('pageerror', (e) => errors.push(e.message));
    const lab = (await page.locator('.hg-lab').innerText()).trim();
    const pct = (await page.locator('.hg-pct').innerText()).trim();
    ok(`목표 ${goal} → 「JLPT ${goal}」`, lab === `JLPT ${goal}`, `${lab} · ${pct}`);
    if (goal !== 'N3') ok(`목표 ${goal}에서는 N3 준비도 %가 아니라 배운 단어 수`, /단어 배움/.test(pct) && !/%/.test(pct), pct);
    await page.close();
  }

  console.log('\n[ B 약점 퀴즈는 바로 시작 ]');
  /* 내 시험 설정은 직접 쓰기 · 한국어 → 일본어로 해 둔 사람 — 약점 퀴즈가 그걸 덮어쓰면 안 된다 */
  const b = await boot(browser, { goalLevel: 'N3', quizType: 'typing', quizDir: 'ko-jp' });
  b.on('pageerror', (e) => errors.push(e.message));
  const row = b.locator('.tdq-row', { hasText: '약점 퀴즈' });
  ok('오늘 퀘스트에 약점 퀴즈 줄이 있다(조건)', await row.count() === 1);
  await row.first().click();
  await b.locator('.qoptions .qopt').first().waitFor({ timeout: 3000 }).catch(() => {});
  ok('★ 설정 화면 없이 바로 문제가 뜬다 ★', await b.locator('.qoptions .qopt').count() >= 2 && await b.locator('.qz-fromlisten').count() === 0);
  ok('객관식(보기 4개 안팎)', [2, 3, 4, 5].includes(await b.locator('.qoptions .qopt').count()));
  ok('일본어를 보고 뜻을 고르는 판(일본어 → 한국어)', (await b.locator('.qc-tag').innerText()).includes('뜻을 고르세요'));
  const settingsAfter = await b.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}'));
  ok('★ 내 시험 설정(직접 쓰기 · 한→일)은 그대로 ★', settingsAfter.quizType === 'typing' && settingsAfter.quizDir === 'ko-jp', `${settingsAfter.quizType}/${settingsAfter.quizDir}`);
  await b.locator('.sh-close').first().click();
  await b.waitForTimeout(800);
  ok('★ 그만두면 설정 화면이 아니라 온 곳(오늘/내 학습)으로 돌아간다 ★', await b.locator('.qz-fromlisten').count() === 0 && await b.locator('.qoptions').count() === 0 && await b.locator('.tabbar').count() === 1);
  await b.close();

  console.log('\n[ C 쭉 퀴즈 소개의 한 줄 ]');
  const c = await boot(browser, { goalLevel: 'N3' });
  c.on('pageerror', (e) => errors.push(e.message));
  await openMenu(c, '쭉 퀴즈');
  await c.waitForTimeout(700);
  ok('★ 목표 N3, 한자·문법 0 → 안내 한 줄 ★', (await c.locator('.st-n3hint').innerText().catch(() => '')).includes('N3 학습하기'));
  await c.close();
  const d = await boot(browser, { goalLevel: 'N4' });
  d.on('pageerror', (e) => errors.push(e.message));
  await openMenu(d, '쭉 퀴즈');
  await d.waitForTimeout(700);
  ok('목표 N4에서는 안 뜬다(N3 코스가 목표가 아니다)', await d.locator('.st-n3hint').count() === 0);
  await d.close();

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
