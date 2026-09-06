/* 하루 계획과 완료 집계.
 *
 * 예전엔 「오늘 할 것」을 부를 때마다 새로 계산했다. 그래서 두 가지가 어긋났다.
 *
 *   · 신규 20개를 다 외워도 「새 단어 20개」가 그대로 떴다. 외운 카드는 후보에서
 *     빠지지만 아직 안 본 다음 20개가 곧바로 자리를 채웠다 — 끝이 없는 목록을
 *     「오늘 할 것」이라고 부른 셈이다.
 *   · 완료 수를 판정 횟수로 셌다. 한 카드를 세 번 만나면 3이 올랐다.
 *   · 상단은 설정 목표 60을 띄웠다. 복습이 하나도 없는 첫날에도 그랬다.
 *
 * 이제 하루치를 한 번 정해서 적어 둔다. 배정과 완료가 거기 있고,
 * 화면·큐·통계가 그 하나만 본다. */
import {
  buildPlan, ensurePlan, planStatus, markStudied, unmarkStudied,
  addMore, remaining, mergePlan, noteFreeStudy, untouched, MORE_STEP,
} from '../../src/lib/plan.js';
import { applyVerdict, emptyState, VERDICT } from '../../src/lib/review.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const T = '2026-09-05';
const GOALS = { fresh: 20, review: 20, weak: 20 };
const pool = (n = 200) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, kind: 'word' }));

console.log('\n[ ★ 필수 회귀 4 — 첫날엔 실제 배정량이 목표로 뜬다 ★ ]');
{
  const p = buildPlan(pool(), {}, { goals: GOALS, today: T });
  const s = planStatus(p);
  ok('★ 60이 아니라 20 ★', s.assigned === 20, `${s.assigned}`);
  ok('복습은 0으로 잡힌다', s.lanes.review.assigned === 0);
  ok('약점도 0', s.lanes.weak.assigned === 0);
  ok('신규만 20', s.lanes.fresh.assigned === 20);
  /* 설정 목표는 안 없앤다. 다른 숫자로 따로 들고 있는다 */
  ok('설정 목표는 그대로 적혀 있다', p.goals.review === 20, JSON.stringify(p.goals));
  ok('안 담은 복습도 0이라고 말한다', s.over.review === 0 && s.over.weak === 0);
}

console.log('\n[ ★ 필수 회귀 5 — 신규 20개를 끝내면 남은 신규는 0 ★ ]');
{
  let p = buildPlan(pool(), {}, { goals: GOALS, today: T });
  for (const it of p.assigned) p = markStudied(p, it.id);
  const s = planStatus(p);
  ok('★ 남은 0 ★', s.left === 0, `${s.left}`);
  ok('오늘 학습 완료로 잡힌다', s.finished === true);
  ok('큐에 남는 것도 없다', remaining(p).length === 0);
  /* 예전엔 여기서 다음 20개가 저절로 나왔다 */
  ok('★ 저절로 다음 20개가 안 나온다 ★', planStatus(ensurePlan(p, pool(), {}, { goals: GOALS, today: T })).left === 0);

  // 더 하고 싶으면 명시적으로
  const more = addMore(p, pool(), {}, { today: T });
  ok('「10개 더」로 늘린다', planStatus(more).assigned === 30, `${planStatus(more).assigned}`);
  ok('그만큼만 남는다', planStatus(more).left === MORE_STEP);
  ok('늘렸다고 표시한다', more.extra === MORE_STEP);
  ok('끝낸 것은 그대로 끝난 채로', planStatus(more).done === 20);
  /* 더 배울 게 없으면 안 늘린다 */
  const tiny = addMore(markAll(buildPlan(pool(5), {}, { goals: GOALS, today: T })), pool(5), {}, { today: T });
  ok('없으면 안 늘어난다', planStatus(tiny).assigned === 5, `${planStatus(tiny).assigned}`);
}

function markAll(p) {
  let out = p;
  for (const it of p.assigned) out = markStudied(out, it.id);
  return out;
}

