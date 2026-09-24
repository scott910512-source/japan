/* 듣기 · 따라 말하기 — 무엇을 들려줄지 고르는 규칙.
 *
 * 여태 이 화면은 오늘의 학습 큐를 그대로 빌려 썼다. 그게 세 가지를 망가뜨렸다.
 *
 *   · 범위가 좁다 — 오늘 몫 스무 장 안에서만 돈다. 배운 게 500개인데 늘
 *     같은 것만 들린다
 *   · 순서가 늘 같다 — 회독 큐는 「복습으로 열고 약점을 흩는다」는 규칙으로
 *     짜인다. 판정을 하는 화면에서는 그게 맞지만, 여기서는 판정을 안 하니
 *     그 순서를 지킬 이유가 없고 매번 같은 차례로 들리기만 한다
 *   · 목표에 얽힌다 — 「20개만 듣고 자자」가 이 화면의 쓰임인데, 목표가
 *     갈래별로 갈리면서 그 숫자가 통째로 무시됐다
 *
 * 그래서 여기서 따로 고른다. 판정을 안 하는 화면이니 규칙도 단순하다 —
 * 범위를 고르고, 섞고, 개수만큼 자른다. */

import { stateOf, isWeak, isDue, shuffled, todayKey } from './review.js';

export const SCOPES = [
  { id: 'today', label: '오늘 볼 것', sub: '복습일이 됐거나 아직 안 본 것' },
  /* 기출만 듣는 자리.
     다른 범위는 「얼마나 외웠나」로 고르는데 이것만 「시험에 나왔나」로 고른다 —
     손이 안 비는 시간에 귀로라도 시험 범위를 한 바퀴 돌자는 것이다.
     외웠는지 안 외웠는지는 안 본다. 이미 아는 것도 귀로는 낯설 수 있다. */
  { id: 'kiju', label: '기출 단어', sub: '시험에 나온 것만 — 외운 것도 같이' },
  { id: 'seen', label: '배운 것', sub: '한 번이라도 본 것 전체' },
  { id: 'weak', label: '약점만', sub: '세 번 넘게 틀린 것' },
  { id: 'all', label: '전체', sub: '아직 안 본 것까지 다' },
];

/* 어느 쪽을 먼저 들려줄까.
 *
 * 「뜻 → 일본어」가 있어야 입이 열린다. 일본어를 듣고 뜻을 떠올리는 건
 * 알아듣는 연습이고, 뜻을 듣고 일본어를 말해 보는 건 말하는 연습이다 —
 * 여행에서 막히는 쪽은 뒤엣것이다. */
export const DIRECTIONS = [
  { id: 'jp-ko', label: '일본어 → 뜻', sub: '듣고 뜻을 떠올려요' },
  { id: 'ko-jp', label: '뜻 → 일본어', sub: '뜻을 듣고 일본어로 말해요' },
];

export function inScope(st, scope, today = todayKey()) {
  if (scope === 'all') return true;
  if (scope === 'seen') return Boolean(st.lastSeen);
  if (scope === 'weak') return isWeak(st);
  /* 기출은 회독 상태로 고르는 범위가 아니다 — 「시험에 나왔나」는 카드의
     내력이 아니라 목록이 답한다. 그래서 여기서는 거르지 않고, 후보 목록
     자체를 기출로 바꿔 끼운다(poolFor). 이 함수에 기출이 들어왔다는 것은
     이미 그 목록 안이라는 뜻이다. */
  if (scope === 'kiju') return true;
  // 오늘 볼 것 — 복습일이 됐거나 아직 안 본 것
  return !st.lastSeen || isDue(st, today);
}

/* 어느 목록에서 고를까.
 *
 * ★ 기출만 다른 목록을 본다 ★
 *
 * 다른 범위는 오늘의 후보(pool)에서 고른다. 그 목록은 고른 레벨이 반영돼
 * 있어서, N5만 켜 둔 사람에게는 N5 단어만 들어 있다.
 *
 * 기출에 그 규칙을 그대로 쓰면 205개가 18개로 잘린다. 기출 화면은 205개를
 * 보여 주는데 듣기에서는 18개만 들리는 것이다 — 같은 목록을 두 화면이 다르게
 * 세는 셈이라, 어느 쪽이 맞는지 알 방법이 없다.
 *
 * 기출은 시험에 나온 것이라 레벨로 자를 이유가 없다. 卒業은 N4지만 N3 시험에
 * 나왔고, N5만 골랐다고 안 나오는 게 아니다. 그래서 목록을 통째로 바꿔 낀다.
 * 안 주면 기출 범위는 빈손이다 — 「다 들린다」보다 낫다. */
function poolFor(scope, pool, kiju) {
  return scope === 'kiju' ? (kiju || []) : pool;
}

/* 들을 것을 고른다.
 *
 * 섞는 게 기본이다. 안 섞으면 자료에 적힌 차례대로만 들려서, 어제 들은 것을
 * 오늘 또 같은 순서로 듣게 된다 — 그러면 소리가 아니라 순서를 외운다. */
