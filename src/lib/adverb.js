/* 부사 빈칸 채우기 — 규칙.
 *
 * 뜻을 아는 것과 자리에 넣는 것은 다른 일이다. 「あまり = 별로」를 외운
 * 사람이 「あまりわかります」라고 쓴다 — 부사는 뒤에 뭐가 오는지가 절반이라
 * 카드로는 안 배워진다.
 *
 * 여기서도 숙련도를 새로 만들지 않는다. 부사는 이미 단어장에 카드로 있으니
 * 회독 저장소의 그 카드에 붙인다 — 실전 연습과 같은 방식이다. 그래야
 * 여기서 틀린 「あまり」가 다음 날 오늘의 학습에 약점으로 올라온다. */

import { ADVERB_SETS, ALL_ADVERB_ITEMS, BLANK } from '../data/adverbs.js';
import { shuffled, stateOf, isWeak, VERDICT } from './review.js';

export { BLANK, ADVERB_SETS, ALL_ADVERB_ITEMS };

/* 빈칸을 앞뒤로 쪼갠다. 화면이 「앞 [칸] 뒤」로 그린다 —
   문장을 통째로 두고 밑줄만 치면 어디가 빈칸인지 눈에 안 들어온다. */
export function splitBlank(text) {
  const at = String(text || '').indexOf(BLANK);
  if (at < 0) return { head: String(text || ''), tail: '' };
  return { head: text.slice(0, at), tail: text.slice(at + BLANK.length) };
}

/* 답을 넣은 완성 문장. 맞힌 뒤에 보여 준다 — 빈칸인 채로 넘어가면
   방금 배운 문장이 머리에 통째로 안 남는다. */
export function filled(item) {
  return String(item.jp || '').replace(BLANK, item.answer);
}
export function filledKana(item) {
  return String(item.kana || '').replace(BLANK, item.answer);
}

/* 이 부사가 단어장의 어느 카드인가.
 *
 * id를 자료에 박아 두지 않고 읽는 법으로 찾는다. 부사 카드 id는 파일이
 * 합쳐지면서 바뀔 수 있고(같은 말이 여러 파일에 있으면 낮은 레벨 쪽 id가
 * 남는다), 박아 두면 그때 조용히 연결이 끊긴다. */
export function cardOf(words, kana) {
  return words.find((w) => w.kana === kana && w.type === 'adv')
    || words.find((w) => w.kana === kana)
    || null;
}

/* 한 판을 짠다.
 *
 * 묶음 하나를 통째로 돈다. 부정 호응을 배우는 중에 시간 부사가 섞여 나오면
 * 무엇을 배우는 판인지 흐려진다.
 *
 * 보기 순서는 섞되 문제 순서는 안 섞는다 — 자료를 쉬운 것부터 적어 뒀다. */
export function buildSet(setId, { shuffle = true } = {}) {
  const set = ADVERB_SETS.find((s) => s.id === setId);
  if (!set) return [];
  return set.items.map((it) => ({
    ...it,
    options: shuffle ? shuffled(it.options) : [...it.options],
  }));
}

/* 틀린 것만 다시. 같은 판 안에서 두 번째로 만나는 자리다 —
   틀린 채로 넘어가면 그 부사는 오늘 배운 게 없다. */
export function retryOf(items, wrongIds) {
  const set = new Set(wrongIds);
  return items.filter((it) => set.has(it.id)).map((it) => ({
    ...it,
    options: shuffled(it.options),
  }));
}

/* 몇 개 맞혔나 */
export function scoreOf(answers, items) {
  const right = items.filter((it) => answers[it.id]?.good).length;
  return { right, total: items.length, rate: items.length ? right / items.length : 0 };
}

/* 회독으로 넘길 판정.
 *
 * 맞힌 것은 안 올린다. 셋 중에 고르는 건 알아본 것이지 떠올린 게 아니다 —
 * 그걸 「알아요」로 세면 복습 간격이 실력보다 빨리 벌어진다. 실전 연습에서
 * 정한 것과 같은 규칙이다.
 *
 * 틀린 것만 「몰라요」로 올린다. 그게 이 화면이 회독에 보태는 값이다. */
export function verdictsFrom(answers, items, words) {
  const out = {};
  for (const it of items) {
    const a = answers[it.id];
    if (!a || a.good) continue;
    const card = cardOf(words, it.answer);
    if (card) out[card.id] = VERDICT.UNKNOWN;
  }
  return out;
}

/* 묶음마다 얼마나 했는지. 진도가 안 보이면 어디까지 했는지 매번 다시 센다. */
export function setStats(words, review) {
  return ADVERB_SETS.map((s) => {
    const cards = s.items.map((it) => cardOf(words, it.answer)).filter(Boolean);
    const seen = cards.filter((c) => stateOf(review, c.id).lastSeen).length;
    const weak = cards.filter((c) => isWeak(stateOf(review, c.id))).length;
    return { id: s.id, label: s.label, sub: s.sub, total: s.items.length, seen, weak };
  });
}
