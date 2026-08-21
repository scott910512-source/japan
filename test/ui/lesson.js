import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openVideos } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e ? '— ' + e : ''); } };

const FAKE = {
  overview: { jlpt: 'N4 초반', speed: '보통 속도', worth: '회화 연결 표현 익히기 좋음', points: ['～って 익히기', '～し로 이유 잇기'] },
  words: [
    { jp: '結構', yomi: 'けっこう', ko: '꽤, 제법', type: 'adv', level: 'N4', point: '정도를 나타낼 때' },
    { jp: '替え玉', yomi: 'かえだま', ko: '면 추가', type: 'noun', level: 'N3', point: '라멘집에서',
      ex: '替え玉をお願いします。', exYomi: 'かえだまをおねがいします。', exKo: '면 추가 부탁드려요.' },
  ],
  grammar: [
    { form: '～ながら', meaning: '~하면서', howTo: 'ます형에서 ます 빼고 ながら', forms: ['食べます → 食べながら'],
      fromVideo: { jp: '話しながら練習していく。', ko: '말하면서 연습해 나가다.' },
      examples: [{ jp: '音楽を聞きながら走ります。', ko: '음악을 들으면서 달립니다.' }], mistake: '조사 を를 빠뜨리기 쉬움' },
    { form: '～し', meaning: '~하고 (이유 나열)', howTo: '보통형 + し', forms: ['安い → 安いし'],
      fromVideo: { jp: '安いし、美味しいし。', ko: '싸고, 맛있고.' },
      examples: [{ jp: '近いし便利です。', ko: '가깝고 편리해요.' }], mistake: '' },
  ],
  realTalk: [{ expr: 'って', meaning: '화제를 꺼낼 때', origin: 'は / というのは', when: '가벼운 대화', vsTextbook: '교과서는 は를 씀', examples: [{ jp: 'これって何？', ko: '이거 뭐야?' }] }],
  breakdown: [
    { sentence: '辛いのが食べられないので、これにします。', parts: [{ token: '辛い', note: '맵다' }, { token: 'の', note: '명사화' }], natural: '매운 걸 못 먹어서 이걸로 할게요.', why: 'が는 가능 표현의 대상' },
    { sentence: '外で食べると美味しいです。', parts: [{ token: 'で', note: '장소' }], natural: '밖에서 먹으면 맛있어요.', why: 'と는 조건' },
  ],
  literal: [{ koStyle: 'とても美味しいです。', natural: 'めっちゃ美味しい！', note: '일상에서는 더 자연스러움' }],
  takeaway: { grammar: [{ expr: '～ながら', meaning: '~하면서', example: '歩きながら話します。' }], words: [{ jp: '結構', ko: '꽤', usage: '結構難しい' }] },
  shadowing: [
    { jp: 'やっぱり外で食べるラーメンって味が違いますよね。', yomi: 'やっぱりそとでたべるラーメンってあじがちがいますよね。', ko: '역시 밖에서 먹는 라멘은 맛이 다르죠.', point: 'ラーメンって를 한 덩어리로' },
    { jp: 'замена', yomi: 'かえだまおねがいします', ko: '면 추가 부탁해요', point: '짧게' },
  ],
  question: { jp: '韓国のコンビニって、日本のコンビニと何が違うと思いますか？', ko: '한국 편의점은 일본 편의점과 뭐가 다르다고 생각해요?', target: '～って + ～と思います' },
};

