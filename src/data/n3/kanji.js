/* N3 한자 — 쉰 레슨, 열 자씩(500자).
 *
 * 앞 서른 과(a·b)는 주제별로 고른 300자, 뒤 스무 과(c·d)는 흔히 쓰는 N3 한자
 * 목록에서 앞 300에 없던 것을 채운 200자 — 그래서 표준 N3 목록을 다 덮는다.
 * 한자 하나의 회독 id는 `k:漢`(글자 그대로). 레슨 id는 `k:1`…`k:50`.
 * 한자 문제(읽기·뜻·단어 읽기)는 lib/n3.js가 여기 자료로 만든다. */
import { KANJI_A } from './kanji-a.js';
import { KANJI_B } from './kanji-b.js';
import { KANJI_C } from './kanji-c.js';
import { KANJI_D } from './kanji-d.js';

export const KANJI_LESSONS = [...KANJI_A, ...KANJI_B, ...KANJI_C, ...KANJI_D].map((l) => ({
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
