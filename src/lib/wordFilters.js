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


/* ★ 새 낱말이 모자라면 다음 레벨까지 ★ (2026-11-16)
 * 고른 레벨에 한 번도 안 본 낱말이 min개보다 적으면 다음 레벨(N5 → N4 → N3)을 하나씩 더해 돌려준다.
 * 레벨을 안 골랐으면(전체) 그대로. 고른 레벨은 빼지 않는다 — 더하기만 한다. */
const LEVEL_ORDER = ['N5', 'N4', 'N3'];
export function levelsForFresh(words, levels, review = {}, min = 20, seenElsewhere = null) {
  if (!levels?.length) return levels;
  const out = [...levels];
  const unseen = (lv) => filterByLevel(words, lv).filter((w) => !review?.[w.id]?.lastSeen && !seenElsewhere?.[w.id]).length;
  let count = unseen(out);
  for (const lv of LEVEL_ORDER) {
    if (count >= min) break;
    if (out.includes(lv)) continue;
    out.push(lv);
    count = unseen(out);
  }
  return out;
}

/* ★ 이미 단어장에 있는 낱말인가 ★ (2026-11-17)
 * AI 검색 · 번역 · 직접 추가로 담을 때, 기본 단어장(3천7백여 개)이나 전에 담은 것과 겹치면 다시 담지 않는다.
 * 전에는 id(custom-ask-…)만 봐서, 기본 단어장에 있는 地下鉄를 담으면 같은 카드가 하나 더 생겼고
 * 전에 담은 것을 또 눌러도 「담았어요」라고 했다.
 *   - 한자가 있으면 표기(kanji)로 견준다 — 읽기가 같은 다른 낱말(橋 · 箸)을 같은 것으로 보면 안 된다
 *   - 가나로만 쓴 것이면 가나로만 쓴 낱말과 견준다(ありがとう). 雨(あめ)와 あめ(사탕)는 다른 낱말일 수 있다 */
const norm = (s) => String(s ?? '').replace(/[\s〜~]/g, '').trim();
const hasKanji = (s) => /[一-鿿々]/.test(s);
export function findSameWord(words = [], { kanji, jp, kana } = {}) {
  const k = norm(kanji ?? jp);
  if (!k) return null;
  if (hasKanji(k)) return words.find((w) => norm(w.kanji) === k) || null;
  return words.find((w) => norm(w.kanji) === k || (!hasKanji(w.kanji || '') && norm(w.kana) === k)) || null;
}
