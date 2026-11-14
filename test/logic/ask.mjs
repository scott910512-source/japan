/* 공부하다 물어보기 — 규칙 검사.
 *
 * 여기서 제일 중요한 건 두 가지다. 모델이 보낸 게 어떤 모양이든 화면이 안
 * 깨져야 하고(번역기에서 옛 기록 때문에 흰 화면을 봤다), 같은 걸 두 번 물으면
 * 요금이 두 번 나가면 안 된다. */
import {
  MAX_ITEMS, MAX_QUESTION_CHARS, KEEP_ASKS,
  SYSTEM, userText, parseAsk, shapeAsk, askKey, findAsk, rememberAsk, ask, eumOf, hanjaEum,
  ASK_PRESET, MAX_KANJI, MAX_TIPS, hasKanji, presetQuestion,
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
  ok('길잡이에게 거는 잡담은 거절하지 말라고 적혀 있다', SYSTEM.includes('거절하지 마세요') && SYSTEM.includes('[길잡이]'));
  ok('원작 대사를 옮기지 말라고 적혀 있다', SYSTEM.includes('원작의 대사를 그대로 옮기려 하지 마세요'));
  ok('일본어 공부와 상관없는 일은 여전히 돌려보낸다', SYSTEM.includes('숙제 대필'));
  ok('누구에게 묻는지 같이 보낸다', userText('너의 명대사는 뭐야', null, '곤').startsWith('[길잡이] 곤') && !userText('뭐야?', null).includes('[길잡이]'));
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
  {
    const refused = rememberAsk([], { key: askKey('', '곤 너의 명대사는 뭐야'), q: '곤 너의 명대사는 뭐야', answer: '일본어나 일본 생활과 관계없는 질문입니다.', items: [] });
    ok('예전에 거절로 저장된 답은 다시 꺼내지 않는다(다시 묻는다)', findAsk(refused, '', '곤 너의 명대사는 뭐야') === null);
    const fine = rememberAsk([], { key: askKey('', '뭐야'), q: '뭐야', answer: '관계없는 질문은 아니고요, 이건 조사예요.', items: [{ jp: 'は', kana: 'は', ko: '은/는', note: '' }] });
    ok('표현이 달린 답은 그대로 꺼낸다', Boolean(findAsk(fine, '', '뭐야')));
  }
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

  /* ★ 카드 없이 묻기(곤에게 물어보기) ★ null 카드에서 죽으면 안 된다 */
  ok('카드가 null이어도 질문 글이 만들어진다', userText('食べている는 뭐야?', null) === '[질문] 食べている는 뭐야?', userText('x', null));
  ok('카드가 없으면 「지금 보는 카드」 줄이 없다', !userText('뭐야', undefined).includes('지금 보는 카드'));

  /* ★ 질문은 가벼운 모델로, 직접 고른 모델은 존중 ★ */
  const realFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (u) => { urls.push(String(u)); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: '네', items: [] }) }] } }] }), { status: 200 }); };
  try {
    await ask('뭐야?', CARD, { geminiKey: 'AQ.x' });
    ok('모델을 안 골랐으면 가벼운 lite 별칭으로 묻는다', urls[0].includes('gemini-flash-lite-latest:generateContent'), urls[0]);
    await ask('다른 건?', CARD, { geminiKey: 'AQ.x', geminiModel: 'gemini-3.5-flash' });
    ok('직접 고른 모델은 그대로 쓴다', urls[1].includes('gemini-3.5-flash:generateContent'), urls[1]);
  } finally { globalThis.fetch = realFetch; }
}

