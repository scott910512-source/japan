/* 문장을 카드로 감싼다.
 *
 * 단어와 문장은 여태 다른 화면에서 배웠다. 회독 저장소는 같은데 화면만 갈라져
 * 있었던 것이다. 문장을 카드 모양으로 감싸 두면 회독 화면이 그대로 받아서
 * 돌린다 — 앞면 뒷면을 정하는 쪽이 kanji·kana·mean 세 칸만 보기 때문이다.
 *
 * 덤으로 방향 설정도 따라온다. 「뜻 → 일본어」로 두면 문장도 한국어를 먼저
 * 보여 주고 일본어를 떠올리게 된다 — 회화에 제일 가까운 연습이다. */

import { ALL_SITUATIONS } from '../data/allSituations.js';

/* 문장 하나 → 카드 하나.
 * kind를 남겨 두는 이유는 화면이 글자 크기를 달리 잡아야 하기 때문이다.
 * 문장을 단어만 한 크기로 띄우면 화면 밖으로 나간다. */
export function sentenceToCard(item, place) {
  return {
    id: item.id,
    kanji: item.jp,
    kana: item.kana || item.jp,
    mean: item.ko,
    type: 'sentence',
    kind: 'sentence',
    /* ★ 근거 없는 레벨을 붙이지 않는다 ★
     *
     * 여기엔 star가 「얼마나 자주 쓰나」로 적혀 있다. 중요도지 난이도가 아니다.
     * 그걸 그대로 N5/N4로 바꿔 놓으니, 자주 쓴다는 이유로 어려운 문장이 N5가
     * 되고 드물다는 이유로 쉬운 문장이 N4가 됐다. 근거 없는 레벨은 레벨이
     * 아니라 추측이다.
     *
     * 그래서 둘을 갈라 둔다. importance는 자료에 있는 값 그대로, level은
     * 모르면 모른다고 한다(null). 레벨을 고른 사람에게 미분류 문장을 새로
     * 배정하지 않는 판단은 daily.js가 한다. */
    importance: item.star ?? null,
    level: item.level ?? null,
    // 대답이 있으면 예문 자리에 넣는다 — 실제로 주고받는 모양이 같이 보인다
    example: item.reply?.jp || '',
    exampleKana: item.reply?.kana || '',
    exampleKo: item.reply?.ko || '',
    place: place || '',
  };
}

/* 자료에 있는 문장을 전부 카드로. 화면마다 다시 만들지 않게 한 번만 만든다. */
let cached = null;
export function allSentenceCards() {
  if (!cached) {
    cached = ALL_SITUATIONS.flatMap((s) => s.parts.flatMap(
      (p) => p.items.map((i) => sentenceToCard(i, `${s.label} · ${p.label}`)),
    ));
  }
  return cached;
}

/* 오늘 큐가 고를 수 있는 것 전부 — [{ id, kind }].
 * 큐를 짜는 쪽은 카드 알맹이가 필요 없고 id와 종류만 있으면 된다. */
export function dailyPool(words, sentences, {
  levels = null, seen = null, includeUnleveled = true,
} = {}) {
  /* ★ 레벨 설정은 문장에도 걸린다 ★
   *
   * 여태 단어만 걸러졌다. N5만 켠 사람은 단어 후보가 534개로 줄었는데 문장은
   * 600개가 그대로 남아서, 고르지도 않은 범위의 문장이 새 학습에 섞였다.
   *
   * 다만 「이미 배운 문장」은 안 뺀다. 레벨을 좁혔다고 어제 외운 문장이
   * 복습에서 조용히 사라지면, 외운 게 새어 나가는 걸 설정 하나로 만드는
   * 셈이다. 새로 배정하는 것만 막고, 배운 것은 계속 복습한다.
   *
   * 미분류 문장은 어떻게 하나. 레벨을 모르니 거를 수도 없다.
   *
   *   빼면  — 지금 자료에는 레벨이 하나도 안 적혀 있어서 문장이 통째로
   *           사라진다. 문제를 기능을 없애서 푸는 것이다
   *   넣으면 — 「N5만 골랐는데 왜 이게 나오나」가 남는다
   *
   * 기본은 넣는 쪽이다. 대신 미분류라고 말하고, 빼고 싶으면 뺄 수 있게 한다
   * (설정의 sentenceScope). 자료에 레벨이 붙는 날 이 갈림길은 없어진다. */
  const want = levels?.length ? new Set(levels) : null;
  const known = seen instanceof Set ? seen : null;
  const fits = (c) => {
    if (!want) return true;
    if (known?.has(c.id)) return true;      // 배운 것은 범위 밖이어도 복습한다
    if (c.level == null) return includeUnleveled;
    return want.has(c.level);
  };
  return [
    ...words.map((w) => ({ id: w.id, kind: 'word' })),
    ...sentences.filter(fits).map((s) => ({ id: s.id, kind: 'sentence' })),
  ];
}

/* 큐(id 목록)를 실제 카드로 바꾼다. 없는 id는 조용히 버린다 —
 * 자료가 바뀌어 사라진 카드가 큐에 남아 있으면 화면이 빈 카드를 그린다. */
export function cardsForQueue(queue, words, sentences) {
  const byId = new Map();
  for (const w of words) byId.set(w.id, w);
  for (const s of sentences) byId.set(s.id, s);
  return queue.map((q) => byId.get(q.id)).filter(Boolean);
}
