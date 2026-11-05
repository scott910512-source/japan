import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu, openListen, goTab, startStudy } from './_nav.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { applyVerdict, VERDICT, addDays, todayKey } from '../../src/lib/review.js';
import { allSentenceCards } from '../../src/lib/content.js';
import { normalizeJp } from '../../src/lib/jptext.js';
import { chunksOf } from '../../src/data/allChunks.js';

const chrome = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let checks = 0;
const check = (label, value) => { assert.ok(value, label); checks++; console.log('✓', label); };
try {
  await page.addInitScript(() => {
    window.__said = [];
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices = () => [{ name: 'Test Japanese', lang: 'ja-JP', voiceURI: 'ja' }, { name: 'Test Korean', lang: 'ko-KR', voiceURI: 'ko' }];
    let generation = 0;
    synth.cancel = () => { generation++; };
    synth.speak = (u) => {
      window.__said.push(u.text);
      const mine = generation;
      setTimeout(() => { if (mine === generation) { u.onstart?.({}); setTimeout(() => { if (mine === generation) u.onend?.({}); }, 50); } }, 10);
    };
  });
  await page.goto(process.env.APP_URL || 'http://localhost:8932/japan/', { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const today = todayKey();
  const known = () => ({ ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -5)), due: addDays(today, -1) });
  const sentences = allSentenceCards().filter((s) => chunksOf(s.id) && normalizeJp(s.kanji).length >= 8 && normalizeJp(s.kanji).length <= 32).slice(0, 12);
  const review = Object.fromEntries([...ALL_WORDS.filter((w) => w.level === 'N5').slice(0, 30), ...sentences].map((c) => [c.id, known()]));
  await page.evaluate((review) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(review));
    localStorage.setItem('jp_optrev_open', '0');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, listenScope: 'all', listenGap: 5 }));
  }, review);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.gate, .tabbar').first().waitFor();
  await page.context().setOffline(true);
  if (!(await page.locator('.tabbar').isVisible())) await page.locator('.gate-offline').click();
  await page.locator('.tabbar').waitFor();

  // Study: old Vimium-conflicting aliases do nothing; Enter reveals without judging.
  await startStudy(page);
  await page.locator('.studycard').waitFor();
  await page.keyboard.press('x');
  check('X no longer judges a study card', await page.locator('.sc-back').count() === 0);
  await page.keyboard.press('Enter');
  check('Enter reveals the study answer', await page.locator('.sc-back').count() === 1);
  await page.keyboard.press('Escape');
  await page.locator('.studycard').waitFor({ state: 'detached' });

  // Grammar sheet owns digits; held Enter cannot advance across multiple questions.
  await openMenu(page, '문법');
  await page.locator('.gram-card').first().click();
  const grammar = page.locator('.grammar-session');
  await grammar.waitFor();
  await page.keyboard.press('1');
  check('Grammar accepts a numbered answer', await grammar.locator('.quiz-opt').first().isDisabled());
  await page.keyboard.down('Enter');
  await page.waitForTimeout(100);
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  check('Held Enter advances exactly one grammar question', (await grammar.locator('.grammar-quiz-progress').textContent()).includes('현재 2 / 10문제'));
  check('Next question remains unanswered', !(await grammar.locator('.quiz-opt').first().isDisabled()));
  await page.keyboard.press('Escape');
  check('Escape closes only the grammar sheet', await grammar.count() === 0);

  // Stream: physically identified numpad keys work; correct answers wait for Enter.
  await openMenu(page, '쭉 퀴즈');
  await page.locator('.st-start:not([disabled])').waitFor();
  await page.keyboard.press('Enter');
  const stream = page.locator('.st-run');
  await stream.waitFor();
  // Any answer suffices: correct and wrong answers both stay until Enter in keyboard mode.
  if (await stream.locator('.st-input').count()) {
    await stream.locator('.st-input').fill('모르겠어요');
    await page.keyboard.press('Enter');
  } else {
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', code: 'Numpad1', bubbles: true, cancelable: true })));
  }
  const streamQuestion = await stream.locator('.qc-prompt').textContent();
  await page.waitForTimeout(1100);
  check('Stream keyboard answer waits instead of auto-skipping', await stream.locator('.qc-prompt').textContent() === streamQuestion);
  check('Stream shows a next action after answering', await stream.locator('.st-next, .st-close').count() > 0);
  await page.keyboard.press('Enter');
  // Close answers are explicitly treated as wrong by Enter, then need a second Enter to advance.
  if (await stream.locator('.st-next').count()) await page.keyboard.press('Enter');
  check('Stream Enter returns to an unanswered problem', await stream.locator('.st-opt:disabled, .st-input:disabled').count() === 0);
  await page.keyboard.press('Escape');
  await page.locator('.st-sum').waitFor();

  // Sentence tiles: keyboard labels do not change tile text or expose answer audio.
  await openMenu(page, '문장 만들기');
  const build = page.locator('.cmp-build');
  await build.waitFor();
  const id = await build.getAttribute('data-id');
  const chunks = chunksOf(id);
  const saidBefore = await page.evaluate(() => window.__said.length);
  await page.keyboard.press('Space');
  check('Unsolved assembly does not speak its answer', await page.evaluate(() => window.__said.length) === saidBefore);
  for (const text of chunks) {
    const labels = await page.locator('.build-pool .build-tile').allTextContents();
    const n = labels.findIndex((s) => s.trim() === text);
    assert.ok(n >= 0, `tile ${text}`);
    await page.keyboard.press(String(n + 1));
  }
  check('Number keys complete sentence assembly', await page.locator('.build-done').count() === 1);
  await page.keyboard.press('Enter');
  check('Enter starts another assembly question', await page.locator('.build-done').count() === 0);

  await page.locator('.cmp-tabs [data-mode="write"]').click();
  const write = page.locator('.cmp-input');
  await write.fill('わからない');
  await write.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
  check('IME confirmation does not submit a sentence', !(await write.isDisabled()));
  await page.keyboard.press('1');
  check('Number keys type normally inside the answer field', (await write.inputValue()).endsWith('1'));
  await page.keyboard.press('Enter');
  check('Enter submits after composition finishes', await write.isDisabled());
  await page.keyboard.press('Enter');
  check('Enter continues from a wrong written answer', !(await write.isDisabled()));

  // Automatic listening: preserve start confirmation, pause, navigate, replay.
  await openListen(page);
  await page.keyboard.press('Enter');
  await page.locator('.sheet.open .ls-ask').waitFor();
  check('Listening Enter opens the existing start confirmation', await page.locator('.listen.play').count() === 0);
  await page.keyboard.press('Enter');
  await page.locator('.listen.play').waitFor();
  await page.keyboard.press('Space');
  check('Space pauses continuous listening', await page.locator('.ls-pause').getAttribute('aria-pressed') === 'true');
  await page.keyboard.press('ArrowRight');
  check('Right arrow moves to second listening card', (await page.locator('.listen.play .sub-title').textContent()).includes('2 /'));
  check('Navigating while paused keeps it paused', await page.locator('.ls-pause').getAttribute('aria-pressed') === 'true');
  await page.keyboard.press('ArrowLeft');
  check('Left arrow returns to first listening card', (await page.locator('.listen.play .sub-title').textContent()).includes('1 /'));
  await page.keyboard.press('ArrowDown');
  check('Down arrow replays and resumes the current card', await page.locator('.ls-pause').getAttribute('aria-pressed') === 'false');
  await page.keyboard.press('Escape');
  check('Escape stops listening', await page.locator('.listen.play').count() === 0);
  // N3 exam waits in keyboard mode, and the listening parent yields to its quiz.
  await openMenu(page, 'N3 학습하기');
  await page.locator('.n3-tile', { hasText: '전체 과정' }).click();
  await page.locator('.n3-chapter[data-chapter="ch0"] .n3-chhead').click();
  await page.locator('.n3-testbtn[data-test="t:ch0"]').click();
  const runner = page.locator('.n3-quiz');
  const qid = await runner.getAttribute('data-qid');
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  check('N3 exam keyboard answer waits for Enter', await runner.getAttribute('data-qid') === qid);
  await page.keyboard.press('Enter');
  check('N3 exam Enter advances one question', await runner.getAttribute('data-qid') !== qid);
  await page.keyboard.press('Escape');
  await page.locator('.n3-chapter[data-chapter="ch6"] .n3-chhead').click();
  await page.locator('.n3-group[data-group="ll1"] .n3-ghead').click();
  await page.locator('.n3-group[data-group="ll1"] .n3-lrow').first().click();
  const lesson = page.locator('.n3-listening');
  await page.keyboard.press('Space');
  check('Space starts N3 listening', await page.locator('.n3-playbtn').getAttribute('aria-label') === '멈추기');
  await page.locator('.n3-toq:not([disabled])').waitFor();
  await page.keyboard.press('Enter');
  await runner.waitFor();
  await page.keyboard.press('1');
  check('N3 listening accepts numbered answers', await runner.locator('.qopt').first().isDisabled());
  await page.keyboard.press('Enter');
  check('Nested quiz Enter advances only to listening step 2', await lesson.getAttribute('data-step') === '2');
  await page.keyboard.press('Escape');

  check('No runtime errors', errors.length === 0);
  await goTab(page, '설정');
  await page.locator('.keyboard-help:visible').first().click();
  check('Keyboard guide is available in settings', (await page.locator('.keyboard-help:visible').textContent()).includes('Vimium'));
  console.log(`통과 ${checks} / 실패 0`);
} finally { await browser.close(); }
