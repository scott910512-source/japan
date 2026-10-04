/* JLPT 문장 듣기 — 급수별 문장만 모은다.
 *
 * ★ 왜 생겼나 ★
 *
 * 자동 듣기를 틀었더니 몇몇 낱말 말고는 아예 안 들렸다. 범위가 「오늘 볼 것」
 * 「전체」처럼 외운 정도로 갈려 있어서, 급수가 섞인 채로 흘러갔기 때문이다.
 * 귀는 눈보다 늦다 — 눈으로 N3을 보는 사람도 귀로는 N5부터 쌓아야 한다.
 * 그래서 「무엇을 들을까」에 급수로 고르는 자리를 하나 더 둔다. 낱말은 빼고
 * 문장만 돈다. 낱말 하나는 눈으로 외우는 게 빠르고, 문장은 귀로 익혀야 한다.
 *
 * ★ 문장은 어디서 오나 ★
 *
 *   1. 단어장 예문 — N5 낱말 534개마다 짧은 예문이 하나씩 붙어 있다
 *      (学校へ行きます。). 한 문장에 새 낱말이 하나라 제일 먼저 듣기 좋다.
 *   2. 상황별 회화 — 문장에 나오는 낱말로 잰 급수(sentlevel.js)가 그 급수인 것.
 *
 * 예문이 앞, 회화가 뒤다. 예문은 한 낱말을 둘러싼 문장이고 회화는 한 자리를
 * 둘러싼 문장이라, 낱말이 귀에 붙은 뒤에 자리로 넘어가는 차례다.
 *
 * ★ 급수 밖 낱말이 든 예문은 뺀다 ★
 *
 * N5 낱말의 예문인데 N4 낱말이 끼어 있는 것이 서른 개쯤 있다. 그걸 N5라고
 * 들려주면 「N5인데 왜 모르지」가 된다. 예문도 같은 자로 재서(sentlevel.js)
 * 그 급수를 넘는 것은 빼고, 근거를 못 찾은 것(히라가나뿐인 문장)은 둔다 —
 * 모른다는 것은 어렵다는 뜻이 아니다.
 *
 * ★ 카드를 새로 만든다, 기록은 안 붙는다 ★
 *
 * 예문은 단어장에 카드로 없다. 여기서 문장 카드 모양(kanji·kana·mean)으로
 * 감싸 듣기에 넘긴다. id는 「ex:낱말id」로 둔다 — 듣기는 회독 기록을 안
 * 건드리니 이 id로 적히는 것은 「들었다」 활동뿐이고, 그건 낱말 기록과 섞이지
 * 않는다. 회화 문장은 이미 카드라 그대로 쓴다. */
import { LEVELS, defaultLexicon, gradeSentence } from './sentlevel.js';

/* 급수 차례. N2·N1은 단어장에 없어서 여기서도 없다. */
export const JLPT_LEVELS = ['N5', 'N4', 'N3'];
const RANK = Object.fromEntries(LEVELS.map((l, i) => [l, i]));

/* 예문 id. 낱말 id와 겹치지 않게 앞에 표를 붙인다. */
export const exampleId = (wordId) => `ex:${wordId}`;

/* 낱말 하나의 예문 → 문장 카드. 예문이 없으면 null. */
export function exampleCard(w) {
  if (!w?.example) return null;
  return {
    id: exampleId(w.id),
    kanji: w.example,
    kana: w.exampleKana || w.example,
    mean: w.exampleKo || '',
    type: 'sentence',
    kind: 'sentence',
    level: w.level || null,
    /* 어느 낱말의 예문인가 — 화면이 「이 문장의 새 낱말」을 적을 때 쓴다 */
    word: w.kanji,
    wordKana: w.kana,
    wordMean: w.mean,
  };
}

/* 한 급수의 문장 전부 — 예문 먼저, 회화 뒤.
 *
 * words: 단어장(level이 적힌 것) · sentences: 상황 문장 카드(level이 잰 것)
 * 같은 문장이 두 번 들어오지 않는다. 같은 예문이 두 낱말에 붙어 있거나
 * (友達が来ます。가 来る에도, 友達에도), 회화에 같은 문장이 있으면 먼저 온
 * 것만 둔다. */
export function jlptSentences(level, words = [], sentences = [], lex = defaultLexicon()) {
  const want = RANK[level];
  if (want === undefined) return [];
  const seen = new Set();
  const out = [];
  const take = (card) => {
    const key = String(card.kanji || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(card);
  };

  for (const w of words) {
    if (w?.level !== level) continue;
    const card = exampleCard(w);
    if (!card) continue;
    /* 예문 속 낱말로 다시 잰다 — 그 급수를 넘는 낱말이 들어 있으면 뺀다 */
    const g = gradeSentence({ jp: card.kanji }, lex);
    if (g.level != null && RANK[g.level] > want) continue;
    take(card);
  }
  for (const s of sentences) {
    if (s?.level !== level) continue;
    take(s);
  }
  return out;
}

/* 급수마다 몇 개나 되는지 — 화면의 급수 칸에 숫자를 적는다 */
export function jlptCounts(words = [], sentences = [], lex = defaultLexicon()) {
  const out = {};
  for (const l of JLPT_LEVELS) out[l] = jlptSentences(l, words, sentences, lex).length;
  return out;
}

/* 듣기가 받을 후보 — [{ id, kind }]. 카드 알맹이는 jlptSentences가 든다. */
export function jlptPool(level, words = [], sentences = [], lex = defaultLexicon()) {
  return jlptSentences(level, words, sentences, lex).map((c) => ({ id: c.id, kind: 'sentence' }));
}
