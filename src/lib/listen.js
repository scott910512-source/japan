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

import { stateOf, isDoneEnough, isDue, shuffled, todayKey } from './review.js';
/* 「약점만」의 기준 — 회독 기록에 시험 오답·잊어버림까지 더해서 본다 */
import { isWeakNow, weakEntry } from './weak.js';

export const SCOPES = [
  { id: 'today', label: '오늘 볼 것', sub: '복습일이 됐거나 아직 안 본 것' },
  /* 기출만 듣는 자리.
     다른 범위는 「얼마나 외웠나」로 고르는데 이것만 「시험에 나왔나」로 고른다 —
     손이 안 비는 시간에 귀로라도 시험 범위를 한 바퀴 돌자는 것이다.
     외웠는지 안 외웠는지는 안 본다. 이미 아는 것도 귀로는 낯설 수 있다. */
  { id: 'kiju', label: '기출 단어', sub: '시험에 나온 것만 — 외운 것도 같이' },
  /* 여행 벼락치기.
     기출과 같은 자리에 선다 — 「얼마나 외웠나」가 아니라 「무엇이 필요한가」로
     고르는 범위다. 다만 고르는 기준이 시험이 아니라 나흘 뒤의 공항이다.
     낱말과 짧은 문장이 하루의 차례대로 섞여 돈다. */
  { id: 'trip', label: '여행 · 삿포로', sub: '공항부터 계산까지 — 벼락치기' },
  /* 급수별 문장.
     「오늘 볼 것」을 틀었더니 N3이 섞여 와서 몇몇 낱말 말고는 안 들렸다.
     귀는 눈보다 늦다 — 급수를 골라 그 급수의 문장만 돈다. 낱말은 안 돈다.
     목록은 급수마다 다르니 여기도 후보 목록을 통째로 바꿔 낀다(poolFor). */
  { id: 'jlpt', label: 'JLPT 문장', sub: '급수를 골라 그 급수의 문장만 — 예문부터 회화까지' },
  { id: 'seen', label: '배운 것', sub: '한 번이라도 본 것 전체' },
  { id: 'weak', label: '약점만', sub: '회독·시험에서 세 번 넘게 틀린 것' },
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
  /* ★ 섞어서 ★
     한 방향으로만 돌면 그 방향에만 익는다. 「일본어를 들으면 뜻이 떠오르는데
     뜻을 보면 일본어가 안 나오는」 상태가 그렇게 생긴다 — 시험은 앞쪽을 묻고
     여행은 뒤쪽을 묻는다.
     그리고 방향이 고정이면 다음 장에 무엇이 나올지 알고 듣는다. 어느 쪽으로
     올지 모르면 매번 맨손으로 떠올려야 한다. */
  { id: 'mix', label: '랜덤', sub: '두 방향을 섞어서 — 어느 쪽이 올지 몰라요' },
];

/* 이 장은 어느 방향인가.
 *
 * ★ 그릴 때마다 뽑으면 안 된다 ★
 * Math.random을 화면에서 바로 부르면 한 장이 흘러가는 동안에도 다시 그릴
 * 때마다 방향이 바뀐다 — 일본어를 듣다가 뜻 쪽으로 넘어가 버린다.
 * 그래서 판(run)의 씨앗과 자리·바퀴로 정한다. 같은 자리는 늘 같은 방향이고,
 * 판이 바뀌면 패턴도 바뀐다. */
