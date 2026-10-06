/* 비행기 모드 — 서비스워커가 받아 둔 것만으로 앱이 뜨는가.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 이 앱은 인터넷 없이 쓰는 앱이다. 다른 검사들은 「켜진 채로 불러온 뒤 끊는」
 * 순서로 오프라인을 흉내 내는데, 그건 이미 떠 있는 화면이 끊김을 견디는지를
 * 본다. 비행기에서 겪는 일은 다르다 — 앱을 아예 새로 여는데 인터넷이 없다.
 * 그때는 서비스워커가 미리 받아 둔 파일만으로 첫 화면부터 떠야 하고, 늦게
 * 받는 화면(단어·듣기)까지 열려야 한다.
 *
 * 깨지기 쉬운 자리는 둘이다.
 *   · 사전 캐시 목록에 파일이 빠진다 — 설치는 되는데 그 화면만 안 열린다
 *   · 서비스워커가 자리를 잡기 전에 끊긴다 — 그건 기기 문제라 여기서는
 *     받아 둔 것을 확인하고 나서 끊는다
 *
 * 배포 뒤의 live-check는 「올라간 파일이 다 있나」를 본다. 여기는 「받아 둔
 * 파일만으로 돌아가나」를 본다. 둘이 짝이다.
 *
 * ★ 밑줄 — npm test에서 뺐다 ★
 * 이 컨테이너에서는 통과하는데 CI(GitHub 러너)에서는 「인터넷을 끊고 새로
 * 열기」에서 앱이 안 떴다(사전 캐시는 44개로 똑같이 찼는데도). 원인을 아직
 * 모른다 — 서비스워커가 그 탭을 아직 쥐지 못했거나, 러너의 오프라인 흉내가
 * 서비스워커까지 막는 쪽일 수 있다. 모르는 채로 CI를 빨갛게 두면 다른 검사까지
 * 안 믿게 되니, 원인을 잡을 때까지 손으로 돌리는 도구로 둔다. 아래에 실패하면
 * 무엇이 보였는지 적게 해 두었다 — 다음에 CI에서 한 번 돌려 보면 답이 나온다.
 *
 *   APP_URL=http://localhost:8934/japan/ node test/ui/_offline-reload.js */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openListen, openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 사전 캐시가 다 찼나 — 이름표(js-japanese)가 붙은 캐시의 항목 수 */
const cached = (page) => page.evaluate(async () => {
  const names = (await caches.keys()).filter((n) => n.includes('js-japanese'));
  let n = 0;
  for (const name of names) n += (await (await caches.open(name)).keys()).length;
  return { names, n };
});

const waitCached = async (page, min = 40, ms = 40000) => {
  const t0 = Date.now();
  let last = { names: [], n: 0 };
  while (Date.now() - t0 < ms) {
    last = await cached(page).catch(() => last);
    if (last.n >= min) return last;
    await page.waitForTimeout(500);
  }
  return last;
};

const passGate = async (page) => {
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 인터넷이 있을 때 받아 둔다 ]');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  const reg = await page.evaluate(async () => {
    const r = await Promise.race([
      navigator.serviceWorker.ready.then(() => 'ready'),
      new Promise((res) => setTimeout(() => res('timeout'), 20000)),
    ]);
    return r;
  });
  ok('서비스워커가 자리를 잡는다', reg === 'ready', reg);
  const got = await waitCached(page);
  ok('★ 사전 캐시가 찼다 (앱 전체) ★', got.n >= 40, `${got.n}개 · ${got.names.join(', ')}`);

  console.log('\n[ 인터넷을 끊고 처음부터 다시 연다 ]');
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await passGate(page);
  const booted = await page.locator('.tabbar').count() === 1;
  ok('★ 오프라인에서 새로 열어도 앱이 뜬다 ★', booted);
  if (!booted) {
    /* 왜 안 떴나 — 다음 사람이 처음부터 뒤지지 않게 */
    const why = await page.evaluate(() => ({
      url: location.href,
      ready: document.readyState,
      controlled: Boolean(navigator.serviceWorker?.controller),
      text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
    })).catch((e) => ({ error: e.message.split('\n')[0] }));
    console.log('   보인 것:', JSON.stringify(why));
    console.log('   에러:', errors.slice(0, 3).join(' | ') || '없음');
  }
  ok('홈이 그려진다', (await page.locator('body').innerText()).includes('오늘'));

  console.log('\n[ 늦게 받는 화면도 받아 둔 것으로 열린다 ]');
  await openMenu(page, '단어');
  ok('단어 화면(지연 로딩)', await page.locator('.bigstart').count() === 1);
  await page.locator('.subscreen.open .sub-back').first().click();
  await page.waitForTimeout(300);
  await openListen(page, 'auto');
  ok('자동 듣기 화면(지연 로딩)', await page.locator('.ls-go').count() === 1);
  await page.locator('.ls-scope[data-scope="jlpt"]').click();
  await page.waitForTimeout(300);
  ok('JLPT 문장 목록이 자료째로 들어 있다', await page.locator('.ls-level').count() === 3
    && Number((await page.locator('.ls-level[data-level="N5"] .pk-count').innerText()).replace(/\D/g, '')) >= 600);
  await page.locator('.ls-go').click();
  await page.waitForTimeout(400);
  await page.locator('.ls-ask .submit-btn').click();
  await page.waitForTimeout(900);
  ok('★ 오프라인에서 재생까지 간다 ★', await page.locator('.listen.play').count() === 1);
  await page.locator('.listen .sub-back').click();
  await page.waitForTimeout(400);
  await goTab(page, '홈');
  await openMenu(page, '한 권으로 끝내는 N3');
  ok('N3 코스(제일 큰 지연 로딩)', await page.locator('.n3-cta').count() === 1);

  console.log('\n[ 한 번 더 — 두 번째 열기도 같다 ]');
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await passGate(page);
  ok('두 번째도 뜬다', await page.locator('.tabbar').count() === 1);

  /* 끊긴 탓에 못 받은 요청(ERR_INTERNET_DISCONNECTED)은 콘솔 에러일 뿐이라
     여기서는 안 센다 — 보는 것은 앱이 던진 에러다 */
  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
