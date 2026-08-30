/* 일상문법 빈칸 채우기 — 규칙.
 *
 * 부사 연습과 다른 점이 하나 있다. 부사는 단어장에 카드가 있어서 틀리면
 * 회독으로 올릴 데가 있었다. 조사와 문형은 카드가 없다 — 「を」를 카드로
 * 만들 수는 없고, 만들어도 회독으로 외울 것이 아니다.
 *
 * 그래서 여기는 진도를 따로 적는다. 묶음마다 마지막에 몇 개 맞혔는지만
 * 남긴다. 회독 저장소는 안 건드린다 — 거기 없는 것을 억지로 밀어 넣으면
 * 「오늘의 학습」에 카드도 없는 항목이 뜬다. */

import { DAILY_GRAMMAR_SETS, ALL_DAILY_GRAMMAR } from '../data/grammar-daily.js';
import {
  BLANK, buildSetFrom, filled, filledKana, retryOf, scoreOf, splitBlank,
} from './blank.js';

export { BLANK, DAILY_GRAMMAR_SETS, ALL_DAILY_GRAMMAR };
export {
  splitBlank, filled, filledKana, retryOf, scoreOf,
};

export function buildSet(setId, opts) {
  return buildSetFrom(DAILY_GRAMMAR_SETS, setId, opts);
}

/* 한 판을 끝내면 남길 것. 더 잘한 판만 남긴다 —
   두 번째에 못 봤다고 처음 잘한 게 지워지면 진도가 뒤로 간다. */
export function recordOf(prev = {}, setId, score, at) {
  const old = prev[setId];
  if (old && old.right >= score.right) return prev;
  return { ...prev, [setId]: { right: score.right, total: score.total, at } };
}

/* 묶음마다 얼마나 했는지 */
export function setStats(done = {}) {
  return DAILY_GRAMMAR_SETS.map((s) => {
    const rec = done[s.id];
    return {
      id: s.id,
      label: s.label,
      sub: s.sub,
      intro: s.intro,
      total: s.items.length,
      right: rec?.right || 0,
      cleared: Boolean(rec && rec.right === s.items.length),
    };
  });
}