/* ── 한자 설명 · 외우는 법 ── */
console.log('\n[ 눌러서 묻는 두 가지 ]');
{
  ok('한자 설명은 정해 둔 글로 묻는다', presetQuestion(ASK_PRESET.KANJI, ' 習う ') === '「習う」의 한자를 설명해 줘');
  ok('외우는 법도 정해 둔 글로 묻는다', presetQuestion(ASK_PRESET.MEMO, '習う') === '「習う」 외우는 법을 추천해 줘');
  ok('★ 한글로 적어도 묻는다 — 일본어 한자로 어떻게 쓰는지부터 ★', presetQuestion(ASK_PRESET.KANJI, '지하철') === '「지하철」를 일본어 한자로 어떻게 쓰는지, 그 한자를 설명해 줘' && presetQuestion(ASK_PRESET.KANJI, 'ちかてつ').includes('일본어 한자로 어떻게 쓰는지'));
  ok('한글 · 가나로 온 낱말은 한자 표기를 찾아 설명하라고 적혀 있다', SYSTEM.includes('한글(지하철)이나 가나') && SYSTEM.includes('보통 한자로 쓰지 않는 낱말이면'));
  ok('낱말이 없으면 묻지 않는다(빈 글)', presetQuestion(ASK_PRESET.KANJI, '  ') === '' && presetQuestion(ASK_PRESET.MEMO, null) === '');
  ok('한자가 든 낱말인지 가린다', hasKanji('習う') && hasKanji('時々') && !hasKanji('かわいい') && !hasKanji('コーヒー') && !hasKanji(''));
  ok('★ 프롬프트가 한자 설명의 세 가지를 요구한다: 한국 한자음 · 한국어에서의 쓰임 · 짜임 ★', SYSTEM.includes('훈음') && SYSTEM.includes('한국어에서도 같은 한자를 쓰는지') && SYSTEM.includes('부수') && SYSTEM.includes('정자'));
  ok('★ 어원은 지어내지 말라고 한다 ★', SYSTEM.includes('지어내지 마세요') && SYSTEM.includes('풀이해요'));
  ok('외우는 법은 짧게 두세 개, 종류를 나눠 권하게 한다', SYSTEM.includes('소리') && SYSTEM.includes('묶기') && SYSTEM.includes(`2~${MAX_TIPS}개`));
}

console.log('\n[ 한자 설명 · 외우는 법의 모양 ]');
{
  const got = shapeAsk({
    answer: '요약',
    kanji: [
      { char: '習', hanja: '익힐 습', korean: '학습(學習)', parts: '羽 + 白', more: 'シュウ' },
      { char: '習', hanja: '겹침' },                       // 같은 글자는 한 번만
      { char: '学', hanja: '배울 학(學)' },
      { char: '空' },                                       // 내용이 없는 칸은 버린다
      null, 'x', { hanja: '글자 없음' },
    ],
    tips: [{ kind: '소리', text: '하나' }, { kind: '아무거나', text: '둘' }, { text: '' }, null, { kind: '묶기', text: '셋' }, { kind: '한자', text: '넷' }],
  });
  ok('글자마다 한 칸 · 같은 글자는 한 번 · 빈 칸은 버린다', got.kanji.map((k) => k.char).join('') === '習学', JSON.stringify(got.kanji.map((k) => k.char)));
  ok('칸마다 다섯 항목이 글자로 채워진다(빠진 것은 빈 글)', got.kanji.every((k) => ['char', 'hanja', 'korean', 'parts', 'more'].every((f) => typeof k[f] === 'string')) && got.kanji[1].korean === '');
  ok(`외우는 법은 ${MAX_TIPS}개까지 · 빈 것은 버린다`, got.tips.length === MAX_TIPS && got.tips.map((t) => t.text).join() === '하나,둘,셋');
  ok('모르는 종류는 종류 없이 둔다', got.tips[0].kind === '소리' && got.tips[1].kind === '' && got.tips[2].kind === '묶기');
  const many = shapeAsk({ answer: 'a', kanji: Array.from({ length: 9 }, (_, i) => ({ char: String.fromCharCode(0x4e00 + i), hanja: 'x' })) });
  ok(`한자는 ${MAX_KANJI}글자까지`, many.kanji.length === MAX_KANJI);
  const old = shapeAsk({ answer: '예전 답', items: [{ jp: '食べる' }] });
  ok('★ 칸이 없는 답(예전 모양)도 빈 목록으로 받는다 ★', Array.isArray(old.kanji) && old.kanji.length === 0 && Array.isArray(old.tips) && old.tips.length === 0 && old.items.length === 1);
  ok('모양이 틀린 칸이 와도 죽지 않는다', shapeAsk({ answer: 'a', kanji: 'x', tips: { a: 1 } }).kanji.length === 0 && shapeAsk({ answer: 'a', kanji: 'x', tips: { a: 1 } }).tips.length === 0);
}

