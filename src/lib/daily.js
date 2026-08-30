/* 오늘의 학습 — 뭘 공부할지 앱이 정한다.
 *
 * 여태 이 앱은 "골라서 들어가는" 앱이었다. 메뉴가 여덟 개고, 매번 어디부터
 * 할지 정하는 게 사용자 몫이었다. 그 판단이 매일 드는 비용이라, 앱을 켜고도
 * 안 하게 되는 제일 큰 이유가 된다.
 *
 * 그래서 큐를 앱이 짠다. 고르는 길은 그대로 두고(학습 탭), 그 위에 "그냥
 * 시작"을 하나 얹는 것이다.
 *
 * 단어와 문장은 이미 같은 회독 저장소를 쓴다. 그래서 한 큐에 섞을 수 있다 —
 * 단어만 스무 개 돌고 문장은 따로 들어가야 하는 게 지금 구조의 아쉬운 점이었다. */

import {
  stateOf, isDue, isMastered, todayKey, dueDate, shuffled,
} from './review.js';

/* 갈래마다 제 목표를 가진다 — 신규 20 · 복습 20 · 약점 20.
 *
 * 예전에는 「하루 20장」 하나를 4:3:3으로 쪼갰다. 그러면 복습이 밀린 날
 * 신규가 여섯 장으로 줄어서, 진도가 밀린 벌로 새로 배우는 걸 뺏겼다.
 * 반대로 복습이 없는 날은 신규가 스무 장이 되어 다음 날 복습이 폭발했다.
 *
 * 갈래를 갈라 두면 서로 안 뺏는다. 복습이 밀려도 새 단어 스무 개는 그대로고,
 * 복습할 게 없는 날은 그냥 복습이 0이다 — 그게 정직하다.
 *
 * 대신 몫을 서로 못 빌린다. 그게 이 방식의 값이다. */
export const DEFAULT_GOALS = { fresh: 20, review: 20, weak: 20 };
export const LANES = ['review', 'weak', 'fresh'];

/* 몰라요·애매해요가 이만큼 쌓이면 약점으로 본다. 회독 쪽 기준과 같은 값이다. */
export const WEAK_THRESHOLD = 3;

/* 몰라요가 이만큼 쌓인 카드는 한 판에 두 번 만난다.
 *
 * 열 번 넘게 틀렸다는 건 그 카드를 만나는 방식이 안 통하고 있다는 뜻이다.
 * 하루에 한 번 더 보는 것으로 될 일은 아니지만, 적어도 판마다 두 번은
 * 마주쳐야 한다 — 스무 장 중 한 장으로 묻히면 영영 안 외워진다.
 *
 * 몫 안에서 두 자리를 차지한다. 목표를 넘겨서 늘리지 않는다 — 그러면 제일
 * 안 외워지는 사람의 하루가 제일 길어진다. */
export const HARD_WRONG = 10;

export function isHardWeak(st) {
  return (st?.wrongCount || 0) >= HARD_WRONG;
}

/* 옛 설정은 숫자 하나(dailyGoal)였다. 읽을 때 셋으로 펴 준다 —
   기능을 더할 때마다 옛 기록이 화면을 죽이는 일을 여기서 막는다. */
export function normalizeGoals(goals) {
  if (typeof goals === 'number') {
    const n = Math.max(0, Math.round(goals) || 0);
    return { fresh: n, review: n, weak: n };
  }
  return {
    fresh: Math.max(0, Math.round(goals?.fresh ?? DEFAULT_GOALS.fresh) || 0),
    review: Math.max(0, Math.round(goals?.review ?? DEFAULT_GOALS.review) || 0),
    weak: Math.max(0, Math.round(goals?.weak ?? DEFAULT_GOALS.weak) || 0),
  };
}

/* 한 개에 걸리는 시간(초). 문장이 더 오래 걸린다 — 읽고 뜻을 떠올리는 양이 다르다.
 * 정확할 수 없는 값이라 "약 8분"처럼 어림으로만 쓴다. */
const SECONDS = { word: 9, sentence: 16 };


/* 오늘 큐에서 문장이 차지할 수 있는 몫의 상한.
 *
 * 문장에는 레벨이 없다. 단어만 설정한 레벨로 걸러지니, N5만 켠 사람은 단어
 * 후보가 534개로 줄고 문장은 600개가 그대로 남는다. 남은 수에 비례해 뽑는
 * 규칙이라 스무 개 중 열한 개가 문장이 됐다 — 비율이 뒤집힌 것이다.
 *
 * 비례로 뽑는 것 자체는 남긴다. 그게 없으면 자료 차례대로 잘려서 문장이 아예
 * 0개가 된다. 대신 위에 뚜껑을 씌운다. */
