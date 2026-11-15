/* 계정을 바꿔 로그인해도 기록이 섞이지 않는다 — 진짜 화면에서
 *
 * 기존 계정에서 로그아웃하고 새 계정으로 가입했더니 새 계정에 기존 기록(복습 32개 · 9일째)이 그대로 올라갔다.
 * 로그아웃해도 이 기기의 기록은 남고, 첫 동기화가 그것을 새 계정에 합쳐 올렸기 때문이다.
 *   · 다른 계정으로 로그인하면 이 기기의 기록은 이전 계정 보관함으로 옮기고, 새 계정은 자기 클라우드 기록으로 시작한다
 *   · 새 계정의 클라우드에 이전 계정의 기록 · API 키가 올라가지 않는다
 *   · 이전 계정으로 돌아오면 그 기록이 되살아나고, 새 계정에서 공부한 것은 섞이지 않는다
 *   · 로그아웃 전에 못 올린 것을 올린다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMore } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const mkUser = (id, email) => ({ id, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
const mkSession = (u) => ({ access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, exp, role: 'authenticated', aud: 'authenticated' })}.sig`, refresh_token: `r-${u.id}`, token_type: 'bearer', expires_in: 86400, expires_at: exp, user: u });
const A = mkUser('aaaaaaaa-0000-0000-0000-00000000000a', 'old@example.com');
const B = mkUser('bbbbbbbb-0000-0000-0000-00000000000b', 'new@example.com');
const PW = { [A.email]: 'pass-a-1234', [B.email]: 'pass-b-1234' };
const today = new Date().toISOString().slice(0, 10);
/* 기존 계정의 기록 — 클라우드와 이 기기에 같은 것이 있다 */
const A_REVIEW = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`n5-${i + 1}`, { box: 3, streak: 2, lastSeen: today, due: today, level: 1 }]));

