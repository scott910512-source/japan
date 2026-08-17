/* 번역기 — 받아 온 답의 모양을 고정하는지, 이상한 답에 안 터지는지. */
import {
  parseTranslation, parseTrends, shapeTranslation,
  MAX_INPUT_CHARS, SAFE_LEVELS, TREND_COUNT, fetchTrends, translate,
} from '../../src/lib/translate.js';
import { PROVIDERS } from '../../src/lib/aiClient.js';
import { kanaToHangul } from '../../src/lib/hangul.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const FULL = {
  jp: 'すみません、これはいくらですか。',
  yomi: 'すみません、これわいくらですか。',
  ko: '실례합니다, 이거 얼마예요?',
  politeness: '정중체',
  note: '가게에서 값을 물을 때.',
  alt: [{ jp: 'これ、いくら？', yomi: 'これ、いくら？', when: '편한 자리' }],
  dialect: [{ area: '오사카', jp: 'これなんぼ？', yomi: 'これなんぼ？', note: 'なんぼ를 씁니다' }],
  slang: [{ jp: 'これいくら？', yomi: 'これいくら？', ko: '이거 얼마임?', safe: '친구', note: '점원에게는 쓰지 마세요' }],
  words: [{ jp: 'いくら', yomi: 'いくら', ko: '얼마', type: 'noun', level: 'N5' }],
};

// ── 제대로 온 답 ──
{
  const r = parseTranslation(JSON.stringify(FULL));
  ok('일본어를 읽음', r.jp.includes('いくら'));
  ok('사투리를 읽음', r.dialect[0].area === '오사카');
  ok('단어를 읽음', r.words[0].ko === '얼마');
  ok('요즘 말을 읽음', r.slang[0].jp.includes('いくら'));
  ok('어디까지 써도 되는지 같이 옴', r.slang[0].safe === '친구');
}

/* 요즘 말은 알아듣는 것만으로도 값이 있지만, 모르고 점원에게 던지면 무례하다.
   그래서 "어디까지"가 빠지거나 이상하면 제일 좁게 잡는다. */
{
  const r = parseTranslation(JSON.stringify({
    jp: 'はい',
    slang: [{ jp: 'それな' }, { jp: 'マジ？', safe: '아무나' }, { jp: 'ヤバい', safe: '안전' }],
  }));
  ok('빠지면 또래끼리만으로', r.slang[0].safe === '친구', r.slang[0].safe);
  ok('모르는 값도 또래끼리만으로', r.slang[1].safe === '친구', r.slang[1].safe);
  ok('제대로 온 값은 그대로', r.slang[2].safe === '안전');
  ok('쓸 수 있는 값은 셋뿐', SAFE_LEVELS.length === 3, SAFE_LEVELS.join('/'));
}

// ── 펜스가 붙어 와도 ──
{
  const r = parseTranslation(`\`\`\`json\n${JSON.stringify(FULL)}\n\`\`\``);
  ok('펜스가 붙어도 읽음', r.jp.includes('いくら'));
  const r2 = parseTranslation(`네, 이렇게 말하시면 돼요.\n${JSON.stringify(FULL)}`);
  ok('앞말이 붙어도 읽음', r2.jp.includes('いくら'));
}

/* 빠진 칸이 있어도 화면이 안 죽어야 한다. 여행 중에 흰 화면이 뜨면
   그 자리에서 할 수 있는 게 없다. */
{
  const r = parseTranslation(JSON.stringify({ jp: 'はい' }));
  ok('최소한만 와도 됨', r.jp === 'はい');
  ok('읽기가 없으면 본문으로 채움', r.yomi === 'はい');
  ok('없는 목록은 빈 배열', Array.isArray(r.alt) && r.alt.length === 0);
  ok('사투리도 빈 배열', Array.isArray(r.dialect) && r.dialect.length === 0);
  ok('단어도 빈 배열', Array.isArray(r.words) && r.words.length === 0);
  ok('요즘 말도 빈 배열', Array.isArray(r.slang) && r.slang.length === 0);
}

// 목록에 쓰레기가 섞여 와도 걸러 낸다
{
  const r = parseTranslation(JSON.stringify({
    jp: 'はい', alt: [{ when: '없음' }, null, { jp: 'ええ' }], dialect: 'x', words: [{ ko: '뜻만' }],
  }));
  ok('일본어 없는 대안은 버림', r.alt.length === 1 && r.alt[0].jp === 'ええ');
  ok('배열이 아닌 사투리는 빈 배열', r.dialect.length === 0);
  ok('일본어 없는 단어는 버림', r.words.length === 0);
}

