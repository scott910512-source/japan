/* 학습 목적과 여행 날짜.
 *
 * 온보딩은 「남은 기간에 맞춰 오늘 학습량과 우선순위를 잡아 드려요」라고
 * 적어 두고 아무것도 안 했다. 답은 받아서 저장까지 했는데 계획은 그 답을
 * 한 번도 읽지 않았다 — 개인화되지 않는 것을 개인화된 것처럼 말한 것이다.
 *
 * 그리고 「3일 이내」 같은 선택을 tripDay에 저장해 두고 날짜처럼 썼다.
 * 그건 고른 날의 이야기라 사흘이 지나면 거짓말이 된다. */
import {
  PURPOSES, purposeOf, orderByPurpose, isTripCard, directionFor,
  daysUntilTrip, tripLabel, DEFAULT_PURPOSE,
} from '../../src/lib/purpose.js';
import { buildPlan, planStatus } from '../../src/lib/plan.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 목적 ]');
ok('셋이다', PURPOSES.length === 3, PURPOSES.map((p) => p.label).join(' / '));
ok('JLPT · 여행 · 회화', PURPOSES.map((p) => p.id).join() === 'jlpt,trip,talk');
/* ★ 무엇이 달라지는지 그 자리에 적어야 한다 ★ */
ok('목적마다 무엇이 달라지는지 적혀 있다', PURPOSES.every((p) => p.does?.length > 10));
ok('모르는 값은 기본으로', purposeOf({ purpose: '없는것' }) === DEFAULT_PURPOSE);
ok('빈 설정도 안 죽는다', purposeOf(undefined) === DEFAULT_PURPOSE);

console.log('\n[ 차례가 실제로 바뀐다 ]');
{
  const cards = {
    w1: { id: 'w1' }, w2: { id: 'w2' },
    s1: { id: 's1', place: '이동 · 지하철' },
    s2: { id: 's2', place: '취미 · 영화' },
  };
  const pool = [
    { id: 'w1', kind: 'word' }, { id: 's2', kind: 'sentence' },
    { id: 'w2', kind: 'word' }, { id: 's1', kind: 'sentence' },
  ];
  const cardOf = (id) => cards[id];
  const ids = (p) => orderByPurpose(pool, p, cardOf).map((x) => x.id);

  ok('시험은 단어를 앞세운다', ids('jlpt').slice(0, 2).join() === 'w1,w2', ids('jlpt').join(','));
  ok('★ 여행은 여행 문장을 맨 앞에 ★', ids('trip')[0] === 's1', ids('trip').join(','));
  ok('여행이어도 단어가 사라지진 않는다', ids('trip').includes('w1') && ids('trip').includes('w2'));
  ok('회화는 문장을 앞세운다', ids('talk')[0] === 's2' || ids('talk')[0] === 's1', ids('talk').join(','));
  /* 거르지 않고 차례만 바꾼다 — 목적은 취향이지 자격이 아니다 */
  ok('무엇을 고르든 개수는 같다',
    PURPOSES.every((p) => orderByPurpose(pool, p.id, cardOf).length === pool.length));
  /* 같은 등급 안에서는 원래 차례를 지킨다 — 매번 다른 데서 튀어나오면 안 된다 */
  ok('안정 정렬이다', ids('jlpt').join() === 'w1,w2,s2,s1', ids('jlpt').join(','));

  ok('여행 상황을 알아본다', isTripCard({ place: '식당 · 주문' }) && isTripCard({ place: '숙소' }));
  ok('아닌 것은 아니라고 한다', !isTripCard({ place: '취미' }) && !isTripCard({}));
}

console.log('\n[ 계획에 반영된다 ]');
{
  const pool = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, kind: 'word' })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, kind: 'sentence' })),
  ];
  const cardOf = (id) => ({ id, place: id.startsWith('s') ? '이동 · 버스' : '' });
  const opt = (purpose) => ({ goals: { fresh: 6, review: 0, weak: 0 }, today: '2026-09-05', purpose, cardOf });

  const jlpt = buildPlan(pool, {}, opt('jlpt')).assigned;
  const trip = buildPlan(pool, {}, opt('trip')).assigned;
  ok('시험이면 단어가 더 많다',
    jlpt.filter((x) => x.kind === 'word').length > trip.filter((x) => x.kind === 'word').length,
    `jlpt 단어 ${jlpt.filter((x) => x.kind === 'word').length} / trip 단어 ${trip.filter((x) => x.kind === 'word').length}`);
  ok('여행이면 문장이 들어온다', trip.some((x) => x.kind === 'sentence'));
  ok('배정 개수는 목적과 무관', planStatus(buildPlan(pool, {}, opt('jlpt'))).assigned
    === planStatus(buildPlan(pool, {}, opt('talk'))).assigned);
  /* 목적을 안 주면 예전처럼 자료 차례대로 — 옛 동작을 안 깬다 */
  ok('목적이 없어도 돈다', buildPlan(pool, {}, { goals: { fresh: 6, review: 0, weak: 0 }, today: '2026-09-05' }).assigned.length === 6);
}

console.log('\n[ 회화는 방향을 뒤집는다 ]');
ok('회화는 뜻 → 일본어', directionFor('talk') === 'mean-kanji');
ok('나머지는 그대로', directionFor('jlpt') === 'kanji-mean' && directionFor('trip') === 'kanji-mean');
ok('설정한 기본을 지킨다', directionFor('jlpt', 'kanji-kana') === 'kanji-kana');

console.log('\n[ ★ 여행까지 며칠 — 실제 날짜로만 ★ ]');
{
  const T = '2026-09-05';
  ok('날짜가 있으면 센다', daysUntilTrip({ tripDate: '2026-09-15' }, T) === 10);
  ok('오늘이면 0', daysUntilTrip({ tripDate: T }, T) === 0);
  ok('지났으면 음수', daysUntilTrip({ tripDate: '2026-09-01' }, T) === -4);
  /* ★ 「3일 이내」를 날짜인 척 쓰지 않는다 ★ */
  ok('★ 옛 선택값은 날짜로 안 센다 ★', daysUntilTrip({ tripDay: 'd3' }, T) === null);
  ok('없으면 없다고 한다', daysUntilTrip({}, T) === null);
  ok('이상한 값도 안 죽는다', daysUntilTrip({ tripDate: '내일' }, T) === null);
  ok('달을 넘겨도 맞다', daysUntilTrip({ tripDate: '2026-10-05' }, T) === 30);

  ok('홈에 적을 말', tripLabel({ tripDate: '2026-09-15' }, T) === '여행까지 10일');
  ok('당일', tripLabel({ tripDate: T }, T) === '오늘 출발이에요');
  ok('지난 여행은 지났다고', tripLabel({ tripDate: '2026-09-01' }, T)?.includes('다녀오셨'));
  ok('안 넣었으면 아무 말도 안 한다', tripLabel({}, T) === null);
  ok('옛 선택값만 있으면 아무 말도 안 한다', tripLabel({ tripDay: 'd7' }, T) === null);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
