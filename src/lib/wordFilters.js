export const LEVELS = ['N5', 'N4', 'N3'];

/* 레벨 필터. 고른 게 없으면 전체를 쓴다 — 빈 덱으로 들어가는 일이 없게.
 *
 * ★ 다섯 급수가 아닌 레벨은 어디에도 안 든다 ★
 *
 * 札幌·小樽·市電 같은 낱말은 JLPT 급수가 없다. 그런 것에는 다섯 급수가 아닌
 * 표시를 달아 두는데(data/words-sapporo.js의 NO_JLPT), 그러면 여기서 저절로
 * 빠진다 — set에 없고, level이 비어 있지도 않아서 N5로도 안 센다.
 *
 * 일부러 그렇게 둔 것이다. 급수 없는 낱말을 N5로 세면 「N5 어휘 534개」가
 * 늘어나고, 공부할 범위를 세는 숫자가 무슨 뜻인지 알 수 없게 된다. 그 낱말이
 * 필요한 화면(여행 듣기)은 후보 목록을 통째로 바꿔 끼워서 가져간다. */
export function filterByLevel(words, levels) {
  if (!levels?.length) return words;
  const set = new Set(levels);
  return words.filter((w) => set.has(w.level) || (!w.level && set.has('N5')));
}

