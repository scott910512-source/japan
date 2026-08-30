/* 부사 빈칸 채우기.
 *
 * 이 검사가 제일 힘주는 건 자료 쪽이다. 「답이 하나만 되는가」 —
 * 「毎日【　】走ります」에 いつも도 よく도 다 되면, 맞는 답을 골랐는데
 * 틀렸다고 나온다. 그러면 사람이 앱을 안 믿는다.
 *
 * 기계가 「말이 되는가」를 판단할 수는 없다. 대신 자료가 스스로 어기기 쉬운
 * 규칙들을 여기서 지킨다 — 정답이 보기에 있는지, 오답마다 왜 틀렸는지가
 * 적혀 있는지, 부정 호응 부사가 부정문에만 답으로 쓰였는지. */
import {
  ADVERB_SETS, ALL_ADVERB_ITEMS, BLANK,
  splitBlank, filled, filledKana, buildSet, retryOf, scoreOf, cardOf, setStats, verdictsFrom,
} from '../../src/lib/adverb.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('── 자료가 성한가');
{
  ok('묶음이 여럿', ADVERB_SETS.length >= 5, `${ADVERB_SETS.length}묶음`);
  ok('문제가 스무 개 넘음', ALL_ADVERB_ITEMS.length >= 20, `${ALL_ADVERB_ITEMS.length}문제`);

  const noBlank = ALL_ADVERB_ITEMS.filter((it) => !it.jp.includes(BLANK));
  ok('모든 문장에 빈칸이 있음', noBlank.length === 0, noBlank.map((x) => x.id).join(', '));

  const kanaNoBlank = ALL_ADVERB_ITEMS.filter((it) => !it.kana.includes(BLANK));
  ok('읽는 법에도 빈칸이 있음', kanaNoBlank.length === 0, kanaNoBlank.map((x) => x.id).join(', '));

  /* 빈칸이 둘이면 어디를 채우는 건지 모른다 */
  const twice = ALL_ADVERB_ITEMS.filter((it) => it.jp.split(BLANK).length > 2);
  ok('빈칸은 하나씩', twice.length === 0, twice.map((x) => x.id).join(', '));

  const dup = ALL_ADVERB_ITEMS.map((x) => x.id).filter((id, i, a) => a.indexOf(id) !== i);
  ok('id가 안 겹침', dup.length === 0, dup.join(', '));
}

console.log('\n── 답이 보기 안에 있는가');
{
  const missing = ALL_ADVERB_ITEMS.filter((it) => !it.options.includes(it.answer));
  ok('정답이 보기에 들어 있음', missing.length === 0, missing.map((x) => x.id).join(', '));

  const three = ALL_ADVERB_ITEMS.filter((it) => it.options.length !== 3);
  ok('보기는 셋씩', three.length === 0, three.map((x) => `${x.id}(${x.options.length})`).join(', '));

  const dupOpt = ALL_ADVERB_ITEMS.filter((it) => new Set(it.options).size !== it.options.length);
  ok('보기에 같은 말이 두 번 안 나옴', dupOpt.length === 0, dupOpt.map((x) => x.id).join(', '));
}

console.log('\n── 왜 틀렸는지가 적혀 있는가');
{
  /* 정답만 알려 주면 다음에 또 틀린다. 이 화면의 값은 설명에 있다. */
  const noWhy = [];
  for (const it of ALL_ADVERB_ITEMS) {
    for (const o of it.options) {
      if (o === it.answer) continue;
      if (!it.why?.[o]) noWhy.push(`${it.id}:${o}`);
    }
  }
  ok('오답마다 왜 틀렸는지 적혀 있음', noWhy.length === 0, noWhy.join(', '));

  const noNote = ALL_ADVERB_ITEMS.filter((it) => !it.note);
  ok('문제마다 한 줄 설명이 있음', noNote.length === 0, noNote.map((x) => x.id).join(', '));

  const noKo = ALL_ADVERB_ITEMS.filter((it) => !it.ko);
  ok('한국어 뜻이 있음', noKo.length === 0, noKo.map((x) => x.id).join(', '));
}

console.log('\n── 부정과 짝을 이루는 부사');
{
  /* あまり·ぜんぜん·けっして·めったに는 뒤에 부정이 와야 한다.
     이걸 긍정문의 답으로 쓰면 틀린 일본어를 가르치게 된다. */
  const NEG_ONLY = ['あまり', 'ぜんぜん', 'けっして', 'めったに'];
  const bad = ALL_ADVERB_ITEMS.filter((it) => {
    if (!NEG_ONLY.includes(it.answer)) return false;
    return !/ません|ない|ありません/.test(it.jp);
  });
  ok('부정 호응 부사는 부정문에만 답으로 쓰임', bad.length === 0,
    bad.map((x) => `${x.id}: ${x.jp}`).join(' | '));

  /* 반대로, 부정문에 「とても」 같은 걸 답으로 두면 안 된다 */
  const POS_ONLY = ['とても', 'たくさん', 'いつも', 'よく', 'かならず'];
  const bad2 = ALL_ADVERB_ITEMS.filter(
    (it) => POS_ONLY.includes(it.answer) && /ません|ありません/.test(it.jp),
  );
  ok('긍정 부사는 부정문에 답으로 안 쓰임', bad2.length === 0,
    bad2.map((x) => `${x.id}: ${x.jp}`).join(' | '));
}

