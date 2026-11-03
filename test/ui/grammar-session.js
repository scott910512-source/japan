import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { conjugate, FORM_LABELS } from '../../src/lib/conjugate.js';

const localChrome = '/opt/pw-browsers/chromium';
const chrome = process.env.CHROMIUM || (existsSync(localChrome) ? localChrome : undefined);
let pass = 0;
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(process.env.APP_URL || 'http://localhost:8932/japan/', { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.gate, .tabbar').first().waitFor();
  await page.context().setOffline(true);
  if (!(await page.locator('.tabbar').isVisible())) {
    await page.locator('.gate-offline').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('.gate-offline').click();
  }
  await page.locator('.tabbar').waitFor();
  await openMenu(page, '문법');
  await page.locator('.gram-card').first().click();
  const run = page.locator('.grammar-session');
  const readProgress = () => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}'));
  const question = async () => {
    const prompt = await run.locator('.quiz-q').textContent();
    const [, kanji, kana, label] = prompt.match(/^(.+)\(([^)]+)\)의 (.+)은\?$/);
    const word = ALL_WORDS.find((w) => (w.kanji || w.kana) === kanji && w.kana === kana);
    assert.ok(word, prompt);
    const form = Object.keys(FORM_LABELS).find((key) => FORM_LABELS[key] === label);
    const answer = conjugate(word.kana, String(word.group))[form];
    const options = await run.locator('.quiz-opt').allTextContents();
    assert.equal(new Set(options.map((o) => o.trim())).size, options.length);
    return { prompt, answer, options };
  };
  const answerQuestion = async (wrong) => {
    const q = await question();
    const value = wrong ? q.options.find((s) => s !== q.answer) : q.answer;
    await run.getByRole('button', { name: value, exact: true }).click();
    assert.ok(await run.locator('.quiz-opt').first().isDisabled());
    await run.locator('.swap-btn').click();
    return q.prompt;
  };
  const prompts = [];
  for (let i = 0; i < 10; i++) {
    assert.ok((await run.locator('.grammar-quiz-progress').textContent()).includes(`현재 ${i + 1} / 10문제`));
    prompts.push(await answerQuestion(i < 2));
  }
  assert.equal(new Set(prompts).size, 10); pass++;
  assert.equal(await run.getAttribute('data-phase'), 'result');
  assert.match(await run.locator('.grammar-result').textContent(), /정답 8개 · 오답 2개 · 80점/); pass++;
  assert.equal(await run.locator('.quiz-q').count(), 0); pass++;
  assert.equal((await readProgress()).grammarDone.tense, 10); pass++;
  const mistakes = Object.values((await readProgress()).mistakes || {}).filter((m) => m.source === 'grammar');
  assert.equal(mistakes.length, 2); assert.ok(mistakes.every((m) => m.chosen && m.correct && !m.resolved)); pass++;
  const resultTop = await run.locator('.grammar-result').boundingBox();
  assert.ok(resultTop.y >= 0 && resultTop.y < 400); pass++;
  if (process.env.GRAMMAR_SCREENSHOTS) await page.screenshot({ path: '.qa/grammar-ten-result.png' });
  await run.getByRole('button', { name: '틀린 문제 2개만 복습', exact: true }).click();
  assert.equal(await run.getAttribute('data-review'), 'true');
  assert.ok((await run.locator('.grammar-quiz-progress').textContent()).includes('현재 1 / 2문제')); pass++;
  assert.ok(prompts.slice(0, 2).includes(await answerQuestion(true)));
  assert.ok(prompts.slice(0, 2).includes(await answerQuestion(false)));
  assert.equal(await run.getAttribute('data-phase'), 'result');
  assert.match(await run.locator('.grammar-result').textContent(), /오답 복습 완료.*정답 1개 · 오답 1개/); pass++;
  assert.equal((await readProgress()).grammarDone.tense, 12); pass++;
  await run.getByRole('button', { name: '새 10문제 시작', exact: true }).click();
  assert.ok((await run.locator('.grammar-quiz-progress').textContent()).includes('현재 1 / 10문제'));
  assert.equal(await run.locator('.grammar-result').count(), 0); pass++;
  await run.getByRole('button', { name: '그만하기', exact: true }).click();
  assert.equal(await page.locator('.sheet.open').count(), 0);
  assert.ok(await page.locator('.gram-card').first().isVisible()); pass++;
  assert.deepEqual(errors, []); pass++;
  console.log(`통과 ${pass} / 실패 0`);
} catch (error) { console.error(error); console.log(`통과 ${pass} / 실패 1`); process.exitCode = 1; }
finally { await browser.close(); }
