/* 헌터 성장의 단어 회독 요약 — 진짜 화면에서.
 *
 *   · 오늘 탭 › 기록에 「단어 회독」 카드: 본 단어 · 외운 단어 · 아직 안 본 단어 + 레벨별 막대
 *   · 숫자는 내 학습의 「얼마나 했나」와 같다(같은 셈)
 *   · 「세부 보기」는 복습&내기록 탭으로 간다(세부는 거기서) */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';
import * as allWords from '../../src/data/allWords.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const WORDS = allWords.ALL_WORDS || allWords.default;
const N5 = WORDS.filter((w) => String(w.level).toUpperCase() === 'N5').map((w) => w.id);
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
/* 본 단어 12개: 그중 4개는 외운 것(단계 높음) */
const SEEN = 12; const MASTERED = 4;
const review = Object.fromEntries(N5.slice(0, SEEN).map((id, i) => [id, i < MASTERED
  ? { box: 5, level: 4, streak: 4, lastSeen: day(10), rounds: 5, seenAt: 1, due: day(-30) }
  : { box: 2, level: 1, streak: 1, lastSeen: day(2), rounds: 1, seenAt: 1, due: day(-1) }]));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((r) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, canReadKana: true, autoTTS: false });
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r));
  }, review);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 });

  console.log('\n[ 오늘 › 기록 › 단어 회독 ]');
  await goTab(page, '오늘');
  await page.getByRole('tab', { name: /^기록/ }).click();
  await page.waitForTimeout(500);
  const card = page.locator('.hunter-words');
  ok('★ 기록 탭에 단어 회독 카드가 있다 ★', await card.count() === 1 && await card.isVisible());
  const seen = Number(await card.getAttribute('data-seen'));
  const mastered = Number(await card.getAttribute('data-mastered'));
  ok('본 단어가 심은 수와 같다', seen === SEEN, `${seen}`);
  ok('외운 단어가 센다', mastered >= 1 && mastered <= MASTERED, `${mastered}`);
  ok('세 숫자(본 · 외운 · 아직 안 본)가 보인다', (await card.locator('.hunter-growth-numbers > div').count()) === 3);
  ok('레벨별 막대가 N5 · N4 · N3', (await card.locator('.hunter-levelbar').evaluateAll((els) => els.map((e) => e.dataset.level))).join() === 'N5,N4,N3');
  ok('N5 막대에 본 수가 적힌다', (await card.locator('.hunter-levelbar[data-level="N5"] small').innerText()).startsWith(`${SEEN} /`), await card.locator('.hunter-levelbar[data-level="N5"] small').innerText());
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('375px대에서 가로로 안 넘친다', !overflow);

  console.log('\n[ 세부는 복습&내기록에서 ]');
  await card.getByRole('button', { name: /세부 보기/ }).click();
  await page.waitForTimeout(800);
  ok('★ 세부 보기가 복습&내기록 탭을 연다 ★', await page.locator('.tabbar .tab.active[data-tab="me"]').count() === 1);
  const me = await page.locator('.screen.active').innerText();
  ok('거기에 기억 수준 · 판정 통계가 있다', me.includes('기억 수준') && me.includes('얼마나 했나'));
  ok('★ 내 학습의 「한 번이라도 본 것」과 같은 수 ★', new RegExp(`${seen}\\s*한 번이라도 본 것|한 번이라도 본 것[\\s\\S]{0,12}${seen}`).test(me) || me.replace(/\s+/g, ' ').includes(`${seen} 한 번이라도 본 것`), me.replace(/\s+/g, ' ').match(/\d+ 한 번이라도 본 것/)?.[0]);

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
