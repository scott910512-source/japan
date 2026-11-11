/* 계정 동기화 — 가짜 서버(가로챈 요청)로 본다. 실제 서버에는 아무것도 안 보낸다.
 *
 *   1. 가만히 두면 동기화가 되풀이되지 않는다
 *      동기화가 돌려준 값을 얹는 것을 「이 기기에서 바뀐 것」으로 세서, 로그인해 있는 동안 12초마다 끝없이 내려받고 올렸다.
 *   2. 요청이 오가는 동안 판정한 카드가 사라지지 않는다
 *      동기화가 끝나면 보내기 전의 값으로 합친 결과를 그대로 덮어서, 그 사이에 판정한 카드의 회독 기록과 그날 활동이
 *      이 기기에서 사라지고 서버에도 못 올라갔다(2분마다 올리는 동기화가 학습 중에 돈다).
 *   3. 그 사이에 바뀐 것은 다음 올리기로 서버에 간다 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { startStudy } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

(async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'qa@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', aud: 'authenticated' })}.sig`;
  const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  let server = null; let gets = 0; let posts = 0; let delay = 0; const getTimes = []; let onGet = null;
  /* 주소는 src/lib/supabase.js에 적힌 그 프로젝트다. 요청은 전부 여기서 가로채 답한다 — 밖으로 안 나간다 */
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', async (route) => {
    const req = route.request(); const url = req.url(); const m = req.method();
    if (url.includes('/auth/v1/')) {
      if (url.includes('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    }
    if (url.includes('/rest/v1/user_data')) {
      if (m === 'GET') {
        gets++; getTimes.push(Date.now()); onGet?.();
        const snap = server;                       // server state at request time
        if (delay) await new Promise((r) => setTimeout(r, delay));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snap ? [snap] : []) });
      }
      if (m === 'POST') { posts++; const body = req.postDataJSON(); server = Array.isArray(body) ? body[0] : body; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
      if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await ctx.addInitScript(([s]) => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('sb-ifjgngkkozsiyoafhlkb-auth-token', JSON.stringify(s));
      localStorage.setItem('jp_manabu_signed_in_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3 }));
    }
  }, [session]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 30000 });
  const t0 = Date.now();

  console.log('\n[ 가만히 두면 동기화가 되풀이되지 않는다 ]');
  await page.waitForTimeout(30000);
  ok('★ 로그인 직후 한 번만 맞춘다(30초 동안 내려받기 1번) ★', gets === 1 && posts === 1, `내려받기 ${gets} · 올리기 ${posts} · 시각(초) ${getTimes.map((t) => ((t - t0) / 1000).toFixed(1)).join(',')}`);

  console.log('\n[ 요청이 오가는 동안 판정한 카드 ]');
  await startStudy(page);
  await page.waitForTimeout(800);
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const seenToday = () => page.evaluate((day) => Object.entries(JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}')).filter(([, s]) => s.lastSeen === day).map(([id]) => id), today);
  const statToday = () => page.evaluate((day) => (JSON.parse(localStorage.getItem('jp_manabu_stats_v1') || '{}'))[day] || null, today);
  const judge = async () => {
    if (await page.locator('.sc-reveal').count()) await page.locator('.sc-reveal').click();
    await page.locator('.judge.known').waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.locator('.judge.known').click();
    await page.waitForTimeout(700);
  };
  await judge();                                    // 카드 하나 — 12초 뒤에 올리기가 잡힌다
  ok('카드 하나를 판정했다', (await seenToday()).length === 1);
  delay = 4000;                                     // 다음 동기화는 내려받는 데 4초 걸린다
  const postsBefore = posts;
  await new Promise((res) => { onGet = () => { onGet = null; res(); }; });
  await page.waitForTimeout(400);
  await judge();                                    // 그 4초 사이에 한 장 더
  const during = await seenToday();
  ok('오가는 중에 한 장 더 판정했다', during.length === 2 && (await statToday())?.studied === 2, JSON.stringify(during));
  while (posts === postsBefore) await page.waitForTimeout(200);
  await page.waitForTimeout(1500);
  const after = await seenToday();
  ok('★ 동기화가 끝난 뒤에도 그 카드의 회독 기록이 남아 있다 ★', after.length === 2 && during.every((id) => after.includes(id)), JSON.stringify(after));
  ok('★ 그날 활동도 그대로다(2장) ★', (await statToday())?.studied === 2, JSON.stringify(await statToday()));

  console.log('\n[ 그 사이에 바뀐 것은 다음 올리기로 서버에 간다 ]');
  delay = 0;
  const g2 = gets;
  await page.waitForTimeout(18000);
  const onServer = Object.entries(server?.review || {}).filter(([, s]) => s.lastSeen === today).map(([id]) => id);
  ok('★ 서버에도 두 장이 다 있다 ★', after.every((id) => onServer.includes(id)), JSON.stringify(onServer));
  ok('올리기는 한 번만 더 돈다', gets - g2 === 1, `${gets - g2}번`);
  const g3 = gets;
  await page.waitForTimeout(20000);
  ok('★ 그 뒤로는 다시 조용하다 ★', gets === g3, `${gets - g3}번 더`);
  ok('서버 줄에 키가 평문으로 올라가지 않는다', !/Key"/.test(JSON.stringify(server?.settings || {})), Object.keys(server?.settings || {}).filter((k) => /key/i.test(k)).join() || '없음');
  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '깨끗');
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
