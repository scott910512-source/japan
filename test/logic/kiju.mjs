/* 기출 단어 — 목록이 단어장과 어긋나면 여기서 잡는다.
 *
 * 이 목록은 손으로 옮겨 적은 자료다(교재 사진 → 표기·읽기·연도). 옮겨 적은
 * 자료는 언젠가 틀린다 — 읽기를 잘못 보거나, 한 해를 통째로 빠뜨리거나,
 * 같은 낱말을 두 줄로 적는다. 그걸 사람이 다시 눈으로 대조할 수는 없으니
 * 검사가 대조한다.
 *
 * 제일 중요한 것은 「단어장에 없는 표기가 목록에 있으면 안 된다」다. 그러면
 * 기출 화면에서 그 줄이 조용히 사라진다 — 시험에 나온 단어가 목록에서
 * 빠지는 건 이 기능이 하려는 일의 정반대다. */
import { ALL_WORDS } from '../../src/data/allWords.js';
import {
  KIJU_GROUP, KIJU_LIST, KIJU_SOURCE, kijuByWord, kijuByYear, kijuCards, kijuGroupAt,
  kijuIndex, kijuMissing, kijuStat,
} from '../../src/lib/kiju.js';
import { dailyPool } from '../../src/lib/cards.js';
import { classifyDaily } from '../../src/lib/daily.js';
import { applyVerdict, isDoneEnough, stateOf, VERDICT } from '../../src/lib/review.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n── 자료 자체');
{
  ok('열여섯 해', KIJU_SOURCE.from === 2010 && KIJU_SOURCE.to === 2025);
  ok('205개', KIJU_LIST.length === 205, `${KIJU_LIST.length}개`);

  const dup = KIJU_LIST.map((e) => e.w).filter((w, i, a) => a.indexOf(w) !== i);
  ok('같은 표기가 두 줄로 있지 않다', dup.length === 0, dup.join(' '));

  const bad = KIJU_LIST.filter((e) => !e.w || !e.k || !e.ko || !e.y?.length);
  ok('빈 칸이 없다', bad.length === 0, bad.map((e) => e.w).join(' '));

  const range = KIJU_LIST.filter((e) => e.y.some((y) => y < 2010 || y > 2025));
  ok('연도가 범위 안', range.length === 0, range.map((e) => e.w).join(' '));

  const sorted = KIJU_LIST.every((e) => e.y.every((y, i) => i === 0 || e.y[i - 1] < y));
  ok('한 낱말의 연도는 오름차순이고 겹치지 않는다', sorted);

  /* な형용사는 사전형으로 적는다 — 교재는 「得意だ」지만 단어장이 「得意」라,
     둘 중 한 곳에서만 だ를 떼면 이어 붙는 자리가 어긋난다. */
  const da = KIJU_LIST.filter((e) => e.w.endsWith('だ'));
  ok('표기에 だ가 붙은 줄이 없다', da.length === 0, da.map((e) => e.w).join(' '));
}

console.log('\n── 연도별');
{
  const years = kijuByYear();
  ok('열여섯 해가 다 있다', years.length === 16, `${years.length}해`);
  ok('최근 해가 먼저', years[0].year === 2025 && years[15].year === 2010);

  /* 한자읽기는 한 회에 여덟 문제, 한 해에 두 회라 한 해에 열여섯 개다.
     그렇지 않은 해가 둘 있고, 둘 다 교재가 그렇게 적혀 있는 것이다.

       2020 — 8개. 그해 7월 시험이 취소되어 한 회만 치렀다.
       2022 — 15개. 교재의 2022년 목록이 열다섯 줄이다(확인함).

     한 해에 하나씩 따로 못 박는 이유가 이것이다. 「16이 아닌 해가 둘 있다」로
     뭉뚱그리면 다음에 한 해가 통째로 잘못 들어와도 이 검사가 조용하다. */
  const byYear = Object.fromEntries(years.map((y) => [y.year, y.items.length]));
  ok('2020년은 여덟 개 — 7월 시험 취소', byYear[2020] === 8, `${byYear[2020]}개`);
  ok('2022년은 열다섯 개 — 교재가 그렇다', byYear[2022] === 15, `${byYear[2022]}개`);
  const rest = years.filter((y) => y.year !== 2020 && y.year !== 2022 && y.items.length !== 16);
  ok('나머지 열네 해는 열여섯 개씩', rest.length === 0, rest.map((y) => `${y.year}:${y.items.length}`).join(' '));

  const total = years.reduce((s, y) => s + y.items.length, 0);
  ok('출제 횟수 합계 247', total === 247, `${total}회`);
}

