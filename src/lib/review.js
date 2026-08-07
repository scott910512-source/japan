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

// 알아요 연속 횟수(streak)별 다음 복습까지의 간격(일).
// streak 4 이상이면 졸업 — 복습 큐에서 빠진다.
const REVIEW_INTERVAL_DAYS = { 1: 1, 2: 3, 3: 7 };
export const MASTER_STREAK = 4;

// 하루에 처리할 복습 상한 — 복습 부채가 쌓여 이탈하는 것을 막는다.
export const DAILY_REVIEW_CAP = 100;

export function emptyState() {
  return { box: BOX.NEW, streak: 0, lastSeen: null, rounds: 0, wrongCount: 0, vagueCount: 0 };
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

// 카드 한 장에 판정을 적용한 새 상태를 돌려준다. 입력은 변경하지 않는다.
export function applyVerdict(prev, verdict, today = todayKey()) {
  const s = { ...emptyState(), ...prev };
  const next = { ...s, rounds: s.rounds + 1, lastSeen: today };

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

// 다음 복습 예정일. 저장하지 않고 lastSeen + 간격으로 매번 계산한다.
// null이면 복습 대상이 아님(미학습 또는 졸업).
export function dueDate(st) {
  if (!st.lastSeen) return null;
  if (isMastered(st)) return null;
  const days = st.box < BOX.KNOWN ? 1 : (REVIEW_INTERVAL_DAYS[st.streak] ?? 7);
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

/* ── 취약 단어 ── */

export const WEAK_THRESHOLD = 3;

// 몰라요+애매해요 누적이 기준 이상인 카드 — "내 취약 단어" 가상 덱.
export function weakCards(cardIds, progress, threshold = WEAK_THRESHOLD) {
  return cardIds.filter((id) => {
    const st = stateOf(progress, id);
    return st.wrongCount + st.vagueCount >= threshold && !isMastered(st);
  });
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

/* 하루치 세션 구성 — "복습 섞기 + 신규".
 *
 * 매일 신규만 쌓으면 앞서 틀린 것이 영영 안 돌아오고, 복습만 하면 진도가 안 나간다.
 * 그래서 한 세션을 [이미 틀린 것 중 무작위 N개] + [처음 보는 M개]로 짠다.
 *
 * 복습 쪽 우선순위:
 *   1) 몰라요·애매해요로 남은 카드 (box < KNOWN)
 *   2) 알아요지만 복습일이 된 카드
 * 둘 다 무작위로 섞어 뽑는다 — 항상 같은 카드만 도는 것을 막는다.
 */
export function buildDailySession(cardIds, progress, {
  newCount = 50, reviewCount = 15, today = todayKey(), shuffle = true,
} = {}) {
  const fresh = [];
  const wrong = [];
  const dueKnown = [];

  for (const id of cardIds) {
    const st = stateOf(progress, id);
    if (!st.lastSeen) { fresh.push(id); continue; }
    if (isMastered(st)) continue;
    if (st.box < BOX.KNOWN) wrong.push(id);
    else if (isDue(st, today)) dueKnown.push(id);
  }

  const reviewPool = [...shuffled(wrong), ...shuffled(dueKnown)];
  const review = reviewPool.slice(0, Math.max(0, reviewCount));
  const fresher = fresh.slice(0, Math.max(0, newCount));

  const picked = [...review, ...fresher];
  return {
    queue: shuffle ? shuffled(picked) : picked,
    reviewPicked: review.length,
    newPicked: fresher.length,
    freshLeft: Math.max(0, fresh.length - fresher.length),
    reviewLeft: Math.max(0, reviewPool.length - review.length),
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
  const reinserted = session.reinserted || [];

  // 몰라요는 방금 본 답을 한 번 더 확인하도록 같은 회독 안에서 1회만 재삽입한다.
  const shouldReinsert = verdict === VERDICT.UNKNOWN && !reinserted.includes(cardId);
  if (shouldReinsert) queue.push(cardId);

  return {
    session: {
      ...session,
      queue,
      reinserted: shouldReinsert ? [...reinserted, cardId] : reinserted,
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
  return { total: cardIds.length, mastered, learning, fresh };
}