export const SENTENCE_SHARE = 0.5;

/* 새로 배우는 판에 문장은 세 개까지.
 *
 * 단어 외우기는 단어를 외우는 자리다. 문장이 절반까지 들어오면 스무 장 중 열
 * 장이 문장이 되는데, 문장 한 장은 단어 한 장의 두 배 가까이 걸린다 —
 * 「단어 20개」라고 적어 놓고 실제로는 30개어치를 시키는 셈이다.
 *
 * 그렇다고 0으로 두지는 않는다. 단어만 외우면 그 단어가 문장 안에서 어떻게
 * 서는지를 영영 안 보게 된다. 두세 개면 그 감을 잡기에 충분하다.
 *
 * 복습에는 이 뚜껑을 안 씌운다. 전에 외운 문장은 복습일이 되면 나와야 하고,
 * 여기서 막으면 외운 게 조용히 새어 나간다. */
export const FRESH_SENTENCE_MAX = 3;

/* 큐에 담기는 한 개. 단어인지 문장인지를 들고 다녀야 화면이 다르게 그린다. */
function item(id, kind, bucket) {
  return { id, kind, bucket };
}

/* 세 갈래로 나눈다. 겹치지 않게 나누는 게 중요하다 — 약점이면서 복습일인 카드가
 * 양쪽에 다 들어가면 같은 게 두 번 나온다. 약점이 먼저 가져간다. */
export function classifyDaily(pool, review, today = todayKey()) {
  const weak = []; const due = []; const fresh = [];
  for (const { id, kind } of pool) {
    const st = stateOf(review, id);
    /* 졸업한 카드도 한참 뒤에는 한 번 다시 나와야 한다 — 안 그러면 외운 게
       조용히 새어 나간다. 통째로 빼 뒀더니 180일 재확인이 영영 안 왔다.
       복습일이 안 됐을 때만 뺀다. */
    if (isMastered(st) && !isDue(st, today)) continue;
    if (!st.lastSeen) { fresh.push(item(id, kind, 'fresh')); continue; }
    if (st.wrongCount + st.vagueCount >= WEAK_THRESHOLD) { weak.push(item(id, kind, 'weak')); continue; }
    if (isDue(st, today)) due.push(item(id, kind, 'review'));
  }
  /* 복습은 오래 밀린 것부터. 신규는 자료 차례대로 — 뒤섞으면 N5 앞쪽부터
     차근차근 가려는 사람에게 매번 다른 데서 튀어나온다. */
  due.sort((a, b) => {
    const da = dueDate(stateOf(review, a.id));
    const db = dueDate(stateOf(review, b.id));
    return da < db ? -1 : da > db ? 1 : 0;
  });
  /* 약점은 많이 틀린 것부터 */
  weak.sort((a, b) => {
    const sa = stateOf(review, a.id); const sb = stateOf(review, b.id);
    return (sb.wrongCount + sb.vagueCount) - (sa.wrongCount + sa.vagueCount);
  });
  return { weak, due, fresh };
}

/* 갈래마다 제 목표까지만 가져간다. 서로 빌리지 않는다 —
 * 복습이 없는 날 신규가 두 배가 되면, 다음 날 복습이 그만큼 폭발한다. */
function shareOut(sizes, goals) {
  return {
    review: Math.min(goals.review, sizes.review),
    weak: Math.min(goals.weak, sizes.weak),
    fresh: Math.min(goals.fresh, sizes.fresh),
  };
}

/* 갈래 안에서 단어와 문장을 남은 양에 비례해 번갈아 뽑는다.
 *
 * 앞에서부터 그냥 자르면 자료가 담긴 차례대로 단어만 나오고 문장은 영영
 * 안 나온다 — 실제로 그랬다. 비례로 뽑으면 단어 2330개와 문장 600개가
 * 4:1로 나가서 둘이 비슷한 때에 끝난다. */
function takeMixed(items, count) {
  if (count >= items.length) return items.slice(0, count);
  const lanes = new Map();
  for (const it of items) {
    if (!lanes.has(it.kind)) lanes.set(it.kind, []);
    lanes.get(it.kind).push(it);
  }
  if (lanes.size <= 1) return items.slice(0, count);

  const rows = [...lanes.values()];
  const at = rows.map(() => 0);
  const out = [];
  while (out.length < count) {
    let best = -1; let bestGap = -Infinity;
    for (let i = 0; i < rows.length; i++) {
      if (at[i] >= rows[i].length) continue;
      // 제 몫보다 얼마나 덜 뽑혔는지 — 제일 뒤처진 쪽이 다음 차례다
      const gap = (rows[i].length / items.length) * (out.length + 1) - at[i];
      if (gap > bestGap) { bestGap = gap; best = i; }
    }
    if (best < 0) break;
    out.push(rows[best][at[best]++]);
  }
  return out;
}

