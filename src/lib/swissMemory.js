import {
  VERDICT, applyVerdict, daysBetween, isDue, stateOf, todayKey, MASTER_STREAK,
} from './review.js';
import { difficultyOf } from './stream.js';
import { SWISS_ITEMS, SWISS_LESSONS } from '../data/swiss.js';

/* 독일어 기억 — 낱말마다 「언제 다시 볼까」를 적어 둔다.
 *
 * 독일어 코스는 레슨을 한 번 끝내면 그걸로 끝이었다. 틀린 것이 약점 주머니에 들어갈 뿐, 일주일 뒤에
 * 그 낱말을 기억하는지 확인해 주는 곳이 없었다 — 외우는 앱인데 외웠는지를 안 본다. 일본어 회독이
 * 쓰는 복습 규칙(review.js)을 그대로 쓰되, 기록은 독일어 진도 안(progress.mem)에 따로 적는다.
 * 일본어 회독·오늘 계획·통계에는 안 섞인다.
 *
 * 규칙은 일본어와 같다 — 맞히면 알아요, 틀리면 몰라요. 복습일이 된 것을 맞혀야 기억 단계가 한 칸 오르고
 * (하루 한 칸), 틀리면 오늘 다시 나온다. 미리 연습한 것으로는 단계가 안 오른다.
 *
 * ★ 이미 쌓인 진도를 버리지 않는다 ★
 * 전에 끝낸 레슨의 낱말은 기억 기록이 없다. seedMemory가 그 낱말을 「그 레슨을 끝낸 날 맞힌 것」으로
 * 채우고, 약점 주머니에 있던 것은 「몰라요」로 채운다. 그러면 복습이 처음부터 쓸모 있다. */

const BY_ID = new Map(SWISS_ITEMS.map((it) => [it.id, it]));
export const itemById = (id) => BY_ID.get(id) || null;

export const MEMORY_STAGES = [
  { id: 'learning', label: '익히는 중' },
  { id: 'known', label: '거의 외움' },
  { id: 'mastered', label: '외웠어요' },
];

/* 낱말 하나가 어느 단계인가. 기억 기록이 없거나 본 적이 없으면 null(아직 안 배움). */
export function stageOf(st) {
  if (!st || !st.lastSeen) return null;
  if ((st.level || 0) >= MASTER_STREAK) return 'mastered';
  if ((st.level || 0) >= 2) return 'known';
  return 'learning';
}

export const memoryOf = (progress) => (progress && typeof progress.mem === 'object' && progress.mem) || {};

const dayOf = (ms) => (Number.isFinite(ms) && ms > 0 ? todayKey(new Date(ms)) : todayKey());

/* 끝낸 레슨의 낱말에 기억 기록이 없으면 채운다. 이미 있으면 건드리지 않는다(여러 번 불러도 같다). */
export function seedMemory(progress, today = todayKey()) {
  const mem = { ...memoryOf(progress) };
  let changed = false;
  const weak = new Set(progress?.weak || []);
  for (const lesson of SWISS_LESSONS) {
    const done = progress?.lessons?.[lesson.id];
    if (!done || (done.stars || 0) < 1) continue;
    for (const it of lesson.items) {
      if (mem[it.id]) continue;
      const day = dayOf(done.at);
      mem[it.id] = weak.has(it.id)
        ? applyVerdict(undefined, VERDICT.UNKNOWN, today)           // 틀렸던 것은 오늘 다시
        : applyVerdict(undefined, VERDICT.KNOWN, day);              // 끝낸 날 맞힌 것으로
      changed = true;
    }
  }
  return changed ? { ...progress, mem } : progress;
}

/* 이번에 낸 문제들의 결과를 기억에 적는다. results: { 낱말id: 맞았나 } — 한 낱말의 첫 대답만 담아 온다.
   틀린 뒤 곧바로 맞혔다고 「몰라요」가 지워지면 안 되고, 틀릴 때마다 쌓이면 약점이 부푼다. */
export function recordResults(progress, results = {}, { today = todayKey(), at = Date.now() } = {}) {
  const base = seedMemory(progress, today);
  const mem = { ...memoryOf(base) };
  let changed = false;
  for (const [id, ok] of Object.entries(results)) {
    if (!BY_ID.has(id)) continue;
    mem[id] = applyVerdict(mem[id], ok ? VERDICT.KNOWN : VERDICT.UNKNOWN, today, at);
    changed = true;
  }
  return changed ? { ...base, mem } : base;
}

/* 복습일이 된 낱말 — 오래 밀린 것, 어려운 것부터 */
export function dueIds(progress, today = todayKey()) {
  const mem = memoryOf(seedMemory(progress, today));
  return Object.keys(mem)
    .filter((id) => BY_ID.has(id) && isDue(stateOf(mem, id), today))
    .sort((a, b) => priority(mem, b, today) - priority(mem, a, today));
}

/* 미리 복습할 낱말 — 아직 복습일은 아니지만 단단하지 않은 것(약한 것부터) */
export function preReviewIds(progress, today = todayKey()) {
  const mem = memoryOf(seedMemory(progress, today));
  const due = new Set(dueIds(progress, today));
  return Object.keys(mem)
    .filter((id) => BY_ID.has(id) && !due.has(id) && mem[id].lastSeen)
    .sort((a, b) => priority(mem, b, today) - priority(mem, a, today));
}

function priority(mem, id, today) {
  const st = stateOf(mem, id);
  const late = st.due ? Math.max(0, daysBetween(st.due, today)) : 0;
  return late * 2 + difficultyOf(st, null, today);
}

/* 허브에 보여 줄 요약 */
export function memorySummary(progress, today = todayKey()) {
  const seeded = seedMemory(progress, today);
  const mem = memoryOf(seeded);
  const stages = { learning: 0, known: 0, mastered: 0 };
  let seen = 0;
  for (const id of Object.keys(mem)) {
    if (!BY_ID.has(id)) continue;
    const s = stageOf(mem[id]);
    if (!s) continue;
    seen += 1;
    stages[s] += 1;
  }
  return { total: SWISS_ITEMS.length, seen, unseen: SWISS_ITEMS.length - seen, stages, due: dueIds(seeded, today).length };
}

/* 기기 두 대의 기억을 합친다 — 낱말마다 나중에 만진 쪽(seenAt)을 따른다 */
export function mergeMemory(a, b) {
  const x = memoryOf({ mem: a }); const y = memoryOf({ mem: b });
  const out = {};
  for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const l = x[id]; const r = y[id];
    out[id] = !l ? r : !r ? l : ((l.seenAt || 0) >= (r.seenAt || 0) ? l : r);
  }
  return out;
}
