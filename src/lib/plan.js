/* 오늘의 계획 — 무엇을 배정했고 무엇을 끝냈는가.
 *
 * 여태 「오늘 할 것」은 부를 때마다 새로 계산했다. 그래서 두 가지가 어긋났다.
 *
 *   · 신규 20개를 다 외워도 「새 단어 20개」가 그대로 떴다. 외운 카드는 신규
 *     후보에서 빠지지만 그 자리를 아직 안 본 다음 20개가 곧바로 채웠다.
 *     끝이 없는 목록을 「오늘 할 것」이라고 부른 셈이다.
 *   · 완료 수를 판정 횟수로 셌다. 한 카드를 세 번 만나면 3이 올랐고,
 *     새로고침하거나 되돌리면 또 올랐다.
 *
 * 그래서 하루치를 한 번 정해서 적어 둔다. 적어 둔 뒤로는
 *   무엇을 배정했나  → 안 바뀐다
 *   무엇을 끝냈나    → 카드 id로 센다. 몇 번 눌렀는지와 무관하다
 *
 * 「몇 번 눌렀나」를 버리는 게 아니다. 그건 활동 통계(stats)에 그대로 남는다.
 * 둘은 다른 숫자이고, 다른 이름으로 불려야 한다. */

import { todayKey } from './review.js';
import { classifyDaily, normalizeGoals, estimateMinutes, takeForPlan } from './daily.js';
import { freshSentenceMax, orderByPurpose, purposeOf } from './purpose.js';

export const PLAN_VERSION = 1;

/* 「10개 더」로 한 번에 늘리는 양 */
export const MORE_STEP = 10;

/* 오늘 계획을 새로 짠다.
 *
 * assigned에는 카드가 한 번씩만 들어간다. 약점 카드가 한 판에 두 번 나오는
 * 것은 「연습 횟수」이지 「배운 카드 수」가 아니다 — 둘을 같은 칸에 세면
 * 20개를 배정하고 22개를 끝낸 것처럼 보인다. */
export function buildPlan(pool, review, {
  goals, today = todayKey(), purpose, cardOf,
} = {}) {
  const want = normalizeGoals(goals);
  /* 무엇을 먼저 배정할지는 학습 목적이 정한다. 거르지 않고 차례만 바꾼다 —
     목적은 취향이지 자격이 아니라, 「여행」을 골랐다고 시험 단어를 영영
     못 보게 되면 안 된다. */
  const use = purpose ? orderByPurpose(pool, purposeOf({ purpose }), cardOf) : pool;
  /* 차례만 바꿔서는 안 된다. 큐를 짜는 쪽이 종류별로 다시 묶어 비례로 뽑아서,
     앞뒤를 바꿔도 단어와 문장이 섞이는 비율은 그대로였다. 몇 개까지 넣을지도
     같이 정해야 목적이 실제로 반영된다. */
  const picked = takeForPlan(use, review, {
    goals: want,
    today,
    sentenceMax: purpose ? freshSentenceMax(purposeOf({ purpose })) : undefined,
  });
  /* 오늘 후보가 갈래마다 몇 개였는지. 배정에 다 못 담은 복습이 있으면
     조용히 밀어 두지 않고 알려 줘야 해서 같이 적어 둔다. */
  const groups = classifyDaily(use, review, today);
  const sizes = { review: groups.due.length, weak: groups.weak.length, fresh: groups.fresh.length };

  const assigned = [];
  const seen = new Set();
  let reps = 0;
  for (const it of picked) {
    reps += 1;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    assigned.push({ id: it.id, kind: it.kind, bucket: it.bucket });
  }

  return {
    v: PLAN_VERSION,
    date: today,
    goals: want,          // 설정 목표 — 「내가 정한 양」
    assigned,             // 실제 배정 — 「오늘 정말 있는 양」
    reps,                 // 연습 횟수(약점 두 번 포함)
    done: {},             // { 카드id: true } — 고유 학습 완료
    extra: 0,             // 「10개 더」로 늘린 수
    sizes,                // 갈래별 후보 수 — 「오늘 안 담은 복습 N개」에 쓴다
  };
}

