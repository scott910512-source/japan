/* 문장의 레벨을 「근거」로 정한다.
 *
 * 예전에는 star가 3이면 N5, 아니면 N4였다. star는 「얼마나 자주 쓰나」라서
 * 자주 쓰는 어려운 문장이 N5가 되고 드문 쉬운 문장이 N4가 됐다. 그래서 그
 * 추측을 걷어내고 전부 미분류(null)로 두었다.
 *
 * 미분류로 두니 다른 게 걸렸다. 설정의 「문장 범위」를 레벨로 좁히면 문장이
 * 통째로 사라진다 — 600개가 전부 미분류였기 때문이다. 켜면 아무 일도 안
 * 일어나거나 전부 없어지는 스위치는 스위치가 아니다.
 *
 * ★ 그래서 근거를 만든다 ★
 *
 * 이 문장에 실제로 나오는 낱말 중 제일 높은 급수. 그게 이 문장의 레벨이다.
 * 우리 단어장(N5 534 · N4 596 · N3 1206)이 급수를 알고 있으니, 추측할 게 아니라
 * 세면 된다. 뜻은 이렇다 — 「이 문장을 읽으려면 어느 급수 낱말까지 알아야 하나」.
 *
 * 공식 JLPT 문장 등급이 아니다. 주관사는 그런 걸 내지 않는다. 우리 단어장을
 * 기준으로 잰 값이고, 어느 낱말 때문에 그렇게 됐는지(by)까지 남긴다.
 * 근거가 없으면 없다고 한다(null) — 없는 걸 있다고 하지 않는 규칙은 그대로다.
 *
 * ── 찾는 방법을 왜 이렇게 했나 ──
 *
 * 히라가나로는 안 찾는다. 낱말 경계가 없어서 엉뚱한 데서 걸린다.
 *   現金しか(げんきんしか) → 「きんし」(금지, N3)
 *   何という場所(なんというばしょ) → 「はな」(꽃, N5)
 * 한자와 가타카나는 덩어리가 눈에 보이니 이 문제가 없다. 그래서 한자·가타카나
 * 표기로만 찾는다. 히라가나뿐인 낱말(ください·いくら)은 못 찾지만, 그런 낱말은
 * 거의 기초라서 제일 높은 급수를 가리는 데는 영향이 없다.
 *
 * 한 글자 한자는 낱말이 아니라 조각이다. 活用하는 낱말에서 떼어 낸 조각
 * (買う→買, 行く→行)은 문장 속 활용형을 잡아 주지만, 그 글자가 정말 그
 * 낱말이라는 보장은 없다. 실제로 「次」는 우리 단어장에 次ぐ(N3)로만 있어서
 * 「次の駅はどこですか」가 N3이 됐다. 그래서 조각은 N4까지만 근거로 쓴다 —
 * 쉬운 쪽으로 틀리면 문장이 조금 일찍 나올 뿐이지만, 어려운 쪽으로 틀리면
 * 쉬운 문장이 학습에서 사라진다.
 *
 * 한 글자 낱말과 가타카나는 덩어리 전체가 같을 때만 센다. 부분일치를 허용하면
 * 新宿이 宿(N3)으로, 渋谷가 谷(N3)으로, ジャパンレールパス가 パン(N5)으로 걸린다.
 *
 * 문형은 한자 표기에서 찾는다. 가나에서 찾으면 必要ですか(ひつようですか)가
 * 「ようです」로 걸리고, 少し考えます(すこしかんがえます)가 「しか」로 걸린다. */

import { ALL_WORDS } from '../data/allWords.js';

export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const RANK = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

const HAS_KANJI = /[一-鿿]/;
const KANJI_RUN = /[一-鿿]+/g;
const KATA_RUN = /[ァ-ヴー]+/g;
const KATA_ONLY = /^[ァ-ヴー]+$/;

/* 조각으로 올릴 수 있는 상한. 조각은 낱말이 아니라서 여기까지만 믿는다. */
const PIECE_MAX = RANK.N4;

/* ── 문형 ──
 *
 * 낱말이 다 쉬워도 문형 때문에 초급을 넘는 문장이 있다. 「教えていただけますか」는
 * 教える·いただく 둘 다 기초지만 겸양 의뢰형이라 N5에서 배우지 않는다.
 *
 * 넣기 전에 600문장 전부에 대고 실제로 무엇이 걸리는지 눈으로 확인했다.
 * 오탐이 하나라도 나온 것(ようです·しか를 가나에서 찾는 방식)은 표기 쪽에서
 * 찾도록 바꿔 오탐을 없앴고, 한 건도 안 걸리는 것은 넣지 않았다 —
 * 자료에 없는 문형을 표에 적어 두면 안 쓰는 규칙이 쌓인다. */
