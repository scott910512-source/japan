import { SITUATIONS } from './situations.js';
import { MOVE_EXTRA } from './situations-extra-move.js';
import { FOOD_EXTRA } from './situations-extra-food.js';
import { DAILY_EXTRA } from './situations-extra-daily.js';

/* 파트별 문장을 기본분 + 추가분으로 합친다.
 *
 * 추가분을 situations.js에 직접 밀어 넣지 않고 파일을 나눠 둔 이유는,
 * 나중에 또 늘릴 때 기존 문장을 건드리지 않고 파일만 하나 더 붙이면 되기 때문이다.
 * 학습 기록은 문장 id에 붙으므로 기존 id의 순서·내용이 유지되는 게 중요하다. */
const EXTRA_BY_SITUATION = {
  move: MOVE_EXTRA,
  food: FOOD_EXTRA,
  daily: DAILY_EXTRA,
};

export const ALL_SITUATIONS = SITUATIONS.map((situation) => {
  const extra = EXTRA_BY_SITUATION[situation.id] || {};
  return {
    ...situation,
    parts: situation.parts.map((part) => {
      const added = extra[part.id] || [];
      return added.length ? { ...part, items: [...part.items, ...added] } : part;
    }),
  };
});