(async () => {
  const rows = { [A.id]: { user_id: A.id, review: A_REVIEW, progress: { syncUser: A.id }, settings: {}, stats: {}, custom_words: [], streak: { count: 9, lastDate: today }, memos: {}, updated_at: new Date().toISOString() } };
  let current = A; const posts = [];
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', async (route) => {
    const req = route.request(); const url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/token') && url.includes('grant_type=password')) {
      const { email, password } = req.postDataJSON();
      const u = [A, B].find((x) => x.email === email);
      if (!u || PW[email] !== password) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }) });
      current = u;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mkSession(u)) });
    }
    if (url.includes('/auth/v1/signup')) {
      /* 메일 확인을 끈 서버 — 가입하면 바로 로그인된다 */
      const { email, password } = req.postDataJSON();
      const u = mkUser('cccccccc-0000-0000-0000-00000000000c', email); PW[email] = password; current = u;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mkSession(u)) });
    }
    if (url.includes('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) });
    if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mkSession(current)) });
    if (url.includes('/rest/v1/user_data')) {
      if (req.method() === 'POST') {
        const b = req.postDataJSON(); const one = Array.isArray(b) ? b[0] : b;
        posts.push(one); rows[one.user_id] = { ...(rows[one.user_id] || {}), ...one };
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      const id = (url.match(/user_id=eq\.([0-9a-f-]+)/) || [])[1];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[id] ? [rows[id]] : []) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await ctx.addInitScript(([s, rv]) => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('sb-ifjgngkkozsiyoafhlkb-auth-token', JSON.stringify(s));
      localStorage.setItem('jp_manabu_signed_in_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3, gttsKey: 'AIza-KEY-OF-A' }));
      localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rv));
      localStorage.setItem('jp_manabu_progress_v1', JSON.stringify({ syncUser: s.user.id }));
      localStorage.setItem('jp_manabu_streak_v1', JSON.stringify({ count: 9, lastDate: new Date().toISOString().slice(0, 10) }));
    }
    window.speechSynthesis.speak = () => {};
    /* 뜬 알림을 다 적는다 — 알림은 2초 뒤 사라진다 */
    window._toasts = [];
    const watch = () => new MutationObserver(() => { document.querySelectorAll('.toast').forEach((t) => { const x = t.innerText.trim(); if (x && !window._toasts.includes(x)) window._toasts.push(x); }); })
      .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);
  }, [mkSession(A), A_REVIEW]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1500);
  const local = () => page.evaluate(() => ({ review: Object.keys(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).length, streak: JSON.parse(localStorage.getItem('jp_manabu_streak_v1') || '{}').count || 0, syncUser: JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').syncUser || null, key: JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}').gttsKey || '' }));
  const login = async (email) => {
    await page.locator('.gate, .tabbar').first().waitFor({ timeout: 20000 });
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(PW[email]);
    await page.locator('.submit-btn', { hasText: '로그인' }).first().click();
    await page.waitForTimeout(800);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2500);
  };
  const logout = async () => {
    await openMore(page, 'account');
    await page.locator('button', { hasText: '로그아웃' }).first().click();
    await page.waitForTimeout(1500);
  };

  console.log('\n[ 기존 계정 ]');
  const a0 = await local();
  ok('기존 계정의 기록이 이 기기에 있다(복습 32 · 9일째)', a0.review === 32 && a0.streak === 9 && a0.syncUser === A.id, JSON.stringify(a0));

  console.log('\n[ 로그아웃하고 새 계정으로 로그인 ]');
  await logout();
  ok('로그인 화면이 뜬다', await page.locator('.gate').count() === 1);
  await login(B.email);
  const b0 = await local();
  ok('★ 새 계정은 빈 기록으로 시작한다(기존 계정의 복습 · 연속일이 안 보인다) ★', b0.review === 0 && b0.streak === 0, JSON.stringify(b0));
  ok('이 기기의 기록이 새 계정과 맞춰졌다', b0.syncUser === B.id);
  ok('★ 기존 계정의 API 키는 이 기기에서 빠진다 ★', b0.key === '');
  ok('★ 새 계정의 클라우드에 기존 계정의 회독이 안 올라갔다 ★', rows[B.id] && Object.keys(rows[B.id].review || {}).length === 0 && !(rows[B.id].streak?.count > 0), JSON.stringify({ review: Object.keys(rows[B.id]?.review || {}).length, streak: rows[B.id]?.streak }));
  ok('★ 기존 계정의 클라우드는 그대로다 ★', Object.keys(rows[A.id].review).length === 32 && rows[A.id].streak.count === 9);
  ok('무슨 일이 있었는지 알린다', (await page.evaluate(() => window._toasts)).some((t) => t.includes('따로 보관')), JSON.stringify(await page.evaluate(() => window._toasts)));

  /* 새 계정에서 공부한 셈 — 이 기기에 한 장 */
  await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'); r['n4-777'] = { box: 1, lastSeen: new Date().toISOString().slice(0, 10) }; localStorage.setItem('jp_manabu_review_v1', JSON.stringify(r)); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('\n[ 기존 계정으로 돌아오면 ]');
  await logout();
  await login(A.email);
  const a1 = await local();
  ok('★ 기존 계정의 기록이 그대로 돌아온다(32개 · 9일째) ★', a1.review === 32 && a1.streak === 9 && a1.syncUser === A.id, JSON.stringify(a1));
  ok('★ 새 계정에서 공부한 것은 섞이지 않는다 ★', !(await page.evaluate(() => Boolean(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')['n4-777']))));
  ok('★ 기존 계정의 클라우드에도 안 섞였다 ★', !rows[A.id].review['n4-777'] && Object.keys(rows[A.id].review).length === 32);
  ok('★ 기존 계정의 API 키가 돌아온다 ★', a1.key === 'AIza-KEY-OF-A');
  ok('되살렸다고 알린다', (await page.evaluate(() => window._toasts)).some((t) => t.includes('되살렸어요')), JSON.stringify(await page.evaluate(() => window._toasts)));
  ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 새 계정을 가입하면(메일 확인 없이 바로 로그인) ]');
  await logout();
  await page.locator('.gate').waitFor({ timeout: 20000 });
  await page.locator('.acct-links button', { hasText: '가입하기' }).first().click();
  await page.locator('input[type="email"]').first().fill('fresh@example.com');
  await page.locator('input[type="password"]').first().fill('pass-c-1234');
  await page.locator('.submit-btn', { hasText: '가입' }).first().click();
  await page.waitForTimeout(800);
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(2500);
  const c0 = await local();
  ok('★ 가입한 새 계정도 빈 기록으로 시작한다 ★', c0.review === 0 && c0.streak === 0 && c0.key === '', JSON.stringify(c0));
  const C = 'cccccccc-0000-0000-0000-00000000000c';
  ok('★ 가입한 계정의 클라우드에도 기존 기록 · 키가 안 올라갔다 ★', rows[C] && Object.keys(rows[C].review || {}).length === 0 && !rows[C].gtts_key_enc, JSON.stringify({ review: Object.keys(rows[C]?.review || {}).length, key: Boolean(rows[C]?.gtts_key_enc) }));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
