import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

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
    { jp: '替え玉', yomi: 'かえだま', ko: '면 추가', type: 'noun', level: 'N3', point: '라멘집에서 쓰는 말',
      ex: '替え玉をお願いします。', exYomi: 'かえだまをおねがいします。', exKo: '면 추가 부탁드려요.' },
  ],
  grammar: [{
    form: '～ながら', meaning: '~하면서', howTo: 'ます형에서 ます 빼고 ながら',
    forms: ['食べます → 食べながら'],
    fromVideo: { jp: '話しながら練習していく。', ko: '말하면서 연습해 나가다.' },
    examples: [{ jp: '音楽を聞きながら走ります。', ko: '음악을 들으면서 달립니다.' }],
    mistake: '조사 を를 빠뜨리기 쉬움',
  }],
  realTalk: [{ expr: 'って', meaning: '화제를 꺼낼 때', origin: 'は / というのは', when: '가벼운 대화', vsTextbook: '교과서는 は를 씀', examples: [{ jp: 'これって何？', ko: '이거 뭐야?' }] }],
  breakdown: [{ sentence: '辛いのが食べられないので、これにします。', parts: [{ token: '辛い', note: '맵다' }, { token: 'の', note: '명사화' }], natural: '매운 걸 못 먹어서 이걸로 할게요.', why: 'が는 가능 표현의 대상' }],
  literal: [{ koStyle: 'とても美味しいです。', natural: 'めっちゃ美味しい！', note: '일상에서는 더 자연스러움' }],
  takeaway: { grammar: [{ expr: '～ながら', meaning: '~하면서', example: '歩きながら話します。' }], words: [{ jp: '結構', ko: '꽤', usage: '結構難しい' }] },
  shadowing: [{ jp: 'やっぱり外で食べるラーメンって味が違いますよね。', yomi: 'やっぱりそとでたべるラーメンってあじがちがいますよね。', ko: '역시 밖에서 먹는 라멘은 맛이 다르죠.', point: 'ラーメンって를 한 덩어리로' }],
  question: { jp: '韓国のコンビニって、日本のコンビニと何が違うと思いますか？', ko: '한국 편의점은 일본 편의점과 뭐가 다르다고 생각해요?', target: '～って + ～と思います' },
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
    s.onboarded = true;
    s.claudeKey = 'sk-ant-test'; s.aiProvider = 'claude';
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
  });
  await page.waitForTimeout(1200);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }

  // 유튜브/Claude 호출을 가로챈다 (오프라인이라 실제로 못 나감)
  await page.evaluate((fake) => {
    window._calls = [];
    window.speechSynthesis.speak = (u) => { window._spoken = (window._spoken || []).concat(u.text); };
    window.speechSynthesis.cancel = () => {};
    const orig = window.fetch;
    window.fetch = (url, opt) => {
      const u = String(url);
      if (u.includes('youtube.com/oembed')) {
        return Promise.resolve(new Response(JSON.stringify({ title: '테스트 영상 제목', author_name: '테스트 채널' }), { status: 200 }));
      }
      if (u.includes('api.anthropic.com')) {
        window._calls.push(JSON.parse(opt.body));
        return Promise.resolve(new Response(JSON.stringify({
          content: [{ type: 'text', text: '```json\n' + JSON.stringify(fake) + '\n```' }],
        }), { status: 200 }));
      }
      return orig(url, opt);
    };
  }, FAKE);

  // 홈 → 영상으로 배우기
  const tab = page.locator('.tabbar .tab', { hasText: '영상' });
  ok('영상 탭이 생김', await tab.count() === 1);
  await tab.first().click();
  await page.waitForTimeout(900);

  ok('기본 영상이 담겨 있음', await page.locator('.vd-item').count() === 1);
  const titleText = await page.locator('.vd-title').first().textContent();
  ok('제목을 유튜브에서 받아옴', titleText.includes('테스트 영상 제목'), titleText);

  // 영상 추가/중복 방지
  await page.fill('.vd-add input', 'https://www.youtube.com/watch?v=ABCDEFGHIJK');
  await page.click('.vd-addbtn');
  await page.waitForTimeout(400);
  ok('주소로 영상 담기', await page.locator('.vd-item').count() === 2);
  await page.fill('.vd-add input', 'https://youtu.be/ABCDEFGHIJK');
  await page.click('.vd-addbtn');
  await page.waitForTimeout(400);
  ok('같은 영상 중복 방지', await page.locator('.vd-item').count() === 2);

  // 상세 진입
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(600);
  ok('플레이어가 붙음', await page.locator('.vd-player iframe').count() === 1);
  const src = await page.locator('.vd-player iframe').getAttribute('src');
  ok('시드 영상 id로 임베드', src.includes('8ZGXMjd6Z2E'), src);

  // 자막 분석
  ok('분석 버튼은 자막 없으면 잠김', await page.locator('.vd-run').isDisabled());
  await page.fill('.vd-script', '[00:00]\nやっぱり外で食べるラーメンって味が違いますよね。');
  await page.waitForTimeout(200);
  ok('자막 넣으면 열림', !(await page.locator('.vd-run').isDisabled()));
  await page.click('.vd-run');
  await page.waitForTimeout(700);
  await page.locator('button', { hasText: '설명 만들기' }).click();
  await page.waitForTimeout(1200);

  const calls = await page.evaluate(() => window._calls);
  ok('Claude를 호출함', calls.length === 1);
  if (calls.length) {
    ok('자막을 본문에 실어 보냄', calls[0].messages[0].content.includes('ラーメン'));
    ok('영상 제목도 함께 보냄', calls[0].messages[0].content.includes('테스트 영상 제목'));
    ok('JSON만 내라고 지시함', calls[0].system.includes('JSON 하나만 출력'));
  }

  // 분석 뒤에는 학습 입구가 나온다 — 내용은 학습 단계나 전체 보기에서 본다
  ok('학습 입구가 뜸', await page.locator('.vd-entry').count() === 2);
  await page.locator('button', { hasText: '전체 보기' }).click();
  await page.waitForTimeout(400);

  const body = await page.textContent('body');
  ok('난이도 평가 표시', body.includes('N4 초반'));
  ok('핵심 단어 표시', body.includes('結構') && body.includes('替え玉'));
  ok('문법 표시', body.includes('～ながら') && body.includes('話しながら練習していく'));
  ok('실제 회화 표현 표시', body.includes('これって何'));
  ok('문장 뜯어보기 표시', body.includes('명사화'));
  ok('직역 주의 표시', body.includes('めっちゃ美味しい'));
  ok('쉐도잉 표시', body.includes('ラーメンって를 한 덩어리로'));
  ok('회화 질문 표시', body.includes('と思いますか'));
  ok('목표 표현 표시', body.includes('～って + ～と思います'));

  // 발음 재생: 쉐도잉은 가나 읽기로 읽어야 한다
  await page.evaluate(() => { window._spoken = []; });
  await page.locator('.vd-shadow button', { hasText: '듣기' }).first().click();
  await page.waitForTimeout(300);
  const spoken = await page.evaluate(() => window._spoken || []);
  ok('쉐도잉은 가나 읽기로 재생', spoken[0] && !/[一-龯]/.test(spoken[0]), spoken[0]);

  // 이미 단어장에 있는 단어는 새로 만들지 않는다
  ok('이미 있는 단어는 담기 대신 안내', await page.locator('.vd-have').count() === 1);
  ok('새 단어만 담기 버튼', await page.locator('.vd-keep').count() === 1);

  await page.locator('.vd-keepall').click();
  await page.waitForTimeout(500);
  const custom = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_custom_words_v1') || '[]'));
  ok('새 단어 1개만 담김', custom.length === 1, JSON.stringify(custom.map((c) => c.kanji)));
  const c0 = custom[0] || {};
  ok('품사를 그대로 씀', c0.type === 'noun', c0.type);
  ok('레벨을 그대로 씀', c0.level === 'N3', c0.level);
  ok('예문도 함께 담김', c0.example === '替え玉をお願いします。' && c0.exampleKo === '면 추가 부탁드려요.', c0.example);
  ok('어느 영상에서 왔는지 남음', c0.source && c0.source.video === '8ZGXMjd6Z2E', JSON.stringify(c0.source || {}));
  ok('id가 영상·단어로 고정됨', c0.id === 'custom-vid-8ZGXMjd6Z2E-替え玉', c0.id);

  // 다시 눌러도 카드가 늘어나지 않아야 한다
  await page.locator('.vd-keepall').click();
  await page.waitForTimeout(400);
  const again = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_custom_words_v1') || '[]'));
  ok('다시 담아도 안 늘어남', again.length === 1, String(again.length));

  // 저장·복원
  await page.locator('.inner-back').first().click();
  await page.waitForTimeout(400);
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(600);
  await page.locator('button', { hasText: '전체 보기' }).click();
  await page.waitForTimeout(400);
  ok('분석 결과가 남아 있음', (await page.textContent('body')).includes('替え玉'));
  ok('자막 입력창은 사라짐', await page.locator('.vd-script').count() === 0);

  // 영상 단어로 바로 회독 시작
  await page.locator('.vd-study').click();
  await page.waitForTimeout(700);
  const deck = await page.textContent('body');
  ok('영상 단어로 회독 진입', deck.includes('영상 ·'), deck.slice(0, 80));
  ok('회독 덱에 두 단어가 들어감', deck.includes('/ 2'), deck.slice(0, 120));
  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
