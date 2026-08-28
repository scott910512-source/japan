// 회독(반복학습) 엔진 — 순수 함수만 둔다.
// 저장소·화면과 분리해 두어 규칙을 단독으로 테스트할 수 있게 유지한다.
//
// 사용자에게 설명하는 규칙 한 줄:
//   "빨강은 오늘 또 나오고, 노랑은 다음 회독에 나오고, 초록이 이어지면 졸업"

// MASTER는 "뜻을 안 봐도 확실히 아는" 카드를 바로 졸업시키는 판정이다.
// 나머지 셋과 달리 뒷면을 확인하지 않은 상태에서도 누를 수 있다.
export const VERDICT = { UNKNOWN: 'unknown', VAGUE: 'vague', KNOWN: 'known', MASTER: 'master' };

// box: 0=미학습, 1=몰라요, 2=애매해요, 3=알아요
export const BOX = { NEW: 0, UNKNOWN: 1, VAGUE: 2, KNOWN: 3 };

/* 알아요 연속 횟수(streak)별 다음 복습까지의 간격(일).
 *
 * 4연속이면 졸업으로 친다(화면에 그렇게 센다). 다만 졸업이 "다시는 안 나옴"은
 * 아니다 — 예전엔 그랬는데, 그러면 11일 만에 졸업한 단어를 그 뒤로 한 번도 안
 * 보게 된다. 2,330개를 그렇게 졸업시키면 복습할 게 0이 되고, 실제로는 다 잊는다.
 * 오래 안 잊으려면 간격을 벌리면서 계속 만나야 한다.
 *
 * 그래서 졸업 뒤에도 한 달·석 달·반년으로 간격만 벌린다. 반년 간격이면
 * 2,330개가 전부 졸업해도 하루 13장꼴이라 부담이 되지 않는다. */
const REVIEW_INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7, 4: 30, 5: 90 };
const LONG_INTERVAL_DAYS = 180;
export const MASTER_STREAK = 4;

// 하루에 처리할 복습 상한 — 복습 부채가 쌓여 이탈하는 것을 막는다.
export const DAILY_REVIEW_CAP = 100;

export function emptyState() {
  return { box: BOX.NEW, streak: 0, lastSeen: null, seenAt: 0, rounds: 0, wrongCount: 0, vagueCount: 0 };
}

export function stateOf(progress, id) {
  return { ...emptyState(), ...(progress?.[id] || {}) };
}

/* ── 날짜 유틸 (YYYY-MM-DD 문자열 기준, 로컬 타임존) ── */

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dayKey, n) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return todayKey(dt);
}