console.log('\n[ 한 줄 요약이 빠진 답 ]');
{
  const realFetch = globalThis.fetch;
  const reply = (body) => { globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }), { status: 200 }); };
  try {
    reply({ answer: '', kanji: [{ char: '習', hanja: '익힐 습' }] });
    const a = await ask(presetQuestion(ASK_PRESET.KANJI, '習う'), CARD, { geminiKey: 'AQ.x' }, { preset: ASK_PRESET.KANJI });
    ok('★ 한자 칸에 내용이 있으면 요약이 없어도 받는다 ★', a.kanji.length === 1 && a.answer === '');
    reply({ answer: '', tips: [{ kind: '소리', text: '문구' }] });
    const b = await ask(presetQuestion(ASK_PRESET.MEMO, '習う'), CARD, { geminiKey: 'AQ.x' });
    ok('외우는 법도 마찬가지', b.tips.length === 1);
    reply({ answer: '', kanji: [], tips: [] });
    let threw = false;
    try { await ask('뭐야?', CARD, { geminiKey: 'AQ.x' }); } catch { threw = true; }
    ok('아무것도 없는 답은 여전히 빈 답으로 알린다', threw);
  } finally { globalThis.fetch = realFetch; }
}

console.log('\n[ ★ 일본어 읽기와 한국 한자음을 따로 적는다 ★ ]');
{
  ok('훈음의 마지막 소리가 한국 한자음이다', eumOf('큰 대') === '대' && eumOf('끊을 절') === '절' && eumOf('배울 학(學)') === '학' && eumOf('쇠 철（鐵）') === '철');
  ok('훈음이 없거나 한글로 안 끝나면 빈 글', eumOf('') === '' && eumOf('big') === '' && eumOf(null) === '');
  const K = [{ char: '大', hanja: '큰 대' }, { char: '切', hanja: '끊을 절' }];
  ok('★ 낱말의 한국 한자음은 글자마다의 훈음에서 만든다(大切 → 대절) ★', hanjaEum('大切', K) === '대절');
  ok('가나는 건너뛴다(習う → 습)', hanjaEum('習う', [{ char: '習', hanja: '익힐 습' }]) === '습');
  ok('★ 훈음을 못 받은 한자가 있으면 만들지 않는다(반쪽 소리를 낱말처럼 보이지 않는다) ★', hanjaEum('大切', [K[0]]) === '' && hanjaEum('', K) === '' && hanjaEum('かな', K) === '');
  const got = shapeAsk({ answer: '大切(たいせつ)는 소중하다는 뜻이에요.', word: { jp: '大切', kana: 'たいせつ' }, kanji: [
    { char: '大', hanja: '큰 대', on: 'タイ · ダイ', kun: 'おお(きい)', korean: '대학(大學)' },
    { char: '切', hanja: '끊을 절', on: 'セツ · サイ', kun: 'き(る)', korean: '친절(親切)' },
  ] });
  ok('★ 낱말 칸: 일본어 읽기와 한국 한자음이 따로 온다 ★', got.word?.jp === '大切' && got.word.kana === 'たいせつ' && got.word.eum === '대절', JSON.stringify(got.word));
  ok('글자마다 음독 · 훈독 칸이 따로 있다', got.kanji[0].on === 'タイ · ダイ' && got.kanji[0].kun === 'おお(きい)' && got.kanji[1].on === 'セツ · サイ');
  ok('모델이 한국 한자음을 보내도 쓰지 않는다(훈음에서 만든 것만)', shapeAsk({ answer: 'a', word: { jp: '大切', kana: 'たいせつ', eum: '대체' }, kanji: [{ char: '大', hanja: '큰 대' }, { char: '切', hanja: '끊을 절' }] }).word.eum === '대절');
  ok('한자 설명이 아니면 낱말 칸은 없다', shapeAsk({ answer: 'a', word: { jp: '大切', kana: 'たいせつ' } }).word === null && shapeAsk({ answer: 'a' }).word === null);
  ok('옛 답(on · kun · word가 없는 것)도 그대로 받는다', shapeAsk({ answer: 'a', kanji: [{ char: '習', hanja: '익힐 습', more: '음독 シュウ' }] }).kanji[0].on === '' && shapeAsk({ answer: 'a', kanji: [{ char: '習', hanja: '익힐 습' }] }).word === null);
  ok('규칙에 적혀 있다: 일본어 낱말은 한자(가나)로, 한국 한자음은 이름표를 붙여', SYSTEM.includes('일본어 읽기와 한국 한자음을 섞지 마세요') && SYSTEM.includes('大切(たいせつ)') && SYSTEM.includes('한국 한자음으로는'));
}

