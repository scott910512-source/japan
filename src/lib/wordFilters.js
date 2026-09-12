export const LEVELS = ['N5', 'N4', 'N3'];

// 레벨 필터. 고른 게 없으면 전체를 쓴다 — 빈 덱으로 들어가는 일이 없게.
export function filterByLevel(words, levels) {
  if (!levels?.length) return words;
  const set = new Set(levels);
  return words.filter((w) => set.has(w.level) || (!w.level && set.has('N5')));
}