// ── 이상한 답 ──
{
  const boom = (text, expect, label) => {
    let msg = '';
    try { parseTranslation(text); } catch (e) { msg = e.message; }
    ok(label, msg.includes(expect), msg || '(안 터짐)');
  };
  boom('', '빈 응답', '빈 답이면 그렇게 말함');
  boom('그냥 하는 말', '읽지 못했', 'JSON이 아니면 그렇게 말함');
  boom('{"jp":"すみ', '잘렸', '중간에 잘리면 그렇게 말함');
  boom('{"ko":"뜻만 왔다"}', '일본어가 안 왔', '일본어가 없으면 그렇게 말함');
}

// ── 한글 발음은 우리가 만든다 (AI에 안 맡긴다) ──
{
  const r = parseTranslation(JSON.stringify(FULL));
  const h = kanaToHangul(r.yomi);
  ok('가나에서 한글 발음이 나옴', h.length > 0, h);
  ok('일본어가 아니라 발음이 나옴', !/[ぁ-んァ-ン]/.test(h), h);
  // 조사 は를 「하」로 읽으면 안 통한다 — 소리대로 적어 달라고 지시해 뒀다
  ok('조사 は가 「와」로 나옴', h.includes('코레와'), h);
}

// ── 부르기 전 검사 ──
{
  const boom = async (args, expect, label) => {
    let msg = '';
    try { await translate(args); } catch (e) { msg = e.message; }
    ok(label, msg.includes(expect), msg || '(안 터짐)');
  };
  await boom({ apiKey: '', korean: '안녕' }, 'API 키', '키가 없으면 안 부름');
  await boom({ apiKey: 'k', korean: '   ' }, '적어 주세요', '빈 말이면 안 부름');
  await boom({ apiKey: 'k', korean: '가'.repeat(MAX_INPUT_CHARS + 1) }, `${MAX_INPUT_CHARS}자`, '너무 길면 안 부름');
}

// ── 실제로 나가는 요청 ──
{
  let sent = null;
  globalThis.fetch = async (url, opt) => {
    sent = { url: String(url), body: JSON.parse(opt.body) };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(FULL) }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const r = await translate({
    provider: PROVIDERS.GEMINI, apiKey: 'AIzaTEST', korean: '이거 얼마예요?', place: '오사카',
  });
  ok('Gemini를 부름', sent.url.includes(':generateContent'));
  ok('키를 실음', sent.url.includes('AIzaTEST'));
  const user = sent.body.contents[0].parts[0].text;
  ok('내가 적은 한국어를 보냄', user.includes('이거 얼마예요?'), user.split('\n').pop());
  ok('여행지를 같이 보냄', user.includes('오사카'));
  ok('통역사로 시킴', sent.body.system_instruction.parts[0].text.includes('통역사'));
  ok('사투리를 지어내지 말라고 함', sent.body.system_instruction.parts[0].text.includes('지어내지 마세요'));
  ok('소리 나는 대로 적으라고 함', sent.body.system_instruction.parts[0].text.includes('조사 は는 わ로'));
  const sys = sent.body.system_instruction.parts[0].text;
  ok('요즘 말도 물어봄', sys.includes('요즘 말(slang)'));
  ok('한물간 말은 빼라고 함', sys.includes('한물간'));
  ok('어디까지 써도 되는지 적으라고 함', sys.includes('safe에'));
  ok('욕설은 빼라고 함', sys.includes('욕설'));
  ok('JSON으로 달라고 함', sent.body.generationConfig.responseMimeType === 'application/json');
  ok('답을 읽어 돌려줌', r.dialect[0].jp.includes('なんぼ'));

  // 여행지를 안 적었으면 그 줄이 아예 없다
  await translate({ provider: PROVIDERS.GEMINI, apiKey: 'k', korean: '고마워요' });
  ok('여행지가 없으면 안 보냄', !sent.body.contents[0].parts[0].text.includes('지금 있는 곳'));
}

