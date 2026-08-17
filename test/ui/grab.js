/* 자막 구하는 길 — 접어 둔 안내, 물어볼 말 복사, 손으로 붙여넣기.
   API로 영상을 듣는 건 기본이 꺼짐 — 여기선 꺼진 상태만 본다(켠 뒤는 grabtoggle.js). */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

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
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
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
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);

  // 유튜브·구글은 아무도 안 부른다 — 이 화면은 이제 요금이 0이다
  await page.evaluate(() => {
    window._net = [];
    const orig = window.fetch;
    window.fetch = (url, opt) => {
      const u = String(url);
      if (u.includes('googleapis.com') || u.includes('anthropic.com')) { window._net.push(u); return Promise.reject(new Error('안 불러야 한다')); }
      if (u.includes('youtube.com/oembed')) return Promise.resolve(new Response(JSON.stringify({ title: '라멘 일본어', author_name: '테스트' }), { status: 200 }));
      return orig(url, opt);
    };
  });

  await page.locator('.tabbar .tab', { hasText: '영상' }).click();
  await page.waitForTimeout(900);
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(700);


  // 설정에서 켜야 나온다(기본 꺼짐). 켠 뒤 동작은 grabtoggle.js에서 본다.
  const body0 = await page.textContent('.screen.active');
  ok('「영상에서 가져오기」가 없음', await page.locator('button', { hasText: '영상에서 가져오기' }).count() === 0);
  ok('요금 얘기로 겁주지 않음', !body0.includes('토큰'), body0.match(/\S*토큰\S*/)?.[0]);

  // ── 안내는 접혀 있다 ──
  const how = page.locator('.vd-how');
  ok('방법 보기가 있음', await how.count() === 1);
  ok('처음엔 접혀 있음', !(await how.evaluate((el) => el.open)));
  ok('접혀 있으면 단계가 안 보임', !(await page.locator('.vd-steps').isVisible()));

  await page.locator('.vd-how > summary').click();
  await page.waitForTimeout(300);
  ok('누르면 펼쳐짐', await how.evaluate((el) => el.open));
  ok('단계가 보임', await page.locator('.vd-steps').isVisible());
  const steps = await page.locator('.vd-steps li').allTextContents();
  ok('네 단계로 안내', steps.length === 4, String(steps.length));
  ok('Gemini 앱에 붙여넣으라고 함', steps.join(' ').includes('Gemini 앱'));
  ok('돌아와서 붙여넣으라고 함', steps.join(' ').includes('자막 칸에 붙여넣'));

  // ── 물어볼 말 ──
  const shown = await page.inputValue('.vd-prompt');
  ok('물어볼 말이 그대로 보임', shown.includes('8ZGXMjd6Z2E'), shown.split('\n')[0]);
  ok('읽을 수 있는 형식을 못 박음', shown.includes('[분:초]'));
  ok('번역을 섞지 말라고 함', shown.includes('번역'));
  ok('지어내지 말라고 함', shown.includes('지어내지'));
  ok('고쳐 쓰지 못하게 잠금', await page.locator('.vd-prompt').evaluate((el) => el.readOnly));

  await page.evaluate(() => {
    window._copied = null;
    navigator.clipboard.writeText = (t) => { window._copied = t; return Promise.resolve(); };
  });
  await page.locator('button', { hasText: '이 글 복사' }).click();
  const t1 = await toast(page);
  ok('복사됨', (await page.evaluate(() => window._copied)) === shown);
  ok('다음에 할 일을 알려 줌', t1.includes('Gemini 앱에 붙여넣고'), t1);

  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('막힘')); });
  await page.waitForTimeout(2400);
  await page.locator('button', { hasText: '이 글 복사' }).click();
  const t2 = await toast(page);
  ok('복사가 막히면 직접 복사하라고 안내', t2.includes('직접 복사'), t2);
  ok('그래도 글은 그대로 보임', (await page.inputValue('.vd-prompt')).includes('8ZGXMjd6Z2E'));

  // ── 손으로 붙여넣으면 학습이 열린다 ──
  await page.fill('.vd-script', '[0:05] 替え玉をお願いします。\n[0:12] ごちそうさまでした。');
  await page.locator('.vd-run').click();
  await page.waitForTimeout(700);
  ok('학습이 열림', await page.locator('.vd-entry').count() >= 1);
  ok('넣은 줄로 학습함', (await page.textContent('.vd-entry')).includes('2줄'), (await page.textContent('.vd-entry')).replace(/\s+/g, ' ').slice(0, 40));

  ok('구글·앤트로픽을 한 번도 안 부름', (await page.evaluate(() => window._net)).length === 0, (await page.evaluate(() => window._net)).join(' '));
  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
