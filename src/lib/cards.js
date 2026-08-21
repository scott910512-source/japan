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
    level: item.star === 3 ? 'N5' : 'N4',
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
export function dailyPool(words, sentences) {
  return [
    ...words.map((w) => ({ id: w.id, kind: 'word' })),
    ...sentences.map((s) => ({ id: s.id, kind: 'sentence' })),
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
