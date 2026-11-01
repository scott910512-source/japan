import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { questionById } from '../../src/lib/n3.js';
import { goTab } from './_nav.js';
const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
let pass = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const settings = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ ...settings, onboarded: true, canReadKana: true, autoTTS: false }));
  });
  await page.waitForTimeout(900); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
  await context.setOffline(true); await page.locator('.gate-offline').waitFor({ timeout: 15000 }); await page.locator('.gate-offline').click();
  await page.getByRole('button', { name: '↗ 레벨 진단', exact: true }).click();
  await page.locator('.n3-quiz').waitFor();
  const id = await page.locator('.n3-quiz').getAttribute('data-qid'); const q = questionById(id);
  const chosen = q.options.find((option) => option !== q.answer);
  await page.locator('.n3-opts .qopt').nth(q.options.indexOf(chosen)).click();
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').mistakes || {});
  await page.waitForTimeout(100);
  let book = await read();
  assert.equal(book[`n3:${id}`].wrongChosen, chosen); assert.equal(book[`n3:${id}`].correct, q.answer); pass += 2;
  await goTab(page, '오늘', 100);
  const notebook = page.locator('.screen.active .mistake-notebook');
  await notebook.locator('.mistake-start').click();
  await notebook.getByRole('button', { name: q.answer, exact: true }).click();
  assert.match(await notebook.locator('.mistake-feedback').innerText(), /맞았어요/); pass++;
  book = await read(); assert.equal(book[`n3:${id}`].resolved, false); assert.equal(book[`n3:${id}`].wrongChosen, chosen); pass += 2;
  await notebook.getByRole('button', { name: '재시험 마치기', exact: true }).click();
  await notebook.getByRole('button', { name: '기록 보기', exact: true }).click();
  assert.match(await notebook.locator('.mistake-list').innerText(), new RegExp(chosen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); pass++;
  if (process.env.HUNTER_SCREENSHOTS) await notebook.screenshot({ path: '.qa/mistake-notebook.png' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.gate-offline').waitFor({ timeout: 15000 }); await page.locator('.gate-offline').click();
  book = await read(); assert.equal(book[`n3:${id}`].wrongChosen, chosen); pass++;
  await page.getByRole('button', { name: '↗ 레벨 진단', exact: true }).click();
  await page.locator('.n3-quiz').waitFor();
  assert.equal(await page.locator('.n3-quiz').getAttribute('data-qid'), id); pass++;
  assert.deepEqual(errors, []); pass++;
  console.log(`통과 ${pass} / 실패 0`);
} catch (error) { console.error(error); console.log(`통과 ${pass} / 실패 1`); process.exitCode = 1; }
finally { await browser.close(); }