console.log('\n[ ★ 필수 회귀 6 — 중복 판정·새로고침·되돌리기로 안 부푼다 ★ ]');
{
  let p = buildPlan(pool(), {}, { goals: GOALS, today: T });
  const id = p.assigned[0].id;

  // 같은 카드를 세 번 판정
  p = markStudied(p, id); p = markStudied(p, id); p = markStudied(p, id);
  ok('★ 같은 카드는 한 번만 ★', planStatus(p).done === 1, `${planStatus(p).done}`);

  // 새로고침 — 저장했다 읽어도 같다
  const reloaded = JSON.parse(JSON.stringify(p));
  ok('★ 새로고침해도 그대로 ★', planStatus(reloaded).done === 1);
  ok('같은 날이면 다시 안 짠다', ensurePlan(reloaded, pool(), {}, { goals: GOALS, today: T }) === reloaded);

  // 되돌리기
  p = unmarkStudied(p, id);
  ok('★ 되돌리면 완료도 물러난다 ★', planStatus(p).done === 0);
  ok('되돌린 것은 큐에 다시 들어간다', remaining(p).some((x) => x.id === id));
  ok('두 번 되돌려도 음수가 안 된다', planStatus(unmarkStudied(p, id)).done === 0);

  /* 「몇 번 눌렀나」는 따로 남는다 — 버리는 게 아니라 다른 이름으로 부른다 */
  ok('연습 횟수는 별도로 들고 있다', typeof p.reps === 'number' && p.reps >= p.assigned.length);
}

console.log('\n[ 약점은 카드 수와 연습 횟수를 가른다 ]');
{
  /* 몰라요가 열 번 넘은 카드는 한 판에 두 번 나온다. 그건 연습 횟수이지
     배운 카드 수가 아니다 — 같은 칸에 세면 20개 배정에 22개 완료가 된다. */
  const review = {};
  for (let i = 0; i < 5; i++) {
    review[`w${i}`] = {
      box: 1, streak: 0, level: 0, due: T, promotedOn: null, selfKnown: false,
      lastSeen: '2026-08-01', seenAt: 1, rounds: 12, wrongCount: 12, vagueCount: 0,
    };
  }
  const p = buildPlan(pool(50), review, { goals: { fresh: 0, review: 0, weak: 10 }, today: T });
  const s = planStatus(p);
  /* 두 번 나오는 카드가 몫 안에서 두 자리를 쓴다(daily.js). 그래서 카드 수는
     후보 수보다 적어진다 — 제일 안 외워지는 걸 놔두고 다음으로 넘어가지
     않으려는 것이고, 목표를 넘겨 하루를 늘리지 않으려는 것이다. */
  ok('★ 카드 수와 연습 횟수가 다르다 ★', p.reps > s.assigned,
    `카드 ${s.assigned} / 연습 ${p.reps}`);
  ok('배정된 카드는 겹치지 않는다',
    new Set(p.assigned.map((x) => x.id)).size === s.assigned, `${s.assigned}`);
  ok('연습 횟수가 몫을 안 넘는다', p.reps <= 10, `${p.reps}`);
  ok('둘 다 끝내면 완료', planStatus(markAll(p)).finished);
  /* 완료는 카드로 센다 — 두 번 만났다고 2가 오르면 20 배정에 22 완료가 된다 */
  ok('두 번 만나도 완료는 한 번', planStatus(markAll(p)).done === s.assigned);
}

console.log('\n[ 계획 밖 자유 학습 ]');
{
  let p = buildPlan(pool(), {}, { goals: GOALS, today: T });
  const inPlan = p.assigned[0].id;
  /* 계획의 같은 항목을 채웠으면 한 번만 반영한다 */
  p = noteFreeStudy(p, inPlan);
  p = noteFreeStudy(p, inPlan);
  ok('계획에 있는 것은 한 번 반영', planStatus(p).done === 1);
  /* 계획에 없는 카드로 오늘 목표가 저절로 커지면 안 된다 */
  const before = planStatus(p).assigned;
  p = noteFreeStudy(p, 'w199');
  ok('★ 계획에 없는 건 목표를 안 늘린다 ★', planStatus(p).assigned === before, `${before} → ${planStatus(p).assigned}`);
  ok('완료도 안 늘어난다', planStatus(p).done === 1);
}

console.log('\n[ ★ 아침 동기화가 늦게 와도 계획이 비어 있지 않다 ★ ]');
{
  /* 앱을 열면 아직 동기화가 안 끝나서 복습 기록이 비어 있다. 그때 짠 계획은
     「복습 0」인데, 잠시 뒤 복습이 스무 개 들어와도 하루 종일 비어 있었다.
     아직 아무것도 안 했으면 다시 짜도 잃을 게 없다. */
  const p0 = buildPlan(pool(), {}, { goals: GOALS, today: T });
  ok('처음엔 신규만', planStatus(p0).lanes.review.assigned === 0);

  const late = {};
  for (let i = 100; i < 130; i++) {
    late[`w${i}`] = {
      box: 3, streak: 0, level: 1, due: '2026-08-01', promotedOn: '2026-07-31',
      selfKnown: false, lastSeen: '2026-07-31', seenAt: 1, rounds: 1, wrongCount: 0, vagueCount: 0,
    };
  }
  const p1 = ensurePlan(p0, pool(), late, { goals: GOALS, today: T });
  ok('★ 늦게 온 복습이 계획에 들어온다 ★', planStatus(p1).lanes.review.assigned === 20,
    `${planStatus(p1).lanes.review.assigned}`);

  /* 한 장이라도 손댔으면 그때부터 얼린다 — 도중에 다시 짜면 하던 게 사라진다 */
  const started = markStudied(p1, p1.assigned[0].id);
  ok('손댄 뒤로는 안 바뀐다',
    ensurePlan(started, pool(), { ...late, w150: { lastSeen: T, level: 1, due: T } },
      { goals: GOALS, today: T }) === started);
  ok('손댔는지 알아본다', !untouched(started, late, T) && untouched(p0, {}, T));

  /* 몰라요를 눌러 아직 못 끝낸 카드도 「손댄 것」이다 */
  const seenToday = { [p1.assigned[0].id]: { lastSeen: T } };
  ok('오늘 만난 카드가 있으면 얼린다', !untouched(p1, seenToday, T));

  /* 달라진 게 없으면 같은 객체를 준다 — 매번 새로 주면 화면이 끝없이 다시 그려진다 */
  ok('안 달라졌으면 그대로', ensurePlan(p1, pool(), late, { goals: GOALS, today: T }) === p1);
}

