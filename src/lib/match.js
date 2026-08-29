/* 짝 맞추기 — 게임으로 외우기.
 *
 * 회독은 한 장씩 판정하는 일이라 느리고 진지하다. 그게 맞는 방식이지만
 * 매일 그것만 하면 안 하게 되는 날이 온다. 같은 자료로 짧게 치고 빠지는
 * 판을 하나 둔다 — 왼쪽과 오른쪽에서 짝을 찾는 것뿐이라 규칙 설명이 필요 없다.
 *
 * 두 가지 판.
 *   글자판  왼쪽 일본어  ↔  오른쪽 뜻
 *   소리판  왼쪽 소리    ↔  오른쪽 일본어   (누르면 소리만 난다)
 *
 * 회독 기록은 건드리지 않는다. 짝 맞추기는 네 개 중에 고르는 일이라 떠올리는
 * 것보다 훨씬 쉽다 — 여기서 맞혔다고 「알아요」로 세면 복습 간격이 실제
 * 실력보다 빨리 벌어지고, 그러면 회독이 못 미더워진다. 게임은 게임으로 둔다. */

import { stateOf, isWeak, shuffled } from './review.js';

export const MODE = { TEXT: 'text', SOUND: 'sound' };

export const MODE_LABEL = {
  [MODE.TEXT]: '글자로',
  [MODE.SOUND]: '소리로',
};

export const MODE_HINT = {
  [MODE.TEXT]: '일본어와 뜻을 짝지어요',
  [MODE.SOUND]: '소리를 듣고 맞는 일본어를 찾아요',
};

/* 한 판에 몇 쌍. 다섯 쌍이면 열 칸이라 한 화면에 들어가고,
   기억에 담아 두기에도 딱 그쯤이 넘치지 않는다. */
export const PAIRS = 5;

/* 짝 맞추기에 쓸 수 있는 카드인가.
 *
 * 문장은 뺀다. 「切符はどこで買えますか。」를 작은 칸에 넣으면 글자가 뭉개지고,
 * 짝을 찾는 게 아니라 긴 글 두 개를 비교하는 일이 된다. 짧은 것만 남긴다. */
export function usable(card, mode = MODE.TEXT) {
  if (!card?.id || !card.kanji || !card.mean) return false;
  if (card.kind === 'sentence') return false;
  if (card.kanji.length > 6) return false;
  if (mode === MODE.SOUND && !(card.kana || card.kanji)) return false;
  return true;
}

/* 뜻이 「다투다;경쟁하다」처럼 여러 개 붙어 있다. 칸에는 첫 뜻만 쓴다 —
   전부 쓰면 칸을 넘고, 어차피 하나만 맞으면 되는 문제다. */
export function shortMean(card) {
  return String(card.mean || '').split(/[;,/]/)[0].trim();
}

/* 판을 짠다.
 *
 * 뽑는 차례: 약점 → 오늘 볼 것 → 나머지. 게임이라고 아무거나 내면 이미 아는
 * 것만 스치고 지나간다. 그렇다고 약점만 다섯 개면 한 판이 다 막히니,
 * 약점은 절반까지만 넣는다. */
export function buildBoard(cards, review, { mode = MODE.TEXT, pairs = PAIRS, exclude = [] } = {}) {
  const skip = new Set(exclude);
  const pool = cards.filter((c) => usable(c, mode) && !skip.has(c.id));
  if (pool.length < 2) return null;

  const weak = shuffled(pool.filter((c) => isWeak(stateOf(review, c.id))));
  const seen = shuffled(pool.filter((c) => stateOf(review, c.id).lastSeen && !isWeak(stateOf(review, c.id))));
  const rest = shuffled(pool.filter((c) => !stateOf(review, c.id).lastSeen));

  const want = Math.min(pairs, pool.length);
  const picked = [];
  const take = (list, n) => { while (picked.length < want && n-- > 0 && list.length) picked.push(list.shift()); };
  take(weak, Math.ceil(want / 2));
  take(seen, want);
  take(rest, want);
  take(weak, want);          // 약점밖에 없으면 그거라도 채운다

  /* 뜻이 같은 게 두 개 들어오면 어느 쪽에 붙여도 맞는 짝이 생긴다.
     화면은 하나만 정답으로 치니, 맞는데 틀렸다고 나온다. */
  const byMean = new Set();
  const clean = [];
  for (const c of picked) {
    const key = mode === MODE.SOUND ? (c.kana || c.kanji) : shortMean(c);
    if (byMean.has(key)) continue;
    byMean.add(key);
    clean.push(c);
  }
  if (clean.length < 2) return null;

  return {
    mode,
    pairs: clean.map((c) => ({
      id: c.id,
      jp: c.kanji,
      kana: c.kana || c.kanji,
      mean: shortMean(c),
    })),
    left: shuffled(clean.map((c) => c.id)),
    right: shuffled(clean.map((c) => c.id)),
  };
}

/* 점수. 시간을 재긴 하지만 앞세우지는 않는다 —
   빨리 누르는 놀이가 되면 외우는 것과 멀어진다. */
export function scoreOf({ pairs, misses, seconds }) {
  const base = pairs * 100;
  const penalty = Math.min(base - pairs * 20, misses * 30);
  const speed = seconds > 0 ? Math.max(0, Math.round((pairs * 6 - seconds) * 5)) : 0;
  return Math.max(pairs * 20, base - penalty + speed);
}

/* 한 판이 끝났을 때 한 줄 평. 숫자만 내놓으면 잘한 건지 모른다. */
export function verdictOf({ pairs, misses }) {
  if (misses === 0) return '한 번도 안 틀렸어요';
  if (misses <= Math.ceil(pairs / 2)) return '거의 다 맞혔어요';
  return '틀린 건 회독에서 다시 만나요';
}