export function daysBetween(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/* ── 판정 적용 ── */

/* 카드 한 장에 판정을 적용한 새 상태를 돌려준다. 입력은 변경하지 않는다.
 *
 * seenAt은 "몇 시 몇 분에 눌렀는가"다. 복습 날짜 계산은 lastSeen(날짜)만 쓰지만,
 * 기기 두 대를 합칠 때는 이게 필요하다 — 같은 날 같은 카드를 아이폰과 아이패드에서
 * 다르게 판정하면 날짜만으로는 어느 쪽이 나중인지 알 수가 없다. */
export function applyVerdict(prev, verdict, today = todayKey(), at = Date.now()) {
  const s = { ...emptyState(), ...prev };
  const next = { ...s, rounds: s.rounds + 1, lastSeen: today, seenAt: at };

  if (verdict === VERDICT.MASTER) {
    // 졸업 기준까지 한 번에 올린다 — 복습 큐에서도 바로 빠진다.
    next.box = BOX.KNOWN;
    next.streak = MASTER_STREAK;
  } else if (verdict === VERDICT.UNKNOWN) {
    next.box = BOX.UNKNOWN;
    next.streak = 0;
    next.wrongCount = s.wrongCount + 1;
  } else if (verdict === VERDICT.VAGUE) {
    next.box = BOX.VAGUE;
    next.streak = 0;
    next.vagueCount = s.vagueCount + 1;
  } else {
    next.box = BOX.KNOWN;
    next.streak = s.streak + 1;
  }
  return next;
}

/* ── 세션(회독) 판정 ── */

// 이번 세션에서 이 카드가 끝났는가.
// 애매해요를 한 번이라도 받은 카드는 "알아요" 2연속이어야 빠진다(요행 방지).
export function isSessionClear(st) {
  if (st.box !== BOX.KNOWN) return false;
  return st.vagueCount > 0 ? st.streak >= 2 : st.streak >= 1;
}

export function isMastered(st) {
  return st.box === BOX.KNOWN && st.streak >= MASTER_STREAK;
}

/* ── 복습 큐 ── */

/* 다음 복습 예정일. 저장하지 않고 lastSeen + 간격으로 매번 계산한다.
 * null이면 복습 대상이 아님 — 이제는 미학습(한 번도 안 본 것)뿐이다. */
export function dueDate(st) {
  if (!st.lastSeen) return null;
  const days = st.box < BOX.KNOWN ? 1 : (REVIEW_INTERVAL_DAYS[st.streak] ?? LONG_INTERVAL_DAYS);
  return addDays(st.lastSeen, days);
}

export function isDue(st, today = todayKey()) {
  const due = dueDate(st);
  return due != null && due <= today;
}

// 오늘 복습해야 할 카드 id 목록. 오래 밀린 것부터, 상한까지만.
export function dueCards(cardIds, progress, today = todayKey(), cap = DAILY_REVIEW_CAP) {
  return cardIds
    .map((id) => ({ id, st: stateOf(progress, id) }))
    .filter(({ st }) => isDue(st, today))
    .sort((a, b) => (dueDate(a.st) < dueDate(b.st) ? -1 : 1))
    .slice(0, cap)
    .map(({ id }) => id);
}

/* ── 취약 단어 ──
 *
 * 「약점」이 무엇인지는 여기 한 군데서만 정한다.
 *
 * 예전엔 화면마다 제 나름대로 셌다. 같은 화면 안에서 8px 떨어진 두 자리가
 * 「약점 14」와 「약점 6개」였고, 복습 탭은 25, 카드 배지는 53, 시험은 56이었다.
 * 두 곳은 이 상수를 안 가져다 쓰고 숫자를 손으로 적어 뒀다. 이름이 같으면
 * 값도 같아야 한다 — 아니면 어느 것도 못 믿는다. */

export const WEAK_THRESHOLD = 3;

/* 이 카드가 약점인가. 졸업한 카드는 아니다 —
   다 외운 것에 「취약」이 붙으면 졸업이라는 말이 취소된다. */
export function isWeak(st, threshold = WEAK_THRESHOLD) {
  if (!st) return false;
  return (st.wrongCount || 0) + (st.vagueCount || 0) >= threshold && !isMastered(st);
}

export function weakCards(cardIds, progress, threshold = WEAK_THRESHOLD) {
  return cardIds.filter((id) => isWeak(stateOf(progress, id), threshold));
}

/* ── 세션 큐 만들기 ── */

export function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 1회독 시작 큐. size가 0 이하면 전체.
// 미학습 → 오래된 것 순으로 채워, 매번 같은 카드만 도는 것을 막는다.
export function buildRound1(cardIds, progress, { size = 0, shuffle = true } = {}) {
  const ordered = [...cardIds].sort((a, b) => {
    const sa = stateOf(progress, a);
    const sb = stateOf(progress, b);
    if (!sa.lastSeen && sb.lastSeen) return -1;
    if (sa.lastSeen && !sb.lastSeen) return 1;
    if (!sa.lastSeen && !sb.lastSeen) return 0;
    return sa.lastSeen < sb.lastSeen ? -1 : 1;
  });
  const picked = size > 0 ? ordered.slice(0, size) : ordered;
  return shuffle ? shuffled(picked) : picked;
}

/* 여러 갈래에서 골고루 뽑는다.
 *
 * 앞 갈래부터 채우면 뒤는 영영 차례가 안 온다 — 실제로 몰라요가 복습 몫보다
 * 많으면 복습일 지난 카드가 한 장도 안 나왔고, 그 카드들은 계속 밀리기만 했다.
 * 몰라요를 더 자주 뽑되(weight), 나머지도 자리를 갖게 한다. */
function drawMixed(groups, take) {
  const at = groups.map(() => 0);
  const out = [];
  let moved = true;
  while (out.length < take && moved) {
    moved = false;
    groups.forEach((g, i) => {
      for (let k = 0; k < g.weight && out.length < take && at[i] < g.items.length; k++) {
        out.push(g.items[at[i]++]);
        moved = true;
      }
    });
  }
  return out;
}

/* 오늘 뽑을 카드를 네 갈래로 나눈다.
 *   fresh     한 번도 안 본 것
 *   wrong     몰라요·애매해요로 남은 것 — 날짜를 안 따진다. 오늘 틀린 걸
 *             내일까지 기다릴 이유가 없다
 *   dueKnown  알아요지만 복습일이 된 것
 *   refresh   졸업했지만 오래돼 한 번 확인할 것
 */
function classify(cardIds, progress, today) {
  const fresh = []; const wrong = []; const dueKnown = []; const refresh = [];
  for (const id of cardIds) {
    const st = stateOf(progress, id);
    if (!st.lastSeen) { fresh.push(id); continue; }
    if (st.box < BOX.KNOWN) { wrong.push(id); continue; }
    if (!isDue(st, today)) continue;
    if (isMastered(st)) refresh.push(id);
    else dueKnown.push(id);
  }
  return { fresh, wrong, dueKnown, refresh };
}

/* 오늘 학습량을 신규와 복습으로 나눈다.
 *
 * 예전에는 신규 50 + 복습 15가 코드에 박혀 있었고, 설정의 "오늘 학습량"은
 * 아무 데도 안 쓰였다. 20장으로 맞춰 놓고 65장이 나오는 게 그래서였다.
 * 이제 학습량 하나만 정하면 그 안에서 나눈다.
 *
 * 복습이 1/4다. 새것만 밀어 넣으면 앞에 본 게 무너지고, 복습만 하면 진도가
 * 안 나간다. 아주 적게 잡은 날에도 복습이 최소 한 장은 있어야 한다. */
export const REVIEW_SHARE = 0.25;

// 고를 수 있는 학습량. 두 화면이 같은 값을 써야 서로 어긋나지 않는다.
export const GOAL_CHOICES = [10, 20, 30, 50, 80];

export function splitGoal(goal) {
  const total = Math.max(1, Math.round(goal) || 1);
  const review = total <= 4 ? 1 : Math.max(2, Math.round(total * REVIEW_SHARE));
  return { review: Math.min(review, total), fresh: total - Math.min(review, total) };
}

/* 실제로 몇 장이 나올지 — 화면에 미리 적어 주기 위한 것.
 * 한쪽 갈래가 모자라면 다른 쪽으로 채워 목표 장수를 맞춘다. */
function shareOut(pools, goal) {
  const want = splitGoal(goal);
  const reviewTotal = pools.wrong.length + pools.dueKnown.length + pools.refresh.length;
  let review = Math.min(want.review, reviewTotal);
  const fresh = Math.min(goal - review, pools.fresh.length);
  if (review + fresh < goal) review = Math.min(reviewTotal, goal - fresh);
  return { review, fresh, reviewTotal };
}

export function planDailySession(cardIds, progress, { goal = 20, today = todayKey() } = {}) {
  const pools = classify(cardIds, progress, today);
  const { review, fresh, reviewTotal } = shareOut(pools, Math.max(0, goal));
  return {
    total: review + fresh,
    reviewPicked: review,
    newPicked: fresh,
    freshLeft: Math.max(0, pools.fresh.length - fresh),
    reviewLeft: Math.max(0, reviewTotal - review),
  };
}

/* 하루치 세션 구성 — "복습 섞기 + 신규".
 *
 * 매일 신규만 쌓으면 앞서 틀린 것이 영영 안 돌아오고, 복습만 하면 진도가 안 나간다.
 * 복습 쪽은 세 갈래를 2:1:1로 섞는다 — 몰라요, 복습일이 된 알아요, 졸업 재확인.
 * 갈래마다 무작위로 섞어 뽑는다 — 항상 같은 카드만 도는 것을 막는다.
 */
export function buildDailySession(cardIds, progress, {
  goal = 20, today = todayKey(), shuffle = true,
} = {}) {
  const pools = classify(cardIds, progress, today);
  const want = shareOut(pools, Math.max(0, goal));

  const groups = [
    { items: shuffled(pools.wrong), weight: 2 },
    { items: shuffled(pools.dueKnown), weight: 1 },
    { items: shuffled(pools.refresh), weight: 1 },
  ];
  const review = drawMixed(groups, want.review);
  const fresher = pools.fresh.slice(0, want.fresh);

  const picked = [...review, ...fresher];
  return {
    queue: shuffle ? shuffled(picked) : picked,
    reviewPicked: review.length,
    newPicked: fresher.length,
    freshLeft: Math.max(0, pools.fresh.length - fresher.length),
    reviewLeft: Math.max(0, want.reviewTotal - review.length),
  };
}

// 다음 회독 큐 = 이번 회독에서 아직 안 끝난 카드만. 2회독부터는 항상 섞는다.
export function buildNextRound(roundIds, progress) {
  const remaining = roundIds.filter((id) => !isSessionClear(stateOf(progress, id)));
  return shuffled(remaining);
}

/* ── 세션 진행 ── */

// 세션 한 장을 처리한 결과를 돌려준다. 화면은 이 결과를 그대로 상태에 반영하면 된다.
//
// session: { queue, roundIds, reinserted, done }
// 반환: { session, progress } — 둘 다 새 객체
export function advanceSession(session, progress, cardId, verdict, today = todayKey()) {
  const nextState = applyVerdict(stateOf(progress, cardId), verdict, today);
  const nextProgress = { ...progress, [cardId]: nextState };

  const queue = session.queue.filter((id) => id !== cardId);

  /* 몰라요를 이 회독 안에 도로 넣지 않는다 — 다음 회독에서 만난다.
   *
   * 예전엔 여기서 큐 맨 뒤에 도로 넣었다. 그런데 몰라요는 어차피 box가 낮아
   * 다음 회독 큐에도 들어간다. 두 군데서 한 번씩, 그러니까 같은 카드를 두 규칙이
   * 각각 집행했고 그 곱이 최악 판정 수를 목표의 여섯 배로 만들었다.
   * 스무 장을 고르면 백스무 번을 눌러야 끝났다 — 그러고도 오늘 정리된 카드는 0장.
   *
   * 재삽입을 없애는 게 아니라 옮기는 것이다. 못 외운 건 오늘 안에 다시 나온다.
   * 다만 이번 바퀴가 아니라 다음 바퀴에 나온다. 그래서 1회독이 정확히 고른 장수가
   * 되고, 「남은 N개」가 줄기만 한다. 최악은 목표의 세 배(3회독)로 준다. */

  return {
    session: {
      ...session,
      queue,
      // 옛 세션이 들고 있을 수 있어 칸은 남겨 둔다. 이제 아무도 안 채운다.
      reinserted: session.reinserted || [],
      done: (session.done || 0) + 1,
    },
    progress: nextProgress,
  };
}

// 회독이 끝났을 때 다음 회독으로 넘어갈지, 세션을 끝낼지 판단한다.
// maxRounds회독까지만 돌리고 남은 카드는 내일 복습 큐로 넘긴다(당일 무한 루프 방지).
export function nextRoundOf(session, progress, maxRounds = 3) {
  if (session.queue.length > 0) return { kind: 'continue' };

  const remaining = buildNextRound(session.roundIds, progress);
  if (remaining.length === 0) return { kind: 'done', reason: 'clear' };
  if (session.round >= maxRounds) return { kind: 'done', reason: 'carryover', carried: remaining.length };

  return {
    kind: 'next',
    session: {
      ...session,
      round: session.round + 1,
      queue: remaining,
      roundIds: remaining,
      reinserted: [],
    },
  };
}

/* ── 집계 ── */

export function summarize(cardIds, progress) {
  let mastered = 0, learning = 0, fresh = 0;
  for (const id of cardIds) {
    const st = stateOf(progress, id);
    if (isMastered(st)) mastered++;
    else if (st.lastSeen) learning++;
    else fresh++;
  }
  // seen은 "한 번이라도 본 단어". 졸업은 며칠 걸리므로, 오늘 한 만큼 올라가는
  // 숫자가 따로 있어야 진도가 멈춘 것처럼 보이지 않는다.
  return { total: cardIds.length, mastered, learning, fresh, seen: mastered + learning };
}