/* 약점 몫을 채운다 — 자리 수가 아니라 「만나는 횟수」로 센다.
 *
 * 몰라요가 열 번 넘은 카드는 두 자리를 쓴다. 그만큼 다른 약점이 덜 들어오는데,
 * 그게 맞다 — 제일 안 외워지는 걸 놔두고 다음 것으로 넘어가면 목록만 길어진다.
 * 목표를 넘겨서 늘리지는 않는다. 그러면 제일 안 외워지는 사람의 하루가
 * 제일 길어진다. */
function takeWeak(items, count, review) {
  const out = [];
  for (const it of items) {
    if (out.length >= count) break;
    out.push(it);
    if (isHardWeak(stateOf(review, it.id)) && out.length < count) out.push({ ...it, again: true });
  }
  return out;
}

/* 순서를 짠다.
 *
 * 그냥 섞으면 첫 문제가 약점일 수 있다. 시작하자마자 모르는 게 나오면 그날
 * 학습이 거기서 끝난다. 그래서 앞은 아는 것(복습)으로 열고, 약점은 중간중간
 * 흩어 놓는다. 몰아 두면 그 구간에서 지친다. */
/* 같은 카드가 두 번 들어온 판에서, 두 번째를 첫 번째에서 떼어 놓는다.
 *
 * 붙여 놓으면 두 번째가 그냥 따라 나온다 — 방금 본 걸 다시 보는 건 외운 게
 * 아니다. arrange가 두 번째 것들을 뒤로 몰아 두기는 하는데, 그것만으로는
 * 모자란 판이 있다. 판이 통째로 약점일 때(약점만 고른 날)는 사이에 낄
 * 다른 카드가 없어서, 「15장 뒤에 5장」으로 붙여 놓으면 14번째 것의 두 번째가
 * 바로 15번째에 온다. 실제로 그렇게 나왔다.
 *
 * 그래서 마지막에 한 번 훑어서 너무 붙은 것을 뒤로 민다. 미는 사이에 다른
 * 것이 당겨질 수 있어서 몇 번 더 훑되, 끝이 없지는 않게 횟수를 막아 둔다. */
