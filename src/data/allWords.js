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
/* 표준 N3 어휘 목록과 대조해 없던 것 — 동사·형용사·명사·부사·가타카나 338개 */
import { N3_WORDS_J } from './words-n3j.js';
/* 기출(한자읽기 2010~2025)에 나왔는데 단어장에 없던 68개 */
import { KIJU_WORDS } from './words-kiju.js';
/* 삿포로 여행 목록(data/sapporo.js) 70개 중 단어장에 없던 20개 */
import { SAPPORO_WORDS } from './words-sapporo.js';
/* 표준 N5 · N4 목록과 대조해 없던 것 — N5 162개 · N4 184개 (2026-11-16) */
import { N5_WORDS_B } from './words-n5b.js';
import { N4_WORDS_C } from './words-n4c.js';
/* 일상대화 낱말 · 정해진 인사 · 맞장구 415개 — tags 첫 칸이 '회화'(새로 배우기에 고르게 섞인다, lib/cards.js mixFresh) */
import { DAILY_WORDS } from './words-daily.js';
/* N4 · N3 문법 포인트 246개 — 낱말 칸에 카드로 싣는다(grammar: true). 새로 배우기에 하루 두 개씩 섞인다.
   자료의 kana는 서로 겹치지 않게 「・용법」 꼬리를 단 것이 있다(そうだ・ようす 등) — 읽기 · 소리 · 답으로 쓰는 칸이라
   꼬리는 떼어 싣는다. 겹쳐도 괜찮다 — 단어장은 표기(kanji)로 하나를 가린다. */
import { GRAMMAR_POINTS } from './grammar-points.js';
/* N5 기초 문법 95개(조사 쓰임별 · です/ます 활용 · て형 · 형용사 활용 …) — N4 카드가 이미 다루는 것은 뺐다 (2026-11-17) */
import { GRAMMAR_POINTS_N5 } from './grammar-points-n5.js';
const GRAMMAR_CARDS = [...GRAMMAR_POINTS_N5, ...GRAMMAR_POINTS].map((g) => ({ ...g, kana: String(g.kana).split('・')[0] }));

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
  N5_WORDS, N5_WORDS_B,
  N4_WORDS, N4_WORDS_B, N4_WORDS_C,
  N3_WORDS, N3_WORDS_B, N3_WORDS_C, N3_WORDS_D, N3_WORDS_E,
  N3_WORDS_F, N3_WORDS_G, N3_WORDS_H, N3_WORDS_I, N3_WORDS_J,
  KIJU_WORDS,
  SAPPORO_WORDS,
  DAILY_WORDS,
  GRAMMAR_CARDS,
);