console.log('\n[ 날짜가 바뀌면 ]');
{
  const p = markAll(buildPlan(pool(), {}, { goals: GOALS, today: T }));
  const next = ensurePlan(p, pool(), {}, { goals: GOALS, today: '2026-09-06' });
  ok('새로 짠다', next.date === '2026-09-06');
  ok('어제 끝낸 것은 안 따라온다', planStatus(next).done === 0);
  ok('어제 계획을 덮어쓰지 않는다', p.date === T && planStatus(p).done === 20);
}

console.log('\n[ ★ 필수 회귀 9 — 기기 두 대를 합쳐도 안 부푼다 ★ ]');
{
  const base = buildPlan(pool(), {}, { goals: GOALS, today: T });
  const phone = markStudied(markStudied(base, base.assigned[0].id), base.assigned[1].id);
  const pad = markStudied(markStudied(base, base.assigned[1].id), base.assigned[2].id);
  const m = mergePlan(phone, pad);
  ok('양쪽에서 한 것이 다 남는다', planStatus(m).done === 3, `${planStatus(m).done}`);
  ok('★ 겹친 것이 두 번 안 세진다 ★', planStatus(m).assigned === 20);
  ok('두 번 합쳐도 같다', planStatus(mergePlan(m, m)).done === 3);
  ok('순서가 바뀌어도 같다', planStatus(mergePlan(pad, phone)).done === 3);

  /* 한쪽에서 「10개 더」를 눌렀으면 그게 맞다 */
  const wide = addMore(phone, pool(), {}, { today: T });
  ok('늘린 쪽을 따른다', planStatus(mergePlan(pad, wide)).assigned === 30);

  /* 날짜가 다르면 새 쪽 */
  const old = buildPlan(pool(), {}, { goals: GOALS, today: '2026-09-01' });
  ok('오래된 계획은 안 이긴다', mergePlan(base, old).date === T);
  ok('한쪽이 없어도 안 죽는다', mergePlan(null, base) === base && mergePlan(base, null) === base);
}

console.log('\n[ 남은 시간·진행률·버튼이 같은 상태에서 나온다 ]');
{
  let p = buildPlan(pool(), {}, { goals: GOALS, today: T });
  const full = planStatus(p);
  p = markStudied(p, p.assigned[0].id);
  const half = planStatus(p);
  ok('완료가 오르면 남은 것이 준다', half.left === full.left - 1);
  ok('남은 시간도 같이 준다', half.minutes <= full.minutes, `${full.minutes} → ${half.minutes}`);
  ok('진행률의 분모는 배정량', half.assigned === 20);
  /* 큐도 같은 상태에서 나온다 — 화면은 7개 남았다는데 큐가 8개면 못 믿는다 */
  ok('큐 길이와 남은 수가 같다', remaining(p).length === half.left);
}

console.log('\n[ 실제 판정과 이어 붙여 본다 ]');
{
  let p = buildPlan(pool(), {}, { goals: GOALS, today: T });
  let review = {};
  const id = p.assigned[0].id;
  // 몰라요 → 아직 못 끝낸 것이다
  review = { ...review, [id]: applyVerdict(emptyState(), VERDICT.UNKNOWN, T) };
  ok('몰라요는 완료가 아니다', !review[id].streak);
  // 알아요 → 이번 판에서 정리됐다
  review = { ...review, [id]: applyVerdict(review[id], VERDICT.KNOWN, T) };
  p = markStudied(p, id);
  ok('맞히면 완료로 센다', planStatus(p).done === 1);
  ok('그래도 같은 날 졸업은 안 한다', review[id].level === 1, `${review[id].level}`);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
