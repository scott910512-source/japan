/* 아이디 찾기 — 가짜 서버(가로챈 요청)로 본다. 실제 서버에는 아무것도 안 보낸다.
 *
 *   1. 처음 쓰는 기기: 「아이디를 잊었어요」 → 이메일을 넣으면 가입된 주소인지 알려 준다
 *      (서버에는 「계정은 만들지 말고」로 청한다 — 없는 주소로 계정이 생기면 안 된다)
 *   2. 로그인하면 그 이메일을 기기에 기억한다
 *   3. 로그인했던 기기: 로그인 화면이 쓰던 이메일을 가려서 보여 주고, 누르면 칸에 채운다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const user = { id: '22222222-2222-2222-2222-222222222222', aud: 'authenticated', role: 'authenticated', email: 'hunter1234@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', aud: 'authenticated' })}.sig`;
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

async function open(browser, { seed = {}, otpStatus = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const otp = [];
  /* 주소는 src/lib/supabase.js에 적힌 그 프로젝트다. 요청은 전부 여기서 가로채 답한다 — 밖으로 안 나간다 */
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', async (route) => {
    const req = route.request(); const url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/otp')) {
      const body = req.postDataJSON(); otp.push(body);
      if (otpStatus === 429) return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }) });
      if (otpStatus === 500) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: 'Internal Server Error' }) });
      if (body.email === user.email) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' }) });
    }
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    if (url.includes('/rest/v1/user_data') && req.method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await ctx.addInitScript(([extra]) => {
    if (localStorage.getItem('qa_seeded')) return;
    localStorage.setItem('qa_seeded', '1');
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3 }));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, [seed]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.gate, .tabbar').first().waitFor({ timeout: 30000 });
  return { ctx, page, otp, errors };
}
const notice = async (page) => ((await page.locator('.acct-notice').count()) ? (await page.locator('.acct-notice').innerText()).trim() : '');

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ 처음 쓰는 기기에서 아이디 찾기 ]');
  {
    const { ctx, page, otp, errors: e } = await open(browser);
    ok('로그인 화면에 「아이디를 잊었어요」가 있다', await page.locator('.acct-links [data-go="find"]').count() === 1 && await page.locator('.acct-links [data-go="reset"]').count() === 1);
    ok('기억해 둔 계정이 없으면 「쓰던 계정」 줄은 없다', await page.locator('.acct-known').count() === 0);
    await page.locator('.acct-links [data-go="find"]').click();
    ok('아이디 찾기 화면: 이메일 칸만 있고 비밀번호 칸은 없다', (await page.locator('.gate .card .set-title').first().innerText()).includes('아이디 찾기') && await page.locator('.gate input[type="email"]').count() === 1 && await page.locator('.gate input[type="password"]').count() === 0);
    await page.locator('.gate input[type="email"]').fill('nobody@example.com');
    await page.locator('.gate .card .submit-btn').click();
    await page.waitForTimeout(900);
    ok('★ 가입 안 된 주소면 없다고 알려 준다 ★', (await notice(page)).includes('가입한 계정이 없어요') && await page.locator('.acct-usefound').count() === 0, await notice(page));
    ok('★ 서버에는 계정을 만들지 말라고 청했다 ★', otp.length === 1 && otp[0].email === 'nobody@example.com' && otp[0].create_user === false, JSON.stringify(otp[0]));
    await page.waitForTimeout(260);
    await page.locator('.gate input[type="email"]').fill(user.email);
    await page.locator('.gate input[type="email"]').press('Enter');
    await page.waitForTimeout(900);
    ok('★ 가입된 주소면 그 이메일이 아이디라고 알려 준다 ★', (await notice(page)).includes('가입된 주소예요') && (await notice(page)).includes('로그인 링크'), await notice(page));
    ok('「이 이메일로 로그인」이 나온다', await page.locator('.acct-usefound').count() === 1);
    await page.locator('.acct-usefound').click();
    ok('★ 누르면 로그인 화면으로 가고 이메일이 채워져 있다 ★', (await page.locator('.gate .card .set-title').first().innerText()).trim() === '로그인' && await page.locator('.gate input[type="email"]').inputValue() === user.email && await page.locator('.gate input[type="password"]').count() === 1);
    ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    console.log('\n[ 로그인하면 이메일을 기억한다 ]');
    await page.locator('.gate input[type="password"]').fill('secret123');
    await page.locator('.gate .card .submit-btn').click();
    await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(800);
    ok('★ 로그인한 이메일이 기기에 남는다 ★', await page.evaluate(() => localStorage.getItem('jp_manabu_last_email_v1')) === user.email);
    errors.push(...e);
    await ctx.close();
  }

  console.log('\n[ 로그인했던 기기 ]');
  {
    const { ctx, page, errors: e } = await open(browser, { seed: { jp_manabu_last_email_v1: user.email, jp_manabu_signed_in_v1: '1' } });
    const known = page.locator('.acct-known');
    ok('★ 로그인 화면이 쓰던 계정을 알려 준다 ★', await known.count() === 1);
    const text = (await known.innerText()).replace(/\s+/g, ' ');
    ok('★ 이메일은 가려서 보여 준다(앞 두 글자 + 도메인) ★', text.includes('hu••••••••@example.com') && !text.includes('hunter1234'), text);
    await known.click();
    ok('★ 누르면 이메일 칸에 채워진다 ★', await page.locator('.gate input[type="email"]').inputValue() === user.email);
    ok('채운 뒤에는 그 줄이 사라진다', await page.locator('.acct-known').count() === 0);
    await page.locator('.gate input[type="email"]').fill('');
    await page.locator('.acct-links [data-go="find"]').click();
    ok('아이디 찾기 화면에도 쓰던 계정이 보인다', await page.locator('.acct-known').count() === 1);
    await page.locator('.acct-known').click();
    ok('거기서 누르면 로그인 화면으로 돌아가 채운다', (await page.locator('.gate .card .set-title').first().innerText()).trim() === '로그인' && await page.locator('.gate input[type="email"]').inputValue() === user.email);
    ok('가로로 넘치지 않는다(쓰던 계정)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    errors.push(...e);
    await ctx.close();
  }

  console.log('\n[ 서버가 답을 못 줄 때 ]');
  {
    const { ctx, page, errors: e } = await open(browser, { otpStatus: 429 });
    await page.locator('.acct-links [data-go="find"]').click();
    await page.locator('.gate input[type="email"]').fill(user.email);
    await page.locator('.gate .card .submit-btn').click();
    await page.waitForTimeout(900);
    ok('너무 잦으면 잠시 뒤에 하라고 한다(가입 여부를 지어내지 않는다)', (await notice(page)).includes('1분쯤 뒤') && await page.locator('.acct-usefound').count() === 0, await notice(page));
    errors.push(...e);
    await ctx.close();
  }
  {
    const { ctx, page, errors: e } = await open(browser, { otpStatus: 500 });
    await page.locator('.acct-links [data-go="find"]').click();
    await page.locator('.gate input[type="email"]').fill(user.email);
    await page.locator('.gate .card .submit-btn').click();
    await page.waitForTimeout(1200);
    const t = (await page.locator('.toast').count()) ? (await page.locator('.toast').innerText()).trim() : '';
    ok('★ 서버 오류를 「가입 안 됨」으로 읽지 않는다 ★', (await notice(page)) === '' && t.includes('서버'), t);
    errors.push(...e);
    await ctx.close();
  }

  ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '없음');
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error('CRASH', err); process.exit(1); });
