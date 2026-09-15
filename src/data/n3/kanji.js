/* N3 한자 — 서른 레슨, 열 자씩.
 *
 * 한자 하나의 회독 id는 `k:漢`(글자 그대로). 레슨 id는 `k:1`…`k:30`.
 * 한자 문제(읽기·뜻·단어 읽기)는 lib/n3.js가 여기 자료로 만든다. */
import { KANJI_A } from './kanji-a.js';
import { KANJI_B } from './kanji-b.js';

export const KANJI_LESSONS = [...KANJI_A, ...KANJI_B].map((l) => ({
  ...l,
  kanji: l.kanji.map((k) => ({ ...k, id: `k:${k.k}`, lessonId: l.id })),
}));

export const KANJI_ITEMS = KANJI_LESSONS.flatMap((l) => l.kanji);

const byChar = new Map(KANJI_ITEMS.map((k) => [k.k, k]));
export const kanjiByChar = (ch) => byChar.get(ch) || null;

const lessonById = new Map(KANJI_LESSONS.map((l) => [l.id, l]));
export const kanjiLessonById = (id) => lessonById.get(id) || null;

/* 어떤 낱말 안에 이 코스의 한자가 몇 개 들었나 — 단어 카드의 「관련 한자」칸. */
export function kanjiIn(text) {
  const out = [];
  for (const ch of String(text || '')) {
    const k = byChar.get(ch);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}
