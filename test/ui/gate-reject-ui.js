/* 서버가 거절·불통일 때 로그인 관문에서 갇히지 않는가 — 진짜 화면에서.
 *
 * 전에는 「서버에 닿지 못함」(시간초과)에서만 「이 기기 기록으로 계속하기」가 떴다.
 * 무료 프로젝트가 정지됐을 때 로그인은 「Load failed」로 막히는데 그 영어가 그대로
 * 떴고, 서버가 키나 갱신 토큰을 거절하면 버튼도 없었다.
 *
 * 서버는 흉내 낸다(route) — 이 검사는 인터넷 없이 돈다.
 *   A  저장된 세션의 갱신을 서버가 거절            → 관문 + 버튼
 *   B  로그인을 눌렀는데 서버에 닿지 못함           → 한국어 문구 + 버튼
 *   C  로그인을 눌렀는데 서버가 키를 거절(401)      → 한국어 문구 + 버튼
 *   D  비밀번호가 틀림                              → 문구만, 버튼 없음 (서버 탓이 아니다)
 *   E  한 번도 로그인한 적 없는 기기에서 서버 불통  → 버튼 없음 (이어 갈 기록이 없다) */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const REF = 'ifjgngkkozsiyoafhlkb';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const expiredSession = () => JSON.stringify({
  access_token: 'a.b.c', refresh_token: 'dead-refresh-token', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) - 7200,
  user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', email: 'me@example.com' },
});

/* mode: 'refresh-rejected' | 'unreachable' | 'key-rejected' | 'wrong-password' */
async function boot(browser, { signedInOnce = true, storedSession = false, server }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.route(/supabase\.co/, (route) => {
    const url = route.request().url();
    if (server === 'unreachable') return route.abort('failed');
    if (server === 'key-rejected') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.' }) });
    if (server === 'wrong-password') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials' }) });
    if (server === 'refresh-rejected') {
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found', message: 'Invalid Refresh Token: Refresh Token Not Found' }) });
    }
    return route.continue();
  });
  await page.addInitScript(({ signedInOnce, storedSession, REF, session }) => {
    if (signedInOnce) localStorage.setItem('jp_manabu_signed_in_v1', '1');
    if (storedSession) localStorage.setItem(`sb-${REF}-auth-token`, session);
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, { signedInOnce, storedSession, REF, session: expiredSession() });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.gate, .tabbar').first().waitFor({ timeout: 15000 });
  return { page, ctx };
}

const login = async (page, password = 'secret123') => {
  await page.locator('.gate input[type="email"]').fill('me@example.com');
  await page.locator('.gate input[type="password"]').fill(password);
  await page.locator('.gate .card .submit-btn').first().click();
  await page.waitForTimeout(1200);
};
const toastText = async (page) => (await page.locator('.toast').innerText()).trim();

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  console.log('\n[ A 저장된 세션의 갱신을 서버가 거절 ]');
  {
    const { page, ctx } = await boot(browser, { storedSession: true, server: 'refresh-rejected' });
    page.on('pageerror', (e) => errors.push(e.message));
    ok('관문이 뜬다', await page.locator('.gate').count() === 1);
    ok('★ 「이 기기 기록으로 계속하기」가 뜬다 ★', await page.locator('.gate-offline').count() === 1);
    await page.locator('.gate-offline').click();
    await page.waitForTimeout(800);
    ok('누르면 앱이 열린다', await page.locator('.tabbar').count() === 1 && await page.locator('.gate').count() === 0);
    await ctx.close();
  }

  console.log('\n[ B 로그인을 눌렀는데 서버에 닿지 못함 ]');
  {
    const { page, ctx } = await boot(browser, { server: 'unreachable' });
    ok('처음엔 버튼이 없다(저장된 세션이 없으니 서버를 부르지 않았다 — 아직 모른다)', await page.locator('.gate-offline').count() === 0);
    await login(page);
    const t = await toastText(page);
    ok('★ 영어(Load failed·Failed to fetch)가 그대로 안 뜬다 ★', !/load failed|failed to fetch|networkerror/i.test(t), t);
    ok('★ 한국어로 서버에 닿지 못했다고 알린다 ★', t.includes('서버에 닿지 못했어요'), t);
    ok('★ 이 기기 기록으로 계속하기가 열린다 ★', await page.locator('.gate-offline').count() === 1);
    await page.locator('.gate-offline').click();
    await page.waitForTimeout(700);
    ok('눌러서 들어간다', await page.locator('.tabbar').count() === 1);
    await ctx.close();
  }

  console.log('\n[ C 로그인을 눌렀는데 서버가 키를 거절(401) ]');
  {
    const { page, ctx } = await boot(browser, { server: 'key-rejected' });
    await login(page);
    const t = await toastText(page);
    ok('한국어로 서버가 받지 않는다고 알린다', t.includes('서버가 요청을 받지 않아요') && !/api key/i.test(t), t);
    ok('★ 이 기기 기록으로 계속하기가 열린다 ★', await page.locator('.gate-offline').count() === 1);
    await ctx.close();
  }

  console.log('\n[ D 비밀번호가 틀림 — 서버 탓이 아니다 ]');
  {
    const { page, ctx } = await boot(browser, { server: 'wrong-password' });
    await login(page, 'wrongpass');
    const t = await toastText(page);
    ok('비밀번호가 틀렸다고 알린다', t.includes('이메일이나 비밀번호가 맞지 않아요'), t);
    ok('★ 이때는 버튼이 안 열린다 — 내가 고칠 일이다 ★', await page.locator('.gate-offline').count() === 0);
    await ctx.close();
  }

  console.log('\n[ E 한 번도 로그인한 적 없는 기기 ]');
  {
    const { page, ctx } = await boot(browser, { signedInOnce: false, server: 'unreachable' });
    await login(page);
    const t = await toastText(page);
    ok('한국어 안내는 똑같이 뜬다', t.includes('서버에 닿지 못했어요'), t);
    ok('★ 이어 갈 기록이 없으니 버튼은 안 뜬다 ★', await page.locator('.gate-offline').count() === 0);
    await ctx.close();
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