console.log('\n── 빈칸을 쪼개고 채운다');
{
  const it = ALL_ADVERB_ITEMS[0];
  const { head, tail } = splitBlank(it.jp);
  ok('앞뒤로 갈린다', head.length + tail.length === it.jp.length - BLANK.length,
    `«${head}» + «${tail}»`);
  ok('빈칸이 안 남는다', !head.includes(BLANK) && !tail.includes(BLANK));

  ok('답을 넣으면 완성된다', filled(it) === head + it.answer + tail, filled(it));
  ok('완성 문장에 빈칸 기호가 없다', !filled(it).includes(BLANK));
  ok('읽는 법도 완성된다', !filledKana(it).includes(BLANK), filledKana(it));

  /* 빈칸이 없는 글도 안 깨져야 한다 */
  ok('빈칸이 없으면 통째로 앞', splitBlank('あいうえお').head === 'あいうえお');
  ok('빈 값도 안 깨짐', splitBlank().head === '' && splitBlank(null).tail === '');
}

console.log('\n── 한 판 짜기');
{
  const items = buildSet('neg');
  ok('묶음 하나를 통째로 돈다', items.length === ADVERB_SETS[0].items.length, `${items.length}문제`);
  ok('보기가 딸려 온다', items.every((it) => it.options.length === 3));
  ok('정답은 그대로', items.every((it) => it.options.includes(it.answer)));
  /* 문제 순서는 안 섞는다 — 자료를 쉬운 것부터 적어 뒀다 */
  ok('문제 순서는 그대로', items.map((x) => x.id).join(',') === ADVERB_SETS[0].items.map((x) => x.id).join(','));
  ok('없는 묶음은 빈 배열', buildSet('없는것').length === 0);

  /* 틀린 것만 다시 — 틀린 채로 넘어가면 오늘 배운 게 없다 */
  const again = retryOf(items, [items[0].id, items[2].id]);
  ok('틀린 것만 골라 낸다', again.length === 2, again.map((x) => x.id).join(','));
  ok('없는 것을 넣어도 안 깨짐', retryOf(items, ['없는id']).length === 0);
}

console.log('\n── 셈');
{
  const items = buildSet('neg');
  const answers = {};
  items.forEach((it, i) => { answers[it.id] = { good: i % 2 === 0 }; });
  const s = scoreOf(answers, items);
  ok('맞힌 수를 센다', s.right === Math.ceil(items.length / 2), `${s.right}/${s.total}`);
  ok('안 푼 것은 틀린 것으로 안 센다', scoreOf({}, items).right === 0);
  ok('빈 판도 안 깨짐', scoreOf({}, []).rate === 0);
}

console.log('\n── 단어장 카드와 잇기');
{
  /* id를 자료에 박아 두지 않고 읽는 법으로 찾는다 — 파일이 합쳐지면서
     부사 카드 id가 바뀔 수 있고, 박아 두면 그때 조용히 끊긴다. */
  const missing = [...new Set(ALL_ADVERB_ITEMS.map((it) => it.answer))]
    .filter((k) => !cardOf(ALL_WORDS, k));
  ok('모든 정답 부사가 단어장에 있다', missing.length === 0, missing.join(', '));

  const card = cardOf(ALL_WORDS, 'あまり');
  ok('부사 카드를 찾는다', Boolean(card) && card.kana === 'あまり', card?.id);
  ok('없는 말은 null', cardOf(ALL_WORDS, 'ぞぞぞ') === null);
}

console.log('\n── 회독으로 넘기는 판정');
{
  const items = buildSet('neg');
  /* 맞힌 것은 안 올린다. 셋 중에 고르는 건 알아본 것이지 떠올린 게 아니다 —
     그걸 「알아요」로 세면 복습 간격이 실력보다 빨리 벌어진다. */
  const allRight = {};
  items.forEach((it) => { allRight[it.id] = { good: true }; });
  ok('다 맞히면 아무것도 안 올린다',
    Object.keys(verdictsFrom(allRight, items, ALL_WORDS)).length === 0);

  const oneWrong = { [items[0].id]: { good: false, opt: items[0].options[0] } };
  const v = verdictsFrom(oneWrong, items, ALL_WORDS);
  ok('틀린 것만 올린다', Object.keys(v).length === 1, JSON.stringify(v));
  ok('「몰라요」로 올린다', Object.values(v)[0] === 'unknown', Object.values(v)[0]);

  const card = cardOf(ALL_WORDS, items[0].answer);
  ok('그 부사의 단어장 카드에 붙는다', Object.keys(v)[0] === card.id, `${Object.keys(v)[0]} vs ${card.id}`);

  ok('안 푼 판은 아무것도 안 올린다',
    Object.keys(verdictsFrom({}, items, ALL_WORDS)).length === 0);
}

console.log('\n── 묶음별 진도');
{
  const review = {};
  const card = cardOf(ALL_WORDS, 'あまり');
  review[card.id] = { box: 1, streak: 0, lastSeen: '2026-08-01', rounds: 5, wrongCount: 4, vagueCount: 0, seenAt: 1 };
  const rows = setStats(ALL_WORDS, review);
  ok('묶음마다 한 줄', rows.length === ADVERB_SETS.length);
  ok('본 것을 센다', rows[0].seen === 1, `${rows[0].seen}개`);
  ok('약점도 센다', rows[0].weak === 1, `${rows[0].weak}개`);
  ok('안 본 묶음은 0', rows[1].seen === 0);
  ok('기록이 없어도 안 깨짐', setStats(ALL_WORDS, {}).every((r) => r.seen === 0));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
