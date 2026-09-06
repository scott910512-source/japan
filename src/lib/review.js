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
export const MAX_LEVEL = 5;

/* ★ 이번 판의 연속과 오래 기억하는 것은 다른 일이다 ★
 *
 * 예전엔 하나로 셌다. 「알아요」를 누를 때마다 streak을 올렸고, streak이 4면
 * 졸업이며 다음 복습은 30일 뒤였다. 그래서 한 자리에서 같은 카드에 알아요를
 * 네 번 누르면 — 한 판에서 세 번 보고 다음 판에서 한 번만 더 봐도 — 그 카드는
 * 졸업하고 한 달 동안 안 나왔다. 오늘 세 번 연속 맞힌 것은 「오늘 외웠다」이지
 * 「사흘 뒤에도 기억한다」가 아니다.
 *
 * 그래서 둘로 가른다.
 *   streak  이번 판에서 이어 맞힌 횟수. 판이 언제 끝나는지를 정한다
 *   level   날짜를 두고 확인된 기억. 다음 복습 간격을 정한다
 *
 * level은 하루에 한 칸만 오른다. 그것도 복습일이 됐을 때만 오른다 —
 * 기한 전에 미리 연습한 것으로는 안 오르고, 복습일도 안 밀린다. */

// 하루에 처리할 복습 상한 — 복습 부채가 쌓여 이탈하는 것을 막는다.
export const DAILY_REVIEW_CAP = 100;

export function emptyState() {
  return {
    box: BOX.NEW,
    streak: 0,          // 이번 판에서 이어 맞힌 횟수
    level: 0,           // 날짜를 두고 확인된 기억 (0~MAX_LEVEL)
    due: null,          // 다음 복습일. lastSeen에서 계산하지 않고 여기 적어 둔다
    promotedOn: null,   // level이 마지막으로 오른 날 — 하루 두 칸을 막는다
    selfKnown: false,   // 「이미 알아요」 자가 신고. 검증된 숙련과 구별한다
    lastSeen: null,
    seenAt: 0,
    rounds: 0,
    wrongCount: 0,
    vagueCount: 0,
  };
}

/* 옛 기록을 새 칸에 맞춘다.
 *
 * ★ 없는 이력을 지어내지 않는다 ★
 * 옛 기록에는 「어느 날 맞혔는가」가 없다. streak이 4라도 그게 나흘에 걸친
 * 것인지 한 자리에서 네 번 누른 것인지 알 길이 없다. 그래서 날짜별 성공
 * 이력을 만들지 않고, 지금 사용자가 보고 있는 상태를 그대로 옮긴다.
 *
 *   level ← streak     지금 화면에 뜨는 회독 수가 그대로 남는다
 *   due   ← 옛 규칙으로 계산한 날짜   오늘 당장 일정이 안 바뀐다
 *   promotedOn ← lastSeen             오늘 또 오르지는 않는다
 *
 * 새 규칙은 여기서부터 적용된다. 옛 기록으로 잘못 졸업한 카드가 있다면
 * 그건 다음 복습에서 틀리면서 제자리를 찾는다 — 임의로 내리지 않는다. */
export function migrateState(raw) {
  const st = { ...emptyState(), ...(raw || {}) };
  if (raw && raw.level === undefined) {
    st.level = Math.min(MAX_LEVEL, Math.max(0, raw.streak || 0));
    st.promotedOn = raw.lastSeen || null;
    st.due = legacyDue(raw);
    st.selfKnown = false;
  }
  return st;
}

/* 옛 규칙의 복습일 — 마이그레이션에서만 쓴다 */
function legacyDue(raw) {
  if (!raw?.lastSeen) return null;
  const box = raw.box ?? BOX.NEW;
  const streak = raw.streak || 0;
  const days = box < BOX.KNOWN ? 1 : (REVIEW_INTERVAL_DAYS[streak] ?? LONG_INTERVAL_DAYS);
  return addDays(raw.lastSeen, days);
}

