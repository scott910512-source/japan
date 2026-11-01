/* Real app: map routes, reward derivation, image fallback, saved guide, responsive home. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { goTab } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
let pass = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const settings = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ ...settings, onboarded: true, canReadKana: true, autoTTS: false }));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify({ 'n5-0001': { lastSeen: '2026-10-01', box: 3, level: 1, streak: 1, rounds: 1, due: '2026-10-02' } }));
  });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await context.setOffline(true);
  await page.locator('.gate-offline').waitFor({ timeout: 15000 });
  await page.locator('.gate-offline').click();
  await page.locator('.hunter-home').waitFor();
  assert.equal(await page.locator('.hunter-region').count(), 6); pass++;
  assert.match(await page.locator('.hunter-license').innerText(), /10 \/ 100 XP/); pass++;
  assert.equal(await page.locator('.tabbar .tab').count(), 4); pass++;
  for (let i = 0; i < 6; i++) {
    await page.locator('.hunter-region').nth(i).click();
    assert.equal(await page.locator('.hunter-region-missions button').count(), 3);
    assert.equal(await page.locator('.hunter-region').nth(i).getAttribute('aria-pressed'), 'true'); pass++;
  }
  await page.locator('.hunter-region').nth(2).click();
  await page.locator('.hunter-region-missions button').filter({ hasText: '한자 구조' }).click();
  await page.locator('.n3-curriculum').waitFor();
  assert.equal(await page.locator('.n3-curriculum').count(), 1); pass++;
  await goTab(page, '오늘', 100);
  await page.getByRole('button', { name: '↗ 레벨 진단', exact: true }).click();
  await page.locator('.n3-test[data-test="t:ch0"]').waitFor(); pass++;
  await goTab(page, '오늘', 100);
  await page.locator('.hunter-guides button').filter({ hasText: '키르아' }).click();
  assert.match(await page.locator('.hunter-welcome').innerText(), /키르아/); pass++;
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).hunterGuide), 'killua'); pass++;
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  assert.equal(await page.locator('.hunter-badges .earned, .hunter-badges .locked').count(), 6); pass++;
  assert.equal(await page.locator('.hunter-welcome img').count(), 1); pass++;
  await context.setOffline(false);
  // Force an actual asset load after the offline check and keep screenshots optional in CI.
  await page.locator('.hunter-guides button').filter({ hasText: /^곤$/ }).click();
  if (process.env.HUNTER_SCREENSHOTS) {
    await page.locator('.hunter-welcome img').waitFor();
    await page.waitForFunction(() => document.querySelector('.hunter-welcome img')?.naturalWidth > 0, null, { timeout: 15000 });
    mkdirSync('.qa', { recursive: true });
    await page.locator('.screen.active').evaluate((el) => { el.scrollTop = 0; });
    await page.screenshot({ path: '.qa/hunter-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.qa/hunter-mobile.png' });
    await page.locator('.hunter-shortnav button').filter({ hasText: '학습 지도' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: '.qa/hunter-map-mobile.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); pass++;
  }
  assert.deepEqual(errors, []); pass++;
  console.log(`통과 ${pass} / 실패 0`);
} catch (error) { console.error(error); console.log(`통과 ${pass} / 실패 1`); process.exitCode = 1; }
finally { await browser.close(); }
