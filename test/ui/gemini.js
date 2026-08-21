/* Gemini 경로 — 음성 키를 그대로 쓰는지, 요청이 맞는 모양인지. */
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

const FAKE = {
  overview: { jlpt: 'N4 초반', speed: '보통', worth: '좋음', points: ['～って'] },
  words: [{ jp: '替え玉', yomi: 'かえだま', ko: '면 추가', type: 'noun', level: 'N3', point: '라멘집' }],
  grammar: [], realTalk: [], breakdown: [], literal: [],
  takeaway: { grammar: [], words: [] },
  shadowing: [{ jp: '替え玉をお願いします。', yomi: 'かえだまをおねがいします。', ko: '면 추가요', point: '짧게' }],
  question: { jp: '好きですか。', ko: '좋아해요?', target: '～ですか' },
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    s.gttsKey = 'AIzaTESTVOICEKEY';   // 음성 키만 있고 Gemini 키는 없다
    s.geminiKey = ''; s.claudeKey = ''; s.aiProvider = 'gemini';
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

  await page.evaluate((fake) => {
    window._calls = [];
    const orig = window.fetch;
    window.fetch = (url, opt) => {
      const u = String(url);
      if (u.includes('youtube.com/oembed')) return Promise.resolve(new Response(JSON.stringify({ title: '라멘 일본어', author_name: '테스트' }), { status: 200 }));
      if (u.includes('generativelanguage.googleapis.com')) {
        window._calls.push({ url: u, body: opt?.body ? JSON.parse(opt.body) : null });
        if (u.includes('/models?')) {
          return Promise.resolve(new Response(JSON.stringify({
            models: [
              { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
            ],
          }), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(fake) }] } }],
        }), { status: 200 }));
      }
      if (u.includes('api.anthropic.com')) { window._calls.push({ url: 'CLAUDE' }); return Promise.reject(new Error('안 불러야 한다')); }
      return orig(url, opt);
    };
  }, FAKE);

  // 설정 화면
  await goTab(page, '더보기');
  await page.waitForTimeout(700);
  const body = await page.textContent('.screen.active');
  ok('설명을 만들 곳을 고를 수 있음', body.includes('설명을 만들 곳'));
  ok('Gemini가 기본으로 골라져 있음', await page.locator('.ai-pick.active', { hasText: 'Gemini' }).count() === 1);
  ok('음성 키를 빌려 쓴다고 안내', body.includes('음성 키를 그대로 쓰고 있어요'));
  ok('자막 학습은 키가 필요 없다고 안내', body.includes('키 없이도'));

  // 모델 목록 받기
  await page.locator('button', { hasText: '쓸 수 있는 모델 보기' }).click();
  await page.waitForTimeout(600);
  const listCall = (await page.evaluate(() => window._calls)).find((c) => c.url.includes('/models?'));
  ok('모델 목록을 키로 물어봄', Boolean(listCall));
  ok('음성 키를 그대로 씀', listCall && listCall.url.includes('AIzaTESTVOICEKEY'));
  ok('글을 만드는 모델만 보여 줌', await page.locator('.modelpick').count() === 1, await page.locator('.modelpick').first().textContent());
  await page.locator('.modelpick').first().click();
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).geminiModel);
  ok('고른 모델이 저장됨', saved === 'gemini-3-flash', saved);

  // 영상 → 자막 → 설명 만들기
  await openVideos(page);
  await page.waitForTimeout(900);
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(700);
  await page.fill('.vd-script', '[00:05] 替え玉をお願いします。\n[00:12] ごちそうさまでした。');
  await page.click('.vd-run');
  await page.waitForTimeout(700);
  await page.evaluate(() => { window._calls = window._calls.filter((c) => !c.url || !c.url.includes('/models?')); });
  await page.locator('button', { hasText: '설명 만들기' }).click();
  await page.waitForTimeout(1200);

  const calls = await page.evaluate(() => window._calls);
  ok('Claude는 안 부름', !calls.some((c) => c.url === 'CLAUDE'));
  const gen = calls.find((c) => c.url.includes(':generateContent'));
  ok('Gemini를 부름', Boolean(gen));
  ok('고른 모델로 부름', gen && gen.url.includes('gemini-3-flash'), gen?.url.split('/models/')[1]?.split(':')[0]);
  ok('음성 키로 부름', gen && gen.url.includes('AIzaTESTVOICEKEY'));
  ok('튜터 지시를 보냄', gen && gen.body.system_instruction.parts[0].text.includes('일본어 회화 튜터'));
  ok('자막을 본문에 실음', gen && gen.body.contents[0].parts[0].text.includes('替え玉'));
  ok('영상 제목도 보냄', gen && gen.body.contents[0].parts[0].text.includes('라멘 일본어'));
  ok('JSON으로 달라고 지정', gen && gen.body.generationConfig.responseMimeType === 'application/json');
  ok('생각 토큰까지 감안해 한도를 넉넉히', gen && gen.body.generationConfig.maxOutputTokens >= 32768, String(gen?.body.generationConfig.maxOutputTokens));

  const after = await page.textContent('body');
  ok('설명이 만들어짐', after.includes('설명 보기') || after.includes('전체 보기'), after.slice(0, 60));

  // 실패했을 때 이유가 화면에 나와야 한다
  const failCase = async (payload, expect, label) => {
    await page.evaluate((p) => {
      const orig = window.fetch;
      window.fetch = (url, opt) => {
        if (String(url).includes(':generateContent')) return Promise.resolve(new Response(JSON.stringify(p), { status: 200 }));
        return orig(url, opt);
      };
    }, payload);
    const redo = page.locator('button', { hasText: '설명 다시 만들기' });
    if (await redo.count()) { await redo.click(); await page.waitForTimeout(500); }

    /* 앞 사례의 토스트가 아직 떠 있으면 그걸 읽고 지나간다. 비워질 때까지
       기다렸다가 누른다 — 이것 때문에 가끔씩만 실패하던 검사였다. */
    for (let i = 0; i < 40; i++) {
      if (!((await page.textContent('.toast')) || '').trim()) break;
      await page.waitForTimeout(100);
    }
    await page.locator('button', { hasText: '설명 만들기' }).click();

    // 토스트는 2.2초 뒤 사라진다 — 뜨는 순간을 놓치지 않게 촘촘히 본다
    let t = '';
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(100);
      const now = (await page.textContent('.toast')) || '';
      if (now.trim()) { t = now; break; }
    }
    ok(label, t.includes(expect), t || '(토스트 없음)');
  };

  await failCase({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] }, '잘렸어요', '길어서 잘리면 그렇게 말함');
  await failCase({ promptFeedback: { blockReason: 'SAFETY' } }, '안전 필터', '필터에 걸리면 그렇게 말함');
  await failCase({ candidates: [{ content: { parts: [{ text: '{"overview":{"jlpt":"N4"' }] } }] }, '잘렸어요', 'JSON이 잘려도 그렇게 말함');

  // Claude로 바꾸면 Claude를 부른다
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1'));
    s.aiProvider = 'claude'; s.claudeKey = 'sk-ant-test';
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  ok('제공처 설정이 저장됨', (await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_settings_v1')).aiProvider)) === 'claude');

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
