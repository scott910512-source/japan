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
  /* 서비스워커가 코스 자료(N3 조각)까지 미리 받아 둘 시간을 준다 — 짧으면 오프라인에서 N3 화면이 안 뜬다 */
  await page.waitForTimeout(6000); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {}); await context.setOffline(true); await page.locator('.gate-offline').waitFor({ timeout: 15000 }); await page.locator('.gate-offline').click();
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
  /* 홈에는 오답 탭이 없다 — 오늘 화면의 「오답 복습 N문제 시작」 지름길이 복습 화면의 오답 칸을 연다 */
  assert.equal(await page.getByRole('tab', { name: /^오답/ }).count(), 0); pass++;
  await page.locator('.hm-wrong').click();
  await page.locator('.subscreen.open .rv-tabs').waitFor();
  assert.equal(await page.locator('.rv-tabs [data-section="wrong"]').getAttribute('aria-selected'), 'true'); pass++;
  const notebook = page.locator('.subscreen.open .mistake-notebook');
  await notebook.locator('.mistake-start').click();
  await notebook.getByRole('button', { name: q.answer, exact: true }).click();
  assert.match(await notebook.locator('.mistake-feedback').innerText(), /맞았어요/); pass++;
  book = await read(); assert.equal(book[`n3:${id}`].resolved, false); assert.equal(book[`n3:${id}`].wrongChosen, chosen); pass += 2;
  /* 기록 연결 — 같은 N3 문제의 코스 오답 기록에도 한 번만 닿는다(연속 정답 1) */
  const n3wrong = await page.evaluate((qid) => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').n3?.wrong?.[qid] || null, id);
  assert.equal(n3wrong?.ok, 1); pass++;
  assert.equal(book[`n3:${id}`].retest, true); pass++;
  await notebook.getByRole('button', { name: '재시험 마치기', exact: true }).click();
  await notebook.getByRole('button', { name: '기록 보기', exact: true }).click();
  assert.match(await notebook.locator('.mistake-list').innerText(), new RegExp(chosen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); pass++;
  if (process.env.HUNTER_SCREENSHOTS) await notebook.screenshot({ path: '.qa/mistake-notebook.png' });
  await page.locator('.subscreen.open .sub-back').click();   // 복습 화면을 닫고 홈으로 — 다시 켰을 때 홈에서 시작한다
  // Reload online first, then emit the offline transition after the new Gate has
  // mounted. Loading offline from the outset can miss that transition in CI.
  await context.setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => Promise.race([navigator.serviceWorker?.ready, new Promise((r) => setTimeout(r, 20000))])).catch(() => {}); await context.setOffline(true);
  await page.locator('.hunter-home, .gate-offline').first().waitFor({ timeout: 25000 }).catch(async (error) => {
    throw new Error(`Reload did not reach the app: ${(await page.locator('body').innerText()).slice(0, 400)}`, { cause: error });
  });
  if (await page.locator('.gate-offline').isVisible()) await page.locator('.gate-offline').click();
  await page.locator('.hunter-home').waitFor({ timeout: 20000 });
  book = await read(); assert.equal(book[`n3:${id}`].wrongChosen, chosen); pass++;
  await page.getByRole('button', { name: '↗ 레벨 진단', exact: true }).click();
  await page.locator('.n3-quiz').waitFor();
  assert.equal(await page.locator('.n3-quiz').getAttribute('data-qid'), id); pass++;
  assert.deepEqual(errors, []); pass++;
  console.log(`통과 ${pass} / 실패 0`);
} catch (error) { console.error(error); console.log(`통과 ${pass} / 실패 1`); process.exitCode = 1; }
finally { await browser.close(); }

