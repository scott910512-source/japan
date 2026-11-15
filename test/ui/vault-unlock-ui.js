/* 로그인은 돼 있는데 API 키가 안 넘어오는 기기 — 비밀번호 한 번으로 키 보관을 켠다
 *
 * 계정에 보관한 API 키는 로그인 비밀번호로 만든 금고 열쇠로 잠근다. 메일 링크로 로그인했거나 오래전부터 로그인돼 있던 기기에는
 * 그 열쇠가 없어서, 로그인해 있어도 키가 안 넘어왔다. 「한 번 로그인하면 켜져요」뿐이라 로그아웃했다 다시 들어오는 것 말고는 길이 없었다.
 *   · 열쇠가 없는 기기: 계정 칸과 음성 설정에 「키 보관이 꺼져 있어요」와 비밀번호 칸이 뜬다
 *   · 틀린 비밀번호: 알려 주고 열쇠를 만들지 않는다
 *   · 맞는 비밀번호: 열쇠를 만들고, 계정에 보관된 음성 · AI 키를 가져온다. 비밀번호는 기기에 남기지 않는다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMore } from './_nav.js';
import { deriveVaultKey, encryptWithVaultKey } from '../../src/lib/crypto.js';
import { packKeys } from '../../src/lib/keyvault.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const PASSWORD = 'right-password-123';
const GTTS = 'AIzaGTTS-KEY-FROM-ACCOUNT';
const GEMINI = 'AQ.GEMINI-KEY-FROM-ACCOUNT';

(async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = { id: '44444444-4444-4444-4444-444444444444', aud: 'authenticated', role: 'authenticated', email: 'qa-vault@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', aud: 'authenticated' })}.sig`;
  const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };
  /* 계정에는 다른 기기(컴퓨터)가 잠가 올린 키 봉투가 있다 */
  const envelope = await encryptWithVaultKey(packKeys({ gttsKey: GTTS, geminiKey: GEMINI }), await deriveVaultKey(PASSWORD, user.id));
  const server = { user_id: user.id, review: {}, progress: {}, settings: {}, stats: {}, custom_words: [], streak: { count: 0, lastDate: null }, memos: {}, gtts_key_enc: envelope, updated_at: new Date().toISOString() };
  const tries = [];

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', async (route) => {
    const req = route.request(); const url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/token') && url.includes('grant_type=password')) {
      const body = req.postDataJSON();
      tries.push(body.password);
      if (body.password !== PASSWORD || body.email !== user.email) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    }
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    if (url.includes('/rest/v1/user_data')) {
      if (req.method() === 'POST') { const b = req.postDataJSON(); Object.assign(server, Array.isArray(b) ? b[0] : b); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([server]) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  /* 메일 링크로 로그인한 기기 — 로그인은 돼 있고, 금고 열쇠는 없다 */
  await ctx.addInitScript(([s]) => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('sb-ifjgngkkozsiyoafhlkb-auth-token', JSON.stringify(s));
      localStorage.setItem('jp_manabu_signed_in_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3 }));
    }
    window.speechSynthesis.speak = () => {};
  }, [session]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  const keys = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1')); return { g: s.gttsKey || '', a: s.geminiKey || '', vault: localStorage.getItem('jp_manabu_vault_v1') }; });

  console.log('\n[ 열쇠가 없는 기기 ]');
  ok('로그인은 돼 있는데 키가 없다(전에는 여기서 끝이었다)', (await keys()).g === '' && !(await keys()).vault);
  await openMore(page, 'account');
  await page.locator('.vault-unlock').first().waitFor({ timeout: 10000 }).catch(() => {});
  ok('★ 계정 칸에 「키 보관이 꺼져 있어요」와 비밀번호 칸이 뜬다 ★', await page.locator('.vault-unlock').count() >= 1 && (await page.locator('.vault-unlock').first().innerText()).includes('키 보관이 꺼져 있어요'));
  ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 틀린 비밀번호 ]');
  await page.locator('.vault-unlock input').first().fill('wrong-password');
  await page.locator('.vault-unlock .vu-go').first().click();
  await page.waitForTimeout(1200);
  ok('★ 틀리면 알려 주고 열쇠를 만들지 않는다 ★', (await page.locator('.vu-err').innerText().catch(() => '')).includes('비밀번호가 맞지 않아요') && !(await keys()).vault && (await keys()).g === '');

  console.log('\n[ 맞는 비밀번호 ]');
  await page.locator('.vault-unlock input').first().fill(PASSWORD);
  await page.locator('.vault-unlock input').first().press('Enter');
  for (let k = 0; k < 20 && !(await keys()).g; k += 1) await page.waitForTimeout(400);
  const after = await keys();
  ok('★ 계정에 보관된 음성 키를 가져온다 ★', after.g === GTTS, after.g);
  ok('★ AI 키도 같이 가져온다 ★', after.a === GEMINI, after.a);
  ok('열쇠가 기기에 남는다(다음부터는 안 묻는다)', Boolean(after.vault));
  ok('★ 비밀번호 자체는 기기 어디에도 남지 않는다 ★', await page.evaluate((pw) => !Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes(pw)), PASSWORD));
  ok('비밀번호 칸은 사라진다', await page.locator('.vault-unlock').count() === 0);
  ok('서버에는 이 계정 이메일로 한 번씩만 물었다', tries.length === 2);

  console.log('\n[ 다시 열어도 ]');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
  await openMore(page, 'voice');
  await page.waitForTimeout(600);
  ok('★ 음성 설정에 「계정에 암호화해서 보관 중」이 뜬다 ★', (await page.locator('.vault-state').innerText().catch(() => '')).includes('보관 중') && await page.locator('.vault-unlock').count() === 0);

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