export const GRAMMAR_MARKS = [
  { re: /ていただけ|ていただき/, level: 'N4', name: '~해 주시겠어요 (겸양 의뢰)' },
  { re: /てしまい|てしまっ/, level: 'N4', name: '~해 버렸다' },
  { re: /かもしれ/, level: 'N4', name: '~일지도 모른다' },
  { re: /そうです|そうな/, level: 'N4', name: '~할 것 같다 (양태)' },
  { re: /なくて|なければ/, level: 'N4', name: '~하지 않아도 / ~하지 않으면' },
  { re: /たら/, level: 'N4', name: '~하면 (조건)' },
  { re: /しか/, level: 'N4', name: '~밖에 없다' },
  { re: /ようです/, level: 'N3', name: '~인 것 같다 (추측)' },
];

/* 단어장을 찾기 좋은 모양으로 한 번만 바꿔 둔다.
 *   words  덩어리 안에서 부분일치까지 (두 글자 이상 한자)
 *   exact  덩어리 전체가 같을 때만 (한 글자 낱말 · 가타카나)
 *   pieces 활용어에서 떼어 낸 한 글자 조각 — N4까지만 */
export function buildLexicon(list = ALL_WORDS) {
  const words = new Map();
  const exact = new Map();
  const pieces = new Map();
  const put = (map, form, rank) => {
    if (!form) return;
    const cur = map.get(form);
    /* 같은 표기가 여러 급수에 있으면 낮은 쪽. 어느 급수에 처음 나오는지가
       그 낱말의 급수다 — 높은 쪽을 잡으면 쉬운 낱말이 어려워 보인다. */
    if (cur === undefined || rank < cur) map.set(form, rank);
  };
  for (const w of list) {
    const rank = RANK[w?.level];
    if (rank === undefined) continue;      // 급수를 모르는 낱말은 근거가 못 된다
    const form = String(w.kanji || '');
    if (HAS_KANJI.test(form)) {
      const stem = form.match(KANJI_RUN)[0];
      if (stem.length >= 2) put(words, stem, rank);
      else if (form.length === 1) put(exact, form, rank);   // 진짜 한 글자 낱말
      else put(pieces, stem, rank);                          // 活用語의 조각
    } else if (KATA_ONLY.test(form) && form.length >= 2) {
      put(exact, form, rank);
    }
  }
  return { words, exact, pieces };
}

let cached = null;
export function defaultLexicon() {
  if (!cached) cached = buildLexicon();
  return cached;
}

/* 덩어리 안의 두 글자 이상 조각을 전부 훑는다. 표기가 1221개라 문장마다
   전부 대조하면 느리다 — 덩어리 쪽에서 뽑아 조회하는 게 훨씬 빠르고 결과는 같다. */
function scanRun(run, words, hit) {
  for (let i = 0; i < run.length; i += 1) {
    for (let j = i + 2; j <= run.length; j += 1) {
      const r = words.get(run.slice(i, j));
      if (r !== undefined) hit(r, run.slice(i, j));
    }
  }
}

/* 문장 하나의 레벨. { level, by } — by는 그렇게 판정한 근거다.
   근거가 없으면 { level: null, by: null }. */
export function gradeSentence(item, lex = defaultLexicon()) {
  const jp = String(item?.jp ?? item?.kanji ?? '');
  if (!jp) return { level: null, by: null };
  let best = -1;
  let by = null;
  const take = (rank, why) => { if (rank > best) { best = rank; by = why; } };

  for (const run of jp.match(KANJI_RUN) || []) {
    scanRun(run, lex.words, (r, form) => take(r, form));
    if (run.length === 1) {
      const w = lex.exact.get(run);
      if (w !== undefined) take(w, run);
      const p = lex.pieces.get(run);
      if (p !== undefined && p <= PIECE_MAX) take(p, run);
    }
  }
  for (const run of jp.match(KATA_RUN) || []) {
    const r = lex.exact.get(run);
    if (r !== undefined) take(r, run);
  }
  for (const g of GRAMMAR_MARKS) {
    if (g.re.test(jp)) take(RANK[g.level], g.name);
  }

  return best < 0 ? { level: null, by: null } : { level: LEVELS[best], by };
}