// 단계 수: overview 1 + words 1 + grammar 2 + realTalk 1 + breakdown 2 + literal 1 + takeaway 1 + shadowing 2 + question 1 = 12
const TOTAL = 12;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.claudeKey = 'sk-ant-test'; s.aiProvider = 'claude'; s.autoTTS = false;
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
    window.speechSynthesis.speak = (u) => { window._spoken = (window._spoken || []).concat(u.text); };
    window.speechSynthesis.cancel = () => {};
    const orig = window.fetch;
    window.fetch = (url, opt) => {
      const u = String(url);
      if (u.includes('youtube.com/oembed')) return Promise.resolve(new Response(JSON.stringify({ title: '테스트 영상 제목', author_name: '테스트 채널' }), { status: 200 }));
      if (u.includes('api.anthropic.com')) return Promise.resolve(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(fake) }] }), { status: 200 }));
      return orig(url, opt);
    };
  }, FAKE);

  await openVideos(page);
  await page.waitForTimeout(900);
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(600);
  await page.fill('.vd-script', '[00:00]\nやっぱり外で食べるラーメンって味が違いますよね。');
  await page.click('.vd-run');
  await page.waitForTimeout(700);
  await page.locator('button', { hasText: '설명 만들기' }).click();
  await page.waitForTimeout(1200);

  // 분석 직후에는 문서가 아니라 학습 입구가 나와야 한다
  ok('분석 뒤 학습 입구가 뜸', await page.locator('.vd-entry').count() === 2);
  ok('전체를 펼쳐 두지 않음', await page.locator('.vd-sec').count() === 0, String(await page.locator('.vd-sec').count()));
  const entry = await page.locator('.vd-entry').nth(1).textContent();
  ok('단계 수를 알려 줌', entry.includes(`${TOTAL}단계`), entry.replace(/\s+/g, ' ').slice(0, 60));

  // 단계 학습 시작
  await page.locator('button', { hasText: '설명 보기' }).click();
  await page.waitForTimeout(600);
  ok('학습 화면 진입', await page.locator('.vl-head').count() === 1);
  ok('회독·시험과 같은 진행 막대', await page.locator('.vl-head .sh-bar').count() === 1);
  ok('앱 헤더는 접힘', (await page.locator('.sub-header').first().isVisible().catch(() => false)) === false);
  ok('뒤로가기는 하나만', await page.locator('.sub-back:visible, .sh-close:visible').count() === 1);

  const at = async () => (await page.textContent('.vl-head .sh-title')).trim();
  ok('1단계부터 시작', (await at()) === `1 / ${TOTAL}`, await at());
  ok('첫 단계는 난이도 평가', (await page.textContent('.vl-body')).includes('N4 초반'));
  ok('첫 단계엔 이전 버튼 없음', await page.locator('.vl-prev').count() === 0);

  // 한 번에 한 단계만 보여야 한다
  ok('한 화면에 한 단계만', await page.locator('.vl-body .vd-sec').count() === 1);
  ok('다음 단계 내용은 안 보임', !(await page.textContent('.vl-body')).includes('替え玉'));

  // 끝까지 진행
  const seen = [];
  for (let i = 1; i <= TOTAL; i++) {
    seen.push((await page.textContent('.vl-body')).replace(/\s+/g, ' '));
    if (i === 2) {
      ok('2단계는 핵심 단어', seen[1].includes('替え玉') && seen[1].includes('結構'));
      ok('이미 있는 단어는 안내', await page.locator('.vd-have').count() >= 1);
    }
    if (i === 3) ok('3단계는 문법', seen[2].includes('～ながら') && seen[2].includes('話しながら練習していく'));
    if (i === 3) ok('문법은 한 번에 하나만', !seen[2].includes('～し、'));
    if (i === TOTAL) {
      ok('마지막은 직접 말해 보기', seen[TOTAL - 1].includes('と思いますか'));
      ok('마지막은 학습 마치기', (await page.textContent('.vl-next')).includes('학습 마치기'));
    }
    await page.locator('.vl-next').click();
    await page.waitForTimeout(320);
  }

  ok('마치면 영상 화면으로 돌아옴', await page.locator('.vd-entry').count() === 2);
  ok('학습 마침으로 남음', (await page.locator('.vd-entry').nth(1).textContent()).includes('마친 설명'));

  // 중간에 그만두면 이어서 할 수 있어야 한다
  await page.locator('button', { hasText: '다시 보기' }).click();
  await page.waitForTimeout(500);
  await page.locator('.vl-next').click();
  await page.waitForTimeout(300);
  await page.locator('.vl-next').click();
  await page.waitForTimeout(300);
  const stopAt = await at();
  await page.locator('.sh-close').click();
  await page.waitForTimeout(500);
  ok('그만두면 영상 화면', await page.locator('.vd-entry').count() === 2);
  ok('진도가 남음', (await page.locator('.vd-entry').nth(1).textContent()).includes('까지 왔어요'), (await page.locator('.vd-entry').nth(1).textContent()).replace(/\s+/g, ' ').slice(0, 70));
  await page.locator('button', { hasText: '이어서 보기' }).click();
  await page.waitForTimeout(500);
  ok('멈춘 곳에서 이어서', (await at()) === stopAt, `${stopAt} → ${await at()}`);
  await page.locator('.sh-close').click();
  await page.waitForTimeout(400);

  // 전체 보기는 따로 있어야 한다 (끝낸 뒤 다시 찾아볼 때)
  await page.locator('button', { hasText: '전체 보기' }).click();
  await page.waitForTimeout(400);
  ok('전체 보기로 전부 펼침', await page.locator('.vd-sec').count() > 5, String(await page.locator('.vd-sec').count()));

  // 목록에도 진도가 보인다
  await page.locator('.inner-back').first().click();
  await page.waitForTimeout(500);
  ok('목록에 진도 표시', (await page.textContent('.vd-meta')).includes('줄'), await page.textContent('.vd-meta'));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
