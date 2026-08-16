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

const LEVEL_ORDER = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

/* 같은 단어가 여러 파일에 있으면 가장 낮은 레벨로 단다.
 *
 * 먼저 나온 것을 그대로 쓰면 레벨이 파일 순서로 정해진다 — 曲がる는 N5 파일에도
 * 있는데 앞선 파일이 N4라고 적어 두어 N4로 떴다. N5만 골라 공부하는 사람에게는
 * 그 단어가 아예 안 보인다. 어느 급수 시험에 처음 나오는지가 그 단어의 레벨이니,
 * 여러 벌이 엇갈리면 가장 낮은 쪽이 맞다. */
function mergeUnique(...lists) {
  // 표기별 최저 레벨을 한 번에 훑어 둔다. 단어마다 전체를 다시 뒤지면
  // 앱이 켜질 때마다 수백만 번을 돈다.
  const lowest = new Map();
  for (const list of lists) {
    for (const w of list) {
      if (!w.level) continue;
      const key = w.kanji || w.kana;
      const prev = lowest.get(key);
      if (prev === undefined || (LEVEL_ORDER[w.level] ?? 9) < (LEVEL_ORDER[prev] ?? 9)) {
        lowest.set(key, w.level);
      }
    }
  }

  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const word of list) {
      const key = word.kanji || word.kana;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...word, level: lowest.get(key) || word.level || 'N5' });
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
