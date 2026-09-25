/* 듣기 — 무엇을 들려줄지 고르는 규칙.
 *
 * 이 화면이 오늘의 학습 큐를 빌려 쓰던 시절에는 두 가지가 망가져 있었다.
 * 배운 게 500개인데 늘 같은 스무 개만 들렸고, 순서까지 매번 같았다.
 * 그래서 소리가 아니라 순서를 외우게 됐다. 여기서 그걸 지킨다. */
import {
  SCOPES, DIRECTIONS, blockCount, blocksIn, inScope, nextAt, pickBlock, pickListen, scopeCounts, stepsOf,
} from '../../src/lib/listen.js';

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

/* ── 기출만 듣기 ──
   다른 범위는 「얼마나 외웠나」로 고르는데 이것만 「시험에 나왔나」로 고른다.
   목록은 화면이 넘겨 준다 — lib/listen.js는 단어 자료를 모른 채로 둔다. */
const kiju = [{ id: 'w0' }, { id: 'w1' }, { id: 'w35' }, { id: 'w55' }, { id: 'x9' }];
const ids = new Set(kiju.map((x) => x.id));
const ck = scopeCounts(pool, review, TODAY, kiju);
ok('기출은 넘겨준 만큼', ck.kiju === 5, `${ck.kiju}`);
ok('★ 외운 것도 뺀 게 아니다 ★ — w55는 복습일이 한참 남았는데도 들어온다',
  pickListen(pool, review, { scope: 'kiju', count: 20, today: TODAY, kiju }).some((x) => x.id === 'w55'));
ok('기출이 아닌 것은 안 들어온다',
  pickListen(pool, review, { scope: 'kiju', count: 60, today: TODAY, kiju }).every((x) => ids.has(x.id)));

/* ★ 오늘의 후보(레벨을 반영한 pool) 밖에 있어도 들어온다 ★
   x9는 pool에 없다. 레벨을 N5만 켜 둔 사람의 기출이 205개에서 18개로 잘리던
   자리다 — 기출은 시험에 나온 것이라 레벨로 자를 이유가 없다. */
ok('★ pool 밖의 기출도 들린다 ★',
  pickListen(pool, review, { scope: 'kiju', count: 60, today: TODAY, kiju }).some((x) => x.id === 'x9'));
ok('그래도 다른 범위에는 안 샌다',
  pickListen(pool, review, { scope: 'all', count: 99, today: TODAY, kiju }).every((x) => x.id !== 'x9'));

ok('목록을 안 주면 기출 범위는 빈손 — 「다 들린다」보다 낫다',
  scopeCounts(pool, review, TODAY).kiju === 0 && pickListen(pool, review, { scope: 'kiju', count: 20, today: TODAY }).length === 0);
ok('기출 범위를 더해도 다른 범위는 그대로',
  ck.all === c.all && ck.seen === c.seen && ck.today === c.today && ck.weak === c.weak);

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

