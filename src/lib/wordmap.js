/* 전체 단어 지도 — 모든 낱말을 한 칸씩, 지금 기억 상태로 칠한다(기록 화면).
 *
 * ★ 상태 = 기록 화면 「기억 수준」과 같은 셈 ★ (2026-11-17 QA B09)
 *   전에는 지도가 따로 셌다(처음 봄 / 확인 1 / … / 약점을 한 칸으로). 그래서 같은 「확인 1단계」가
 *   지도에서는 21, 기억 수준 막대에서는 23으로 갈렸고, 「만남」도 시험에서만 틀린 낱말까지 세서
 *   홈의 「본 단어」와 달랐다. 이제 단계는 rounds.js stageOf 하나로 정한다 — 이름도 STAGES 그대로.
 *   약점은 단계가 아니라 덧칠이다(weak: true). 약점인 칸도 자기 단계 개수에 그대로 들어간다.
 *
 * ★ 순서 ★ 레벨(N5 → N4 → N3 → 그 밖) 안에서 기출에 나온 낱말 먼저, 그다음 자료 차례 — 새로 배우기가 고르는 차례와 같다.
 *   그래서 왼쪽 위부터 채워져 가는 모양이 곧 진도다. */
import { MASTER_STREAK } from './review.js';
import { errorSignals, weakEntry } from './weak.js';
import { WEAK_THRESHOLD } from './daily.js';
import { STAGES, stageOf } from './rounds.js';

/* 단계 순서는 STAGES 그대로(아직 안 봄 → 확인 1~3 → 익숙함 → 장기복습 → 이미 알아요) */
export const MAP_STATES = STAGES.map((s) => ({ id: s.id, label: s.label }));
export const MAP_LEVELS = ['N5', 'N4', 'N3'];

export function cellState(st) {
  return stageOf(st);
}

/* 약점 덧칠 — 몰라요 · 애매해요 · 시험 오답이 쌓였고 아직 외우지 않은 것(약점 화면과 같은 문턱) */
export function cellWeak(st, rec) {
  if (st?.selfKnown) return false;
  if ((st?.level || 0) >= MASTER_STREAK) return false;
  return errorSignals(st || {}, rec) >= WEAK_THRESHOLD;
}

/* 문법 카드(grammar: true)는 레벨 묶음이 아니라 「문법」 묶음으로 따로 */
const levelOf = (w, byLevel = false) => (w.grammar && !byLevel ? '문법' : MAP_LEVELS.includes(String(w.level).toUpperCase()) ? String(w.level).toUpperCase() : '기타');

/* 레벨별 묶음: [{ level, cells: [{ id, jp, kana, mean, state }], counts: { 상태: 개수 } }] */
/* grammarByLevel: 문법 카드만 넘겨 N5 · N4 · N3으로 나눌 때(문법 지도) */
export function buildWordMap(words = [], review = {}, ledger = null, { first = null, grammarByLevel = false } = {}) {
  const groups = new Map([...MAP_LEVELS, '문법', '기타'].map((lv) => [lv, []]));
  words.forEach((w, i) => {
    if (!w?.id) return;
    const rec = ledger?.[w.id] ? weakEntry(ledger, w.id) : null;
    groups.get(levelOf(w, grammarByLevel)).push({
      id: w.id, jp: w.kanji || w.kana || '', kana: w.kana || '', mean: w.mean || '',
      state: cellState(review?.[w.id]),
      weak: cellWeak(review?.[w.id], rec),
      seen: Boolean(review?.[w.id]?.lastSeen),
      order: (first?.has?.(w.id) ? 0 : 1e6) + i,
    });
  });
  const out = [];
  for (const [level, cells] of groups) {
    if (!cells.length) continue;
    cells.sort((a, b) => a.order - b.order);
    const counts = Object.fromEntries([...MAP_STATES.map((s) => [s.id, 0]), ['weak', 0], ['seen', 0]]);
    for (const c of cells) {
      counts[c.state] += 1;
      if (c.weak) counts.weak += 1;
      if (c.seen) counts.seen += 1;
    }
    out.push({ level, cells, counts });
  }
  return out;
}

/* 모든 레벨을 더한 개수 */
export function totalCounts(groups) {
  const t = Object.fromEntries([...MAP_STATES.map((s) => [s.id, 0]), ['weak', 0], ['seen', 0]]);
  for (const g of groups) for (const k of Object.keys(t)) t[k] += g.counts[k] || 0;
  return t;
}
