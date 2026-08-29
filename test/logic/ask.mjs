/* 공부하다 물어보기 — 규칙 검사.
 *
 * 여기서 제일 중요한 건 두 가지다. 모델이 보낸 게 어떤 모양이든 화면이 안
 * 깨져야 하고(번역기에서 옛 기록 때문에 흰 화면을 봤다), 같은 걸 두 번 물으면
 * 요금이 두 번 나가면 안 된다. */
import {
  MAX_ITEMS, MAX_QUESTION_CHARS, KEEP_ASKS,
  SYSTEM, userText, parseAsk, shapeAsk, askKey, findAsk, rememberAsk, ask,
} from '../../src/lib/ask.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const CARD = {
  id: 'n5-0012', kanji: '食べる', kana: 'たべる', mean: '먹다', level: 'N5',
  example: '朝ごはんを食べる。', exampleKo: '아침을 먹는다.',
};

/* ── 무엇을 보고 묻는지 같이 보낸다 ── */
console.log('\n[ 카드를 같이 보낸다 ]');
{
  const t = userText('그럼 食べている는 뭐야?', CARD);
  ok('보는 카드가 들어간다', t.includes('食べる') && t.includes('たべる'), t.split('\n')[0]);
  ok('뜻도 들어간다', t.includes('먹다'));
  ok('레벨도 들어간다', t.includes('N5'));
  ok('카드 예문도 들어간다', t.includes('朝ごはん'));
  ok('질문이 들어간다', t.includes('食べている'));

  /* 카드 없이도 부를 수 있어야 한다 — 나중에 시험·실전에도 붙일 자리다 */
  const bare = userText('타베루가 뭐야?', undefined);
  ok('카드가 없어도 안 깨진다', bare.includes('타베루') && !bare.includes('[지금 보는 카드]'), bare);

  /* 앞뒤 공백만 있는 질문이 그대로 나가면 모델이 헛돈다 */
  ok('질문 앞뒤 공백은 다듬는다', userText('  뭐야?  ', CARD).endsWith('[질문] 뭐야?'));
}

/* ── 프롬프트가 지켜야 할 것 ── */
console.log('\n[ 프롬프트 ]');
{
  ok('한국어로 답하라고 적혀 있다', SYSTEM.includes('한국어로 답합니다'));
  /* 제일 나쁜 건 틀린 일본어를 자신 있게 가르치는 것이다 */
  ok('모르면 모른다고 하라고 적혀 있다', SYSTEM.includes('지어내지 마세요'));
  ok('짧게 답하라고 적혀 있다', SYSTEM.includes('세 문장'));
  ok('items 상한이 프롬프트에 박혀 있다', SYSTEM.includes(String(MAX_ITEMS)));
  ok('JSON만 달라고 한다', SYSTEM.includes('마크다운 펜스'));
}

/* ── 받은 걸 읽는다 ── */
console.log('\n[ 답을 읽는다 ]');
{
  const good = JSON.stringify({
    answer: '食べている는 食べる의 진행형이에요.',
    items: [{ jp: '食べている', kana: 'たべている', ko: '먹고 있다', note: '지금 먹는 중' }],
  });
  const r = parseAsk(good);
  ok('그대로 읽힌다', r.answer.includes('진행형') && r.items.length === 1);
  ok('items 칸이 다 채워진다',
    r.items[0].jp && r.items[0].kana && r.items[0].ko && r.items[0].note);

  /* 모델이 펜스를 붙이는 일이 실제로 있다 */
  ok('```json 펜스가 붙어도 읽는다', parseAsk('```json\n' + good + '\n```').items.length === 1);
  ok('앞뒤에 말을 얹어도 읽는다', parseAsk('네, 알려드릴게요.\n' + good + '\n도움이 되었길!').answer.length > 0);

  /* 옛 기록·이상한 답이 화면을 죽이면 안 된다 */
  ok('items가 없으면 빈 배열', parseAsk('{"answer":"음"}').items.length === 0);
  ok('items가 배열이 아니면 빈 배열', shapeAsk({ answer: 'a', items: '어라' }).items.length === 0);
  ok('jp 없는 항목은 버린다', shapeAsk({ items: [{ ko: '먹다' }, { jp: '食べる' }] }).items.length === 1);
  ok('kana가 없으면 jp로 채운다', shapeAsk({ items: [{ jp: '食べる' }] }).items[0].kana === '食べる');
  ok('같은 표현이 두 번 오면 한 번만',
    shapeAsk({ items: [{ jp: '食べる' }, { jp: '食べる' }, { jp: '飲む' }] }).items.length === 2);
  ok(`${MAX_ITEMS}개를 넘기면 자른다`,
    shapeAsk({ items: '가나다라마바사'.split('').map((c) => ({ jp: c })) }).items.length === MAX_ITEMS);
  ok('아무것도 없어도 모양은 나온다',
    shapeAsk().answer === '' && Array.isArray(shapeAsk().items));

  let threw = '';
  try { parseAsk('그냥 줄글이 왔어요'); } catch (e) { threw = e.message; }
  ok('JSON이 아니면 알려 준다', threw.includes('읽지 못했'), threw);
  try { parseAsk(''); } catch (e) { threw = e.message; }
  ok('빈 답이면 알려 준다', threw.includes('빈 응답'), threw);
}

