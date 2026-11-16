/* 전체 단어 지도 — 모든 낱말을 한 칸씩, 지금 기억 상태로 칠한다(기록 화면).
 *
 * ★ 상태 ★ (회독 기록 review + 약점 장부 ledger에서만 센다 — 따로 세는 숫자를 만들지 않는다)
 *   new     한 번도 안 봄
 *   seen    봤지만 아직 날짜를 두고 확인 전(level 0)
 *   weak    약점(몰라요 · 애매해요 · 시험 오답이 쌓였다)
 *   l1~l3   날짜를 두고 확인된 기억 1~3단계
 *   master  외웠다(level ≥ MASTER_STREAK)
 *
 * ★ 순서 ★ 레벨(N5 → N4 → N3 → 그 밖) 안에서 기출에 나온 낱말 먼저, 그다음 자료 차례 — 새로 배우기가 고르는 차례와 같다.
 *   그래서 왼쪽 위부터 채워져 가는 모양이 곧 진도다. */
import { MASTER_STREAK } from './review.js';
import { errorSignals, weakEntry } from './weak.js';
import { WEAK_THRESHOLD } from './daily.js';

export const MAP_STATES = [
  { id: 'new', label: '안 봄' },
  { id: 'seen', label: '처음 봄' },
  { id: 'weak', label: '약점' },
  { id: 'l1', label: '확인 1' },
  { id: 'l2', label: '확인 2' },
  { id: 'l3', label: '확인 3' },
  { id: 'master', label: '외움' },
];
export const MAP_LEVELS = ['N5', 'N4', 'N3'];

export function cellState(st, rec) {
  if (!st?.lastSeen) return rec && errorSignals(st || {}, rec) >= WEAK_THRESHOLD ? 'weak' : 'new';
  if (!st.selfKnown && errorSignals(st, rec) >= WEAK_THRESHOLD && (st.level || 0) < MASTER_STREAK) return 'weak';
  const lv = st.level || 0;
  if (lv >= MASTER_STREAK || st.selfKnown) return 'master';
  if (lv >= 3) return 'l3';
  if (lv === 2) return 'l2';
  if (lv === 1) return 'l1';
  return 'seen';
}

const levelOf = (w) => (MAP_LEVELS.includes(String(w.level).toUpperCase()) ? String(w.level).toUpperCase() : '기타');

/* 레벨별 묶음: [{ level, cells: [{ id, jp, kana, mean, state }], counts: { 상태: 개수 } }] */
export function buildWordMap(words = [], review = {}, ledger = null, { first = null } = {}) {
  const groups = new Map([...MAP_LEVELS, '기타'].map((lv) => [lv, []]));
  words.forEach((w, i) => {
    if (!w?.id) return;
    const rec = ledger?.[w.id] ? weakEntry(ledger, w.id) : null;
    groups.get(levelOf(w)).push({
      id: w.id, jp: w.kanji || w.kana || '', kana: w.kana || '', mean: w.mean || '',
      state: cellState(review?.[w.id], rec),
      order: (first?.has?.(w.id) ? 0 : 1e6) + i,
    });
  });
  const out = [];
  for (const [level, cells] of groups) {
    if (!cells.length) continue;
    cells.sort((a, b) => a.order - b.order);
    const counts = Object.fromEntries(MAP_STATES.map((s) => [s.id, 0]));
    for (const c of cells) counts[c.state] += 1;
    out.push({ level, cells, counts });
  }
  return out;
}

/* 모든 레벨을 더한 개수 */
export function totalCounts(groups) {
  const t = Object.fromEntries(MAP_STATES.map((s) => [s.id, 0]));
  for (const g of groups) for (const k of Object.keys(t)) t[k] += g.counts[k] || 0;
  return t;
}
