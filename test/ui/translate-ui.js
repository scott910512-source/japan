/* 번역기 화면 — 여행 중에 한 손으로 끝나는가. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const ANSWER = {
  jp: 'すみません、これはいくらですか。',
  yomi: 'すみません、これわいくらですか。',
  ko: '실례합니다, 이거 얼마예요?',
  politeness: '정중체',
  note: '가게에서 값을 물을 때 가장 무난해요.',
  alt: [{ jp: 'これ、いくら？', yomi: 'これ、いくら？', when: '편한 자리에서' }],
  dialect: [{ area: '오사카', jp: 'これなんぼ？', yomi: 'これなんぼ？', note: 'いくら 대신 なんぼ' }],
  slang: [
    { jp: 'これいくら？', yomi: 'これいくら？', ko: '이거 얼마임?', safe: '친구', note: '점원에게는 쓰지 마세요' },
    { jp: 'ヤバい', yomi: 'やばい', ko: '대박', safe: '안전', note: '좋을 때도 나쁠 때도' },
  ],
  words: [{ jp: 'いくら', yomi: 'いくら', ko: '얼마', type: 'noun', level: 'N5' }],
};

const boot = async (page, patch = {}) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    s.gttsKey = ''; s.geminiKey = 'AIzaTESTKEY'; s.claudeKey = ''; s.aiProvider = 'gemini';
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

const stub = (page, reply, status = 200) => page.evaluate(({ r, st }) => {
  window._calls = [];
  const orig = window.fetch;
  window.fetch = (url, opt) => {
    const u = String(url);
    if (u.includes('generativelanguage.googleapis.com')) {
      window._calls.push({ url: u, body: opt?.body ? JSON.parse(opt.body) : null });
      return Promise.resolve(new Response(JSON.stringify(r), { status: st }));
    }
    return orig(url, opt);
  };
}, { r: reply, st: status });

const openTranslate = async (page) => {
  await openMenu(page, '번역기');
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

const good = { candidates: [{ content: { parts: [{ text: JSON.stringify(ANSWER) }] } }] };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page, { tripPlace: '오사카' });
  await stub(page, good);

  // ── 홈에서 들어간다 ──
  ok('홈에 번역기가 있음', await page.locator('.menutile', { hasText: '번역기' }).count() === 1);
  await openTranslate(page);
  ok('번역기가 열림', await page.locator('.tr-input').count() === 1);
  ok('여행지가 맞춰져 있다고 알려 줌', (await page.textContent('.sub-body')).includes('오사카'));

  // ── 한국어로 물어본다 ──
  await page.fill('.tr-input', '이거 얼마예요?');
  await page.locator('.tr-go').click();
  await page.waitForTimeout(900);

  const call = (await page.evaluate(() => window._calls))[0];
  ok('AI를 부름', Boolean(call) && call.url.includes(':generateContent'));
  const user = call.body.contents[0].parts[0].text;
  ok('내가 적은 말을 보냄', user.includes('이거 얼마예요?'));
  ok('여행지도 같이 보냄', user.includes('오사카'));

  const card = page.locator('.tr-card');
  ok('답이 보임', await card.count() === 1);
  ok('일본어가 크게 나옴', (await page.textContent('.tr-line.big .tr-jp')).includes('いくら'));

  /* 여행 중에 제일 중요한 것 — 보고 바로 말할 수 있는 한글 발음.
     조사 は를 「하」로 읽으면 안 통하니 「와」로 나와야 한다. */
  const hangul = await page.textContent('.tr-line.big .tr-hangul');
  ok('한글 발음이 나옴', hangul.includes('스미마센'), hangul);
  ok('조사 は가 「와」로 나옴', hangul.includes('코레와'), hangul);
  ok('구두점을 정리함', !hangul.includes('、') && !hangul.includes('。'), hangul);

  const body = await page.textContent('.tr-card');
  ok('한국어 뜻도 보임', body.includes('실례합니다'));
  ok('말투를 알려 줌', body.includes('정중체'));
  ok('언제 쓰는지 한 줄', body.includes('무난해요'));
  ok('다른 말투도 보여 줌', body.includes('これ、いくら'));
  ok('사투리를 보여 줌', body.includes('なんぼ') && body.includes('오사카'));

  /* 요즘 말은 알아듣는 것만으로도 값이 있지만, 모르고 점원에게 던지면 무례하다.
     그래서 어디까지 써도 되는지가 말보다 먼저 보여야 한다. */
  ok('요즘 말을 보여 줌', body.includes('요즘은 이렇게도'));
  const safes = await page.locator('.tr-safe').allTextContents();
  ok('어디까지 써도 되는지 붙어 있음', safes.length === 2, safes.join(' · '));
  ok('또래끼리만인 걸 알려 줌', safes.includes('또래끼리만'), safes.join(' · '));
  ok('누구에게나 되는 것도 구분함', safes.includes('누구에게나 OK'), safes.join(' · '));
  ok('조심하라는 말도 보여 줌', body.includes('점원에게는 쓰지 마세요'));

  ok('듣기 버튼이 있음', await page.locator('.tr-say button', { hasText: '듣기' }).count() >= 1);
  ok('천천히도 있음', await page.locator('.tr-say button', { hasText: '천천히' }).count() >= 1);

  // ── 단어를 그 자리에서 담는다 ──
  ok('건질 단어를 보여 줌', body.includes('얼마'));
  await page.locator('.tr-keep').first().click();
  const t1 = await toast(page);
  ok('단어장에 담김', t1.includes('단어장에 담았어요'), t1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_custom_words_v1') || '[]'));
  ok('원래 쓰던 카드 모양으로 담김', saved[0]?.kanji === 'いくら' && saved[0]?.mean === '얼마', JSON.stringify(saved[0]));
  ok('레벨·품사가 붙음', saved[0]?.level === 'N5' && saved[0]?.type === 'noun');

  // 같은 단어를 또 담아도 안 늘어난다
  await page.waitForTimeout(2300);
  await page.locator('.tr-keep').first().click();
  await page.waitForTimeout(500);
  ok('같은 단어가 두 번 안 담김', (await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_custom_words_v1') || '[]'))).length === 1);

  // ── 같은 걸 또 물으면 다시 안 부른다 (요금) ──
  const before = (await page.evaluate(() => window._calls)).length;
  await page.fill('.tr-input', '이거 얼마예요?');
  await page.locator('.tr-go').click();
  const t2 = await toast(page);
  ok('같은 말은 다시 안 부름', (await page.evaluate(() => window._calls)).length === before, `${before}회`);
  ok('아까 것이라고 알려 줌', t2.includes('아까'), t2);

  // ── 받아 둔 건 앱을 껐다 켜도 남는다 (비행기 모드) ──
  /* 다시 불러오기 전에는 잠깐 연결을 돌려놓는다. 끊긴 채로 불러오면
     서비스워커가 자리를 안 잡았을 때 아무것도 안 뜬다. */
  await page.context().setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off2 = page.locator('.gate-offline');
  if (await off2.count()) { await off2.click(); await page.waitForTimeout(700); }
  await openTranslate(page);
  ok('앱을 다시 켜도 남아 있음', (await page.textContent('.tr-card')).includes('いくら'));
  ok('최근 목록에 있음', await page.locator('.tr-item').count() === 1);

  // 지울 수 있다
  await page.locator('.tr-item .vd-del').first().click();
  await page.waitForTimeout(500);
  ok('지우면 사라짐', await page.locator('.tr-item').count() === 0);

  /* ── 요즘 일본어 알아보기 ── */
  await page.evaluate(() => {
    window._calls = []; // 앞에서 새로고침했으니 다시 깐다
    const orig = window.fetch;
    window.fetch = (url, opt) => {
      if (String(url).includes('generativelanguage')) {
        window._calls.push({ url: String(url), body: JSON.parse(opt.body) });
        return Promise.resolve(new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({
            items: [
              { jp: 'それな', yomi: 'それな', ko: '그니까', safe: '친구', when: '맞장구칠 때', ex: 'それな、まじで寒い。', exYomi: 'それな、まじでさむい。', exKo: '그니까, 진짜 춥다.' },
              { jp: 'エモい', yomi: 'えもい', ko: '뭉클하다', safe: '안전', when: '분위기 좋을 때', ex: 'この景色エモい。', exYomi: 'このけしきえもい。', exKo: '이 풍경 뭉클하다.' },
            ],
          }) }] } }],
        }), { status: 200 }));
      }
      return orig(url, opt);
    };
  });

  const trend = page.locator('.tr-trend');
  ok('요즘 일본어 자리가 있음', await trend.count() === 1);
  ok('처음엔 접혀 있음', !(await trend.evaluate((el) => el.open)));
  await page.locator('.tr-trend > summary').click();
  await page.waitForTimeout(300);
  ok('모델이 아는 범위라고 밝힘', (await trend.textContent()).includes('모델이 아는 범위'));

  await page.locator('.tr-trend .ghost-btn', { hasText: '받아 오기' }).click();
  await page.waitForTimeout(900);
  const rows = page.locator('.tr-trendrow');
  ok('받아 옴', await rows.count() === 2, `${await rows.count()}개`);
  const first = await rows.first().textContent();
  ok('뜻을 알려 줌', first.includes('그니까'));
  ok('언제 쓰는지도', first.includes('맞장구칠 때'));
  /* 응용해서 쓰려면 예문이 핵심이다 — 뜻만 알면 못 쓴다 */
  ok('예문이 같이 옴', first.includes('まじで寒い'));
  ok('예문 발음도 한글로', first.includes('마지데'), first.replace(/\s+/g, ' ').slice(0, 80));
  ok('예문 뜻도 옴', first.includes('진짜 춥다'));
  ok('예문 듣기 버튼', await page.locator('.tr-exsay').count() === 2);
  const safes2 = await page.locator('.tr-trendrow .tr-safe').allTextContents();
  ok('어디까지 써도 되는지 붙음', safes2.includes('또래끼리만') && safes2.includes('누구에게나 OK'), safes2.join(' · '));

  // 담아서 회독으로 넘길 수 있다
  await page.locator('.tr-trendkeep').first().click();
  await page.waitForTimeout(600);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_custom_words_v1') || '[]'));
  ok('요즘 말도 단어장에 담김', kept.some((w) => w.kanji === 'それな'), JSON.stringify(kept.map((w) => w.kanji)));
  /* 예문 없이 「それな」만 남으면 나중에 봐도 어디에 쓸지를 모른다 */
  const sorena = kept.find((w) => w.kanji === 'それな');
  ok('담을 때 예문도 같이', sorena?.example === 'それな、まじで寒い。', sorena?.example);
  ok('예문 읽는 법도', sorena?.exampleKana === 'それな、まじでさむい。', sorena?.exampleKana);
  ok('예문 뜻도', sorena?.exampleKo === '그니까, 진짜 춥다.', sorena?.exampleKo);

  // 언제 받았는지 남는다 — 유행어는 낡는다
  const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_trends_v1') || 'null'));
  ok('받은 날이 남음', saved2 && saved2.at > 0);
  ok('받은 것도 남음', saved2.items.length === 2);
  ok('언제 받았는지 화면에도', (await trend.textContent()).includes('받음'));

  await page.close();

  // ── 키가 없으면 ──
  const p2 = await browser.newPage({ viewport: { width: 375, height: 667 } });
  p2.on('pageerror', (e) => errors.push(e.message));
  await boot(p2, { geminiKey: '', gttsKey: '' });
  await openTranslate(p2);
  ok('키가 없으면 어디서 넣는지 알려 줌', (await p2.textContent('.sub-body')).includes('API 키를 넣으면'));
  ok('키가 없으면 버튼이 잠김', await p2.locator('.tr-go').isDisabled());
  await p2.close();

  /* ── 옛날에 받아 둔 기록이 있어도 화면이 뜬다 ──
     기능을 더하면 저장해 둔 것에는 그 칸이 없다. 실제로 이것 때문에
     번역기가 흰 화면이 됐다. */
  const p4 = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const oldErrors = [];
  p4.on('pageerror', (e) => oldErrors.push(e.message));
  await p4.goto(BASE, { waitUntil: 'networkidle' });
  await p4.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false; s.geminiKey = 'AIzaTESTKEY'; s.aiProvider = 'gemini';
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    // 「요즘 말」이 생기기 전 모양 — slang 칸이 없다
    localStorage.setItem('jp_manabu_translations_v1', JSON.stringify([{
      id: 'tr-old', korean: '이거 얼마예요?', place: '', at: Date.now(),
      jp: 'これはいくらですか。', yomi: 'これわいくらですか。', ko: '이거 얼마예요?',
      politeness: '정중체', note: '', alt: [], dialect: [], words: [],
    }]));
  });
  await p4.waitForTimeout(1100);
  await p4.reload({ waitUntil: 'domcontentloaded' });
  await p4.waitForTimeout(1200);
  await p4.context().setOffline(true);
  const off4 = p4.locator('.gate-offline');
  await off4.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off4.count()) { await off4.click(); await p4.waitForTimeout(700); }
  await openTranslate(p4);
  ok('옛 기록이 있어도 화면이 뜸', await p4.locator('.tr-input').count() === 1);
  ok('탭바도 살아 있음', await p4.locator('.tabbar').count() === 1);
  ok('옛 기록을 보여 줌', (await p4.textContent('.tr-card')).includes('いくら'));
  ok('옛 기록 때문에 안 죽음', oldErrors.length === 0, oldErrors.slice(0, 2).join(' | '));
  await p4.close();

  // ── AI가 이상한 답을 줘도 ──
  const p3 = await browser.newPage({ viewport: { width: 375, height: 667 } });
  p3.on('pageerror', (e) => errors.push(e.message));
  await boot(p3);
  await stub(p3, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] });
  await openTranslate(p3);
  await p3.fill('.tr-input', '길게 물어보기');
  await p3.locator('.tr-go').click();
  const t3 = await toast(p3);
  ok('실패하면 이유를 말함', t3.includes('잘렸어요'), t3);
  ok('화면이 안 죽음', await p3.locator('.tr-input').count() === 1);

  // 최소한만 온 답도 화면이 버틴다
  await p3.waitForTimeout(2300);
  await stub(p3, { candidates: [{ content: { parts: [{ text: '{"jp":"はい"}' }] } }] });
  await p3.fill('.tr-input', '네');
  await p3.locator('.tr-go').click();
  await p3.waitForTimeout(900);
  ok('빠진 칸이 있어도 보여 줌', (await p3.textContent('.tr-card')).includes('はい'));
  await p3.close();

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
