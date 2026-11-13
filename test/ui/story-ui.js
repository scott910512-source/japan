/* 이야기 연속 듣기 — 진짜 화면에서. 서버는 가로채고(밖으로 안 나간다) 기기 음성은 가짜로 바꿔 무엇을 어떤 속도로 읽었는지 적는다.
 *   · 듣기 고르기에 「이야기 연속 듣기」가 있고, 처음에는 비어 있다(글은 앱에 들어 있지 않다)
 *   · 파일(.json · .txt)을 불러오면 목록에 뜨고 기기에 남는다
 *   · 불러온 글은 내 계정으로 올라가서, 한 번도 안 불러온 다른 기기에도 뜬다. 지운 것은 거기서도 안 뜬다
 *   · 시작하면 문장이 끊기지 않고 이어진다 — 고른 속도로, 고른 횟수만큼, 해석은 고른 대로
 *   · 듣는 화면은 화면을 통째로 쓰고 글자가 크다. 글자 크기를 바꿀 수 있고, 가로로 눕혀도 조작대가 화면 안에 있다
 *   · 잠시 멈춤 · 구간으로 가기. 문장을 한 번 누르면 해석과 낱말 뜻(재생은 그대로), 「여기부터 듣기」로 건너뛴다
 *   · 꾹 누르거나 두 번 누르면 그 문장을 붙인 곤 질문 창이 열리고, 묻는 동안 읽기를 멈춘다
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
  /* 가짜 서버 — 계정의 줄 하나를 들고 있다. 두 기기(브라우저 창 둘)가 같은 줄을 본다 */
  let server = null; const posts = [];
  const serve = async (route) => {
    const req = route.request(); const url = req.url();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
    if (url.includes('/rest/v1/user_data')) {
      if (req.method() === 'POST') {
        const body = req.postDataJSON(); const one = Array.isArray(body) ? body[0] : body;
        posts.push(one); server = { ...(server || {}), ...one };          // 보낸 칸만 바뀐다(upsert)
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(server ? [server] : []) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  };
  const seed = ([s]) => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('sb-ifjgngkkozsiyoafhlkb-auth-token', JSON.stringify(s));
      localStorage.setItem('jp_manabu_signed_in_v1', '1');
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3, geminiKey: 'AQ.test-not-a-real-key' }));
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
  };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', serve);
  /* AI 자리에는 가짜 답을 놓는다 — 무엇을 보냈는지만 적는다 */
  const ai = { n: 0, last: '' };
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    ai.n += 1; ai.last = route.request().postData() || '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: '검사용 답이에요.', items: [], kanji: [], tips: [] }) }] } }] }) });
  });
  await ctx.addInitScript(seed, [session]);
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

  console.log('\n[ 화면을 통째로 · 큰 글자 ]');
  const cover = await page.evaluate(() => {
    const r = document.querySelector('.sl-full').getBoundingClientRect();
    const top = document.elementFromPoint(20, 20); const bottom = document.elementFromPoint(innerWidth / 2, innerHeight - 20);
    return { full: r.left === 0 && r.top === 0 && Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight, top: Boolean(top?.closest('.sl-full')), bottom: Boolean(bottom?.closest('.sl-full')), font: parseFloat(getComputedStyle(document.querySelector('.sl-para')).fontSize) };
  });
  ok('★ 듣는 화면이 화면을 통째로 쓴다(앱 머리 · 뒤로 줄 · 아래까지 덮는다) ★', cover.full && cover.top && cover.bottom, JSON.stringify(cover));
  ok('★ 글자가 크다(기본 「크게」 24px) ★', cover.font >= 23, `${cover.font}px`);
  await page.locator('.sl-size').click();
  await page.waitForTimeout(200);
  const bigger = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sl-para')).fontSize));
  ok('★ 「가」를 누르면 글자가 더 커지고 기억한다 ★', bigger > cover.font && await page.evaluate(() => JSON.parse(localStorage.getItem('jp_story_prefs_v1')).size) === 'xl', `${cover.font} → ${bigger}px`);
  await page.locator('.sl-size').click(); await page.waitForTimeout(260);
  await page.locator('.sl-size').click(); await page.waitForTimeout(200);
  ok('한 바퀴 돌면 다시 「크게」다', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_story_prefs_v1')).size) === 'l');

  console.log('\n[ 가로로 눕혀도 ]');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  const land = await page.evaluate(() => {
    const b = document.querySelector('.sl-pause').getBoundingClientRect(); const q = document.querySelector('.sl-quit').getBoundingClientRect(); const sc = document.querySelector('.sl-scroll').getBoundingClientRect();
    return { pause: b.top >= 0 && b.bottom <= innerHeight, quit: q.top >= 0 && q.bottom <= innerHeight, text: Math.round(sc.height), over: document.documentElement.scrollWidth <= innerWidth };
  });
  ok('★ 조작대와 「그만 듣기」가 화면 안에 있고, 글 자리가 남는다 ★', land.pause && land.quit && land.text >= 150 && land.over, JSON.stringify(land));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

  console.log('\n[ 문장을 한 번 누르면 해석 · 낱말 뜻 ]');
  const nSpoken = (await spoken()).length;
  await page.locator('.sl-s[data-at="2"]').click();
  await page.waitForTimeout(300);
  const pick = (await page.locator('.sl-pick').innerText().catch(() => '')).replace(/\s+/g, ' ');
  ok('★ 그 문장의 해석이 뜬다 ★', pick.includes(KO[2]) && pick.includes('3번째 문장'), pick.slice(0, 90));
  ok('★ 문장 속 낱말의 뜻도 붙는다(앱 사전에 있는 것) ★', pick.includes('飲む') && pick.includes('마시다') && pick.includes('朝'), pick.slice(0, 140));
  ok('★ 누르기만 해서는 읽는 자리가 안 바뀐다 ★', await at() === stoppedAt && (await spoken()).length === nSpoken && await page.locator('.sl-s.sel').getAttribute('data-at') === '2');
  await page.waitForTimeout(260);
  await page.locator('.sl-s[data-at="2"]').click();
  await page.waitForTimeout(300);
  ok('같은 문장을 다시 누르면 닫힌다', await page.locator('.sl-pick').count() === 0);
  await page.locator('.sl-s[data-at="1"]').click();
  await page.waitForTimeout(300);
  await page.locator('.sl-pick .sl-from').click();
  await page.waitForTimeout(400);
  ok('★ 「여기부터 듣기」를 누르면 그 문장부터 다시 읽는다 ★', (await spoken()).pop().text === JP[1] && await page.locator('.sl-run').getAttribute('data-playing') === '1' && await page.locator('.sl-pick').count() === 0);
  await page.locator('.sl-sec[data-sec="1"]').click();
  await page.waitForTimeout(400);
  ok('구간을 누르면 그 구간의 첫 문장으로 간다', (await spoken()).pop().text === JP[2]);
  await page.locator('.sl-quick [data-rate="1"]').click();
  await page.waitForTimeout(400);
  ok('듣는 중에 속도를 바꾸면 바로 그 속도로 읽는다', (await spoken()).pop().rate === 1);
  ok('가로로 넘치지 않는다(듣는 중)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 꾹 누르거나 두 번 눌러 곤에게 묻기 ]');
  {
    const box = await page.locator('.sl-s[data-at="4"]').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(600);
    ok('★ 꾹 누르면 곤 질문 창이 열리고 고른 문장이 붙어 있다 ★', await page.locator('.sheet.open .asksheet').count() === 1 && (await page.locator('.sheet.open .ask-chip').innerText()).includes(JP[4]) && (await page.locator('.sheet.open .asksheet h3').innerText()).includes('곤에게 물어보기'), (await page.locator('.sheet.open .ask-chip').innerText().catch(() => '')));
    ok('★ 묻는 동안은 읽기를 멈춘다 ★', await page.locator('.sl-run').getAttribute('data-playing') === '0');
    ok('꾹 누른 뒤 손을 떼도 해석 칸이 닫히지 않는다(고른 문장 그대로)', await page.locator('.sl-s.sel').getAttribute('data-at') === '4');
    await page.locator('.sheet.open .asksheet textarea').fill('이 문장 문법을 설명해 줘');
    await page.locator('.sheet.open .asksheet .ask-box > .submit-btn').click();
    await page.locator('.sheet.open .ask-text').waitFor({ timeout: 8000 });
    ok('★ 질문과 함께 고른 문장 · 해석을 보낸다 ★', ai.n === 1 && ai.last.includes(JP[4]) && ai.last.includes(KO[4]) && ai.last.includes('이 문장 문법을 설명해 줘'));
    ok('답이 같은 창에 뜬다', (await page.locator('.sheet.open .ask-text').innerText()).includes('검사용 답'));
    ok('가로로 넘치지 않는다(질문 창)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.sheet.open .sheet-x').click();
    await page.waitForTimeout(600);
    ok('창을 닫으면 듣는 화면으로 돌아온다(읽기는 멈춘 채)', await page.locator('.sheet.open').count() === 0 && await page.locator('.sl-full').count() === 1 && await page.locator('.sl-run').getAttribute('data-playing') === '0');
    await page.locator('.sl-s[data-at="0"]').dblclick();
    await page.waitForTimeout(600);
    const chip = (await page.locator('.sheet.open .ask-chip').innerText().catch(() => '')).trim();
    ok('★ 두 번 눌러도 질문 창이 열린다(그 문장이나 고른 낱말이 붙는다) ★', await page.locator('.sheet.open .asksheet').count() === 1 && chip.length > 0 && JP[0].includes(chip.split(/\s/)[0]), chip);
    await page.locator('.sheet.open .sheet-x').click();
    await page.waitForTimeout(600);
    await page.locator('.sl-pickx').click().catch(() => {});
    await page.waitForTimeout(200);
  }

  console.log('\n[ 이어 듣기 ]');
  await page.locator('.sl-prev').click();
  await page.waitForTimeout(260);
  await page.locator('.sl-s[data-at="3"]').click();
  await page.waitForTimeout(300);
  await page.locator('.sl-pick .sl-from').click();
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

  console.log('\n[ 내 계정에 저장 ]');
  await page.waitForFunction(() => true, null, { timeout: 1000 });
  for (let i = 0; i < 40 && !(server?.videos?.stories?.list?.length === 2); i += 1) await page.waitForTimeout(500);   // 올리기는 바뀐 뒤 12초쯤에 간다
  ok('★ 불러온 이야기가 내 계정으로 올라간다(해석까지) ★', server?.videos?.stories?.list?.length === 2 && JSON.stringify(server.videos.stories).includes(JP[0]) && JSON.stringify(server.videos.stories).includes(KO[0]), `이야기 ${server?.videos?.stories?.list?.length}편`);

  console.log('\n[ 지우기 ]');
  page.once('dialog', (d) => d.accept());
  await page.locator('.sl-item[data-story="yt-abcdef12345"] .sl-del').click();
  await page.waitForTimeout(400);
  ok('지우면 목록과 기기에서 사라진다', await page.locator('.sl-item').count() === 1 && await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_stories_v1')).length) === 1);
  for (let i = 0; i < 40 && !(server?.videos?.stories?.removed?.['yt-abcdef12345'] > 0); i += 1) await page.waitForTimeout(500);
  ok('★ 지운 표시도 계정으로 올라간다 ★', server?.videos?.stories?.removed?.['yt-abcdef12345'] > 0 && server.videos.stories.list.length === 1);
  const before = posts.length;
  await page.locator('.sl-first').click();                               // 한 문장 듣는다 → 활동이 바뀌어 올리기가 한 번 더 돈다
  await page.waitForFunction(() => Number(document.querySelector('.sl-run')?.dataset.at) >= 1, null, { timeout: 20000 });
  await page.locator('.sl-quit').click();
  for (let i = 0; i < 40 && posts.length === before; i += 1) await page.waitForTimeout(500);
  ok('★ 글이 그대로면 그 뒤로는 큰 칸(영상 · 이야기)을 다시 올리지 않는다 ★', posts.length > before && posts.slice(before).every((p) => !('videos' in p)), `그 뒤 올리기 ${posts.length - before}번`);

  console.log('\n[ 다른 기기 — 한 번도 안 불러왔다 ]');
  {
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx2.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', serve);
    await ctx2.addInitScript(seed, [session]);
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => errors.push(e.message));
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p2.locator('.tabbar').waitFor({ state: 'attached', timeout: 30000 });
    await p2.waitForFunction(() => JSON.parse(localStorage.getItem('jp_manabu_stories_v1') || '[]').length > 0, null, { timeout: 20000 }).catch(() => {});
    await openListen(p2, 'story');
    const rows2 = (await p2.locator('.sl-item').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
    ok('★ 파일을 안 불러와도 계정에 있던 이야기가 뜬다 ★', rows2.length === 1 && rows2[0].includes('아침 이야기') && rows2[0].includes('해석 있음'), rows2.join(' | '));
    ok('★ 다른 기기에서 지운 이야기는 안 뜬다 ★', await p2.locator('.sl-item[data-story="yt-abcdef12345"]').count() === 0);
    ok('듣던 자리는 기기마다 따로다(여기서는 처음부터)', await p2.locator('.sl-continue').count() === 0 && await p2.locator('.sl-first').count() === 1);
    await p2.locator('.sl-first').click();
    await p2.waitForFunction(() => Number(document.querySelector('.sl-run')?.dataset.at) >= 1, null, { timeout: 20000 });
    ok('받은 이야기를 바로 들을 수 있다', (await p2.evaluate(() => window._spoken[0]?.text)) === JP[0]);
    await ctx2.close();
  }

  ok('페이지 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | ') || '없음');
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error('CRASH', err); process.exit(1); });