export function spaceOut(list, minGap = 3) {
  const out = [...list];
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      const first = out.findIndex((x) => x.id === out[i].id);
      if (first === i || i - first >= minGap) continue;
      const [dup] = out.splice(i, 1);
      out.splice(Math.min(out.length, first + minGap), 0, dup);
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

function arrange(picked) {
  const easy = shuffled(picked.filter((x) => x.bucket === 'review'));
  /* 두 번 들어온 카드는 붙여 놓으면 두 번째가 그냥 따라 나온다 —
     방금 본 걸 다시 보는 건 외운 게 아니다. 두 번째 것을 뒤로 몬다. */
  const once = shuffled(picked.filter((x) => x.bucket === 'weak' && !x.again));
  const twice = shuffled(picked.filter((x) => x.bucket === 'weak' && x.again));
  const hard = [...once, ...twice];
  const rest = shuffled(picked.filter((x) => x.bucket === 'fresh'));

  // 앞머리는 복습으로 — 없으면 신규로 연다. 약점으로는 절대 열지 않는다.
  const head = easy.splice(0, Math.min(3, easy.length));
  if (!head.length) head.push(...rest.splice(0, Math.min(2, rest.length)));

  const body = shuffled([...easy, ...rest]);
  if (!hard.length) return [...head, ...body];

  /* 약점을 body에 고르게 흩는다 */
  const out = [...head];
  const gap = (body.length + 1) / (hard.length + 1);
  let next = gap;
  for (let i = 0; i < body.length; i++) {
    while (hard.length && i >= Math.round(next)) { out.push(hard.shift()); next += gap; }
    out.push(body[i]);
  }
  out.push(...hard);
  return spaceOut(out);
}

/* 문장이 몫을 넘으면 그만큼을 단어로 바꿔 넣는다.
 *
 * 갈래별로 뽑고 나서 세는 게 맞다 — 갈래마다 따로 뚜껑을 씌우면 복습에 문장이
 * 없는 날 신규 쪽 몫이 놀게 된다. 바꿔 넣을 단어가 모자라면 그만큼은 그냥
 * 문장으로 둔다. 억지로 채우느라 개수를 줄이지는 않는다. */
function capSentences(picked, groups, got, goal) {
  const taken = new Set(picked.map((x) => x.id));
  const spare = {
    review: groups.due.filter((x) => x.kind === 'word' && !taken.has(x.id)),
    weak: groups.weak.filter((x) => x.kind === 'word' && !taken.has(x.id)),
    fresh: groups.fresh.filter((x) => x.kind === 'word' && !taken.has(x.id)),
  };
  const out = [...picked];

  /* 뒤에서부터 뺀다 — 앞쪽은 복습이라 화면을 여는 자리다.
     바꿔 넣을 단어가 모자라면 그만큼은 그냥 문장으로 둔다. 억지로 채우느라
     개수를 줄이지는 않는다. */
  const swap = (over, match) => {
    let left = over;
    for (let i = out.length - 1; i >= 0 && left > 0; i--) {
      if (out[i].kind !== 'sentence' || !match(out[i])) continue;
      const lane = spare[out[i].bucket];
      if (!lane?.length) continue;
      out[i] = lane.shift();
      left--;
    }
  };

  // 새로 배우는 문장은 세 개까지 — 단어 외우기는 단어를 외우는 자리다
  const freshSent = out.filter((x) => x.kind === 'sentence' && x.bucket === 'fresh').length;
  if (freshSent > FRESH_SENTENCE_MAX) {
    swap(freshSent - FRESH_SENTENCE_MAX, (x) => x.bucket === 'fresh');
  }

  // 그러고도 판 전체에서 문장이 절반을 넘으면 거기서 더 깎는다
  const cap = Math.max(1, Math.floor(goal * SENTENCE_SHARE));
  const all = out.filter((x) => x.kind === 'sentence').length;
  if (all > cap) swap(all - cap, () => true);

  return out;
}

/* 오늘 큐를 짠다.
 *
 * pool: [{ id, kind }] — 단어와 문장을 한 배열에 담아 넘긴다.
 * lanes: 어느 갈래만 담을지. 홈 화면이 「단어 외우기(신규)」와 「복습하기
 *        (복습+약점)」를 따로 열기 때문에 갈래를 골라 짤 수 있어야 한다.
 * 반환: { queue, review, weak, fresh, left, minutes } */
function draw(pool, review, { goals, lanes, today }) {
  const want = normalizeGoals(goals);
  const use = new Set(lanes?.length ? lanes : LANES);
  const groups = classifyDaily(pool, review, today);
  const sizes = { review: groups.due.length, weak: groups.weak.length, fresh: groups.fresh.length };

  // 안 고른 갈래는 목표를 0으로 — 큐에서 통째로 빠진다
  const goal = { review: 0, weak: 0, fresh: 0 };
  for (const k of LANES) if (use.has(k)) goal[k] = want[k];

  const got = shareOut(sizes, goal);
  const total = got.review + got.weak + got.fresh;

  const picked = capSentences([
    ...takeMixed(groups.due, got.review),
    ...takeWeak(groups.weak, got.weak, review),
    ...takeMixed(groups.fresh, got.fresh),
  ], groups, got, total);

  return { groups, sizes, got, picked, total };
}

export function buildDailyStudyQueue(pool, review, { goals, lanes, today = todayKey() } = {}) {
  const { sizes, got, picked } = draw(pool, review, { goals, lanes, today });
  return {
    queue: arrange(picked),
    review: got.review,
    weak: got.weak,
    fresh: got.fresh,
    left: {
      review: sizes.review - got.review,
      weak: sizes.weak - got.weak,
      fresh: sizes.fresh - got.fresh,
    },
    minutes: estimateMinutes(picked),
  };
}

/* 몇 분 걸릴지. 30초 미만이면 0분이 되어 "약 0분"이 되니 최소 1분으로 둔다. */
export function estimateMinutes(items) {
  if (!items?.length) return 0;
  const sec = items.reduce((s, x) => s + (SECONDS[x.kind] ?? SECONDS.word), 0);
  return Math.max(1, Math.round(sec / 60));
}

/* 화면에 미리 적어 줄 숫자 — 큐를 실제로 짜지 않고도 알 수 있어야
 * 대시보드가 매번 섞는 비용을 안 낸다. */
export function planToday(pool, review, { goals, lanes, today = todayKey() } = {}) {
  const { sizes, got, picked } = draw(pool, review, { goals, lanes, today });
  return {
    total: picked.length,
    ...got,
    words: picked.filter((x) => x.kind === 'word').length,
    sentences: picked.filter((x) => x.kind === 'sentence').length,
    minutes: estimateMinutes(picked),
    left: {
      review: sizes.review - got.review,
      weak: sizes.weak - got.weak,
      fresh: sizes.fresh - got.fresh,
    },
    /* 오늘 아직 남은 것 — 화면이 「단어 20 · 복습 12 · 약점 7」처럼 적는다 */
    pool: sizes,
  };
}
