/* 영상에서 자막 직접 받아오기 — 설정에서 켠 사람만 쓸 수 있는가. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openVideos } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const TRANSCRIPT = `[0:05] 替え玉をお願いします。\n[0:12] ごちそうさまでした。`;

const boot = async (page, patch = {}) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    s.gttsKey = ''; s.geminiKey = 'AIzaGEMKEY'; s.claudeKey = ''; s.aiProvider = 'gemini';
    s.geminiModel = 'gemini-2.5-flash';
    Object.assign(s, p);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  }, patch);
  await page.waitForTimeout(1100);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
};

const stub = (page) => page.evaluate((tr) => {
  window._calls = [];
  const orig = window.fetch;
  window.fetch = (url, opt) => {
    const u = String(url);
    if (u.includes('youtube.com/oembed')) return Promise.resolve(new Response(JSON.stringify({ title: '라멘 일본어' }), { status: 200 }));
    if (u.includes('generativelanguage.googleapis.com')) {
      window._calls.push({ url: u, body: opt?.body ? JSON.parse(opt.body) : null });
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: tr }] } }], usageMetadata: { promptTokenCount: 33000 },
      }), { status: 200 }));
    }
    return orig(url, opt);
  };
}, TRANSCRIPT);

const openVideo = async (page) => {
  await openVideos(page);
  await page.waitForTimeout(900);
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(700);
};
const toast = async (page) => {
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const t = (await page.textContent('.toast')) || '';
    if (t.trim()) return t;
  }
  return '';
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  // ── 기본은 꺼져 있다 ──
  const p1 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p1.on('pageerror', (e) => errors.push(e.message));
  await boot(p1);
  await stub(p1);
  await openVideo(p1);
  ok('기본은 가져오기 버튼이 없음', await p1.locator('button', { hasText: '영상에서 가져오기' }).count() === 0);
  await p1.locator('.vd-how > summary').click();
  await p1.waitForTimeout(300);
  ok('어디서 켜는지 알려 줌', (await p1.textContent('.vd-how')).includes('설정 → 영상 학습'));
  ok('앱으로 하는 길은 그대로 있음', await p1.locator('button', { hasText: '이 글 복사' }).count() === 1);

  // 설정 화면에 스위치가 있다
  await goTab(p1, '더보기');
  await p1.waitForTimeout(700);
  const sw = p1.locator('.toggle-row', { hasText: '영상에서 자막 직접 받아오기' });
  ok('설정에 스위치가 있음', await sw.count() === 1);
  ok('꺼져 있음', await sw.locator('.toggle.on').count() === 0);
  const note = await p1.textContent('.screen.active');
  ok('요금이 든다고 알려 줌', note.includes('토큰'), note.match(/[^.]*토큰[^.]*/)?.[0]?.trim().slice(0, 60));
  ok('몇 분까지 듣는지 적음', note.includes('15분까지'));

  // 켜면 저장된다
  await sw.click();
  await p1.waitForTimeout(400);
  ok('켜면 저장됨', await p1.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).videoTranscribe) === true);
  ok('켜진 게 보임', await sw.locator('.toggle.on').count() === 1);
  await p1.close();

  // ── 켜면 쓸 수 있다 ──
  const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p2.on('pageerror', (e) => errors.push(e.message));
  await boot(p2, { videoTranscribe: true });
  await stub(p2);
  await openVideo(p2);
  const btn = p2.locator('button', { hasText: '영상에서 가져오기' });
  ok('켜면 버튼이 보임', await btn.count() === 1);
  ok('몇 분까지 듣는지 버튼에 적음', (await btn.textContent()).includes('15분'), (await btn.textContent()).trim());

  await btn.click();
  const t = await toast(p2);
  ok('받아 옴', t.includes('2줄'), t);
  ok('걸린 시간과 토큰을 보여 줌', /\d+초/.test(t) && t.includes('33,000토큰'), t);
  ok('입력칸에 채움', (await p2.inputValue('.vd-script')).includes('替え玉'));
  const call = (await p2.evaluate(() => window._calls))[0];
  ok('유튜브 주소를 넘김', call.body.contents[0].parts[0].file_data.file_uri.includes('8ZGXMjd6Z2E'));
  ok('앞 15분만', call.body.contents[0].parts[0].video_metadata.end_offset.seconds === 900);
  ok('화면은 거의 안 봄', call.body.contents[0].parts[0].video_metadata.fps <= 0.2);
  await p2.close();

  // ── Claude를 고르면 켜도 안 보인다 ──
  const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  p3.on('pageerror', (e) => errors.push(e.message));
  await boot(p3, { videoTranscribe: true, aiProvider: 'claude', claudeKey: 'sk-ant-x', geminiKey: '' });
  await stub(p3);
  await openVideo(p3);
  ok('Claude에서는 안 보임', await p3.locator('button', { hasText: '영상에서 가져오기' }).count() === 0);
  await goTab(p3, '더보기');
  await p3.waitForTimeout(700);
  ok('Claude에서는 스위치도 안 보임', await p3.locator('.toggle-row', { hasText: '영상에서 자막 직접 받아오기' }).count() === 0);
  await p3.close();

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