/* ── 옛날에 받아 둔 기록 ──
 *
 * 기능을 더하면 저장해 둔 것에는 그 칸이 없다. 실제로 「요즘 말」을 더했더니
 * 그 전에 받아 둔 기록에서 번역기가 흰 화면이 됐다. 읽을 때 맞춰 줘야 한다. */
{
  const old = {
    id: 'tr-1', korean: '이거 얼마예요?', at: 1,
    jp: 'これはいくらですか。', yomi: 'これわいくらですか。', ko: '이거 얼마예요?',
    politeness: '정중체', alt: [], dialect: [], words: [],
    // slang이 없다 — 이 칸이 생기기 전에 저장된 것
  };
  const r = shapeTranslation(old);
  ok('없던 칸이 빈 배열로 채워짐', Array.isArray(r.slang) && r.slang.length === 0);
  ok('있던 것은 그대로', r.jp.includes('いくら') && r.korean === '이거 얼마예요?');
  ok('아무것도 없어도 안 터짐', shapeTranslation().slang.length === 0);
  ok('빈 인자도 됨', shapeTranslation({}).words.length === 0);
  const full = shapeTranslation({ jp: 'はい', slang: [{ jp: 'それな' }] });
  ok('이미 있는 값은 안 건드림', full.slang[0].jp === 'それな');
}

// ── 요즘 일본어 알아보기 ──
{
  const raw = {
    items: [
      {
        jp: 'それな', yomi: 'それな', ko: '그니까', safe: '친구',
        when: '맞장구칠 때', ex: 'それな、まじで寒い。', exYomi: 'それな、まじでさむい。', exKo: '그니까, 진짜 춥다.',
      },
      { jp: 'ヤバい', yomi: 'やばい', ko: '대박' },
      { ko: '일본어가 없다' },
    ],
  };
  const r = parseTrends(JSON.stringify(raw));
  ok('요즘 말을 읽음', r.length === 2, `${r.length}개`);
  ok('일본어 없는 건 버림', r.every((t) => t.jp));
  ok('예문이 같이 옴', r[0].ex.includes('寒い'));
  ok('예문 읽기와 뜻도 옴', r[0].exYomi.includes('さむい') && r[0].exKo.includes('춥다'));
  // 응용해서 쓰려면 예문이 있어야 한다 — 없으면 빈 값이지 터지지 않는다
  ok('예문이 없어도 안 터짐', r[1].ex === '' && r[1].exKo === '');
  ok('어디까지 써도 되는지 빠지면 좁게', r[1].safe === '친구', r[1].safe);
  ok('제대로 온 값은 그대로', r[0].safe === '친구');

  const boom = (text, expect, label) => {
    let msg = '';
    try { parseTrends(text); } catch (e) { msg = e.message; }
    ok(label, msg.includes(expect), msg || '(안 터짐)');
  };
  boom('', '빈 응답', '빈 답이면 그렇게 말함');
  boom('{"items":[]}', '받아 온 게 없', '하나도 없으면 그렇게 말함');
  boom('{"items":[{"jp":"そ', '잘렸', '중간에 잘리면 그렇게 말함');
}

// 실제로 나가는 요청
{
  let sent = null;
  globalThis.fetch = async (url, opt) => {
    sent = { url: String(url), body: JSON.parse(opt.body) };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [{ jp: 'それな' }] }) }] } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const r = await fetchTrends({ provider: PROVIDERS.GEMINI, apiKey: 'k' });
  const sys = sent.body.system_instruction.parts[0].text;
  ok('요즘 쓰는 말만 고르라고 함', sys.includes('실제로 주고받는 말만'));
  ok('한물간 말은 빼라고 함', sys.includes('한물간'));
  ok('누구나 아는 말도 빼라고 함', sys.includes('교과서'));
  ok('개수 채우려 지어내지 말라고 함', sys.includes('개수를 채우려고'));
  ok('예문을 달라고 함', sys.includes('그대로 따라 하면'));
  ok('소리 나는 대로 적으라고 함', sys.includes('조사 は는 わ'));
  ok('욕설은 빼라고 함', sys.includes('욕설'));
  ok(`${TREND_COUNT}개를 물어봄`, sent.body.contents[0].parts[0].text.includes(String(TREND_COUNT)));
  ok('받아서 돌려줌', r[0].jp === 'それな');

  let msg = '';
  try { await fetchTrends({ apiKey: '' }); } catch (e) { msg = e.message; }
  ok('키가 없으면 안 부름', msg.includes('API 키'), msg);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
