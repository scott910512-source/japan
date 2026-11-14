/* 하루 흐름 — 한 단계가 끝나면 다음 단계로 바로 이어 준다.
 *
 *   복습 미션 → 약점 퀴즈 → 쭉 퀴즈 → 새로 배우기(끝에 10개 더) → 문장 퀘스트(새 문장 + 문장 만들기) → 오늘 랜덤 테스트 → 오늘의 N3(어휘·한자·문법…)
 *
 * ★ 순서는 오늘 화면의 퀘스트 줄과 같다 ★ 오늘의 N3는 퀘스트 줄에 없다(학습 탭의 코스다). 전에는 문장 퀘스트와 랜덤 테스트
 * 사이에 끼어 있어서, 문장 퀘스트를 마치면 줄에 보이는 「오늘 랜덤 테스트」가 아니라 N3 코스로 넘어갔다. 퀘스트 줄을 다 마친 뒤로 뺐다.
 *
 * 끝날 때마다 홈으로 돌려보내면 매번 「다음에 뭐 하지」를 다시 정해야 한다. 그래서 각 화면의 끝에
 * 「다음: ○○」를 내민다. 다음 단계가 비었거나(복습할 게 없다 · 약점이 없다) 오늘 몫을 이미 마쳤으면
 * 그 단계는 건너뛰고 그다음 단계를 내민다. 아무것도 안 남았으면 null — 화면이 「오늘로」만 보여 준다.
 *
 * 순서 말고 판단은 여기 없다. 단계가 남았는지는 부르는 쪽이 states에 넣어 준다. */
export const FLOW = ['review', 'weakquiz', 'stream', 'fresh', 'sentence', 'random', 'n3'];

export const FLOW_LABEL = {
  review: '복습 미션',
  weakquiz: '약점 퀴즈',
  stream: '쭉 퀴즈',
  fresh: '새로 배우기',
  sentence: '문장 퀘스트',
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

/* 하루의 마지막 구간 — 앞 단계(복습 · 퀴즈 · 새로 배우기 · 문장)를 다 돈 뒤에만 내민다 */
const TAIL = ['random', 'n3'];
const MAIN = FLOW.filter((s) => !TAIL.includes(s));

/* after 다음 단계. states = { review: bool, weakquiz: bool, stream: bool, fresh: bool, random: bool }
   (true = 아직 할 게 남은 단계). 없으면 null.

   ★ 뒤쪽만 보지 않는다 ★ 첫날에는 외운 것이 없어 쭉 퀴즈가 닫혀 있다가, 새로 배우기를 마치면 열린다. 뒤쪽만 찾으면
   새로 배우기 → 문장 퀘스트에서 끝나고, 방금 열린 쭉 퀴즈(순서로는 앞)는 「0 / 20」으로 남은 채 「홈으로」만 나왔다.
   그래서 뒤쪽에 남은 게 없으면 앞에서 건너뛴 단계로 돌아가고, 그것도 없을 때 마지막 구간(랜덤 테스트 · 오늘의 N3)을 내민다. */
/* ★ 이미 끝 화면까지 간 카드 판으로는 돌려보내지 않는다(tried) ★
   「몰라요」를 누른 카드는 그 판이 끝나도 오늘 몫에 남는다. 그래서 복습 미션과 새로 배우기가 둘 다 「조금 남은」 채로 끝나면
   다음이 서로를 가리켜서, 한두 장짜리 판을 열 번 가까이 오갔다(30명 시뮬레이션에서 「몰라요」가 많은 사람). 한 번 끝까지 돈 판은
   「다음」에서 빼고, 남은 카드는 오늘 화면의 줄과 큰 버튼에서 고르게 둔다. 건너뛰어서 안 열어 본 단계는 그대로 돌아간다. */
export function nextStep(after, states = {}, tried = {}) {
  const open = (list) => list.find((s) => states[s] && !tried[s]) || null;
  const make = (s) => (s ? { to: s, label: FLOW_LABEL[s] } : null);
  if (TAIL.includes(after)) {
    const at = TAIL.indexOf(after);
    return make(open(TAIL.slice(at + 1)) || open(MAIN) || open(TAIL.slice(0, at)));
  }
  const at = MAIN.indexOf(after);
  return make(open(MAIN.slice(at + 1)) || open(MAIN.slice(0, Math.max(0, at))) || open(TAIL));
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

/* 오늘 이미 본 것을 뒤 단계에서 뺀다.
 * 복습 미션에서 만난 낱말이 약점 퀴즈 · 쭉 퀴즈에서 또 나오면 한 바퀴가 같은 것의 반복이 된다.
 * 빼고 나서 min개보다 적게 남으면(외운 것이 적은 사람) 빼지 않고 그대로 쓴다 — 풀이 비면 퀴즈가 안 열린다.
 *   pool — [{ id, ... }]   seen — 오늘 본 id 모음(Set 또는 배열) */
export function avoidToday(pool, seen, min = 4) {
  if (!Array.isArray(pool) || !seen || (seen.size ?? seen.length) === 0) return pool;
  const s = seen instanceof Set ? seen : new Set(seen);
  const rest = pool.filter((it) => !s.has(it.id));
  return rest.length >= min ? rest : pool;
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
