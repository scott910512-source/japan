/* Real card UI: intro audio, keyboard layouts/keypad, editor focus and local fonts. */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--no-sandbox'] });
let pass = 0, fail = 0;
const check = (label, good) => { if (good) pass++; else { fail++; console.error(`  ✗ ${label}`); } };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__said = [];
    speechSynthesis.speak = (utterance) => { if (utterance.text.trim() && utterance.volume !== 0) window.__said.push(utterance.text); };
    speechSynthesis.cancel = () => {};
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const settings = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ ...settings, onboarded: true, canReadKana: true, autoTTS: true, showExample: true, speakOnJudge: false, quickJudge: false, gttsKey: '', goals: { fresh: 12, review: 0, weak: 0 } }));
    // Every tested card needs a real example. A random daily card can be a
    // sentence without one, which would make typography checks wait forever.
    const fixtures = [
      ['見せる', 'みせる', '보여주다', '写真を見せます。'],
      ['書く', 'かく', '쓰다', '名前を書きます。'],
      ['飲む', 'のむ', '마시다', '水を飲みます。'],
      ['歩く', 'あるく', '걷다', '駅まで歩きます。'],
      ['食べる', 'たべる', '먹다', 'パンを食べます。'],
      ['帰る', 'かえる', '돌아가다', '家に帰ります。'],
      ['寝る', 'ねる', '자다', '早く寝ます。'],
      ['泳ぐ', 'およぐ', '수영하다', '海で泳ぎます。'],
      ['聞く', 'きく', '듣다', '音楽を聞きます。'],
      ['待つ', 'まつ', '기다리다', '友達を待ちます。'],
      ['話す', 'はなす', '말하다', '日本語で話します。'],
      ['読む', 'よむ', '읽다', '本を読みます。'],
    ].map(([kanji, kana, mean, example], i) => ({ id: `custom-input-${i}`, kanji, kana, mean, example, exampleKo: '예문 뜻', level: 'N5', type: 'v', custom: true }));
    localStorage.setItem('jp_manabu_custom_words_v1', JSON.stringify(fixtures));
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    localStorage.setItem('jp_manabu_plan_v1', JSON.stringify({ v: 1, date, goals: { fresh: 12, review: 0, weak: 0 }, assigned: fixtures.map((w) => ({ id: w.id, kind: 'word', bucket: 'fresh' })), reps: 12, done: {}, extra: 1, sizes: { fresh: 12, review: 0, weak: 0 } }));
  });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  await context.setOffline(true); await page.locator('.gate-offline').waitFor({ timeout: 15000 }); await page.locator('.gate-offline').click();
  await page.locator('.bigcta').click(); await page.locator('.study.intro').waitFor();
  await page.waitForTimeout(450);
  check('시작 안내에서 첫 단어를 미리 읽지 않는다', await page.evaluate(() => window.__said.length === 0));
  await page.keyboard.press('1');
  check('시작 전 숫자키로 학습 기록을 만들지 않는다', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length === 0));
  await page.keyboard.press('Enter'); await page.waitForTimeout(350);
  check('안내에서 Enter를 누르면 학습을 시작한다', await page.locator('.studycard').isVisible());
  check('Enter로 시작해도 첫 카드 판정은 남기지 않는다', (await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1')))).done === 0);
  if (await page.locator('.bigstart').isVisible()) await page.locator('.bigstart').click();
  await page.locator('.studycard').waitFor(); await page.waitForTimeout(350);
  check('시작한 뒤 첫 단어를 한 번 읽는다', await page.evaluate(() => window.__said.length === 1));
  check('시작 직후 답은 아직 가려져 있다', await page.locator('.sc-back').count() === 0);
  const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1')));
  if (!(await session()).queue.every((id) => id.startsWith('custom-input-'))) throw new Error('고정 학습 자료를 불러오지 못했어요');
  const press = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(280); };
  for (const key of ['1', '2', '3']) {
    await press('4'); const before = (await session()).done;
    await press(key);
    check(`답을 펼친 뒤 숫자 ${key}로 판정한다`, (await session()).done === before + 1);
  }
  await press('4'); let before = (await session()).done;
  await page.dispatchEvent('body', 'keydown', { key: 'Unidentified', code: 'Digit2' }); await page.waitForTimeout(280);
  check('문자 값이 달라도 물리 숫자키를 알아본다', (await session()).done === before + 1);
  for (const [key, code] of [['End', 'Numpad1'], ['ArrowDown', 'Numpad2'], ['PageDown', 'Numpad3']]) {
    await press('4'); before = (await session()).done;
    await page.dispatchEvent('body', 'keydown', { key, code }); await page.waitForTimeout(280);
    check(`오른쪽 숫자패드 ${code}로 판정한다`, (await session()).done === before + 1);
  }
  const bookmark = page.locator('.studyfoot button').filter({ hasText: /단어장/ });
  await bookmark.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await press('Enter');
  check('문자 단축키 대신 Tab과 Enter로 단어장을 추가한다', (await bookmark.innerText()).includes('단어장에 있음'));
  await press('4');
  const fontsLoaded = await page.evaluate(async () => (await document.fonts.load('500 20px "Noto Sans JP Variable"', '写真を見せます。')).length > 0);
  check('오프라인에서도 앱에 포함된 일본어 글꼴을 연다', fontsLoaded);
  check('예문이 20px 이상이다', await page.locator('.sc-example .ex-jp').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 20));
  await page.locator('.memo-add').click(); await page.locator('.memo-input').fill('123');
  before = (await session()).done; await press('1');
  check('메모 입력 중 숫자는 카드 판정으로 새지 않는다', (await session()).done === before);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  for (const key of ['z', 'x', 'c']) {
    before = (await session()).done; await press(key);
    check(`충돌하던 ${key.toUpperCase()}는 판정하지 않는다`, (await session()).done === before);
  }
  if (process.env.HUNTER_SCREENSHOTS) {
    mkdirSync('.qa', { recursive: true });
    await page.screenshot({ path: '.qa/study-readable-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.qa/study-readable-mobile.png' });
    check('휴대폰에서 일본어가 가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  check('JavaScript 오류가 없다', errors.length === 0);
} catch (e) { fail++; console.error(e); }
finally { await browser.close(); console.log(`통과 ${pass} / 실패 ${fail}`); process.exitCode = fail ? 1 : 0; }
