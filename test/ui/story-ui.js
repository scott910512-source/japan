/* 이야기 연속 듣기 — 진짜 화면에서. 서버는 가로채고(밖으로 안 나간다) 기기 음성은 가짜로 바꿔 무엇을 어떤 속도로 읽었는지 적는다.
 *   · 듣기 고르기에 「이야기 연속 듣기」가 있고, 처음에는 비어 있다(글은 앱에 들어 있지 않다)
 *   · 파일(.json · .txt)을 불러오면 목록에 뜨고 기기에 남는다
 *   · 시작하면 문장이 끊기지 않고 이어진다 — 고른 속도로, 고른 횟수만큼, 해석은 고른 대로
 *   · 잠시 멈춤 · 문장을 눌러 건너뛰기 · 구간으로 가기
 *   · 그만두고 다시 오면 듣던 자리부터 이어 듣는다
 *   · 모바일 폭에서 가로로 안 넘친다
 * 여기 쓰는 글은 검사용으로 지은 것이다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openListen } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

const JP = ['皆さん、こんにちは。', '今日は天気がいいです。', '朝、コーヒーを飲みました。', 'それから駅まで歩きました。', '電車は少し混んでいました。'];
const KO = ['여러분, 안녕하세요.', '오늘은 날씨가 좋아요.', '아침에 커피를 마셨어요.', '그러고 나서 역까지 걸었어요.', '전철은 조금 붐볐어요.'];
const STORY_JSON = JSON.stringify({ format: 'jp-hunter-stories', version: 1, stories: [{
  id: 'demo-1', title: '아침 이야기', level: 'N5', source: '검사용',
  sections: [
    { title: '', paras: [[{ jp: JP[0], ko: KO[0] }, { jp: JP[1], ko: KO[1] }]] },
    { title: '月曜日', titleKo: '월요일', paras: [[{ jp: JP[2], ko: KO[2] }, { jp: JP[3], ko: KO[3] }], [{ jp: JP[4], ko: KO[4] }]] },
  ],
}] });
const STORY_TXT = `제목: [N5 - N4] 10-minute simple Japanese listening | My small garden
채널: Test Channel
URL: https://www.youtube.com/watch?v=abcdef12345
============================================================

庭に花があります。毎朝、水をやります。

【春】
春は花がたくさん咲きます。とてもきれいです。
`;

(async () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  const user = { id: '33333333-3333-3333-3333-333333333333', aud: 'authenticated', role: 'authenticated', email: 'qa@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, exp, role: 'authenticated', aud: 'authenticated' })}.sig`;
  const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user };

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let pushed = '';
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', async (route) => {
    const req = route.request(); const url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    if (url.includes('/rest/v1/user_data') && req.method() === 'POST') { pushed += req.postData() || ''; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await ctx.addInitScript(([s]) => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('sb-ifjgngkkozsiyoafhlkb-auth-token', JSON.stringify(s));
      localStorage.setItem('jp_manabu_signed_in_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3 }));
    }
    /* 가짜 기기 음성 — 무엇을 어떤 말 · 속도로 읽었는지 적고, 글자 수만큼 걸린 뒤 끝났다고 알린다 */
    window._spoken = [];
    const live = new Set();
    const synth = window.speechSynthesis;
    const fake = {
      speak(u) {
        if (!String(u.text || '').trim()) return;
        const rec = { text: u.text, lang: u.lang, rate: u.rate, at: Date.now() };
        window._spoken.push(rec);
        const job = { u, t1: setTimeout(() => u.onstart?.({}), 15), t2: setTimeout(() => { live.delete(job); rec.end = Date.now(); u.onend?.({}); }, 60 + u.text.length * 12) };
        live.add(job);
      },
      cancel() { for (const j of live) { clearTimeout(j.t1); clearTimeout(j.t2); j.u.onerror?.({ error: 'canceled' }); } live.clear(); },
      getVoices: () => [],
      get speaking() { return live.size > 0; },
    };
    for (const k of ['speak', 'cancel', 'getVoices']) { try { Object.defineProperty(synth, k, { configurable: true, value: fake[k] }); } catch { /* 무시 */ } }
    try { Object.defineProperty(synth, 'speaking', { configurable: true, get: () => live.size > 0 }); } catch { /* 무시 */ }
  }, [session]);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 30000 });
  const spoken = () => page.evaluate(() => window._spoken.map((x) => ({ ...x })));
  const clearSpoken = () => page.evaluate(() => { window._spoken.length = 0; });
  const at = async () => Number(await page.locator('.sl-run').getAttribute('data-at'));
  const upload = (files) => page.locator('.sl-file').setInputFiles(files);

  console.log('\n[ 들어가기 · 비어 있는 화면 ]');
  await openListen(page, 'story');
  ok('듣기 고르기에서 「이야기 연속 듣기」가 열린다', await page.locator('.sl-setup').count() === 1 && (await page.locator('.subscreen.open .sub-title').innerText()).includes('이야기 연속 듣기'));
  ok('★ 처음에는 이야기가 없다(글은 앱에 들어 있지 않다) ★', await page.locator('.sl-empty').count() === 1 && await page.locator('.sl-item').count() === 0 && await page.locator('.sl-start').count() === 0);

  console.log('\n[ 파일 불러오기 ]');
  await upload([{ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{ 깨진 파일') }]);
  await page.waitForTimeout(500);
  ok('못 읽는 파일은 알리고 아무것도 안 담는다', (await page.locator('.toast').innerText()).includes('읽을 수 없는') && await page.locator('.sl-item').count() === 0);
  await upload([
    { name: 'stories.json', mimeType: 'application/json', buffer: Buffer.from(STORY_JSON) },
    { name: 'garden.txt', mimeType: 'text/plain', buffer: Buffer.from(STORY_TXT) },
  ]);
  await page.waitForTimeout(600);
  ok('★ json과 txt를 한꺼번에 불러온다 ★', await page.locator('.sl-item').count() === 2, (await page.locator('.toast').innerText()).trim());
  const rows = (await page.locator('.sl-item').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  ok('목록에 제목 · 급수 · 문장 수 · 해석 여부가 보인다', rows[0].includes('아침 이야기') && rows[0].includes('N5') && rows[0].includes('5문장') && rows[0].includes('해석 있음') && rows[1].includes('My small garden') && rows[1].includes('4문장') && !rows[1].includes('해석 있음'), rows.join(' | '));
  ok('★ 기기에 남는다 ★', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_stories_v1') || '[]').length) === 2);

  console.log('\n[ 설정 ]');
  ok('기본은 천천히(0.75배) · 문장마다 1번 · 해석 글자로', await page.locator('.sl-rates [data-rate="0.75"].active').count() === 1 && await page.locator('.sl-repeats [data-repeat="1"].active').count() === 1 && await page.locator('.sl-kos [data-ko="text"].active').count() === 1);
  await page.locator('.sl-item[data-story="yt-abcdef12345"] .sl-itembody').click();
  ok('해석이 없는 이야기는 해석을 고를 수 없다', await page.locator('.sl-kos [data-ko="voice"]').isDisabled() && await page.locator('.sl-kos [data-ko="off"].active').count() === 1 && (await page.locator('.sl-konote').innerText()).includes('해석이 없는'));
  await page.locator('.sl-item[data-story="demo-1"] .sl-itembody').click();
  await page.locator('.sl-rates [data-rate="0.6"]').click();
  ok('속도를 바꾸면 기억한다', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_story_prefs_v1')).rate) === 0.6);
  ok('가로로 넘치지 않는다(고르기)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 이어서 흘러간다 ]');
  await clearSpoken();
  await page.locator('.sl-first').click();
  await page.locator('.sl-run').waitFor({ timeout: 5000 });
  await page.waitForFunction(() => Number(document.querySelector('.sl-run')?.dataset.at) >= 3, null, { timeout: 20000 });
  let said = (await spoken()).filter((x) => x.lang === 'ja-JP');
  ok('★ 손을 안 대도 문장이 차례로 이어진다 ★', said.slice(0, 3).map((x) => x.text).join('|') === JP.slice(0, 3).join('|'), said.map((x) => x.text).join(' → '));
  ok('★ 고른 속도(0.6배)로 읽는다 ★', said.every((x) => Math.abs(x.rate - 0.6) < 0.001), said.map((x) => x.rate.toFixed(2)).join(','));
  ok('★ 앞 문장이 끝난 뒤에 다음 문장을 읽는다(겹치지 않는다) ★', said.slice(1).every((x, i) => x.at >= said[i].end), said.map((x) => `${x.at % 100000}~${(x.end || 0) % 100000}`).join(' '));
  ok('해석을 「글자로」 두면 뜻이 화면에만 보이고 소리로는 안 읽는다', (await spoken()).every((x) => x.lang !== 'ko-KR') && KO.includes((await page.locator('.sl-ko').innerText()).trim()));
  ok('지금 읽는 문장만 밝아지고 구간이 따라온다', await page.locator('.sl-s.cur').count() === 1 && (await page.locator('.sl-s.cur').innerText()) === JP[await at()] && (await page.locator('.sl-sec.active').innerText()).includes('월요일'));

  console.log('\n[ 잠시 멈춤 · 건너뛰기 ]');
  await page.locator('.sl-pause').click();
  await page.waitForTimeout(300);
  const stoppedAt = await at(); const n0 = (await spoken()).length;
  await page.waitForTimeout(1500);
  ok('★ 멈추면 더 읽지 않고 그 자리에 선다 ★', await at() === stoppedAt && (await spoken()).length === n0 && (await page.locator('.sl-status').innerText()).includes('잠시 멈춤'));
  await page.locator('.sl-s[data-at="1"]').click();
  await page.waitForTimeout(400);
  ok('★ 문장을 누르면 그 문장부터 다시 읽는다 ★', (await spoken()).pop().text === JP[1] && await page.locator('.sl-run').getAttribute('data-playing') === '1');
  await page.locator('.sl-sec[data-sec="1"]').click();
  await page.waitForTimeout(400);
  ok('구간을 누르면 그 구간의 첫 문장으로 간다', (await spoken()).pop().text === JP[2]);
  await page.locator('.sl-quick [data-rate="1"]').click();
  await page.waitForTimeout(400);
  ok('듣는 중에 속도를 바꾸면 바로 그 속도로 읽는다', (await spoken()).pop().rate === 1);
  ok('가로로 넘치지 않는다(듣는 중)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 이어 듣기 ]');
  await page.locator('.sl-prev').click();
  await page.waitForTimeout(260);
  await page.locator('.sl-s[data-at="3"]').click();
  await page.waitForTimeout(300);
  await page.locator('.sl-quit').click();
  await page.waitForTimeout(400);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_story_pos_v1') || '{}')['demo-1']);
  ok('★ 그만두면 듣던 자리를 기억한다 ★', kept >= 3 && (await page.locator('.sl-item[data-story="demo-1"] .sl-resume').innerText()).includes(`${kept + 1}번째`), `자리 ${kept}`);
  ok('「이어 듣기」와 「처음부터 듣기」가 같이 나온다', (await page.locator('.sl-continue').innerText()).includes(`${kept + 1}번째 문장부터`) && (await page.locator('.sl-first').innerText()).includes('처음부터'));

  console.log('\n[ 반복 · 해석을 소리로 ]');
  await page.locator('.sl-repeats [data-repeat="2"]').click();
  await page.locator('.sl-kos [data-ko="voice"]').click();
  await clearSpoken();
  await page.locator('.sl-continue').click();
  await page.waitForFunction(() => window._spoken.filter((x) => x.lang === 'ko-KR').length >= 1, null, { timeout: 20000 });
  said = await spoken();
  const first = JP[kept];
  ok('★ 문장마다 2번 읽고 나서 뜻을 읽는다 ★', said[0].text === first && said[1].text === first && said[2].lang === 'ko-KR' && said[2].text === KO[kept], said.slice(0, 3).map((x) => `${x.lang}:${x.text}`).join(' → '));
  await page.waitForFunction(() => !document.querySelector('.sl-run'), null, { timeout: 30000 });
  ok('★ 끝까지 가면 멈추고 알려 준다 ★', (await page.locator('.toast').innerText()).includes('끝까지 들었어요') && await page.locator('.sl-setup').count() === 1);
  ok('다 들은 이야기는 처음부터로 돌아간다', await page.locator('.sl-continue').count() === 0 && await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_story_pos_v1'))['demo-1']) === 0);
  ok('들은 문장이 활동 기록에 남는다', await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('jp_manabu_stats_v1') || '{}')).some((d) => d.listened > 0)));

  console.log('\n[ 지우기 · 올리지 않기 ]');
  page.once('dialog', (d) => d.accept());
  await page.locator('.sl-item[data-story="yt-abcdef12345"] .sl-del').click();
  await page.waitForTimeout(400);
  ok('지우면 목록과 기기에서 사라진다', await page.locator('.sl-item').count() === 1 && await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_stories_v1')).length) === 1);
  await page.waitForTimeout(14000);   // 올리기는 바뀐 뒤 12초쯤에 간다
  ok('★ 이야기 글은 계정으로 올라가지 않는다 ★', pushed.length > 0 && !pushed.includes(JP[0]) && !pushed.includes('庭に花'), `올린 양 ${pushed.length}자`);

  ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '없음');
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error('CRASH', err); process.exit(1); });
