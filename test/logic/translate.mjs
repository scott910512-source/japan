/* 번역기 — 받아 온 답의 모양을 고정하는지, 이상한 답에 안 터지는지. */
import {
  parseTranslation, MAX_INPUT_CHARS, SAFE_LEVELS, translate,
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

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
