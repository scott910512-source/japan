/* 「아직 못 읽어요」를 고른 사람에게만 학습 탭 맨 위에 완전기초 — 진짜 화면에서.
 *
 *   · 못 읽는 사람: 「처음이라면」 묶음이 맨 위, 완전기초 칸이 거기 있고 아래 「자료 더 보기」에는 또 없다. 눌러서 열린다
 *   · 읽을 수 있는 사람 · 안 물어본 사람: 화면이 그대로(완전기초는 「자료 더 보기」 안에 있다) */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

async function boot(browser, settings) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((patch) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    Object.assign(s, { onboarded: true, autoTTS: false }, patch);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  }, settings);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2800);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {});   // 서비스워커가 자료를 다 받아 둔 뒤에 끊는다(정해 둔 시간만 기다리면 느린 러너에서 화면 조각이 빠진다)
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  await goTab(page, '학습');
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 아직 못 읽어요 ]');
  const a = await boot(browser, { canReadKana: false });
  a.on('pageerror', (e) => errors.push(e.message));
  const groupsA = await a.locator('.menugroup').evaluateAll((els) => els.map((e) => e.dataset.group));
  ok('★ 「처음이라면」 묶음이 맨 위 ★', groupsA[0] === 'start', groupsA.join(','));
  ok('그 안에 완전기초 칸', await a.locator('.menugroup[data-group="start"] .menutile[data-menu="basics"]').count() === 1);
  ok('「자료 더 보기」에는 또 없다(두 번 안 보인다)', await a.locator('.menutile[data-menu="basics"]').count() === 1);
  ok('N3 학습하기는 그 아래에 그대로 있다', await a.locator('.menugroup[data-group="catalog"] .menutile[data-menu="n3"]').count() === 1);
  await a.locator('.menugroup[data-group="start"] .menutile[data-menu="basics"]').click();
  await a.waitForTimeout(900);
  ok('눌러서 완전기초가 열린다', (await a.locator('body').innerText()).includes('히라가나'));
  await a.close();

  console.log('\n[ 읽을 수 있어요 ]');
  const b = await boot(browser, { canReadKana: true });
  b.on('pageerror', (e) => errors.push(e.message));
  const groupsB = await b.locator('.menugroup').evaluateAll((els) => els.map((e) => e.dataset.group));
  ok('★ 「처음이라면」이 없다(화면 그대로) ★', !groupsB.includes('start'), groupsB.join(','));
  ok('완전기초는 「자료 더 보기」 안에 있다', await b.locator('.menugroup[data-group="more"] .menutile[data-menu="basics"]').count() === 1);
  await b.close();

  console.log('\n[ 안 물어본 사람 ]');
  const c = await boot(browser, { canReadKana: null });
  const groupsC = await c.locator('.menugroup').evaluateAll((els) => els.map((e) => e.dataset.group));
  ok('★ 「처음이라면」이 없다(옛 사용자 화면 그대로) ★', !groupsC.includes('start'), groupsC.join(','));
  await c.close();

  ok('화면 오류 없음', errors.length === 0, errors[0]);
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('CRASH:', e.message); process.exit(2); });
