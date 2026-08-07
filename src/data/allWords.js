import { DEFAULT_WORDS } from './words.js';
import { N5_WORDS } from './words-n5.js';
import { N4_WORDS } from './words-n4.js';
import { N4_WORDS_B } from './words-n4b.js';
import { N3_WORDS } from './words-n3.js';
import { N3_WORDS_B } from './words-n3b.js';
import { N3_WORDS_C } from './words-n3c.js';
import { N3_WORDS_D } from './words-n3d.js';
import { N3_WORDS_E } from './words-n3e.js';
import { N3_WORDS_F } from './words-n3f.js';
import { N3_WORDS_G } from './words-n3g.js';
import { N3_WORDS_H } from './words-n3h.js';
import { N3_WORDS_I } from './words-n3i.js';

/* 기본 수록 단어를 한 곳으로 모은다.
 *
 * DEFAULT_WORDS를 맨 앞에 둔다 — 이미 사용자의 학습 기록이 그 id에 붙어 있어서,
 * 같은 단어가 레벨 파일에도 있으면 기존 id 쪽을 남겨야 진도가 유지된다.
 * 중복 판정은 표기(kanji) 기준이다. */
function mergeUnique(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const word of list) {
      const key = word.kanji || word.kana;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(word.level ? word : { ...word, level: 'N5' });
    }
  }
  return out;
}

export const ALL_WORDS = mergeUnique(
  DEFAULT_WORDS,
  N5_WORDS,
  N4_WORDS, N4_WORDS_B,
  N3_WORDS, N3_WORDS_B, N3_WORDS_C, N3_WORDS_D, N3_WORDS_E,
  N3_WORDS_F, N3_WORDS_G, N3_WORDS_H, N3_WORDS_I,
);