/* 아직 손대지 않은 계획인가.
 *
 * 계획은 하루에 한 번만 정한다. 그런데 「한 번」을 앱을 켠 순간으로 못 박으면
 * 문제가 생긴다 — 아침에 앱을 열면 아직 동기화가 안 끝나서 복습 기록이 비어
 * 있고, 그때 짠 계획은 「복습 0」이다. 잠시 뒤 동기화가 끝나 복습이 스무 개
 * 들어와도 계획은 하루 종일 비어 있는다.
 *
 * 그래서 「아직 아무것도 안 했으면 다시 짠다」로 한다. 안 했으면 다시 짜도
 * 잃을 게 없다. 한 장이라도 손댔으면 그때부터 얼린다 — 도중에 다시 짜면
 * 하던 카드가 큐에서 사라진다. */
export function untouched(plan, review, today) {
  if (!plan) return true;
  if (Object.keys(plan.done || {}).length) return false;
  if (plan.extra) return false;
  // 몰라요를 눌러 아직 못 끝낸 카드도 「손댄 것」이다
  return !plan.assigned.some((x) => review?.[x.id]?.lastSeen === today);
}

/* 날짜가 바뀌었거나, 아직 없거나, 손대기 전이면 새로 짠다.
   손댄 뒤로는 그대로 쓴다 — 여기서 다시 짜면 하던 것이 사라진다. */
export function ensurePlan(plan, pool, review, opts = {}) {
  const today = opts.today || todayKey();
  const fresh = plan?.date === today && plan.v === PLAN_VERSION;
  if (fresh && !untouched(plan, review, today)) return plan;
  if (fresh) {
    /* 손대기 전이라면 다시 짜되, 정말 달라졌을 때만 새 객체를 준다 —
       매번 새 객체를 주면 화면이 끝없이 다시 그려진다. */
    const next = buildPlan(pool, review, { ...opts, today });
    const same = next.assigned.length === plan.assigned.length
      && next.assigned.every((x, i) => x.id === plan.assigned[i].id);
    return same ? plan : next;
  }
  return buildPlan(pool, review, { ...opts, today });
}

/* 한 카드를 끝냈다고 적는다. 같은 카드를 몇 번 판정하든 한 번만 센다. */
export function markStudied(plan, id) {
  if (!plan || plan.done?.[id]) return plan;
  if (!plan.assigned.some((x) => x.id === id)) return plan;   // 계획에 없는 건 여기 안 센다
  return { ...plan, done: { ...plan.done, [id]: true } };
}

/* 되돌리기. 판정을 무르면 완료도 물러야 한다 —
   안 그러면 되돌릴 때마다 완료 수만 남는다. */
export function unmarkStudied(plan, id) {
  if (!plan?.done?.[id]) return plan;
  const done = { ...plan.done };
  delete done[id];
  return { ...plan, done };
}

/* 오늘 계획이 어디까지 왔나. 화면·큐·통계가 모두 이 하나를 본다. */
export function planStatus(plan) {
  if (!plan) return { assigned: 0, done: 0, left: 0, reps: 0, lanes: {}, finished: false };
  const lanes = { review: { assigned: 0, done: 0 }, weak: { assigned: 0, done: 0 }, fresh: { assigned: 0, done: 0 } };
  let done = 0;
  for (const it of plan.assigned) {
    const lane = lanes[it.bucket] || (lanes[it.bucket] = { assigned: 0, done: 0 });
    lane.assigned += 1;
    if (plan.done[it.id]) { lane.done += 1; done += 1; }
  }
  const assigned = plan.assigned.length;
  /* 후보는 있는데 오늘 몫에 다 못 담은 것 */
  const over = {
    review: Math.max(0, (plan.sizes?.review || 0) - lanes.review.assigned),
    weak: Math.max(0, (plan.sizes?.weak || 0) - lanes.weak.assigned),
    fresh: Math.max(0, (plan.sizes?.fresh || 0) - lanes.fresh.assigned),
  };
  return {
    over,
    assigned,
    done,
    left: Math.max(0, assigned - done),
    reps: plan.reps,
    lanes,
    finished: assigned > 0 && done >= assigned,
    minutes: estimateMinutes(plan.assigned.filter((x) => !plan.done[x.id])),
  };
}