console.log('\n── 단어장에 이어 붙는다');
{
  const miss = kijuMissing(ALL_WORDS);
  ok('★ 목록의 표기가 전부 단어장에 있다 ★', miss.length === 0, miss.join(' '));

  const idx = kijuIndex(ALL_WORDS);
  ok('205개가 다 이어졌다', idx.size === 205, `${idx.size}개`);

  const src = kijuByWord();
  const cards = kijuCards(ALL_WORDS);
  const wrong = cards.filter((c) => c.kana !== src.get(c.kanji).kana);
  ok('★ 교재의 읽기와 단어장의 읽기가 같다 ★', wrong.length === 0,
    wrong.map((c) => `${c.kanji} 앱:${c.kana} 교재:${src.get(c.kanji).kana}`).join(' | '));

  /* 기출이라고 전부 N3가 아니다. 卒業·計算은 N4다 — 레벨을 좁혀 공부하는
     사람의 범위를 기출이 마음대로 넓히지 않는지 본다. */
  const levels = new Set(cards.map((c) => c.level));
  ok('레벨은 단어장 것을 그대로 쓴다', levels.size > 1, [...levels].join(' '));
}

console.log('\n── 순서: 많이 나온 것부터');
{
  const cards = kijuCards(ALL_WORDS);
  ok('205장', cards.length === 205, `${cards.length}장`);

  const counts = cards.map((c) => c.kiju.count);
  ok('★ 앞으로 갈수록 출제 횟수가 줄지 않는다 ★', counts.every((n, i) => i === 0 || counts[i - 1] >= n));

  const hot = cards.filter((c) => c.kiju.count > 1);
  ok('두 번 이상 나온 36개', hot.length === 36, `${hot.length}개`);
  ok('그 36개가 맨 앞에 몰려 있다', cards.slice(0, 36).every((c) => c.kiju.count > 1));

  const three = cards.filter((c) => c.kiju.count === 3).map((c) => c.kanji);
  ok('세 번 나온 여섯 개가 제일 앞', three.length === 6 && cards.slice(0, 6).every((c) => c.kiju.count === 3),
    three.join(' '));

  // 두 번 부르면 같은 순서 — 화면을 다시 그릴 때마다 자리가 바뀌면 못 외운다
  const again = kijuCards(ALL_WORDS);
  ok('부를 때마다 같은 순서', again.every((c, i) => c.id === cards[i].id));
}

console.log('\n── 진도');
{
  const cards = kijuCards(ALL_WORDS);
  const T = '2026-09-23';
  let review = {};
  const first = cards[0].id;
  const second = cards[1].id;
  ok('아무것도 안 했으면 전부 아직',
    kijuStat(cards, (id) => stateOf(review, id), isDoneEnough).left === 205);

  review = { ...review, [first]: applyVerdict(stateOf(review, first), VERDICT.VAGUE, T) };
  const s1 = kijuStat(cards, (id) => stateOf(review, id), isDoneEnough);
  ok('한 장 보면 본 것 1', s1.seen === 1 && s1.left === 204, `seen ${s1.seen}`);
  ok('아직 외운 것은 아니다', s1.done === 0);

  review = { ...review, [second]: applyVerdict(stateOf(review, second), VERDICT.MASTER, T) };
  const s2 = kijuStat(cards, (id) => stateOf(review, id), isDoneEnough);
  ok('외운 것 1 · 본 것 2', s2.done === 1 && s2.seen === 2, `done ${s2.done} seen ${s2.seen}`);
  ok('총계는 그대로', s2.total === 205 && s2.left === 203);
}