/* ── 같은 걸 두 번 묻지 않는다 ── */
console.log('\n[ 두 번 안 묻는다 ]');
{
  ok('띄어쓰기가 달라도 같은 질문',
    askKey('n5-0012', '食べている 는 뭐야') === askKey('n5-0012', '  食べている   는  뭐야  '));
  ok('대소문자가 달라도 같은 질문', askKey('a', 'What is TE form') === askKey('a', 'what is te form'));
  /* 카드가 다르면 같은 말이어도 다른 질문이다 — 「이거 언제 써?」가 그렇다 */
  ok('카드가 다르면 다른 질문', askKey('a', '언제 써?') !== askKey('b', '언제 써?'));

  const hist = [
    { key: askKey('n5-0012', '진행형이 뭐야'), q: '진행형이 뭐야', cardId: 'n5-0012', answer: '…' },
  ];
  ok('전에 물은 건 찾아진다', Boolean(findAsk(hist, 'n5-0012', '진행형이 뭐야')));
  ok('띄어쓰기가 달라도 찾아진다', Boolean(findAsk(hist, 'n5-0012', '진행형이  뭐야 ')));
  ok('안 물어본 건 없다고 한다', findAsk(hist, 'n5-0012', '반대말은?') === null);
  ok('기록이 비어도 안 깨진다', findAsk([], 'a', 'b') === null && findAsk(undefined, 'a', 'b') === null);
}

/* ── 기록은 최근 것만 ── */
console.log('\n[ 기록 ]');
{
  const one = { key: 'k1', q: '첫 질문', answer: 'a' };
  const two = { key: 'k2', q: '둘째', answer: 'b' };
  ok('새 것이 맨 앞', rememberAsk([one], two)[0].key === 'k2');
  /* 같은 질문을 다시 물으면 두 줄이 되면 안 된다 */
  const again = rememberAsk([one, two], { key: 'k1', q: '첫 질문', answer: '고친 답' });
  ok('같은 질문은 한 줄로 갱신', again.length === 2 && again[0].answer === '고친 답');

  const many = Array.from({ length: KEEP_ASKS + 10 }, (_, i) => ({ key: `k${i}`, q: `${i}` }));
  const kept = rememberAsk(many, { key: 'new', q: '새것' });
  ok(`${KEEP_ASKS}개까지만 남는다`, kept.length === KEEP_ASKS, String(kept.length));
  ok('학습 기록을 밀어내지 않게 오래된 걸 버린다', !kept.some((h) => h.key === `k${KEEP_ASKS + 5}`));
}

/* ── 부르기 전에 막을 것 ── */
console.log('\n[ 부르기 전에 ]');
{
  const err = async (fn) => { try { await fn(); return ''; } catch (e) { return e.message; } };

  ok('빈 질문은 안 보낸다',
    (await err(() => ask('   ', CARD, { geminiKey: 'x' }))).includes('궁금한 걸 적어'));

  const long = 'ㅁ'.repeat(MAX_QUESTION_CHARS + 1);
  ok('너무 긴 질문은 안 보낸다',
    (await err(() => ask(long, CARD, { geminiKey: 'x' }))).includes(String(MAX_QUESTION_CHARS)));

  /* 키가 없는데 부르면 네트워크 오류로 뜬다 — 그러면 뭘 고쳐야 할지 모른다 */
  const noKey = await err(() => ask('뭐야?', CARD, {}));
  ok('키가 없으면 어디서 넣는지 알려 준다', noKey.includes('설정'), noKey);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