console.log('\n[ 구간별로 끊어 듣기 ]');
{
  /* ★ 섞어 뽑으면 한 덩어리를 못 외운다 ★
     들을 때마다 딴 것이 나오니 「이 스무 개를 귀에 붙이겠다」가 안 된다.
     구간은 몇 번째부터 몇 번째까지고, 그 자리를 앱이 안 흔든다. */
  ok('60개를 20씩 끊으면 세 구간', blockCount(60, 20) === 3);
  ok('딱 안 떨어지면 마지막 구간이 짧다', blockCount(65, 20) === 4);
  ok('비어 있어도 한 구간은 있다 — 「0 / 0구간」은 화면에 못 적는다', blockCount(0, 20) === 1);

  const list = Array.from({ length: 65 }, (_, i) => ({ id: `k${i}` }));
  ok('1구간은 앞에서 스무 개', pickBlock(list, { count: 20, block: 0 }).map((x) => x.id).join() === 'k0,k1,k2'.split(',').concat(Array.from({ length: 17 }, (_, i) => `k${i + 3}`)).join());
  ok('2구간은 그다음 스무 개', pickBlock(list, { count: 20, block: 1 })[0].id === 'k20');
  ok('마지막 구간은 남은 만큼만', pickBlock(list, { count: 20, block: 3 }).length === 5);
  ok('범위를 넘겨 부르면 마지막 구간', pickBlock(list, { count: 20, block: 99 })[0].id === 'k60');
  ok('음수도 첫 구간으로', pickBlock(list, { count: 20, block: -3 })[0].id === 'k0');

  /* ★ 같은 구간은 늘 같은 차례 ★
     섞으면 다시 틀 때마다 순서가 달라지는데, 그러면 「세 번째에 나오는 그
     낱말」이라는 기억의 손잡이가 없어진다. */
  const a = pickListen(pool, review, { scope: 'all', count: 20, order: 'block', block: 1, today: TODAY });
  const b = pickListen(pool, review, { scope: 'all', count: 20, order: 'block', block: 1, today: TODAY });
  ok('★ 같은 구간은 부를 때마다 같은 차례 ★', a.map((x) => x.id).join() === b.map((x) => x.id).join());
  ok('구간이 다르면 내용도 다르다',
    a[0].id !== pickListen(pool, review, { scope: 'all', count: 20, order: 'block', block: 0, today: TODAY })[0].id);

  ok('범위에 구간이 몇 개인지 센다',
    blocksIn(pool, review, { scope: 'all', count: 20, today: TODAY }) === 3, 
    `${blocksIn(pool, review, { scope: 'all', count: 20, today: TODAY })}구간`);
  ok('개수를 키우면 구간이 줄어든다',
    blocksIn(pool, review, { scope: 'all', count: 100, today: TODAY }) === 1);
  ok('좁은 범위는 구간도 적다',
    blocksIn(pool, review, { scope: 'weak', count: 20, today: TODAY }) === 1);

  /* 구간은 범위 규칙을 그대로 따른다 — 기출 구간도 기출 목록에서만 끊는다 */
  const kb = pickListen(pool, review, { scope: 'kiju', count: 2, order: 'block', block: 1, today: TODAY, kiju });
  ok('기출도 구간으로 끊린다', kb.length === 2 && ids.has(kb[0].id), kb.map((x) => x.id).join());
}

console.log('\n[ 다 외운 것 빼기 ]');
{
  /* 「외웠다」의 기준은 회독 쪽 한 군데에서 정한다(isDoneEnough) — 여기서
     따로 세면 같은 낱말이 화면마다 다른 상태가 된다. 졸업한 카드를 몇 장
     심고, 뺐을 때와 안 뺐을 때가 그만큼 차이 나는지 본다. */
  const done = {};
  for (const k of Object.keys(review)) done[k] = review[k];
  // w50~w54는 졸업시킨다 — 복습일이 멀고 연속으로 맞힌 카드
  for (let i = 50; i < 55; i++) {
    done[`w${i}`] = { box: 3, streak: 6, level: 6, lastSeen: '2026-08-29', wrongCount: 0, vagueCount: 0, seenCount: 9, promotedOn: '2026-08-29' };
  }
  const before = scopeCounts(pool, done, TODAY);
  const after = scopeCounts(pool, done, TODAY, null, true);
  ok('★ 다 외운 것을 빼면 그만큼 줄어든다 ★', after.all === before.all - 5,
    `${before.all} → ${after.all}`);
  ok('안 빼면 그대로', before.all === 60);
  ok('뽑을 때도 빠진다',
    pickListen(pool, done, { scope: 'all', count: 60, today: TODAY, skipDone: true })
      .every((x) => !['w50', 'w51', 'w52', 'w53', 'w54'].includes(x.id)));
  ok('안 빼면 들어온다',
    pickListen(pool, done, { scope: 'all', count: 60, today: TODAY })
      .some((x) => x.id === 'w50'));
  ok('구간 수도 줄어든 만큼으로 센다',
    blocksIn(pool, done, { scope: 'all', count: 20, today: TODAY, skipDone: true }) === 3
    && blocksIn(pool, done, { scope: 'all', count: 55, today: TODAY, skipDone: true }) === 1);
  /* 외운 것만 빼는 것이지 약점까지 건드리지 않는다 */
  ok('약점은 그대로', scopeCounts(pool, done, TODAY, null, true).weak === before.weak);
}

