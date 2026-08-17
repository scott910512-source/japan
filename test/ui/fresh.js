/* 아무것도 없는 상태에서 처음 켠 사람 — 여기서 막히면 다른 게 다 소용없다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 로그인 문 — 처음 온 사람은 여기부터 본다
  ok('로그인 화면이 뜸', (await page.textContent('body')).includes('로그인'));
  ok('가입 길이 보임', (await page.textContent('body')).includes('가입하기'));
  ok('비밀번호 찾기도 있음', (await page.textContent('body')).includes('비밀번호를 잊었어요'));

  /* 진짜 계정을 만들 수는 없으니, 로그인한 뒤 상태로 들어간다.
     여기서 보려는 건 "처음 켠 사람이 첫 회독까지 가는가"다. */
  await page.evaluate(() => localStorage.setItem('jp_manabu_signed_in_v1', '1'));
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  ok('인터넷이 없으면 그냥 쓸 길을 줌', await off.count() === 1);
  await off.click();
  await page.waitForTimeout(900);

  // ── 처음 켠 사람 안내 ──
  const onb = page.locator('.onboarding, .ob-slides');
  ok('처음엔 안내가 뜸', await onb.count() > 0 && await onb.first().isVisible());
  ok('건너뛸 수도 있음', await page.locator('.ob-skip').isVisible());

  const first = await page.locator('.ob-slide.active').textContent();
  ok('첫 질문이 보임', first.trim().length > 10, first.replace(/\s+/g, ' ').slice(0, 40));

  // 고르고 넘어가기를 끝까지
  for (let i = 0; i < 6; i++) {
    if (!(await onb.first().isVisible().catch(() => false))) break;
    const choice = page.locator('.ob-slide.active .ob-choices button').first();
    if (await choice.count()) { await choice.click(); await page.waitForTimeout(250); }
    const next = page.locator('.ob-next');
    if (!(await next.count()) || await next.isDisabled()) break;
    await next.click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(700);
  ok('안내를 마치면 홈이 나옴', await page.locator('.tabbar').isVisible());
  ok('안내가 사라짐', !(await onb.first().isVisible().catch(() => false)));
  ok('마쳤다고 기록됨', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}').onboarded) === true);

  // ── 기록이 하나도 없을 때 홈 ──
  const home = await page.textContent('.screen.active');
  ok('오늘 할 일을 알려 줌', /오늘|시작/.test(home), home.replace(/\s+/g, ' ').slice(0, 50));
  ok('깨진 숫자가 없음', !home.includes('undefined') && !home.includes('NaN'));
  ok('학습 메뉴가 보임', await page.locator('.menucard').count() >= 3, `${await page.locator('.menucard').count()}개`);

  // ── 바로 회독 ──
  await page.locator('.tabbar .tab', { hasText: '학습' }).click();
  await page.waitForTimeout(1500);
  ok('회독이 바로 열림', await page.locator('.judgerow').count() === 1);
  const head = await page.textContent('.sh-title');
  ok('첫날 장수가 나옴', /\d+\s*\/\s*\d+/.test(head), head.trim());

  await page.locator('.studycard').click();
  await page.waitForTimeout(500);
  ok('탭하면 뜻이 보임', await page.locator('.sc-back').count() === 1);
  await page.locator('.judgerow button', { hasText: '알아요' }).click();
  await page.waitForTimeout(600);
  ok('판정이 기록됨', Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'))).length === 1);
  ok('다음 장으로 넘어감', (await page.textContent('.sh-title')).includes('1 /'), (await page.textContent('.sh-title')).trim());

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