console.log('\n[ ★ 글자별 한자 설명은 「한자 설명」 단추를 눌렀을 때만 ★ ]');
{
  const realFetch = globalThis.fetch;
  let sent = '';
  const reply = (body) => { globalThis.fetch = async (url, opt) => { sent = String(opt?.body || ''); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }), { status: 200 }); }; };
  const WITH_KANJI = { answer: '習는 익힌다는 글자예요.', items: [], kanji: [{ char: '習', hanja: '익힐 습', parts: '羽 + 白' }], tips: [] };
  try {
    reply(WITH_KANJI);
    const typed = await ask('習う의 한자가 뭐야?', CARD, { geminiKey: 'AQ.x' });
    ok('★ 그냥 물은 것에는 글자별 풀이를 붙이지 않는다(모델이 붙여 와도 버린다) ★', typed.kanji.length === 0 && typed.answer.includes('익힌다'));
    ok('그냥 물을 때는 [요청]을 보내지 않는다', !sent.includes('[요청] 한자 설명'));
    const pressed = await ask(presetQuestion(ASK_PRESET.KANJI, '習う'), CARD, { geminiKey: 'AQ.x' }, { preset: ASK_PRESET.KANJI });
    ok('★ 「한자 설명」 단추로 물으면 글자별 풀이가 온다 ★', pressed.kanji.length === 1 && pressed.kanji[0].hanja === '익힐 습');
    ok('★ 단추로 물었다고 알려 보낸다([요청] 한자 설명) ★', sent.includes('[요청] 한자 설명'));
    const memo = await ask(presetQuestion(ASK_PRESET.MEMO, '習う'), CARD, { geminiKey: 'AQ.x' }, { preset: ASK_PRESET.MEMO });
    ok('외우는 법 단추로는 글자별 풀이를 받지 않는다', memo.kanji.length === 0 && !sent.includes('[요청] 한자 설명'));
    reply({ answer: '', items: [], kanji: [{ char: '習', hanja: '익힐 습' }], tips: [] });
    let threw = false;
    try { await ask('習가 뭐야', CARD, { geminiKey: 'AQ.x' }); } catch { threw = true; }
    ok('그냥 물었는데 글자별 풀이만 온 답은 빈 답으로 알린다', threw);
  } finally { globalThis.fetch = realFetch; }
  ok('규칙에 적혀 있다(단추를 눌렀을 때만)', SYSTEM.includes('[요청]에 「한자 설명」이 없으면'));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
