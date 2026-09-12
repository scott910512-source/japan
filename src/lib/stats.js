/* 일별 활동 집계 — 「몇 번 눌렀나」.
 *
 * 이건 「무엇을 끝냈나」(plan.js)와 다른 숫자다. 한 카드를 세 번 만나면
 * 여기는 3이 오르고 계획의 완료는 1이 오른다. 둘은 다른 이름으로 불려야 한다.
 *
 * ★ 규칙이 두 군데 흩어져 있었다 ★
 *
 * 회독 판정과 실전 연습이 각자 이 계산을 손으로 적어 두고 있었고, 그래서
 * 서로 달라졌다.
 *
 *   · 회독 쪽은 되돌리기에서 아무것도 빼지 않았다. 잘못 눌러 되돌리고 다시
 *     누르면 카드 하나를 한 번 판정했는데 활동이 둘로 셌다.
 *   · 실전 쪽은 studied·vague·unknown만 올리고 known을 안 올렸다. 실전에서
 *     맞힌 것은 어느 칸에도 안 남았다.
 *
 * 그래서 세는 자리를 하나로 모은다. 올리는 것과 내리는 것이 같은 표를 보면
 * 판정 → 되돌리기 → 재판정에서 숫자가 제자리로 돌아온다. */

export const EMPTY_DAY = { studied: 0, known: 0, vague: 0, unknown: 0 };

/* 「알아요」와 「이미 알아요」는 둘 다 안다는 쪽으로 센다.
   기억 단계에서는 구별하지만(review.js의 selfKnown), 활동 집계는
   「눌렀다」를 세는 곳이라 여기서는 같이 둔다. */
const KNOWN = new Set(['known', 'master']);

/* 판정 목록을 칸별 수로. 빈 판정(되돌리기에서 넘어오는 null 등)은 안 센다. */
export function tallyVerdicts(list) {
  const out = { ...EMPTY_DAY };
  for (const v of list || []) {
    if (!v) continue;
    out.studied += 1;
    if (KNOWN.has(v)) out.known += 1;
    else if (v === 'vague') out.vague += 1;
    else if (v === 'unknown') out.unknown += 1;
  }
  return out;
}

/* 그 날 칸에 더한다. */
export function addToDay(stats, day, list) {
  const t = tallyVerdicts(list);
  if (!t.studied) return stats;
  const cur = stats?.[day] || EMPTY_DAY;
  return {
    ...stats,
    [day]: {
      ...cur,
      studied: (cur.studied || 0) + t.studied,
      known: (cur.known || 0) + t.known,
      vague: (cur.vague || 0) + t.vague,
      unknown: (cur.unknown || 0) + t.unknown,
    },
  };
}

/* ── 판정이 아닌 활동 ──
 *
 * 듣기와 시험은 회독 진도를 바로 올리지 않는다. 그 판단은 그대로 둔다 —
 * 들으면서 흘려보낸 것과 떠올려서 맞힌 것은 다른 일이다.
 *
 * 그런데 아무 데도 안 남으니 한 시간 듣고도 기록이 그대로였다. 노력한 내역은
 * 보여야 한다. 기억 단계와 섞지 않고 활동 칸에만 적는다.
 *
 * 칸 이름을 늘려도 동기화가 견딘다 — mergeStats가 양쪽에 있는 칸을 다 훑는다. */
export function noteActivity(stats, day, patch = {}) {
  const add = Object.entries(patch).filter(([, v]) => Number(v) > 0);
  if (!add.length) return stats;
  const cur = stats?.[day] || EMPTY_DAY;
  const next = { ...cur };
  for (const [k, v] of add) next[k] = (Number(next[k]) || 0) + Number(v);
  return { ...stats, [day]: next };
}

/* 그 날 칸에서 뺀다.
 *
 * 0 아래로는 안 내려간다. 이 집계는 60일만 남기고 기기 두 대에서 합쳐지기도
 * 해서, 올린 적 없는 것을 빼라는 요청이 들어올 수 있다 — 그때 음수가 남으면
 * 그 뒤로 모든 합이 틀어진다. 없는 날은 그대로 둔다. */
export function removeFromDay(stats, day, list) {
  const t = tallyVerdicts(list);
  if (!t.studied) return stats;
  const cur = stats?.[day];
  if (!cur) return stats;
  const off = (n, k) => Math.max(0, (n || 0) - k);
  return {
    ...stats,
    [day]: {
      ...cur,
      studied: off(cur.studied, t.studied),
      known: off(cur.known, t.known),
      vague: off(cur.vague, t.vague),
      unknown: off(cur.unknown, t.unknown),
    },
  };
}
