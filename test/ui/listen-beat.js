/* 달리기 박자 — 켜진 채로 시작해도, 끼어들어도 소리가 이어진다.
 *
 * 삿포로를 들을 때는 박자가 났고 기출을 고를 때는 안 났다. 차이는 범위가
 * 아니라 「누가 켰나」였다 — 손으로 켠 것(제스처)과 켜진 채로 시작한 것
 * (화면의 효과). iOS는 제스처 밖에서 깨운 오디오로는 소리를 안 낸다.
 *
 * 크롬에서는 iOS의 그 규칙을 흉내 못 낸다. 대신 지킬 수 있는 것을 지킨다.
 *   · 설정에 켜진 채로 시작하면 박자가 돌고 오디오가 「running」이다
 *   · 범위가 무엇이든 같다 — 기출 단어로도
 *   · 오디오를 멈춰 놓아도(끼어듦 흉내) 다음 터치에서 다시 「running」 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openListen } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser, settings) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((extra) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    Object.assign(s, extra);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  }, settings);
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

const beat = (page) => page.evaluate(() => ({
  audio: window.__jpBeat?.audio() ?? null,
  running: window.__jpBeat?.running() ?? false,
}));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  /* 지난번에 달리다 켜 둔 박자가 기기에 남아 있는 사람 — 범위는 기출 단어 */
  const page = await boot(browser, { listenBeat: true, listenBpm: 170, listenScope: 'kiju' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 켜진 채로 시작 — 기출 단어 ]');
  await openListen(page, 'auto');
  ok('기출 단어 범위다', await page.locator('.ls-scope.active').getAttribute('data-scope') === 'kiju');
  await page.locator('.ls-go').tap();
  await page.waitForTimeout(400);
  await page.locator('.ls-ask .submit-btn').tap();
  await page.waitForTimeout(1200);
  ok('재생 화면', await page.locator('.listen.play').count() === 1);
  ok('박자 버튼이 켜져 있다', (await page.locator('.ls-beat .lb-now').innerText()).includes('170'));
  let b = await beat(page);
  ok('★ 박자가 돈다 ★', b.running === true);
  ok('★ 오디오가 깨어 있다(running) ★', b.audio === 'running', b.audio);

  console.log('\n[ 끼어들어 멈춰도 다음 터치에서 깨어난다 ]');
  /* 멈춘 직후의 상태를 같은 자리에서 읽는다 — 틱(0.25초)이 먼저 깨우기 전에 */
  const stopped = await page.evaluate(async () => { await window.__jpBeat.suspend(); return window.__jpBeat.audio(); });
  ok('멈춰 있다 (끼어듦 흉내)', stopped !== 'running', stopped);
  /* 틱이 먼저 깨울 수도 있고(크롬은 제스처 없이도 resume이 먹는다),
     그게 아니면 다음 터치에서 깨어야 한다 */
  await page.waitForTimeout(600);
  b = await beat(page);
  if (b.audio !== 'running') {
    await page.locator('.ls-pause').tap();
    await page.waitForTimeout(300);
    await page.locator('.ls-pause').tap();
    await page.waitForTimeout(500);
    b = await beat(page);
  }
  ok('★ 다시 깨어났다 ★', b.audio === 'running' && b.running === true, `${b.audio} · ${b.running}`);

  console.log('\n[ 잠깐 멈춤은 박자도 멈추고, 이어서는 다시 ]');
  await page.locator('.ls-pause').tap();
  await page.waitForTimeout(400);
  b = await beat(page);
  ok('멈추면 박자가 선다', b.running === false);
  await page.locator('.ls-pause').tap();
  await page.waitForTimeout(600);
  b = await beat(page);
  ok('이어서 하면 박자가 돈다 · 오디오는 running', b.running === true && b.audio === 'running', b.audio);

  console.log('\n[ 다른 범위도 같다 — 오늘 볼 것 ]');
  await page.locator('.listen .sub-back').tap();
  await page.waitForTimeout(500);
  await page.locator('.ls-scope[data-scope="today"]').tap();
  await page.waitForTimeout(300);
  await page.locator('.ls-go').tap();
  await page.waitForTimeout(400);
  await page.locator('.ls-ask .submit-btn').tap();
  await page.waitForTimeout(1200);
  b = await beat(page);
  ok('오늘 볼 것으로도 박자가 돈다', b.running === true && b.audio === 'running', `${b.audio}`);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
