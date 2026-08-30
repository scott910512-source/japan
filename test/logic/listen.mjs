/* 듣기 — 무엇을 들려줄지 고르는 규칙.
 *
 * 이 화면이 오늘의 학습 큐를 빌려 쓰던 시절에는 두 가지가 망가져 있었다.
 * 배운 게 500개인데 늘 같은 스무 개만 들렸고, 순서까지 매번 같았다.
 * 그래서 소리가 아니라 순서를 외우게 됐다. 여기서 그걸 지킨다. */
import { SCOPES, DIRECTIONS, inScope, pickListen, scopeCounts, stepsOf } from '../../src/lib/listen.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const TODAY = '2026-08-30';
const pool = Array.from({ length: 60 }, (_, i) => ({ id: `w${i}`, kind: 'word' }));

/* 셋으로 갈라 둔다 — 아직 안 본 것 30, 복습일이 된 것 20(그중 약점 8),
   복습일이 아직 안 된 것 10. */
const review = {};
for (let i = 30; i < 50; i++) {
  review[`w${i}`] = {
    box: 2, lastSeen: '2026-08-01', due: '2026-08-20',
    wrongCount: i < 38 ? 4 : 0, seenCount: 3,
  };
}
for (let i = 50; i < 60; i++) {
  review[`w${i}`] = { box: 4, lastSeen: '2026-08-29', due: '2026-12-01', wrongCount: 0, seenCount: 5 };
}

console.log('\n[ 범위 ]');
const c = scopeCounts(pool, review, TODAY);
ok('전체는 전부', c.all === 60, `${c.all}`);
ok('배운 것은 한 번이라도 본 것', c.seen === 30, `${c.seen}`);
ok('오늘 볼 것 = 안 본 것 + 복습일이 된 것', c.today === 50, `${c.today}`);
ok('약점만은 세 번 넘게 틀린 것', c.weak === 8, `${c.weak}`);

/* ★ 이 화면이 있는 이유 ★
   「배운 것」이 오늘 몫보다 넓어야 한다. 안 그러면 옛날과 똑같다. */
ok('배운 것은 오늘의 학습 스무 개보다 넓다', c.seen > 20, `${c.seen}개`);

ok('안 본 카드는 배운 것에 없다',
  !inScope({ box: 0, wrongCount: 0 }, 'seen', TODAY));
ok('복습일이 안 된 카드는 오늘 볼 것에 없다',
  !inScope(review.w50, 'today', TODAY));
ok('범위 목록에 설명이 다 붙어 있다',
  SCOPES.every((s) => s.label && s.sub), `${SCOPES.length}가지`);

console.log('\n[ 고르기 ]');
const seen = pickListen(pool, review, { scope: 'seen', count: 20, today: TODAY });
ok('개수만큼만 나온다', seen.length === 20, `${seen.length}장`);
ok('범위 밖은 안 섞인다', seen.every((x) => review[x.id]?.lastSeen));

const few = pickListen(pool, review, { scope: 'weak', count: 50, today: TODAY });
ok('범위가 개수보다 작으면 있는 만큼만', few.length === 8, `${few.length}장`);

const big = pickListen(pool, review, { scope: 'all', count: 50, today: TODAY });
ok('개수 설정이 실제로 먹는다', big.length === 50, `${big.length}장`);
ok('중복 없이 고른다', new Set(big.map((x) => x.id)).size === big.length);

/* ★ 순서가 매번 같으면 소리가 아니라 순서를 외운다 ★ */
const a = pickListen(pool, review, { scope: 'all', count: 30, today: TODAY }).map((x) => x.id);
const b = pickListen(pool, review, { scope: 'all', count: 30, today: TODAY }).map((x) => x.id);
ok('돌릴 때마다 순서가 다르다', a.join() !== b.join(),
  `${a.slice(0, 4).join(' ')} / ${b.slice(0, 4).join(' ')}`);

const fixed = pickListen(pool, review, { scope: 'all', count: 5, shuffle: false, today: TODAY });
ok('안 섞을 수도 있다', fixed.map((x) => x.id).join() === 'w0,w1,w2,w3,w4');
ok('0개를 부르면 빈손', pickListen(pool, review, { scope: 'all', count: 0 }).length === 0);

console.log('\n[ 한 장의 걸음 ]');
ok('방향은 둘', DIRECTIONS.length === 2, DIRECTIONS.map((d) => d.id).join(' / '));
ok('일본어 → 뜻', stepsOf('jp-ko').join() === 'jp,ko');
ok('따라 말하기는 사이에 말할 틈',
  stepsOf('jp-ko', { shadow: true }).join() === 'jp,say,ko',
  stepsOf('jp-ko', { shadow: true }).join());

/* ★ 뒤집으면 뜻이 먼저다 ★ 뜻을 듣고 → 내가 말하고 → 답을 본다 */
ok('뜻 → 일본어는 한국어로 연다', stepsOf('ko-jp')[0] === 'ko');
ok('말할 틈이 가운데 있다', stepsOf('ko-jp')[1] === 'say');
ok('답은 맨 끝', stepsOf('ko-jp').at(-1) === 'jp');

/* 소리를 끄는 건 걸음을 빼는 게 아니다. 걸음까지 빼면 답이 화면에도 안 뜬다 —
   「듣기 전에 떠올리고 싶다」지 「맞았는지 확인도 안 하겠다」가 아니다. */
ok('답 소리를 꺼도 답 걸음은 남는다',
  stepsOf('ko-jp', { sayAnswer: false }).at(-1) === 'jp');
ok('뒤집은 판에서는 따라 말하기가 순서를 안 바꾼다',
  stepsOf('ko-jp', { shadow: true }).join() === stepsOf('ko-jp').join());

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
