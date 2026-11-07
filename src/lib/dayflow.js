/* 하루 흐름 — 한 단계가 끝나면 다음 단계로 바로 이어 준다.
 *
 *   복습 미션 → 약점 퀴즈 → 쭉 퀴즈 → 새로 배우기(끝에 10개 더) → 오늘의 N3(어휘·한자·문법…) → 오늘 랜덤 테스트
 *
 * 끝날 때마다 홈으로 돌려보내면 매번 「다음에 뭐 하지」를 다시 정해야 한다. 그래서 각 화면의 끝에
 * 「다음: ○○」를 내민다. 다음 단계가 비었거나(복습할 게 없다 · 약점이 없다) 오늘 몫을 이미 마쳤으면
 * 그 단계는 건너뛰고 그다음 단계를 내민다. 아무것도 안 남았으면 null — 화면이 「오늘로」만 보여 준다.
 *
 * 순서 말고 판단은 여기 없다. 단계가 남았는지는 부르는 쪽이 states에 넣어 준다. */
export const FLOW = ['review', 'weakquiz', 'stream', 'fresh', 'n3', 'random'];

export const FLOW_LABEL = {
  review: '복습 미션',
  weakquiz: '약점 퀴즈',
  stream: '쭉 퀴즈',
  fresh: '새로 배우기',
  n3: '오늘의 N3',
  random: '오늘 랜덤 테스트',
};

/* 오늘 랜덤 테스트 문제 수. 오늘 만난 것을 다 섞어서 한 번에 본다 */
export const RANDOM_TEST_SIZE = 50;
/* 이보다 적게 모이면 테스트를 안 낸다 — 열 문제도 안 되는 걸 「랜덤 테스트」라 부르면 거짓이다 */
export const RANDOM_TEST_MIN = 10;

/* 오늘의 N3(N3 코스)가 아직 할 게 남았나.
 *   on      — N3를 켰나(목표가 N3 이상 · 메뉴 켬)
 *   n3      — progress.n3 (days · summary). 코스 자료는 안 불러온다 — 코스 화면이 적어 둔 것만 본다
 *   오늘 계획이 아직 없으면(코스를 안 열었으면) 짜일 것이니 「남음」이다. 계획이 있는데 단계가 비었거나 다 했으면 아니다.
 *   코스를 다 돌았으면(요약의 done이 total에 닿으면) 아니다. */
export function n3Open(on, n3, today) {
  if (!on) return false;
  const sum = n3?.summary;
  if (sum && sum.total > 0 && sum.done >= sum.total) return false;
  const day = n3?.days?.[today];
  const steps = Array.isArray(day?.steps) ? day.steps : [];
  if (!steps.length) return !day?.built;
  return steps.some((s) => !s.done);
}

/* 오늘의 N3 줄에 쓰는 진행 { done, total } — 계획이 아직 없으면 null */
export function n3Progress(n3, today) {
  const steps = n3?.days?.[today]?.steps;
  if (!Array.isArray(steps) || !steps.length) return null;
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

/* after 다음 단계. states = { review: bool, weakquiz: bool, stream: bool, fresh: bool, random: bool }
   (true = 아직 할 게 남은 단계). 없으면 null. */
export function nextStep(after, states = {}) {
  const at = FLOW.indexOf(after);
  for (let i = at + 1; i < FLOW.length; i++) {
    if (states[FLOW[i]]) return { to: FLOW[i], label: FLOW_LABEL[FLOW[i]] };
  }
  return null;
}

/* 덱 id가 어느 단계의 판인가. 다른 판(고른 단어 · 취약 · 기출…)이면 null — 그때는 흐름을 안 잇는다.
 * 「오늘의 학습」 한 판(today)은 복습 · 약점 · 새 단어를 한꺼번에 도는 판이다. 홈의 큰 단추가 여는 판이라 제일 많이 쓴다.
 * 이 판이 끝나면 복습 단계를 마친 것으로 보고 약점 퀴즈부터 잇는다(새 단어까지 돌았으니 새로 배우기는 남은 게 있을 때만 다시 나온다). */
export function stepOfDeck(deckId) {
  if (deckId === 'today') return 'review';
  if (deckId === 'today:review+weak' || deckId === 'today:review' || deckId === 'today:weak') return 'review';
  if (deckId === 'today:fresh') return 'fresh';
  return null;
}

/* 오늘 랜덤 테스트에 낼 낱말 id 목록.
 *
 * 오늘 만난 것 위주로 섞는다 — 오늘 계획에 배정된 낱말, 오늘 푼 약점 퀴즈 낱말. 모자라면 지금까지 외운 낱말로
 * 채운다. 문장 카드는 단어 시험에 못 낸다(Quiz는 낱말만 묻는다) — wordIds에 든 것만 쓴다.
 *   today  — 오늘 만난 낱말 id (앞에 있을수록 먼저 쓴다)
 *   seen   — 외운 낱말 id (모자란 만큼 채운다)
 *   rng    — 0~1 난수. 시험에서는 고정 값을 넘긴다. */
export function randomTestIds({ today = [], seen = [], wordIds = new Set(), size = RANDOM_TEST_SIZE, rng = Math.random } = {}) {
  const ok = (id) => typeof id === 'string' && wordIds.has(id);
  const first = [...new Set(today.filter(ok))];
  const rest = [...new Set(seen.filter(ok))].filter((id) => !first.includes(id));
  const shuffle = (a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  };
  const picked = shuffle(first).slice(0, size);
  if (picked.length < size) picked.push(...shuffle(rest).slice(0, size - picked.length));
  return shuffle(picked);
}