console.log('\n── 서른 개씩 묶어서, 쌓아 가며');
{
  const cards = kijuCards(ALL_WORDS);
  ok('묶음은 서른 개', KIJU_GROUP === 30);

  /* 아무것도 안 뗐으면 1묶음. 「이번 판」은 1~30이다. */
  const g0 = kijuGroupAt(cards, () => false);
  ok('처음에는 1묶음', g0.index === 0 && g0.to === 30, `${g0.index + 1}묶음 · 1~${g0.to}`);
  ok('판은 서른 장', g0.list.length === 30);
  ok('205개면 일곱 묶음', g0.groups === 7, `${g0.groups}묶음`);
  ok('첫 장은 제일 많이 나온 낱말', g0.list[0].kanji === cards[0].kanji, g0.list[0].kanji);

  /* 스물아홉 개만 떼면 아직 1묶음 — 하나 남아도 안 넘어간다.
     건너뛰면 구멍이 생기고, 그 구멍은 시험장에서 열린다. */
  const first29 = new Set(cards.slice(0, 29).map((c) => c.id));
  const g29 = kijuGroupAt(cards, (id) => first29.has(id));
  ok('★ 하나라도 남으면 안 넘어간다 ★', g29.index === 0 && g29.to === 30, `${g29.index + 1}묶음`);
  ok('남은 수를 센다', g29.left === 1, `${g29.left}개`);

  /* 서른 개를 다 떼면 2묶음 — 앞의 서른 개가 그대로 들어 있다 */
  const first30 = new Set(cards.slice(0, 30).map((c) => c.id));
  const g1 = kijuGroupAt(cards, (id) => first30.has(id));
  ok('★ 다 떼면 다음 묶음 ★', g1.index === 1 && g1.to === 60, `${g1.index + 1}묶음 · 1~${g1.to}`);
  ok('★ 앞 묶음이 빠지지 않는다 ★', g1.list.length === 60 && g1.list[0].kanji === cards[0].kanji,
    `${g1.list.length}장`);
  ok('새로 더해진 것은 서른 개', g1.fresh.length === 30 && g1.fresh[0].kanji === cards[30].kanji);
  ok('새로 더해진 것은 아직 안 뗀 상태', g1.left === 30);
  ok('뗀 것도 센다', g1.done === 30);

  /* 세 묶음을 떼면 1~120 */
  const first90 = new Set(cards.slice(0, 90).map((c) => c.id));
  const g3 = kijuGroupAt(cards, (id) => first90.has(id));
  ok('세 묶음을 떼면 1~120', g3.index === 3 && g3.list.length === 120, `1~${g3.to}`);

  /* 중간에 구멍이 있으면 그 묶음에서 멈춘다 */
  const hole = new Set(cards.slice(0, 90).map((c) => c.id));
  hole.delete(cards[15].id);
  const gh = kijuGroupAt(cards, (id) => hole.has(id));
  ok('★ 1묶음에 구멍이 있으면 1묶음에 머문다 ★', gh.index === 0, `${gh.index + 1}묶음`);

  /* 마지막 묶음에서는 더 안 나간다 — 205는 서른으로 안 나눠떨어진다 */
  const all = new Set(cards.map((c) => c.id));
  const gEnd = kijuGroupAt(cards, (id) => all.has(id));
  ok('끝까지 떼면 마지막 묶음에 선다', gEnd.index === 6 && gEnd.to === 205, `${gEnd.index + 1}묶음 · 1~${gEnd.to}`);
  ok('마지막 묶음은 스물다섯 장만 더해진다', gEnd.fresh.length === 25, `${gEnd.fresh.length}개`);
  ok('전체가 판에 들어간다', gEnd.list.length === 205);
  ok('다 끝났다고 말한다', gEnd.finished === true);
  ok('아직일 때는 안 끝났다고 한다', g0.finished === false);

  /* 묶음 크기를 바꿔 불러도 규칙은 같다 */
  const g10 = kijuGroupAt(cards, () => false, 10);
  ok('묶음 크기를 주면 그대로 쓴다', g10.to === 10 && g10.groups === 21, `1~${g10.to} · ${g10.groups}묶음`);
  ok('빈 목록도 안 죽는다', kijuGroupAt([], () => false).list.length === 0);
}

console.log('\n── 오늘의 계획이 기출부터 꺼낸다');
{
  const idx = kijuIndex(ALL_WORDS);
  const first = new Set(idx.keys());
  const pool = dailyPool(ALL_WORDS, [], { first });
  const words = pool.filter((x) => x.kind === 'word');
  ok('★ 앞쪽 205개가 전부 기출 ★', words.slice(0, 205).every((x) => first.has(x.id)));
  ok('나머지도 빠지지 않는다 — 당기는 것이지 빼는 게 아니다',
    words.length === ALL_WORDS.length, `${words.length} / ${ALL_WORDS.length}`);

  /* 계획이 실제로 뽑는 자리까지 본다. 순서만 바꿔 놓고 classifyDaily가
     다시 섞으면 이 기능은 아무 일도 안 한 것이 된다. */
  const { fresh } = classifyDaily(pool, {}, '2026-09-23');
  ok('★ 새로 배울 차례의 처음 여덟 개가 기출 ★', fresh.slice(0, 8).every((x) => first.has(x.id)),
    fresh.slice(0, 3).map((x) => x.id).join(' '));

  const plain = dailyPool(ALL_WORDS, [], {});
  ok('first를 안 주면 예전 차례 그대로', plain[0].id === ALL_WORDS[0].id);
  ok('기출을 주면 첫 카드가 바뀐다', pool[0].id !== plain[0].id);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
