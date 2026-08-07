import { MOVE_CHUNKS } from './chunks-move.js';
import { FOOD_CHUNKS } from './chunks-food.js';
import { DAILY_CHUNKS } from './chunks-daily.js';

/* 문장을 의미 단위로 끊은 조각들. 문장 조립 퀴즈에서 쓴다.
 *
 * 조각이 3개 미만인 짧은 문장(すみません 같은 것)은 애초에 담기지 않았다.
 * 퀴즈로 낼 수 없어서다 — 화면에서는 chunksOf()가 null을 주는지로 판단한다. */
export const ALL_CHUNKS = { ...MOVE_CHUNKS, ...FOOD_CHUNKS, ...DAILY_CHUNKS };

export function chunksOf(sentenceId) {
  const chunks = ALL_CHUNKS[sentenceId];
  return chunks && chunks.length >= 3 ? chunks : null;
}

export function hasChunks(sentenceId) {
  return chunksOf(sentenceId) != null;
}