function mix32(n) {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

export function dirOf(direction, run) {
  if (direction !== 'mix') return direction;
  if (!run) return 'jp-ko';
  const seed = (run.seed || 0) + (run.lap || 0) * 2654435761 + (run.at || 0);
  return mix32(seed) % 2 ? 'ko-jp' : 'jp-ko';
}

export function inScope(st, scope, today = todayKey(), rec = null) {
  if (scope === 'all') return true;
  if (scope === 'seen') return Boolean(st.lastSeen);
  /* 장부를 안 주면 회독 기록만 본다 — 예전과 같은 목록이다. 주면 시험에서
     틀린 낱말과 외웠다가 무너진 낱말이 「약점만」에 들어온다. */
  if (scope === 'weak') return isWeakNow(st, rec);
  /* 기출은 회독 상태로 고르는 범위가 아니다 — 「시험에 나왔나」는 카드의
     내력이 아니라 목록이 답한다. 그래서 여기서는 거르지 않고, 후보 목록
     자체를 기출로 바꿔 끼운다(poolFor). 이 함수에 기출이 들어왔다는 것은
     이미 그 목록 안이라는 뜻이다. */
  if (scope === 'kiju') return true;
  /* 여행도 같다 — 「떠나기 전에 들을 것인가」는 카드의 내력이 아니라 목록이
     답한다. 후보 목록 자체를 바꿔 끼운다(poolFor). */
  if (scope === 'trip') return true;
  /* JLPT 문장도 같다 — 급수는 카드의 내력이 아니라 목록이 답한다. */
  if (scope === 'jlpt') return true;
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
function poolFor(scope, pool, kiju, trip, jlpt) {
  if (scope === 'kiju') return kiju || [];
  if (scope === 'trip') return trip || [];
  /* 급수별 문장 — 화면이 고른 급수의 목록을 만들어 넘긴다(lib/jlptListen.js).
     안 주면 빈손이다. 「다 들린다」보다 낫다. */
  if (scope === 'jlpt') return jlpt || [];
  return pool;
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

/* 고른 구간 번호를 성하게 만든다.
 *
 * 설정에서 온 값이라 뭐든 들어올 수 있다 — 범위 밖 번호(개수를 줄이면
 * 생긴다), 같은 번호 두 번, 숫자가 아닌 것. 걸러 내고 차례대로 둔다.
 * 차례가 중요하다 — 1·3을 골랐으면 1구간이 먼저 나와야 한다. 고른 차례대로
 * 두면 눌러 본 순서에 따라 듣는 차례가 달라진다. */
export function normalizeBlocks(blocks, total) {
  const last = Math.max(0, (Number(total) || 1) - 1);
  const seen = new Set();
  for (const b of Array.isArray(blocks) ? blocks : [blocks]) {
    const i = Math.round(Number(b));
    if (!Number.isFinite(i) || i < 0 || i > last) continue;
    seen.add(i);
  }
  return [...seen].sort((x, y) => x - y);
}

/* ★ 구간을 여러 개 고를 수 있다 ★
 *
 * 한 구간은 스무 개다. 그게 한 덩어리를 귀에 붙이기에 좋은 크기인데, 어떤
 * 날은 그 묶음 셋을 한 번에 돌고 싶다 — 시험이 가깝거나, 이미 뗀 구간을
 * 같이 섞어 다시 다지고 싶을 때다.
 *
 * 그렇다고 「전체」로 가면 안 된다. 그건 구간을 안 쓰는 것이고, 들을 때마다
 * 딴 것이 나오는 자리로 돌아간다. 고른 구간만 이어 붙이면 덩어리는 그대로
 * 두면서 길이만 늘릴 수 있다.
 *
 * 하나도 안 고르면 첫 구간. 빈손으로 두면 「들을 게 없어요」가 뜨는데,
 * 고르는 칸을 잘못 눌러서 그렇게 되는 건 설정이 아니라 사고다. */
export function pickBlocks(list, { count = 20, blocks = [0] } = {}) {
  const size = Math.max(1, count);
  const total = blockCount(list.length, size);
  const want = normalizeBlocks(blocks, total);
  const use = want.length ? want : [0];
  return use.flatMap((i) => list.slice(i * size, i * size + size));
}

/* 한 구간만. 옛 설정(listenBlock 하나)이 쓴다.
 *
 * 여기서는 범위를 넘긴 번호를 버리지 않고 마지막 구간으로 당긴다. 하나뿐일
 * 때는 버리면 들을 게 없어지는데, 개수를 늘려 구간 수가 줄면 저장해 둔
 * 번호가 바로 범위 밖이 된다 — 그때 첫 구간으로 튕기는 것보다 끝에 머무는
 * 쪽이 덜 놀란다. 여럿일 때는 반대로 버린다(위 normalizeBlocks). */
export function pickBlock(list, { count = 20, block = 0 } = {}) {
  const size = Math.max(1, count);
  const last = blockCount(list.length, size) - 1;
  const i = Math.min(Math.max(0, Math.round(block) || 0), last);
  return pickBlocks(list, { count, blocks: [i] });
}

/* 범위 안에 구간이 몇 개인가. 화면이 「3 / 11구간」을 적는 데 쓴다. */
export function blocksIn(pool, review, {
  scope = 'today', count = 20, today = todayKey(), kiju = null, trip = null, jlpt = null,
  skipDone = false, ledger = null,
} = {}) {
  const src = poolFor(scope, pool, kiju, trip, jlpt);
  const keep = keepFor(review, skipDone);
  const n = src.filter(({ id }) => (
    inScope(stateOf(review, id), scope, today, weakEntry(ledger, id)) && keep(id)
  )).length;
  return blockCount(n, count);
}

/* 다 외운 것을 뺀다.
 *
 * 「외웠다」의 기준은 회독 쪽 한 군데에서 정한다(isDoneEnough) — 여기서 따로
 * 세면 같은 낱말이 화면마다 다른 상태가 된다.
 *
 * 기본은 안 빼는 쪽이다. 눈으로 아는 낱말이 귀로는 낯선 일이 흔하고, 듣기는
 * 그 낯섦을 없애는 자리라서 「외웠으니 됐다」가 곧바로 성립하지 않는다.
 * 다만 205개 중 150개를 외운 사람에게 그 150개를 계속 들려주면 남은 55개를
 * 만나는 데 세 배가 걸린다 — 그때 끄라고 둔 칸이다. */
function keepFor(review, skipDone) {
  if (!skipDone) return () => true;
  return (id) => !isDoneEnough(stateOf(review, id));
}

export function pickListen(pool, review, {
  scope = 'today', count = 20, shuffle = true, today = todayKey(), kiju = null, trip = null,
  jlpt = null, order = 'shuffle', block = 0, blocks = null, skipDone = false, ledger = null,
} = {}) {
  const src = poolFor(scope, pool, kiju, trip, jlpt);
  const keep = keepFor(review, skipDone);
  const picked = src.filter(({ id }) => (
    inScope(stateOf(review, id), scope, today, weakEntry(ledger, id)) && keep(id)
  ));
  /* 구간은 안 섞는다. 섞으면 같은 구간을 다시 틀어도 차례가 달라지는데,
     그러면 「세 번째에 나오는 그 낱말」이라는 기억의 손잡이가 없어진다. */
  /* 구간은 안 섞는다(위 설명). 여러 개를 골랐으면 고른 차례대로 이어 붙인다 —
     옛 설정은 하나뿐이라 그때는 그 하나만 본다. */
  if (order === 'block') {
    return blocks?.length
      ? pickBlocks(picked, { count, blocks })
      : pickBlock(picked, { count, block });
  }
  const ordered = shuffle ? shuffled(picked) : picked;
  return ordered.slice(0, Math.max(0, count));
}

/* 범위마다 몇 개나 되는지. 골라 보고 나서야 「들을 게 없어요」를 만나면
   왜 없는지 모른다 — 고르기 전에 숫자를 보여 준다. */
/* 다른 둘(blocksIn·pickListen)과 같은 모양으로 받는다 — 자리 여덟 개를 세다
   보면 다음 범위를 더할 때 자리를 하나 밀리는 것이 조용한 버그가 된다. */
export function scopeCounts(pool, review, {
  today = todayKey(), kiju = null, trip = null, jlpt = null, skipDone = false, ledger = null,
} = {}) {
  const keep = keepFor(review, skipDone);
  const out = {};
  for (const s of SCOPES) {
    out[s.id] = poolFor(s.id, pool, kiju, trip, jlpt)
      .filter(({ id }) => inScope(stateOf(review, id), s.id, today, weakEntry(ledger, id)) && keep(id)).length;
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
 * ★ 바퀴마다 순서를 다시 섞는다 ★
 *
 * 세트는 그대로 두고 순서만 바꾼다. 둘을 같이 묶으면 안 된다 — 세트까지
 * 바뀌면 「이 스무 개를 귀에 붙이겠다」가 다시 깨진다(위의 구간 설명).
 *
 * 순서를 안 바꾸면 세 바퀴째부터 다음에 뭐가 올지 먼저 떠오른다. 그건 낱말을
 * 외운 게 아니라 차례를 외운 것이고, 시험장에는 그 차례가 없다. 섞으면 매번
 * 맨손으로 떠올려야 한다.
 *
 * 섞은 결과가 그대로면 한 번 틀어 준다. 스무 개가 우연히 같은 차례로 나올
 * 일은 거의 없지만, 두세 개짜리 구간에서는 흔하다 — 거기서 「섞었는데 똑같다」가
 * 되면 켠 보람이 없다.
 *
 * null이면 끝났다는 뜻 — 화면은 판을 접고 설정으로 돌아간다. */
/* ★ 몇 바퀴째부터 「아직 안 뗀 것」으로 세나 ★
 *
 * 첫 바퀴는 그냥 처음 만난 것이다. 못 떼는 게 당연해서 셀 것이 없다.
 * 둘째 바퀴도 넘긴다 — 한 번 더 들어 보는 중일 수 있다.
 * 셋째 바퀴부터가 신호다. 같은 스무 개를 세 번 돌았는데 아직 「다
 * 외웠어요」에 손이 안 갔다면, 그건 안 붙고 있다는 뜻이다.
 *
 * 바퀴 번호는 0부터다(첫 바퀴가 0). 그래서 2부터 센다. */
export const STUCK_FROM_LAP = 2;

export function countsAsStuck(lap) {
  return (Number(lap) || 0) >= STUCK_FROM_LAP;
}

export function reorderLap(cards = []) {
  if (cards.length < 2) return cards;
  const next = shuffled(cards);
  const same = next.every((c, i) => c === cards[i]);
  if (!same) return next;
  const swapped = next.slice();
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  return swapped;
}

export function nextAt(run, loop = true, { reshuffle = false } = {}) {
  if (!run?.cards?.length) return null;
  const lap = run.lap || 0;
  if (run.at + 1 < run.cards.length) return { at: run.at + 1, lap };
  if (!loop) return null;
  const next = { at: 0, lap: lap + 1 };
  /* 카드를 같이 돌려준다. 자리(at)만 돌려주면 받는 쪽이 「0번째」가 어느
     낱말인지 따로 정해야 하고, 그러면 순서를 아는 곳이 둘로 갈린다. */
  if (reshuffle) next.cards = reorderLap(run.cards);
  return next;
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
