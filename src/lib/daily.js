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

/* 복습 4 : 약점 3 : 신규 3.
 *
 * 복습이 제일 많은 건 이미 본 걸 안 잃는 게 먼저이기 때문이고, 약점이 신규와
 * 같은 몫인 건 계속 틀리는 걸 놔두면 아무리 새로 배워도 안 쌓이기 때문이다. */
export const MIX = { review: 0.4, weak: 0.3, fresh: 0.3 };

/* 몰라요·애매해요가 이만큼 쌓이면 약점으로 본다. 회독 쪽 기준과 같은 값이다. */
export const WEAK_THRESHOLD = 3;

/* 한 개에 걸리는 시간(초). 문장이 더 오래 걸린다 — 읽고 뜻을 떠올리는 양이 다르다.
 * 정확할 수 없는 값이라 "약 8분"처럼 어림으로만 쓴다. */
const SECONDS = { word: 9, sentence: 16 };

export const DEFAULT_GOAL = 20;

/* 오늘 큐에서 문장이 차지할 수 있는 몫의 상한.
 *
 * 문장에는 레벨이 없다. 단어만 설정한 레벨로 걸러지니, N5만 켠 사람은 단어
 * 후보가 534개로 줄고 문장은 600개가 그대로 남는다. 남은 수에 비례해 뽑는
 * 규칙이라 스무 개 중 열한 개가 문장이 됐다 — 비율이 뒤집힌 것이다.
 *
 * 비례로 뽑는 것 자체는 남긴다. 그게 없으면 자료 차례대로 잘려서 문장이 아예
 * 0개가 된다. 대신 위에 뚜껑을 씌운다. */
export const SENTENCE_SHARE = 0.5;

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

/* 몫을 나눈다. 한쪽이 모자라면 남은 자리를 다른 쪽이 가져간다 —
 * 어제 시작한 사람은 복습도 약점도 없어서, 비율만 지키면 큐가 텅 빈다. */
function shareOut(sizes, goal) {
  const want = {
    review: Math.round(goal * MIX.review),
    weak: Math.round(goal * MIX.weak),
    fresh: goal - Math.round(goal * MIX.review) - Math.round(goal * MIX.weak),
  };
  const got = {
    review: Math.min(want.review, sizes.review),
    weak: Math.min(want.weak, sizes.weak),
    fresh: Math.min(want.fresh, sizes.fresh),
  };
  /* 남은 자리를 순서대로 메운다. 복습 → 약점 → 신규 — 이미 본 걸 안 잃는 쪽이 먼저다. */
  let left = goal - (got.review + got.weak + got.fresh);
  for (const k of ['review', 'weak', 'fresh']) {
    if (left <= 0) break;
    const room = sizes[k] - got[k];
    const take = Math.min(room, left);
    got[k] += take;
    left -= take;
  }
  return got;
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

/* 순서를 짠다.
 *
 * 그냥 섞으면 첫 문제가 약점일 수 있다. 시작하자마자 모르는 게 나오면 그날
 * 학습이 거기서 끝난다. 그래서 앞은 아는 것(복습)으로 열고, 약점은 중간중간
 * 흩어 놓는다. 몰아 두면 그 구간에서 지친다. */
function arrange(picked) {
  const easy = shuffled(picked.filter((x) => x.bucket === 'review'));
  const hard = shuffled(picked.filter((x) => x.bucket === 'weak'));
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
  return out;
}

/* 문장이 몫을 넘으면 그만큼을 단어로 바꿔 넣는다.
 *
 * 갈래별로 뽑고 나서 세는 게 맞다 — 갈래마다 따로 뚜껑을 씌우면 복습에 문장이
 * 없는 날 신규 쪽 몫이 놀게 된다. 바꿔 넣을 단어가 모자라면 그만큼은 그냥
 * 문장으로 둔다. 억지로 채우느라 개수를 줄이지는 않는다. */
function capSentences(picked, groups, got, goal) {
  const cap = Math.max(1, Math.floor(goal * SENTENCE_SHARE));
  const sentences = picked.filter((x) => x.kind === 'sentence');
  if (sentences.length <= cap) return picked;

  const taken = new Set(picked.map((x) => x.id));
  const spare = {
    review: groups.due.filter((x) => x.kind === 'word' && !taken.has(x.id)),
    weak: groups.weak.filter((x) => x.kind === 'word' && !taken.has(x.id)),
    fresh: groups.fresh.filter((x) => x.kind === 'word' && !taken.has(x.id)),
  };

  /* 뒤에서부터 뺀다 — 앞쪽은 복습이라 화면을 여는 자리다 */
  const out = [...picked];
  let over = sentences.length - cap;
  for (let i = out.length - 1; i >= 0 && over > 0; i--) {
    if (out[i].kind !== 'sentence') continue;
    const lane = spare[out[i].bucket];
    if (!lane?.length) continue;
    out[i] = lane.shift();
    over--;
  }
  return out;
}

/* 오늘 큐를 짠다.
 *
 * pool: [{ id, kind }] — 단어와 문장을 한 배열에 담아 넘긴다.
 * 반환: { queue, review, weak, fresh, left, minutes } */
export function buildDailyStudyQueue(pool, review, { goal = DEFAULT_GOAL, today = todayKey() } = {}) {
  const target = Math.max(0, Math.round(goal) || 0);
  const groups = classifyDaily(pool, review, today);
  const sizes = { review: groups.due.length, weak: groups.weak.length, fresh: groups.fresh.length };
  const got = shareOut(sizes, target);

  const picked = capSentences([
    ...takeMixed(groups.due, got.review),
    ...takeMixed(groups.weak, got.weak),
    ...takeMixed(groups.fresh, got.fresh),
  ], groups, got, target);

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
export function planToday(pool, review, { goal = DEFAULT_GOAL, today = todayKey() } = {}) {
  const target = Math.max(0, Math.round(goal) || 0);
  const groups = classifyDaily(pool, review, today);
  const sizes = { review: groups.due.length, weak: groups.weak.length, fresh: groups.fresh.length };
  const got = shareOut(sizes, target);
  const picked = capSentences([
    ...takeMixed(groups.due, got.review),
    ...takeMixed(groups.weak, got.weak),
    ...takeMixed(groups.fresh, got.fresh),
  ], groups, got, target);
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
  };
}