export function stateOf(progress, id) {
  return migrateState(progress?.[id]);
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
  const s = migrateState(prev);
  const next = { ...s, rounds: s.rounds + 1, lastSeen: today, seenAt: at };

  if (verdict === VERDICT.MASTER) {
    /* 「이미 알아요」 — 자가 신고다.
       복습 큐에서는 빠지되, 검증된 숙련과는 구별해서 적어 둔다. 앱이 확인한
       적이 없는 것을 확인했다고 세면 기록이 실력을 안 나타낸다. */
    next.box = BOX.KNOWN;
    next.streak = MASTER_STREAK;
    next.level = MAX_LEVEL;
    next.selfKnown = true;
    next.promotedOn = today;
    next.due = addDays(today, LONG_INTERVAL_DAYS);
    return next;
  }

  if (verdict === VERDICT.UNKNOWN) {
    /* 실패하면 내려간다. 오늘 다시 만나게 두어 재학습으로 잇는다. */
    next.box = BOX.UNKNOWN;
    next.streak = 0;
    next.wrongCount = s.wrongCount + 1;
    next.level = 0;
    next.selfKnown = false;
    next.due = today;
    return next;
  }

  if (verdict === VERDICT.VAGUE) {
    next.box = BOX.VAGUE;
    next.streak = 0;
    next.vagueCount = s.vagueCount + 1;
    next.level = Math.max(0, s.level - 1);
    next.selfKnown = false;
    next.due = today;
    return next;
  }

  // ── 알아요 ──
  next.box = BOX.KNOWN;
  next.streak = s.streak + 1;   // 이번 판의 연속. 판이 언제 끝나는지만 정한다

  /* ★ 장기 기억은 하루에 한 칸만, 그것도 복습일이 됐을 때만 오른다 ★
   *
   * 같은 날 네 번 맞혀도 level은 한 칸이다 — 오늘 외운 것은 오늘 외운 것이지
   * 사흘 뒤에도 안다는 뜻이 아니다.
   *
   * 복습일 전에 미리 연습한 것으로도 안 오른다. 그때 올려 주면 매일 미리
   * 연습하는 사람의 복습일이 계속 뒤로 밀려서, 결국 확인을 안 받게 된다. */
  const first = !s.lastSeen;
  const ripe = first || (s.due != null && s.due <= today);
  const promotedToday = s.promotedOn === today;

  if (ripe && !promotedToday) {
    next.level = Math.min(MAX_LEVEL, s.level + 1);
    next.promotedOn = today;
    next.due = addDays(today, intervalOf(next.level));
  } else {
    /* 안 올린다. 복습일도 그대로 둔다 — 미리 한 연습이 일정을 밀지 않는다.
       처음 보는 카드가 아니고 due가 없을 수는 없지만, 옛 기록을 대비해 채운다. */
    next.due = s.due ?? addDays(today, intervalOf(s.level || 1));
  }
  return next;
}

/* level별 다음 복습까지의 날 수 */
export function intervalOf(level) {
  return REVIEW_INTERVAL_DAYS[level] ?? (level > MAX_LEVEL ? LONG_INTERVAL_DAYS : 1);
}

/* ── 세션(회독) 판정 ── */

// 이번 세션에서 이 카드가 끝났는가.
// 애매해요를 한 번이라도 받은 카드는 "알아요" 2연속이어야 빠진다(요행 방지).
export function isSessionClear(st) {
  if (st.box !== BOX.KNOWN) return false;
  return st.vagueCount > 0 ? st.streak >= 2 : st.streak >= 1;
}

/* ★ 검증된 숙련 ★ — 날짜를 두고 네 번 확인된 것만.
   같은 날 네 번 누른 것으로는 여기 못 온다. */
export function isMastered(st) {
  return !st?.selfKnown && (st?.level || 0) >= MASTER_STREAK;
}

/* 「이미 알아요」로 사용자가 직접 뺀 것. 복습 큐에서는 빠지지만
   앱이 확인한 적은 없다 — 통계에서 검증된 숙련과 섞지 않는다. */
export function isSelfKnown(st) {
  return Boolean(st?.selfKnown);
}

/* 큐에서 뺄 만큼 아는가 — 검증됐든 자가 신고든 */
export function isDoneEnough(st) {
  return isMastered(st) || isSelfKnown(st);
}

/* ── 복습 큐 ── */

/* 다음 복습 예정일. 저장하지 않고 lastSeen + 간격으로 매번 계산한다.
 * null이면 복습 대상이 아님 — 이제는 미학습(한 번도 안 본 것)뿐이다. */
/* 다음 복습 예정일.
 *
 * 이제 상태에 적어 둔 값을 그대로 읽는다. 예전엔 lastSeen + 간격으로 매번
 * 계산했는데, 그러면 카드를 만질 때마다 복습일이 뒤로 밀렸다 — 기한 전에
 * 미리 연습만 해도 확인받을 날이 영영 안 왔다. */
export function dueDate(st) {
  if (!st?.lastSeen) return null;
  return st.due ?? addDays(st.lastSeen, st.box < BOX.KNOWN ? 1 : intervalOf(st.level));
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
  return (st.wrongCount || 0) + (st.vagueCount || 0) >= threshold && !isDoneEnough(st);
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
    if (isDoneEnough(st)) refresh.push(id);
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
  /* 두 번째 회독부터는 한 번씩만 만난다. 1회독에서 두 번 본 카드를 여기서도
     두 번 넣으면, 제일 많이 틀린 카드가 회독을 거듭할수록 배로 불어난다. */
  const seen = new Set();
  const remaining = roundIds.filter((id) => {
    if (seen.has(id) || isSessionClear(stateOf(progress, id))) return false;
    seen.add(id);
    return true;
  });
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

  /* 같은 카드가 큐에 두 번 들어 있을 수 있다 — 몰라요가 열 번 넘게 쌓인
     카드는 한 판에 두 번 만난다(daily.js의 HARD_WRONG). 전부 걷어내면 그
     두 번째가 사라지므로 앞에서 하나만 뺀다. */
  const queue = [...session.queue];
  const at = queue.indexOf(cardId);
  if (at >= 0) queue.splice(at, 1);
  else {
    // 큐에 없는 카드를 판정한 경우(옛 세션 등) — 그냥 앞에서 하나를 뺀다
    queue.shift();
  }

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
