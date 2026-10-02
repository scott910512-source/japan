import { SITUATIONS } from './situations.js';
import { MOVE_EXTRA } from './situations-extra-move.js';
import { FOOD_EXTRA } from './situations-extra-food.js';
import { DAILY_EXTRA } from './situations-extra-daily.js';
/* 삿포로 벼락치기 — 한 묶음을 통째로 더한다. 기존 셋(이동·식당·일상)의
   파트에 끼워 넣는 추가분과 달리, 이건 상황 자체가 새것이다. */
import { SAPPORO_SITUATION } from './situations-sapporo.js';

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

const BASE = SITUATIONS.map((situation) => {
  const extra = EXTRA_BY_SITUATION[situation.id] || {};
  return {
    ...situation,
    parts: situation.parts.map((part) => {
      const added = extra[part.id] || [];
      return added.length ? { ...part, items: [...part.items, ...added] } : part;
    }),
  };
});

/* 삿포로는 맨 뒤에 붙인다. 앞에 끼우면 기존 세 묶음의 차례가 밀리는데,
   화면이 「두 번째 묶음」으로 기억해 둔 자리가 그만큼 어긋난다. */
export const ALL_SITUATIONS = [...BASE, SAPPORO_SITUATION];