/* 후보를 구간으로 끊는다.
 *
 * ★ 섞어 뽑으면 한 덩어리를 못 외운다 ★
 *
 * 여태는 범위 안에서 무작위로 count개를 집었다. 들을 때마다 딴 것이 나오니
 * 「이 스무 개를 귀에 붙이겠다」가 안 된다 — 매번 처음 듣는 낱말이 섞여서
 * 한 바퀴를 돌아도 남는 게 없었다. 소리를 외우는 일은 같은 것을 여러 번
 * 마주쳐야 되는 일이다.
 *
 * 구간은 「몇 번째부터 몇 번째까지」다. 기출이면 1구간이 제일 많이 나온
 * 스무 개고, 그 구간만 반복해서 듣다가 다음 구간으로 넘어간다. 어디까지
 * 들었는지를 사람이 정하고, 앱은 그 자리를 안 흔든다. */
export function blockCount(total, size) {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, size)));
}

export function pickBlock(list, { count = 20, block = 0 } = {}) {
  const size = Math.max(1, count);
  const last = blockCount(list.length, size) - 1;
  const i = Math.min(Math.max(0, Math.round(block) || 0), last);
  return list.slice(i * size, i * size + size);
}

/* 범위 안에 구간이 몇 개인가. 화면이 「3 / 11구간」을 적는 데 쓴다. */
export function blocksIn(pool, review, {
  scope = 'today', count = 20, today = todayKey(), kiju = null,
} = {}) {
  const src = poolFor(scope, pool, kiju);
  const n = src.filter(({ id }) => inScope(stateOf(review, id), scope, today)).length;
  return blockCount(n, count);
}

export function pickListen(pool, review, {
  scope = 'today', count = 20, shuffle = true, today = todayKey(), kiju = null,
  order = 'shuffle', block = 0,
} = {}) {
  const src = poolFor(scope, pool, kiju);
  const picked = src.filter(({ id }) => inScope(stateOf(review, id), scope, today));
  /* 구간은 안 섞는다. 섞으면 같은 구간을 다시 틀어도 차례가 달라지는데,
     그러면 「세 번째에 나오는 그 낱말」이라는 기억의 손잡이가 없어진다. */
  if (order === 'block') return pickBlock(picked, { count, block });
  const ordered = shuffle ? shuffled(picked) : picked;
  return ordered.slice(0, Math.max(0, count));
}

/* 범위마다 몇 개나 되는지. 골라 보고 나서야 「들을 게 없어요」를 만나면
   왜 없는지 모른다 — 고르기 전에 숫자를 보여 준다. */
export function scopeCounts(pool, review, today = todayKey(), kiju = null) {
  const out = {};
  for (const s of SCOPES) {
    out[s.id] = poolFor(s.id, pool, kiju)
      .filter(({ id }) => inScope(stateOf(review, id), s.id, today)).length;
  }
  return out;
}

/* 한 장이 끝났다. 다음은 어디인가.
 *
 * ★ 정지할 때까지 한 세트를 돈다 ★
 *
 * 여태는 마지막 장에서 그냥 멈췄다. 한 바퀴 돌고 끝나면 열 개를 한 번씩
 * 스친 것뿐이라 소리가 귀에 안 붙는다 — 외우는 일은 같은 것을 여러 번
 * 마주쳐야 되는 일이다. 반복이면 제자리에서 다시 돌고, 멈추는 것은 사람이
 * 정한다(그만 버튼).
 *
 * 세는 것은 바퀴 수다. 몇 장 남았는지가 아니라 몇 번 마주쳤는지가 귀에
 * 붙는 정도를 말해 준다.
 *
 * null이면 끝났다는 뜻 — 화면은 판을 접고 설정으로 돌아간다. */
export function nextAt(run, loop = true) {
  if (!run?.cards?.length) return null;
  const lap = run.lap || 0;
  if (run.at + 1 < run.cards.length) return { at: run.at + 1, lap };
  if (!loop) return null;
  return { at: 0, lap: lap + 1 };
}

/* 한 장을 어떤 순서로 보여 줄까.
 *
 * 답을 소리로 낼지 말지는 여기서 안 정한다. 걸음은 그대로 두고 소리만 끈다 —
 * 안 읽어 준다고 걸음까지 빼면 답이 화면에도 안 뜬다. 소리를 끄고 싶은 건
 * 「듣기 전에 떠올리고 싶다」는 뜻이지, 「맞았는지 확인도 안 하겠다」가 아니다. */
export function stepsOf(direction, { shadow = false, recap = false } = {}) {
  // 뜻을 듣고 → 말해 보고 → 답을 본다
  if (direction === 'ko-jp') return ['ko', 'say', 'jp'];
  // 일본어를 듣고 → (따라 말하기면 한 번 더) → 뜻
  const base = shadow ? ['jp', 'say', 'ko'] : ['jp', 'ko'];

  /* ★ 뜻까지 듣고 나서 일본어를 한 번 더 ★
   *
   * 처음 듣는 일본어는 그냥 소리다. 뜻을 알고 다시 들으면 그제야 소리와 뜻이
   * 붙는다 — 같은 문장을 두 번 듣는 게 아니라, 모르고 한 번 알고 한 번 듣는 것이다.
   *
   * 마지막 걸음을 'jp'가 아니라 'jp2'로 둔다. 이름이 같으면 화면이 「아직
   * 뜻을 보여 줄 때가 아니다」로 읽어서, 방금 나온 뜻이 다시 사라진다. */
  return recap ? [...base, 'jp2'] : base;
}
