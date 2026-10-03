/* 뒤로가기.
 *
 * ★ 덮인 것만 닫고, 학습은 잃지 않는다 ★
 *
 * 회독 화면이나 메뉴가 덮여 있을 때 뒤로가기를 누르면 앱을 그냥 벗어났다.
 * 안드로이드와 홈 화면 앱에서 뒤로가기는 제일 자연스러운 「닫기」인데,
 * 여기서는 앱이 닫히는 것으로 읽혔다.
 *
 * 세 가지를 본다.
 *   메뉴가 덮여 있으면 메뉴만 닫힌다
 *   회독 화면이 덮여 있으면 그것만 닫히고 세션은 남는다 (이어하기로 돌아간다)
 *   화면에서 닫은 뒤에는 뒤로가기가 헛돌지 않는다
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu, startStudy, judgeCard } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 며칠 해 본 사람 — 복습이 있어야 회독 화면에 카드가 뜬다 */
function seeded() {
  const day = (d) => {
    const x = new Date(); x.setDate(x.getDate() - d);
    return x.toISOString().slice(0, 10);
  };
  const review = {};
  for (let i = 1; i <= 30; i++) {
    review[`n5-${String(i).padStart(4, '0')}`] = {
      box: 3, streak: 1, lastSeen: day(6), rounds: 1, wrongCount: 0, vagueCount: 0, seenAt: 1,
    };
  }
  return review;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((rv) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
  }, seeded());
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  /* 껍데기가 뜰 때까지 기다린다 — 안 기다리면 느린 기기에서 아직
     안 그려진 화면을 누르게 된다. 끝내 안 뜨면 뒤따르는 검사가
     제 말로 실패하는 쪽이 읽기 쉽다. */
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});

  console.log('── 메뉴를 덮었을 때');
  await openMenu(page, '완전기초');
  await page.waitForTimeout(600);
  ok('메뉴가 열림', await page.locator('.subscreen.open').count() === 1);

  await page.goBack();
  await page.waitForTimeout(700);
  ok('★ 뒤로가기로 메뉴만 닫힌다 ★', await page.locator('.subscreen.open').count() === 0);
  /* 앱을 벗어나지 않았다 — 탭바가 그대로 있어야 한다 */
  ok('앱을 벗어나지 않는다', await page.locator('.tabbar').isVisible());

  console.log('\n── 회독 화면을 덮었을 때');
  const started = await startStudy(page);
  ok('회독이 열림', started && await page.locator('.studycard').count() === 1);
  // 한 장 풀어 둔다 — 세션이 남는지 볼 거리가 생긴다
  await judgeCard(page, '알아요');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1') || 'null'));
  ok('세션이 저장돼 있다', Boolean(before?.queue?.length), `남은 ${before?.queue?.length}`);

  await page.goBack();
  await page.waitForTimeout(800);
  ok('★ 뒤로가기로 회독 화면만 닫힌다 ★', await page.locator('.studycard').count() === 0);
  ok('앱은 그대로', await page.locator('.tabbar').isVisible());

  /* ★ 여기가 핵심이다 ★
     뒤로가기가 학습을 날려 버리면 안 된다. 세션은 그대로 남아 있어야 하고,
     오늘 화면에서 이어하기로 그 자리에 돌아갈 수 있어야 한다. */
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_session_v1') || 'null'));
  ok('★ 학습이 안 날아간다 ★',
    after?.queue?.length === before?.queue?.length,
    `${before?.queue?.length} → ${after?.queue?.length}`);

  await goTab(page, '홈');
  await page.waitForTimeout(600);
  const cta = await page.textContent('.bigcta').catch(() => '');
  ok('이어하기로 돌아갈 수 있다', cta.includes('이어하기'), cta.replace(/\s+/g, ' '));

  console.log('\n── 화면 버튼으로 닫은 뒤');
  /* ★ 헛도는 한 번이 없어야 한다 ★
   *
   * 여태 여기서 한 번은 헛돌았다. 화면 버튼으로 닫을 때 밀어 둔 history
   * 자리가 남아서, 그다음 뒤로가기가 그걸 쓰면서 아무 일도 안 일어났다.
   * 눌렀는데 아무것도 안 나는 그 한 번이 「뒤로가기가 안 먹는다」다.
   *
   * 전에 한 번 고치려다 되돌렸다. 우리가 history.back()을 부르는데 그게
   * 비동기라서, 닫고 바로 다시 여는 흐름에서 엉뚱한 자리를 뺐고 앱 밖으로
   * 튕겼다. 지금은 「부른 back이 도착했다」를 표시로 들고 있고, 도착했을 때
   * 층이 다시 열려 있으면 자리를 새로 세운다(lib/navhistory.js).
   *
   * 그래서 닫은 뒤에는 우리 자리가 남아 있지 않다 — 뒤로가기 한 번이 바로
   * 앱을 벗어난다. 덮인 게 없을 때 붙잡지 않는 것이 맞는 동작이다. */
  await openMenu(page, '완전기초');
  await page.waitForTimeout(600);
  ok('다시 열림', await page.locator('.subscreen.open').count() === 1);
  await page.locator('.subscreen.open .sub-back').first().click();
  await page.waitForTimeout(900);
  ok('화면 버튼으로 닫힘', await page.locator('.subscreen.open').count() === 0);
  ok('★ 닫으면 밀어 둔 자리도 치운다 ★',
    await page.evaluate(() => window.history.state?.jp !== 'layer'),
    JSON.stringify(await page.evaluate(() => window.history.state)));

  /* ★ 닫고 바로 다시 열기 — 전에 앱 밖으로 튕긴 자리 ★
     부른 back이 도착하기 전에 다시 열린다. 그때 자리를 새로 안 세우면
     열린 화면을 두고 다음 뒤로가기가 앱을 벗어난다. */
  await openMenu(page, '완전기초');
  await page.locator('.subscreen.open .sub-back').first().click();
  await openMenu(page, '완전기초');
  await page.waitForTimeout(900);
  ok('빠르게 닫고 열어도 열려 있다', await page.locator('.subscreen.open').count() === 1);
  ok('★ 그 화면에도 자리가 붙어 있다 ★',
    await page.evaluate(() => window.history.state?.jp === 'layer'),
    JSON.stringify(await page.evaluate(() => window.history.state)));
  await page.goBack();
  await page.waitForTimeout(800);
  ok('★ 뒤로가기가 앱을 벗어나지 않고 그 화면만 닫는다 ★',
    await page.locator('.tabbar').isVisible()
    && await page.locator('.subscreen.open').count() === 0);

  /* 덮인 게 없으면 붙잡지 않는다 — 거기서 막으면 앱에서 나갈 길이 없어진다 */
  await page.goBack();
  await page.waitForTimeout(800);
  const left = await page.evaluate(() => location.href);
  ok('★ 덮인 게 없으면 끝내 붙잡지 않는다 ★', !left.includes('/japan/'), left);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
