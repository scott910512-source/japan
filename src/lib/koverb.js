/* 한국어 동사 · 형용사 활용 — 문법 활용 퀘스트가 만든 일본어 문장의 해석을 규칙으로 만든다.
 *
 * 일본어 문장은 틀(data/grammarFrames.js)과 동사 활용(lib/verbform.js)으로 만들고, 해석도 같은 틀에서 나와야
 * 문장마다 따로 적지 않아도 된다. 동사마다 세 줄기만 적는다.
 *   s   어간            먹 · 가 · 만들 · 듣
 *   eo  아/어 꼴         먹어 · 가 · 만들어 · 들어
 *   eu  으 앞 꼴(선택)    ㄷ · ㅂ 불규칙만(듣 → 들으, 돕 → 도우). 없으면 s
 * 받침 · ㄹ 탈락은 여기서 처리한다. */

const BASE = 0xac00;
const isHangul = (ch) => {
  const c = ch?.charCodeAt(0) - BASE;
  return c >= 0 && c <= 11171;
};
const jongOf = (ch) => (isHangul(ch) ? (ch.charCodeAt(0) - BASE) % 28 : -1);
const withJong = (ch, jong) => String.fromCharCode(ch.charCodeAt(0) - jongOf(ch) + jong);
const J = { NONE: 0, N: 4, L: 8, B: 17, SS: 20 };

const last = (s) => s.slice(-1);
const init = (s) => s.slice(0, -1);
/* 받침 있음(ㄹ 받침은 따로 본다) */
const hasBatchim = (s) => jongOf(last(s)) > 0;
const isL = (s) => jongOf(last(s)) === J.L;
/* 끝 글자에 받침을 붙인다(ㄹ 받침이면 ㄹ을 떼고 붙인다 — 만들 → 만듭 · 만든) */
const addJong = (s, jong) => init(s) + withJong(last(s), jong);

/* ㅂ니다 / 습니다 */
function polite(s) {
  if (isL(s)) return `${addJong(s, J.B)}니다`;
  return hasBatchim(s) ? `${s}습니다` : `${addJong(s, J.B)}니다`;
}

/* 아/어 꼴 + ㅆ → 과거 줄기(먹었 · 갔 · 했 · 봤) */
const pastStem = (eo) => addJong(eo, J.SS);

/* 으 앞 꼴 — ㄹ 줄기는 으를 안 넣는다 */
function withEu(stem, tail) {
  if (isL(stem)) return `${stem}${tail}`;
  return hasBatchim(stem) ? `${stem}으${tail}` : `${stem}${tail}`;
}
/* 관형형: 과거(ㄴ/은) · 미래(ㄹ/을) */
function adnPast(stem) {
  if (isL(stem)) return addJong(stem, J.N);
  return hasBatchim(stem) ? `${stem}은` : addJong(stem, J.N);
}
function adnFuture(stem) {
  if (isL(stem)) return stem;
  return hasBatchim(stem) ? `${stem}을` : addJong(stem, J.L);
}
function lets(stem) {
  if (isL(stem)) return `${addJong(stem, J.B)}시다`;
  return hasBatchim(stem) ? `${stem}읍시다` : `${addJong(stem, J.B)}시다`;
}

/* 동사 하나의 한국어 꼴 전부. ko = { s, eo, eu? } */
export function koForms(ko) {
  const { s, eo } = ko;
  const eu = ko.eu || s;
  return {
    dict: `${s}다`,
    masu: polite(s),
    masuPast: `${pastStem(eo)}습니다`,
    masuNeg: `${s}지 않습니다`,
    masuNegPast: `${s}지 않았습니다`,
    want: `${s}고 싶습니다`,
    please: `${eo} 주세요`,
    dont: `${s}지 마세요`,
    mayQ: `${eo}도 됩니까?`,
    may: `${eo}도 됩니다`,
    mustNot: `${withEu(eu, '면')} 안 됩니다`,
    exp: `${adnPast(eu)} 적이 있습니다`,
    can: `${adnFuture(eu)} 수 있습니다`,
    prog: `${s}고 있습니다`,
    lets: lets(eu),
    invite: `${s}지 않겠습니까?`,
    tekara: `${s}고 나서`,
    because: `${s}기 때문에`,
  };
}

/* 형용사(한국어도 형용사) — ko = { s } (비싸 · 크 · 작 · 조용하) */
export function koAdj(ko) {
  const { s } = ko;
  return {
    pol: polite(s),
    neg: `${s}지 않습니다`,
    adn: adnPast(ko.eu || s),   // 비싼 · 큰 · 작은 · 어려운(ㅂ 불규칙은 eu)
    because: `${s}기 때문에`,
  };
}

/* 받침에 맞춘 조사(이/가 · 을/를 · 은/는 · 으로/로) — sentences.js withJosa와 같은 규칙, 으로/로만 더 본다 */
export function josa(word, pair) {
  const w = String(word).trim();
  const [a, b] = pair.split('/');
  const ch = last(w);
  if (!isHangul(ch)) return `${w}${pair}`;
  const jong = jongOf(ch);
  if (pair === '으로/로') return `${w}${jong > 0 && jong !== J.L ? '으로' : '로'}`;
  return `${w}${jong > 0 ? a : b}`;
}
