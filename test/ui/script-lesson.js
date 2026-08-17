/* 자막만으로 영상과 함께 학습되는지 — API 키 없이. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const SCRIPT = `[00:05] やっぱり外で食べるラーメンって
味が違いますよね。
[00:12] 替え玉をお願いします。
[00:20] 辛いのが食べられないので、これにします。
[00:31] ごちそうさまでした。`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false; s.claudeKey = '';   // 키 없음 — 이게 핵심이다
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(1100);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }

  await page.evaluate(() => {
    window._sent = [];
    window.speechSynthesis.speak = (u) => { window._spoken = (window._spoken || []).concat(u.text); };
    window.speechSynthesis.cancel = () => {};
    const orig = window.fetch;
    window.fetch = (url, opt) => {
      const u = String(url);
      if (u.includes('api.anthropic.com')) { window._sent.push('claude'); return Promise.reject(new Error('안 불러야 한다')); }
      if (u.includes('youtube.com/oembed')) return Promise.resolve(new Response(JSON.stringify({ title: '라멘집 일본어', author_name: '테스트 채널' }), { status: 200 }));
      return orig(url, opt);
    };
    // 영상에 보낸 명령을 가로챈다
    window._cmds = [];
    const realPost = window.postMessage;
    const patch = () => {
      document.querySelectorAll('iframe').forEach((f) => {
        if (f._patched) return;
        f._patched = true;
        try {
          Object.defineProperty(f, 'contentWindow', {
            get: () => ({ postMessage: (m) => window._cmds.push(m) }),
          });
        } catch { /* 무시 */ }
      });
    };
    patch();
    new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
    window._realPost = realPost;
  });

  await page.locator('.tabbar .tab', { hasText: '영상' }).click();
  await page.waitForTimeout(900);
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(700);

  ok('자막 넣기 전에는 학습 입구가 없음', await page.locator('.vd-entry').count() === 0);
  ok('자막 입력창이 있음', await page.locator('.vd-script').count() === 1);

  await page.fill('.vd-script', SCRIPT);
  await page.waitForTimeout(200);
  const runText = await page.textContent('.vd-run');
  ok('버튼이 API가 아니라 학습을 말함', runText.includes('학습'), runText.trim());
  await page.click('.vd-run');
  await page.waitForTimeout(700);

  ok('Claude를 부르지 않음', (await page.evaluate(() => window._sent)).length === 0);
  ok('자막 학습 입구가 생김', await page.locator('.vd-entry').count() >= 1);
  const entry = (await page.textContent('.vd-entry')).replace(/\s+/g, ' ');
  ok('줄 수를 알려 줌', entry.includes('4줄'), entry.slice(0, 70));
  ok('설명은 선택으로 안내', (await page.textContent('body')).includes('없어도'));

  // 자막이 기기에 남는다
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_video_scripts_v1') || '{}'));
  ok('자막이 저장됨', Object.values(saved)[0]?.includes('替え玉'));

  // 학습 시작
  await page.locator('.vd-entry .submit-btn').first().click();
  await page.waitForTimeout(800);
  ok('학습 화면 진입', await page.locator('.sl-jp').count() === 1);
  ok('영상이 화면에 같이 있음', await page.locator('.sl-player iframe').count() === 1);
  ok('앱 헤더는 접힘', (await page.locator('.sub-header').first().isVisible().catch(() => false)) === false);

  const at = async () => (await page.textContent('.vl-head .sh-title')).trim();
  const line = async () => (await page.textContent('.sl-jp')).trim();
  ok('1줄부터', (await at()) === '1 / 4', await at());
  ok('끊긴 자막을 이어 붙임', (await line()) === 'やっぱり外で食べるラーメンって味が違いますよね。', await line());
  ok('그 줄의 시각을 보여 줌', (await page.textContent('.vl-kind')).trim() === '0:05', await page.textContent('.vl-kind'));

  const cmds = await page.evaluate(() => window._cmds || []);
  ok('영상을 그 시각으로 되감음', cmds.some((c) => c.includes('seekTo') && c.includes('5')), cmds[0]);
  ok('영상을 재생시킴', cmds.some((c) => c.includes('playVideo')));

  // 읽어 주기는 자막 그대로
  await page.evaluate(() => { window._spoken = []; });
  await page.locator('.sl-acts button', { hasText: '읽어 주기' }).click();
  await page.waitForTimeout(300);
  const spoken = await page.evaluate(() => window._spoken || []);
  ok('자막 문장을 그대로 읽음', spoken[0] === 'やっぱり外で食べるラーメンって味が違いますよね。', spoken[0]);

  // 다음 줄
  await page.locator('.vl-next').click();
  await page.waitForTimeout(500);
  ok('다음 줄로', (await at()) === '2 / 4' && (await line()) === '替え玉をお願いします。', await line());
  const cmds2 = await page.evaluate(() => window._cmds || []);
  ok('줄을 넘기면 영상도 따라옴', cmds2.some((c) => c.includes('seekTo') && c.includes('12')));

  ok('없는 뜻을 지어내지 않음', await page.locator('.sl-ko').count() === 0);

  // 끝까지
  await page.locator('.vl-next').click(); await page.waitForTimeout(350);
  await page.locator('.vl-next').click(); await page.waitForTimeout(350);
  ok('마지막 줄', (await at()) === '4 / 4');
  ok('마지막은 학습 마치기', (await page.textContent('.vl-next')).includes('학습 마치기'));
  await page.locator('.vl-next').click();
  await page.waitForTimeout(600);
  ok('마치면 영상 화면으로', await page.locator('.vd-entry').count() >= 1);
  ok('마침으로 남음', (await page.textContent('.vd-entry')).includes('마친 영상'));

  // 이어하기
  await page.locator('.vd-entry .submit-btn').first().click();
  await page.waitForTimeout(600);
  await page.locator('.vl-next').click(); await page.waitForTimeout(350);
  await page.locator('.sh-close').click(); await page.waitForTimeout(600);
  ok('진도가 남음', (await page.textContent('.vd-entry')).includes('번째 줄까지'), (await page.textContent('.vd-entry')).replace(/\s+/g, ' ').slice(0, 60));

  // 목록에도
  await page.locator('.inner-back').first().click();
  await page.waitForTimeout(600);
  ok('목록에 줄 진도', (await page.textContent('.vd-meta')).includes('줄'), await page.textContent('.vd-meta'));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
