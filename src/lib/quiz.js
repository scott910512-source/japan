import { isWeak } from './review.js';
import { narrowAscii, normalizeJp, phoneticJp, soundDiff, stripPunct } from './jptext.js';
/* 시험 출제 · 채점.
 *
 * 회독(review.js)과는 목적이 다르다. 회독은 "다시 볼지"를 내가 정하는 곳이고,
 * 시험은 "정말 아는지"를 앱이 판정하는 곳이다. 그래서 회독 상태를 건드리지 않고
 * 따로 돈다 — 시험을 봤다고 복습 간격이 밀리면 시험을 마음 편히 못 본다.
 *
 * 화면이 붙지 않은 순수 함수만 둔다. 무작위는 rng를 주입받아 테스트에서 고정한다. */

export const QUIZ_TYPE = { CHOICE: 'choice', TYPING: 'typing', MIX: 'mix' };
export const QUIZ_DIR = { JP_KO: 'jp-ko', KO_JP: 'ko-jp', MIX: 'mix' };
export const QUIZ_SCOPE = { ALL: 'all', SEEN: 'seen', WEAK: 'weak' };

export const CHOICE_COUNT = 4;

/* ── 정답 문자열 다루기 ── */

// 뜻은 '다투다;경쟁하다'처럼 여러 개가 붙어 있다. 어느 하나만 맞아도 정답이다.
export function meaningsOf(word) {
  return String(word?.mean || '')
    .split(/[;,/·]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* 뜻(한국어) 쪽에서 무시할 것들: 공백, 괄호 주석, 문장부호, 대소문자.
   손으로 치는 답을 띄어쓰기로 틀렸다고 하면 시험이 아니라 받아쓰기가 된다.

   ★ 일본어는 여기로 오면 안 된다 ★
   예전엔 이 함수 하나로 둘 다 처리했고, 문장부호 목록에 ー가 끼어 있었다.
   그래서 ビール의 답으로 ビル을 쳐도 정답이 됐다 — 맥주와 빌딩이 같은 답이
   된 것이다. 일본어는 lib/jptext.js가 따로 다룬다. */
export function normalizeAnswer(text) {
  return narrowAscii(stripPunct(text)).replace(/[·\s]/g, '').toLowerCase();
}

export { normalizeJp };

// 한 글자 차이는 오타일 때가 많다. 바로 오답 처리하지 않고 사용자가 정하게 넘긴다.
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/* 이 단어의 답으로 인정하는 일본어 표기.
 *
 * 한자와 가나는 같은 낱말의 두 표기라 둘 다 맞다. 그 밖에 인정할 표기는
 * 자료에 alt로 적어 둔 것만 받는다 — 「비슷하면 맞다」로 열어 두면 규칙이
 * 아니라 인심이 된다. */
export function acceptedJp(word) {
  return [word?.kanji, word?.kana, ...(Array.isArray(word?.alt) ? word.alt : [])]
    .filter(Boolean);
}

/* 뜻이 뒤집히거나 수가 달라지는 차이인가.
 *
 * 「있다」와 「없다」, 「하나」와 「둘」은 한 글자 차이지만 오타가 아니다.
 * 오타로 봐주면 정반대 답이 「거의 맞았어요」가 된다. */
const NEGATION = ['없', '안', '못', '아니', '말고', '불'];
const NUMBERS = /[0-9０-９]|하나|둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열|한|두|세|네/;

export function sensesDiffer(a, b) {
  const has = (s, w) => s.includes(w);
  for (const n of NEGATION) {
    if (has(a, n) !== has(b, n)) return true;
  }
  const na = a.match(NUMBERS)?.[0] || '';
  const nb = b.match(NUMBERS)?.[0] || '';
  return na !== nb;
}

/* 'correct' | 'close' | { verdict: 'wrong', why } .
 *
 * close는 "거의 맞았어요"로 보여 주고 사용자가 인정할 수 있게 한다 — 오타까지
 * 틀렸다고 세면 점수가 실력을 안 나타낸다.
 *
 * 다만 일본어에서 한 글자 차이는 오타가 아닐 때가 더 많다. 장음·촉음·작은
 * 가나·탁음이 다르면 그건 다른 낱말이라 봐주면 안 된다 — 무엇이 다른지
 * 적어서 틀렸다고 한다. */
export function judgeTyping(word, dir, input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { verdict: 'wrong' };

  if (dir === QUIZ_DIR.KO_JP) {
    const accepted = acceptedJp(word);
    const mine = normalizeJp(raw);
    if (!mine) return { verdict: 'wrong' };

    if (accepted.some((a) => normalizeJp(a) === mine)) return { verdict: 'correct' };
    /* 「びいる」처럼 장음을 모음으로 적은 것도 같은 소리다.
       ー를 지우는 게 아니라 펴서 견주기 때문에 びる과는 여전히 다르다. */
    const heard = phoneticJp(raw);
    if (accepted.some((a) => phoneticJp(a) === heard)) return { verdict: 'correct' };

    /* ★ 소리를 가르는 차이는 오타가 아니다 ★ */
    for (const a of accepted) {
      const diff = soundDiff(a, raw);
      if (diff) return { verdict: 'wrong', why: diff.note, expected: a };
    }

    const near = accepted.some((a) => normalizeJp(a).length >= 4
      && editDistance(normalizeJp(a), mine) <= 1);
    return { verdict: near ? 'close' : 'wrong' };
  }

  // 뜻 쪽 — 여러 뜻 중 하나만 맞아도 정답이다
  const accepted = meaningsOf(word).map(normalizeAnswer);
  const mine = normalizeAnswer(raw);
  if (!mine) return { verdict: 'wrong' };
  if (accepted.includes(mine)) return { verdict: 'correct' };

  for (const a of accepted) {
    if (a.length < 3 || editDistance(a, mine) > 1) continue;
    /* 뜻이 뒤집히거나 수가 다르면 오타가 아니다 */
    if (sensesDiffer(a, mine)) {
      return { verdict: 'wrong', why: '뜻이 반대이거나 수가 달라요.', expected: a };
    }
    return { verdict: 'close' };
  }
  return { verdict: 'wrong' };
}

/* 옛 이름 — 화면 여러 곳이 문자열 하나를 기대한다 */
export function checkTyping(word, dir, input) {
  return judgeTyping(word, dir, input).verdict;
}

/* ── 출제 ── */

function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* 오답 후보는 같은 레벨·같은 품사에서 먼저 고른다.
 * 동사 문제에 명사만 섞이면 뜻을 몰라도 답이 보인다.
 *
 * 뜻이 한 조각이라도 겹치면 후보에서 뺀다. 뜻 전체가 같을 때만 걸러내면
 * 尋ねる(묻다) 문제에 聞く(듣다/묻다)가 보기로 붙는다 — 둘 다 맞는데 하나만
 * 정답으로 세니, 아는 사람이 틀리는 문제가 된다.
 * 후보끼리도 겹치지 않게 같은 자리에서 걸러 둔다. */
export function pickDistractors(word, pool, count, rng = Math.random) {
  const taken = new Set(meaningsOf(word));
  const out = [];

  const tiers = [
    pool.filter((w) => w.id !== word.id && w.level === word.level && w.type === word.type),
    pool.filter((w) => w.id !== word.id && w.level === word.level),
    pool.filter((w) => w.id !== word.id),
  ];

  for (const tier of tiers) {
    for (const cand of shuffled(tier, rng)) {
      if (out.length >= count) return out;
      const parts = meaningsOf(cand);
      if (!parts.length || parts.some((m) => taken.has(m))) continue;
      parts.forEach((m) => taken.add(m));
      out.push(cand);
    }
  }
  return out;
}

export function buildQuestion(word, { type, dir }, pool, rng = Math.random) {
  const jpFirst = dir === QUIZ_DIR.JP_KO;
  const base = {
    id: `q-${word.id}-${dir}-${type}`,
    wordId: word.id,
    type,
    dir,
    prompt: jpFirst ? word.kanji : word.mean,
    promptSub: jpFirst ? word.kana : null,   // 힌트로 열어 볼 읽는 법
    answer: jpFirst ? word.mean : word.kanji,
    answerSub: jpFirst ? word.kana : word.kana,
  };

  if (type !== QUIZ_TYPE.CHOICE) return base;

  const distractors = pickDistractors(word, pool, CHOICE_COUNT - 1, rng);
  const options = shuffled([word, ...distractors], rng).map((w) => ({
    wordId: w.id,
    label: jpFirst ? w.mean : w.kanji,
    sub: jpFirst ? null : w.kana,
  }));
  return { ...base, options };
}

// 출제 범위. '학습한 것만'과 '틀린 것만'은 회독 기록을 읽기만 한다.
export function scopeWords(words, review = {}, scope = QUIZ_SCOPE.ALL) {
  if (scope === QUIZ_SCOPE.SEEN) {
    return words.filter((w) => review[w.id]?.lastSeen);
  }
  if (scope === QUIZ_SCOPE.WEAK) {
    /* 약점 기준은 회독 쪽 한 군데서 정한다. 예전엔 여기 ≥1을 손으로 적어 둬서
       같은 「약점」이 시험에서만 56개, 복습에서는 25개였다. */
    return words.filter((w) => isWeak(review[w.id]));
  }
  return words;
}

export function buildQuiz(words, {
  count = 20,
  type = QUIZ_TYPE.CHOICE,
  dir = QUIZ_DIR.JP_KO,
  scope = QUIZ_SCOPE.ALL,
  review = {},
  rng = Math.random,
} = {}) {
  // 4지선다는 오답 후보가 필요하다. 범위를 좁혀도 보기는 전체에서 끌어온다.
  const pool = words;
  const picked = shuffled(scopeWords(words, review, scope), rng).slice(0, count);

  return picked.map((word, i) => {
    // 섞기는 문제마다 번갈아 낸다 — 무작위로 하면 한쪽으로 쏠린 시험이 나온다
    const t = type === QUIZ_TYPE.MIX ? (i % 2 ? QUIZ_TYPE.TYPING : QUIZ_TYPE.CHOICE) : type;
    const d = dir === QUIZ_DIR.MIX ? (i % 2 ? QUIZ_DIR.KO_JP : QUIZ_DIR.JP_KO) : dir;
    return buildQuestion(word, { type: t, dir: d }, pool, rng);
  });
}

/* ── 채점 ── */

// answers: { [questionId]: { value, verdict } } — verdict는 화면에서 확정한 값
export function gradeQuiz(questions, answers = {}) {
  let correct = 0;
  const wrong = [];
  for (const q of questions) {
    if (answers[q.id]?.verdict === 'correct') correct += 1;
    else wrong.push(q);
  }
  const total = questions.length;
  return {
    total,
    correct,
    wrong,
    wrongIds: wrong.map((q) => q.wordId),
    score: total ? Math.round((correct / total) * 100) : 0,
  };
}

export function gradeLabel(score) {
  if (score >= 90) return { text: '완벽해요', tone: 'great' };
  if (score >= 70) return { text: '잘 하고 있어요', tone: 'good' };
  if (score >= 50) return { text: '조금만 더', tone: 'okay' };
  return { text: '다시 외울 때예요', tone: 'weak' };
}
