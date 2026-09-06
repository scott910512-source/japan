/* 무엇을 하려고 일본어를 배우나.
 *
 * 온보딩은 「남은 기간에 맞춰 오늘 학습량과 우선순위를 잡아 드려요」라고
 * 적어 두고 아무것도 안 했다. 답은 받아서 저장까지 했는데 계획은 그 답을
 * 한 번도 읽지 않았다 — 개인화되지 않는 것을 개인화된 것처럼 말한 것이다.
 *
 * 두 가지 중 하나를 해야 했다. 문구를 지우거나, 실제로 반영하거나.
 * 여기서는 반영한다. 대신 반영하는 만큼만 말한다.
 *
 * ★ 목적이 바뀌어도 기록은 그대로다 ★
 * 목적은 「무엇을 먼저 보여 줄까」만 정한다. 회독 상태도 복습일도 안 건드린다 —
 * 목적을 바꿨다고 외운 게 사라지면 아무도 못 바꾼다. */

export const PURPOSES = [
  {
    id: 'jlpt',
    label: 'JLPT',
    sub: '시험에 나오는 어휘와 문법부터',
    /* 시험은 낱말과 문법이 먼저다. 상황 문장은 뒤로 민다 */
    does: '고른 레벨의 단어를 먼저 배정하고, 문장은 뒤로 미뤄요.',
  },
  {
    id: 'trip',
    label: '여행',
    sub: '주문 · 결제 · 길 찾기 · 숙소',
    does: '주문 · 결제 · 길 찾기 · 숙소 문장을 먼저 배정해요.',
  },
  {
    id: 'talk',
    label: '회화',
    sub: '한국어에서 일본어를 떠올리는 연습',
    does: '카드를 「뜻 → 일본어」로 먼저 보여 줘요. 문장도 같이 배정해요.',
  },
];

export const DEFAULT_PURPOSE = 'talk';

export function purposeOf(settings) {
  const id = settings?.purpose;
  return PURPOSES.find((p) => p.id === id) ? id : DEFAULT_PURPOSE;
}

/* 여행 문장으로 볼 자리. 카드의 place에 이 말이 들어 있으면 여행 쪽이다. */
const TRIP_PLACES = ['이동', '식당', '쇼핑', '숙소', '길', '주문', '결제', '교통', '공항', '호텔'];

export function isTripCard(card) {
  const where = String(card?.place || '');
  return TRIP_PLACES.some((w) => where.includes(w));
}

/* 목적에 따라 후보의 차례를 바꾼다.
 *
 * 거르지 않고 차례만 바꾸는 게 중요하다. 거르면 「여행」을 골랐다는 이유로
 * 시험 단어를 영영 못 보게 되는데, 목적은 취향이지 자격이 아니다.
 * 앞쪽부터 배정되니 차례를 바꾸는 것만으로 「먼저 배운다」가 된다. */
export function orderByPurpose(pool, purpose, cardOf) {
  const rank = (it) => {
    const card = cardOf?.(it.id);
    if (purpose === 'jlpt') return it.kind === 'word' ? 0 : 1;
    if (purpose === 'trip') {
      if (it.kind === 'sentence' && isTripCard(card)) return 0;
      if (it.kind === 'sentence') return 2;
      return 1;
    }
    // 회화 — 문장과 단어를 같이. 문장을 조금 앞세운다
    return it.kind === 'sentence' ? 0 : 1;
  };
  /* 안정 정렬이어야 한다. 같은 등급 안에서는 원래 차례를 지킨다 —
     N5 앞쪽부터 차근차근 가려는 사람에게 매번 다른 데서 튀어나오면 안 된다. */
  return [...pool]
    .map((it, i) => ({ it, i, r: rank(it) }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map((x) => x.it);
}

/* 새로 배우는 판에 문장을 몇 개까지 넣을까.
 *
 * 차례를 바꾸는 것만으로는 안 됐다. 큐를 짜는 쪽(takeMixed)이 단어와 문장을
 * 종류별로 다시 묶어 비례로 뽑기 때문에, 앞뒤를 바꿔도 섞이는 비율은 그대로였다.
 * 차례는 「어느 문장이 먼저인가」를 정하고, 이 숫자가 「문장을 몇 개 볼까」를
 * 정한다 — 둘 다 있어야 목적이 실제로 반영된다.
 *
 * 0으로는 안 내린다. 시험을 준비해도 낱말만 외우면 그 낱말이 문장 안에서
 * 어떻게 서는지를 영영 안 보게 된다. */
export function freshSentenceMax(purpose, base = 3) {
  if (purpose === 'jlpt') return 1;
  return base;
}

/* 이 목적에서 카드를 어느 방향으로 보여 줄까.
   회화는 한국어에서 일본어를 떠올리는 연습이 핵심이라 뒤집는다. */
export function directionFor(purpose, fallback = 'kanji-mean') {
  return purpose === 'talk' ? 'mean-kanji' : fallback;
}

/* ── 여행까지 며칠 ──
 *
 * 예전엔 「3일 이내」 같은 선택을 tripDay에 저장했다. 그건 고른 날의 이야기라
 * 사흘이 지나면 거짓말이 된다 — 「3일 이내」인 채로 한 달이 흐른다.
 * 실제 출발일이 있을 때만 날짜로 센다. 없으면 없다고 한다. */
export function daysUntilTrip(settings, today) {
  const date = settings?.tripDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = date.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/* 홈에 적을 한 줄. 지난 여행은 지났다고 말한다. */
export function tripLabel(settings, today) {
  const n = daysUntilTrip(settings, today);
  if (n == null) return null;
  if (n < 0) return '여행 잘 다녀오셨어요?';
  if (n === 0) return '오늘 출발이에요';
  return `여행까지 ${n}일`;
}
