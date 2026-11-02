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
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const settings = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ ...settings, onboarded: true, canReadKana: true, autoTTS: true, showExample: true, speakOnJudge: false, quickJudge: false, gttsKey: '', goals: { fresh: 12, review: 0, weak: 0 } }));
  });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
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
  await page.dispatchEvent('body', 'keydown', { key: 'ㅠ', code: 'KeyB' }); await page.waitForTimeout(100);
  check('한글 입력 상태에서도 B로 단어장을 추가한다', (await bookmark.innerText()).includes('단어장에 있음'));
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
    check(`숫자키 대체 ${key.toUpperCase()}로도 판정한다`, (await session()).done === before + 1);
    await press('ArrowLeft'); await press('4');
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