console.log('\n[ 정지할 때까지 반복 ]');
{
  /* 한 바퀴 돌고 끝나면 열 개를 한 번씩 스친 것뿐이다 — 소리는 그렇게 안 붙는다.
     멈추는 것은 사람이 정한다. */
  const set = { cards: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], at: 0, lap: 0 };
  ok('가운데서는 다음 장으로', nextAt(set, true).at === 1);
  ok('바퀴 수는 그대로', nextAt(set, true).lap === 0);

  const last = { ...set, at: 2 };
  ok('★ 마지막 장 다음은 처음으로 ★', nextAt(last, true).at === 0);
  ok('★ 바퀴가 하나 올라간다 ★', nextAt(last, true).lap === 1);
  ok('반복을 끄면 거기서 끝', nextAt(last, false) === null);
  ok('반복을 꺼도 가운데서는 이어진다', nextAt(set, false).at === 1);

  /* 바퀴를 여러 번 돌아도 자리는 안 흔들린다 — 같은 차례로 다시 만난다 */
  let cur = { ...set };
  const seen = [];
  for (let i = 0; i < 7; i++) { seen.push(cur.at); cur = { ...cur, ...nextAt(cur, true) }; }
  ok('★ 같은 차례로 계속 돈다 ★', seen.join() === '0,1,2,0,1,2,0', seen.join());
  ok('일곱 걸음이면 두 바퀴를 넘긴다', cur.lap === 2, `${cur.lap}바퀴`);

  ok('빈 세트는 돌 게 없다', nextAt({ cards: [], at: 0, lap: 0 }, true) === null);
  ok('세트가 없어도 안 죽는다', nextAt(null, true) === null);
}

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

console.log('\n[ ★ 끝에 일본어 한 번 더 ★ ]');
{
  /* 처음 듣는 일본어는 그냥 소리다. 뜻을 알고 다시 들으면 그제야 소리와 뜻이
     붙는다 — 같은 문장을 두 번 듣는 게 아니라 모르고 한 번, 알고 한 번이다. */
  ok('★ 일본어 → 뜻 → 일본어 ★', stepsOf('jp-ko', { recap: true }).join() === 'jp,ko,jp2',
    stepsOf('jp-ko', { recap: true }).join());
  ok('따라 말하기와 같이 써도 순서가 맞다',
    stepsOf('jp-ko', { shadow: true, recap: true }).join() === 'jp,say,ko,jp2',
    stepsOf('jp-ko', { shadow: true, recap: true }).join());

  /* ★ 마지막 걸음 이름이 jp이면 안 된다 ★
     화면은 걸음 이름으로 「뜻을 보여 줄 때인가」를 정한다. 이름이 같으면
     방금 나온 뜻이 마지막에 도로 사라진다 — 소리와 뜻을 붙이라고 만든
     걸음에서 정작 뜻이 화면에 없게 된다. */
  ok('★ 마지막 걸음은 첫 걸음과 다른 이름 ★',
    stepsOf('jp-ko', { recap: true }).at(-1) !== 'jp');

  // 끄면 예전 그대로다 — 이미 쓰던 사람의 듣기가 길어지면 안 된다
  ok('안 켜면 그대로', stepsOf('jp-ko', { recap: false }).join() === 'jp,ko');
  ok('기본은 꺼져 있다', stepsOf('jp-ko').join() === 'jp,ko');

  /* 뒤집은 판은 원래 일본어로 끝난다 — 한 번 더 붙일 자리가 없다 */
  ok('뒤집은 판은 안 건드린다',
    stepsOf('ko-jp', { recap: true }).join() === stepsOf('ko-jp').join(),
    stepsOf('ko-jp', { recap: true }).join());
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