/* 아직 안 끝낸 것 — 큐를 짤 때 이걸로 짠다.
   끝낸 카드를 다시 넣으면 「남은 7개」가 줄지 않는다. */
export function remaining(plan, lanes = null) {
  if (!plan) return [];
  const use = lanes?.length ? new Set(lanes) : null;
  return plan.assigned.filter((x) => !plan.done[x.id] && (!use || use.has(x.bucket)));
}

/* ★ 계획을 다 하면 거기서 끝이다 ★
 *
 * 더 하고 싶으면 명시적으로 늘린다. 저절로 다음 20개가 따라 나오면 「오늘
 * 할 것」이 끝이 없는 목록이 되고, 끝냈다는 느낌을 영영 못 받는다. */
export function addMore(plan, pool, review, { count = MORE_STEP, today = todayKey() } = {}) {
  if (!plan || plan.date !== today) return plan;
  const taken = new Set(plan.assigned.map((x) => x.id));
  const groups = classifyDaily(pool, review, today);
  const add = [];
  /* 신규부터 채우고, 모자라면 복습·약점에서 마저 채운다 */
  for (const lane of [groups.fresh, groups.due, groups.weak]) {
    for (const it of lane) {
      if (add.length >= count) break;
      if (taken.has(it.id)) continue;
      taken.add(it.id);
      add.push({ id: it.id, kind: it.kind, bucket: it.bucket });
    }
  }
  if (!add.length) return plan;
  return {
    ...plan,
    assigned: [...plan.assigned, ...add],
    reps: plan.reps + add.length,
    extra: (plan.extra || 0) + add.length,
  };
}

/* 계획에 없는 자유 학습(회독 학습·약점 복습·시험 등)을 반영한다.
 *
 * 계획에 같은 카드가 있으면 그 항목을 채운 것으로 한 번만 센다. 없으면
 * 계획 수를 늘리지 않는다 — 자유 학습으로 오늘 목표가 저절로 커지면
 * 「오늘 할 것」이 무슨 뜻인지 알 수 없게 된다. */
export function noteFreeStudy(plan, id) {
  return markStudied(plan, id);
}

/* 기기 두 대를 합친다.
 *
 * 같은 날 계획이면 끝낸 것을 합집합으로 모은다 — 아이폰에서 끝낸 카드가
 * 아이패드에서 안 끝난 것으로 돌아오면 안 된다. 카드 id로 세니 합쳐도
 * 숫자가 부풀지 않는다. 날짜가 다르면 새 쪽을 쓴다. */
export function mergePlan(local, remote) {
  if (!local) return remote || null;
  if (!remote) return local;
  if (local.date !== remote.date) return local.date > remote.date ? local : remote;

  /* 배정은 더 많이 담은 쪽을 쓴다 — 한쪽에서 「10개 더」를 눌렀으면 그게 맞다 */
  const base = remote.assigned.length > local.assigned.length ? remote : local;
  const ids = new Set(base.assigned.map((x) => x.id));
  const done = {};
  for (const [id, v] of Object.entries({ ...remote.done, ...local.done })) {
    if (v && ids.has(id)) done[id] = true;
  }
  return {
    ...base,
    reps: Math.max(local.reps || 0, remote.reps || 0),
    extra: Math.max(local.extra || 0, remote.extra || 0),
    done,
  };
}
