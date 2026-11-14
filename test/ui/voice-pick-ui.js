/* 목소리 고르기 — 회화형 목소리
 *
 * 긴 글 · 일상 회화를 낭독형(Neural2)이 읽으면 딱딱하다. 회화형(Chirp 3 HD) 목소리를 목록 맨 위에 따로 둔다.
 *   · 설정 → 음성 → 목소리에 「회화형」 묶음 4개(여성 2 · 남성 2)가 맨 위에 있고, 낭독형 9개는 그대로다
 *   · 고르면 그 목소리 이름으로 구글에 부르고 설정에 남는다
 *   · 이 키가 회화형을 못 쓰면 「여성 1」로 대신 읽고 알려 준다(기기 음성으로 떨어지지 않는다)
 *   · 이야기 연속 듣기는 제 목소리를 따로 고른다 — 낱말 카드는 낭독형으로 두고 이야기만 회화형으로 들을 수 있다
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMore, openListen } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://ifjgngkkozsiyoafhlkb.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  /* 가짜 구글 음성 — 어떤 목소리로 불렀는지 적는다. reject에 든 목소리는 400으로 거절한다 */
  const tts = { calls: [], reject: '' };
  await ctx.route('**/texttospeech.googleapis.com/**', async (route) => {
    const body = route.request().postDataJSON();
    tts.calls.push({ name: body.voice?.name || null, text: body.input?.text || '', rate: body.audioConfig?.speakingRate ?? null });
    if (tts.reject && body.voice?.name?.includes(tts.reject)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Voice does not exist' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ audioContent: '//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA' }) });
  });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('qa_seeded')) {
      localStorage.setItem('qa_seeded', '1');
      localStorage.setItem('jp_manabu_guest_v1', '1');
      localStorage.setItem('jp_manabu_stories_v1', JSON.stringify([{ id: 'v1', title: '목소리 검사', sections: [{ title: '', paras: [[{ jp: '夜は家族と一緒に晩御飯を食べます。', ko: '밤에는 가족과 함께 저녁을 먹어요.' }, { jp: '寝る前には準備を整えてから寝ます。', ko: '자기 전에는 준비를 하고 자요.' }]] }] }]));
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify({ onboarded: true, canReadKana: true, autoTTS: false, goalsV: 3, gttsKey: 'AIzaTEST-NOT-A-REAL-KEY', useCloudTTS: true }));
    }
    window._device = [];
    /* 가짜 소리는 진짜 mp3가 아니라 브라우저가 못 튼다 — 재생은 된 것으로 친다(안 그러면 기기 음성으로 넘어간다) */
    HTMLMediaElement.prototype.play = function play() { setTimeout(() => this.dispatchEvent(new Event('ended')), 60); return Promise.resolve(); };
    Object.defineProperty(HTMLMediaElement.prototype, 'error', { configurable: true, get: () => null });
    const synth = window.speechSynthesis;
    if (synth) { synth.speak = (u) => { if (u.text.trim()) window._device.push(u.text);   /* 빈 발화는 소리 열기(무음)다 — 대신 읽은 것이 아니다 */ setTimeout(() => u.onend?.({}), 50); }; synth.cancel = () => {}; }
  });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.tabbar').waitFor({ state: 'visible', timeout: 30000 });
  await openMore(page, 'voice');
  await page.locator('.voicegrid').first().waitFor({ timeout: 15000 });

  console.log('\n[ 목소리 목록 ]');
  const talk = await page.locator('.voicegrid.talk .voicecell').evaluateAll((els) => els.map((e) => ({ id: e.dataset.voice, label: e.querySelector('.vc-label').textContent })));
  ok('★ 회화형 목소리 4개가 있다(여성 2 · 남성 2) ★', talk.length === 4 && talk.every((v) => v.id.startsWith('ja-JP-Chirp3-HD-')) && talk.filter((v) => v.label.includes('여성')).length === 2 && talk.filter((v) => v.label.includes('남성')).length === 2, talk.map((v) => v.label).join(' · '));
  const order = await page.evaluate(() => { const a = document.querySelector('.voicegrid.talk').getBoundingClientRect(); const b = document.querySelector('.voicegrid:not(.talk)').getBoundingClientRect(); return a.bottom <= b.top; });
  ok('★ 회화형이 낭독형보다 위에 있다 ★', order);
  ok('낭독형 9개는 그대로다', await page.locator('.voicegrid:not(.talk) .voicecell').count() === 9);
  ok('처음에는 「여성 1」(Neural2)이 골라져 있다', await page.locator('.voicecell.active').getAttribute('data-voice') === 'ja-JP-Neural2-B');
  ok('요금을 적어 둔다', (await page.locator('.setrow:has(.voicegrid) .set-note').innerText()).includes('100만 자'));
  ok('가로로 넘치지 않는다', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

  console.log('\n[ 회화형을 고르면 ]');
  await page.locator('.voicecell[data-voice="ja-JP-Chirp3-HD-Aoede"]').click();
  await page.waitForTimeout(900);
  ok('★ 그 목소리 이름으로 부른다 ★', tts.calls.length === 1 && tts.calls[0].name === 'ja-JP-Chirp3-HD-Aoede', JSON.stringify(tts.calls));
  ok('★ 설정에 남는다 ★', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).gttsVoice) === 'ja-JP-Chirp3-HD-Aoede' && await page.locator('.voicecell.active').getAttribute('data-voice') === 'ja-JP-Chirp3-HD-Aoede');
  ok('기기 음성은 안 쓴다', (await page.evaluate(() => window._device.length)) === 0, JSON.stringify(await page.evaluate(() => window._device)));

  console.log('\n[ 이 키가 회화형을 못 쓰면 ]');
  tts.reject = 'Chirp3'; tts.calls.length = 0;
  await page.locator('.voicecell[data-voice="ja-JP-Chirp3-HD-Charon"]').click();
  await page.waitForTimeout(1200);
  const names = tts.calls.map((c) => c.name);
  ok('★ 「여성 1」(Neural2-B)로 대신 읽는다 ★', names[0] === 'ja-JP-Chirp3-HD-Charon' && names[names.length - 1] === 'ja-JP-Neural2-B', names.join(' → '));
  ok('★ 기기 음성으로 떨어지지 않는다 ★', (await page.evaluate(() => window._device.length)) === 0);
  ok('★ 대신 읽었다고 알려 준다 ★', (await page.locator('body').innerText()).includes('「여성 1」 목소리로 읽었어요'));
  ok('클라우드 음성은 그대로 켜져 있다', (await page.locator('body').innerText()).includes('클라우드 음성 사용 중'));

  console.log('\n[ 이야기 연속 듣기에서 목소리 고르기 ]');
  tts.reject = ''; tts.calls.length = 0;
  await page.locator('.voicecell[data-voice="ja-JP-Neural2-B"]').click();      // 낱말 카드 목소리는 낭독형으로 되돌린다
  await page.waitForTimeout(900);
  await openListen(page, 'story');
  await page.locator('.sl-voices').waitFor({ timeout: 15000 });
  const pills = await page.locator('.sl-voices .ls-pill').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  ok('★ 「설정과 같게」와 회화형 넷 중에서 고른다 ★', pills.length === 5 && pills[0] === '설정과 같게' && pills.slice(1).every((t) => t.startsWith('회화')), pills.join(' · '));
  ok('기본은 「설정과 같게」다', await page.locator('.sl-voices .ls-pill.active').getAttribute('data-voice') === '');
  tts.calls.length = 0;
  await page.locator('.sl-voices [data-voice="ja-JP-Chirp3-HD-Kore"]').click();
  await page.waitForTimeout(900);
  ok('★ 누르면 그 목소리로 한 번 들려준다 ★', tts.calls.length === 1 && tts.calls[0].name === 'ja-JP-Chirp3-HD-Kore', JSON.stringify(tts.calls));
  ok('★ 이야기 설정에만 남고 낱말 카드 목소리는 그대로다 ★', await page.evaluate(() => JSON.parse(localStorage.getItem('jp_story_prefs_v1')).voice === 'ja-JP-Chirp3-HD-Kore' && JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).gttsVoice === 'ja-JP-Neural2-B'));
  ok('가로로 넘치지 않는다(이야기 설정)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  tts.calls.length = 0;
  await page.locator('.sl-start').first().click();
  await page.waitForTimeout(1500);
  const story = tts.calls.filter((c) => c.text.includes('家族') || c.text.includes('準備'));
  ok('★ 이야기를 그 목소리 · 고른 속도로 읽는다 ★', story.length >= 1 && story.every((c) => c.name === 'ja-JP-Chirp3-HD-Kore' && c.rate === 0.75), JSON.stringify(tts.calls));
  ok('기기 음성은 안 쓴다(이야기)', (await page.evaluate(() => window._device.length)) === 0, JSON.stringify(await page.evaluate(() => window._device)));
  if (await page.locator('.sl-quit').count()) { await page.locator('.sl-quit').click(); await page.waitForTimeout(400); }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
