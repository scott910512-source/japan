/* 외운 단어로 문법 활용 — 단어 선정 · 문제 만들기 · 세트 진행 · 기록(progress.grammarUse)을 한 곳에서.
 *
 * ★ 시기 ★ (사용자 요청: 문법은 사람마다 편차가 크니 처음엔 넓게 재고, 그다음 반복)
 *   place    초기 진단 — 문법마다 1문제(기초 12 → 8개 넘게 맞으면 나머지 12). 출발점일 뿐 통과로 치지 않는다
 *   explore  탐색 기간 — 문법 활용을 한 날 10일까지. 하루 8문제 = 문법 4개 × 2문제(유형을 섞음)
 *   repeat   반복 학습 — 문법 하나씩: 진단 3 → (3/3 빠른 통과) · (2/3 추가 확인 2) · (0~1 설명 + 연습 5)
 * 시기는 기록에서 계산한다(따로 저장하지 않는다 — 기기 둘을 합쳐도 어긋나지 않게).
 *
 * ★ 기록 ★ progress.grammarUse = { place: { day, res: { 문법: 1|0 } }, g: { 문법: { pass, fail, quick, apply, qs } }, days }
 *   pass/fail/quick/apply는 날짜 목록, qs는 푼 문제 id 목록, days는 세트를 마친 날 — 전부 「집합」이라 합치면 합집합(중복 집계 없음).
 *   기억 확인 단계 = 서로 다른 날짜에 새 문장으로 통과한 날 수(같은 날 · 같은 문제 재정답은 안 센다).
 *
 * ★ 단어 기록은 안 건드린다 ★ 단, 사용자가 「단어 뜻이 기억 안 나요」를 누르면 그 단어의 뜻 칸에 몰라요(화면이 부른다). */
import { conjugate as vform } from './verbform.js';
import { koForms, koAdj, josa } from './koverb.js';
import { normalizeJp } from './jptext.js';
import { addDays, todayKey, BOX } from './review.js';
import { NOUNS, VERBS, TIMES, ADJ_I, ADJ_NA, REASONS } from '../data/grammarFrames.js';
import { GRAMMAR_USE, GRAMMAR_USE_BY_ID, PLACE_FIRST, PLACE_PASS, EXPLORE_DAYS } from '../data/grammarUse.js';

export { GRAMMAR_USE, GRAMMAR_USE_BY_ID, EXPLORE_DAYS };
export const DIAG_SIZE = 3;
export const FOLLOW_SIZE = 2;
export const PRACTICE_SIZE = 5;
export const EXPLORE_GRAMMARS = 4;
export const PREP_MAX = 3;          // 꼭 필요한 준비 단어(아직 안 외운 낱말)는 한 세트에 3개까지
export const RECHECK_DAYS = [1, 3, 7, 14, 30];
/* 이보다 적게 외웠으면 세트를 안 열고 새로 배우기로 보낸다 */
export const MIN_KNOWN = 5;
const RECENT_UNKNOWN_DAYS = 3;

/* ═══════════ 외운 단어 — 선정 기준은 여기 한 곳 ═══════════
 * 쓴다: ① 뜻 칸이 날짜를 두고 확인됨(fx.mean.lv ≥ 1, 세 칸 이전 기록은 level ≥ 1)
 *       ② 오늘 「알아요」로 확인(box KNOWN · lastSeen 오늘)  ③ 시험에서 맞힘(쭉 퀴즈 등 — 같은 회독 기록에 남는다)
 * 뺀다: 최근 3일 안 「몰라요」(box UNKNOWN), 열어만 본 것(한 번도 알아요 없음)
 * 자가 신고(이미 알아요)만 있는 것은 쓰되 뒤로 둔다. */
export function wordTier(st, today = todayKey()) {
  if (!st?.lastSeen) return 0;
  const recentUnknown = st.box === BOX.UNKNOWN && st.lastSeen >= addDays(today, -RECENT_UNKNOWN_DAYS);
  if (recentUnknown) return 0;
  const meanLv = st.fx?.mean?.lv ?? st.level ?? 0;
  if (meanLv >= 1) return 3;
  if (st.box === BOX.KNOWN && st.lastSeen === today) return 2;
  if (st.selfKnown) return 1;
  return 0;
}
export const TIER_LABEL = { 3: '날짜를 두고 뜻을 확인한 단어', 2: '오늘 알아요로 확인한 단어', 1: '이미 안다고 표시한 단어' };

/* 단어 자료에서 한자로 찾는 표(문법 카드는 뺀다) */
export function wordIndex(words = []) {
  const m = new Map();
  for (const w of words) {
    if (!w || w.grammar) continue;
    const k = w.kanji || w.kana;
    if (k && !m.has(k)) m.set(k, w);
  }
  return m;
}

/* 외운 단어(한자 → { word, tier }) */
export function knownWords(words, review = {}, today = todayKey()) {
  const idx = wordIndex(words);
  const out = new Map();
  for (const [k, w] of idx) {
    const t = wordTier(review[w.id], today);
    if (t > 0) out.set(k, { word: w, tier: t });
  }
  return out;
}

/* ═══════════ 난수 · id ═══════════ */
export function seeded(seed) {
  let a = 0;
  for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];
const shuffle = (list, rng) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
function hashId(text) {
  let h = 5381;
  for (const ch of String(text)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/* ═══════════ 문장 재료 고르기 ═══════════
 * ctx = { idx, known, rng, prep: { left, used: Set } }
 * 외운 단어를 먼저 고르고, 없으면 준비 단어(아직 안 외운 낱말)를 세트에 3개까지만 쓴다. */
export function makeCtx({ words, review, today = todayKey(), seed = 'x', prepMax = PREP_MAX }) {
  return { idx: wordIndex(words), known: knownWords(words, review, today), rng: seeded(seed), prep: { left: prepMax, used: new Set() } };
}

function wordInfo(ctx, kanji, ko) {
  const w = ctx.idx.get(kanji);
  return w ? { id: w.id, kanji, kana: w.kana || kanji, ko, prep: !ctx.known.has(kanji) } : null;
}

/* 갈래 목록에서 명사 하나. only: 이 한자만. not: 빼는 한자 */
function pickNoun(ctx, cats, { only = null, not = [] } = {}) {
  const pool = [];
  for (const c of cats) for (const [k, ko] of Object.entries(NOUNS[c] || {})) {
    if (only && !only.includes(k)) continue;
    if (not.includes(k) || !ctx.idx.has(k)) continue;
    if (!pool.some((p) => p.k === k)) pool.push({ k, ko });
  }
  const known = pool.filter((p) => ctx.known.has(p.k));
  if (known.length) { const p = pickOne(known, ctx.rng); return wordInfo(ctx, p.k, p.ko); }
  const prepped = pool.filter((p) => ctx.prep.used.has(p.k));
  if (prepped.length) { const p = pickOne(prepped, ctx.rng); return wordInfo(ctx, p.k, p.ko); }
  if (ctx.prep.left > 0 && pool.length) {
    const p = pickOne(pool, ctx.rng); ctx.prep.left -= 1; ctx.prep.used.add(p.k); return wordInfo(ctx, p.k, p.ko);
  }
  return null;
}

/* 틀에 맞는 동사 하나 + 그 동사의 일본어 · 한국어 꼴 */
function pickVerb(ctx, test) {
  const pool = Object.entries(VERBS).filter(([k, v]) => ctx.idx.has(k) && test(v, k));
  const known = pool.filter(([k]) => ctx.known.has(k));
  let chosen = null;
  if (known.length) chosen = pickOne(known, ctx.rng);
  else {
    const prepped = pool.filter(([k]) => ctx.prep.used.has(k));
    if (prepped.length) chosen = pickOne(prepped, ctx.rng);
    else if (ctx.prep.left > 0 && pool.length) { chosen = pickOne(pool, ctx.rng); ctx.prep.left -= 1; ctx.prep.used.add(chosen[0]); }
  }
  if (!chosen) return null;
  const [k, frame] = chosen;
  const w = ctx.idx.get(k);
  const jf = vform(w);
  if (!jf) return null;
  const kf = koForms(frame.ko);
  return { k, frame, w, jf, kf, info: { id: w.id, kanji: k, kana: w.kana, ko: kf.dict, prep: !ctx.known.has(k) } };
}

/* 일본어 꼴(jp · 가나) — verbform 아홉 꼴에서 더 만든다 */
export function jpForms(jf) {
  const stem = { jp: jf.masu.jp.replace(/ます$/, ''), yomi: jf.masu.yomi.replace(/ます$/, '') };
  const cat = (a, tail) => ({ jp: a.jp + tail, yomi: a.yomi + tail });
  return {
    stem,
    dict: jf.dict, masu: jf.masu, masuPast: jf.masuPast, masuNeg: jf.masuNeg, masuNegPast: jf.masuNegPast, ta: jf.ta, te: jf.te, nai: jf.nai,
    mashou: cat(stem, 'ましょう'), masenka: cat(stem, 'ませんか'), tai: cat(stem, 'たいです'),
    teiru: cat(jf.te, 'います'), tekudasai: cat(jf.te, 'ください'), naide: cat(jf.nai, 'でください'),
    temoii: cat(jf.te, 'もいいですか'), tewa: cat(jf.te, 'はいけません'), takoto: cat(jf.ta, 'ことがあります'),
    dekiru: cat(jf.dict, 'ことができます'), tekara: cat(jf.te, 'から'),
  };
}

/* ═══════════ 문장 = 조각들 ═══════════
 * part: { jp, kana, role: 'n'|'p'|'v'|'t'|'x', block? } — block이 같은 조각은 순서 맞추기에서 붙어 다닌다 */
const P = (jp) => ({ jp, kana: jp, role: 'p' });
const X = (jp, kana = jp) => ({ jp, kana, role: 'x' });
const Nn = (w) => ({ jp: w.kanji, kana: w.kana, role: 'n', w });
const textOf = (parts) => parts.map((p) => p.jp).join('');
const kanaOf = (parts) => parts.map((p) => p.kana).join('');

/* 문제 하나. kind: choice(빈칸 보기) · type(빈칸 입력) · order(순서 맞추기) · pick(상황에 맞는 문장 고르기) */
function blankQ(g, kind, { parts, at, ko, options, accepted, why, expl, words, cause, showKo = false, hint = '' }) {
  if (kind !== 'choice' && kind !== 'type') return null;   // 빈칸 문제는 보기 고르기 · 직접 입력만
  const answer = parts[at].jp;
  const shown = parts.map((p, i) => (i === at ? '【　】' : p.jp)).join('') + '。';
  const q = {
    gid: g.id, kind, cause, text: shown, full: `${textOf(parts)}。`, fullKana: `${kanaOf(parts)}。`,
    answer, accepted: [...new Set([answer, ...(accepted || [])])], ko, showKo, hint,
    words: words.filter(Boolean), expl, why: why || {},
  };
  if (kind === 'choice') q.options = [...new Set(options)].slice(0, 4);
  q.qid = `${g.id}:${kind}:${hashId(q.full + '|' + answer)}`;
  return q;
}

function orderQ(g, { parts, blocks, ko, expl, words }) {
  /* blocks: [[i, i+1], ...] 자리를 바꿔도 되는 묶음, 나머지는 끝에 그대로 */
  const inBlock = new Set(blocks.flat());
  const tail = parts.map((_, i) => i).filter((i) => !inBlock.has(i));
  const perms = (list) => (list.length <= 1 ? [list] : list.flatMap((b, i) => perms([...list.slice(0, i), ...list.slice(i + 1)]).map((r) => [b, ...r])));
  const answers = perms(blocks).map((order) => [...order.flat(), ...tail].map((i) => parts[i].jp).join(''));
  const pieces = parts.map((p) => p.jp);
  const q = {
    gid: g.id, kind: 'order', cause: 'order', pieces, answer: textOf(parts), accepted: [...new Set(answers)],
    full: `${textOf(parts)}。`, fullKana: `${kanaOf(parts)}。`, ko, showKo: true, words: words.filter(Boolean), expl, why: {},
    /* 조각마다 어느 문법의 조사인가 — 맞히면 선수 기초를 직접 쓴 것으로 센다 */
    applies: [...new Set(parts.map((p) => p.applies).filter(Boolean))],
  };
  q.qid = `${g.id}:order:${hashId(q.full)}`;
  return q;
}

function pickQ(g, { right, wrongs, ko, expl, words, cause }) {
  const options = [...new Set([right, ...wrongs])].slice(0, 3);
  const q = { gid: g.id, kind: 'pick', cause, text: ko, answer: right, accepted: [right], options, ko, showKo: true, full: right, fullKana: right, words: words.filter(Boolean), expl, why: {} };
  q.qid = `${g.id}:pick:${hashId(right)}`;
  return q;
}

/* 조사 오답 설명 — 실제로 고른 조사로만 말한다 */
const PARTICLE_ROLE = {
  は: '주제(~은/는)', が: '주어 · 있는 것(~이/가)', を: '행동의 대상(~을/를)', に: '가는 곳 · 있는 곳 · 시간(~에)', で: '행동하는 장소(~에서)',
  へ: '가는 방향(~으로)', と: '함께(~와)', も: '~도', から: '이유 · 시작(~부터)', まで: '끝(~까지)', けど: '반대로 잇기(~지만)',
};
const particleWhy = (opts, answer, line) => Object.fromEntries(opts.filter((o) => o !== answer).map((o) => [o, `${o}는 ${PARTICLE_ROLE[o] || ''}에 붙어요. ${line}`]));

/* ═══════════ 문법별 문장 만들기 ═══════════
 * make(ctx, kind) → 문제 또는 null(아는 단어로 못 만들면). 문장은 data/grammarFrames.js의 틀에서만 나온다. */
const objVerb = (v) => Array.isArray(v.obj) && !v.objP;
function objSentence(ctx, { needAt = false } = {}) {
  const v = pickVerb(ctx, (f) => objVerb(f) && (!needAt || f.at));
  if (!v) return null;
  const o = pickNoun(ctx, v.frame.obj, { only: v.frame.objOnly });
  if (!o) return null;
  let at = null;
  if (needAt) { at = pickNoun(ctx, v.frame.at, { only: v.frame.atOnly }); if (!at) return null; }
  return { v, o, at };
}
const koObj = (o, v) => josa(o.ko, v.frame.koObj || '을/를');

const MAKERS = {
  desu(ctx, kind) {
    const n = pickNoun(ctx, ['thing', 'read', 'food']);
    if (!n) return null;
    const neg = ctx.rng() < 0.5;
    const pred = neg ? 'ではありません' : 'です';
    const parts = [{ ...X('これ'), block: 0 }, { ...P('は'), block: 0 }, Nn(n), { jp: pred, kana: pred, role: 'v' }];
    const koFixed = neg ? `이것은 ${josa(n.ko, '이/가')} 아닙니다.` : `이것은 ${n.ko}입니다.`;
    const expl = neg ? `「아닙니다」는 です 대신 ではありません. 「${n.kanji}ではありません」처럼 명사 바로 뒤에 붙여요.` : `「~입니다」는 명사 뒤에 です. 「これは${n.kanji}です」.`;
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1]], ko: koFixed, expl, words: [n] });
    const options = ['です', 'ではありません', 'でした', 'ではありませんでした'];
    return blankQ(this, kind, { parts, at: 3, ko: koFixed, showKo: true, options, accepted: neg ? ['じゃありません', 'じゃないです', 'ではないです'] : [],
      why: { です: '「~입니다」(긍정)예요.', ではありません: '「~이 아닙니다」(부정)예요.', でした: '「~이었습니다」(과거)예요.', ではありませんでした: '「~이 아니었습니다」(과거 부정)예요.' },
      expl, words: [n], cause: 'form', hint: '문장 끝 꼴' });
  },
  wa(ctx, kind) {
    const n = pickNoun(ctx, ['thing', 'read', 'food']);
    if (!n) return null;
    const parts = [X('これ'), P('は'), Nn(n), { jp: 'です', kana: 'です', role: 'v' }];
    const ko = `이것은 ${n.ko}입니다.`;
    const expl = `「これ」(이것)에 대해 말하니 주제 は. 「これは${n.kanji}です」 — 읽기는 「わ」.`;
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1]], ko, expl, words: [n] });
    const options = ['は', 'を', 'に', 'で'];
    return blankQ(this, kind, { parts, at: 1, ko, options, why: particleWhy(options, 'は', `「これ」는 이야기의 주제라 は예요.`), expl, words: [n], cause: 'particle' });
  },
  masu(ctx, kind) {
    const s = objSentence(ctx);
    if (!s) return null;
    const { v, o } = s; const f = jpForms(v.jf);
    const parts = [{ ...Nn(o), block: 0 }, { ...P(v.frame.objP || 'を'), block: 0, applies: 'o' }, { jp: f.masu.jp, kana: f.masu.yomi, role: 'v' }];
    const ko = `${koObj(o, v)} ${v.kf.masu}.`;
    const expl = `${v.k}의 ます형은 「${f.masu.jp}」. ${v.w.group === '2' ? '2그룹은 る를 떼고 ます' : v.w.group === '3' ? '3그룹은 외워 둔 꼴(します · 来ます)' : '1그룹은 끝 글자를 い단으로 바꾸고 ます'}.`;
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1]], ko, expl, words: [o, v.info] });
    const options = [f.masu.jp, `${f.dict.jp}ます`, f.masuNeg.jp, f.masuPast.jp];
    return blankQ(this, kind, { parts, at: 2, ko, showKo: true, options, accepted: [f.masu.yomi],
      why: { [`${f.dict.jp}ます`]: '사전형에 ます를 바로 붙이지 않아요.', [f.masuNeg.jp]: '「~하지 않습니다」(부정)예요.', [f.masuPast.jp]: '「~했습니다」(과거)예요.' },
      expl, words: [o, v.info], cause: 'form', hint: `${v.k} → ?` });
  },
  o(ctx, kind) {
    const s = objSentence(ctx);
    if (!s) return null;
    const { v, o } = s; const f = jpForms(v.jf);
    const parts = [{ ...Nn(o), block: 0 }, { ...P('を'), block: 0 }, { jp: f.masu.jp, kana: f.masu.yomi, role: 'v' }];
    const ko = `${koObj(o, v)} ${v.kf.masu}.`;
    const expl = `${f.masu.jp}(${v.kf.dict})는 무엇을 하는 행동이고, ${o.kanji}(${o.ko})은/는 그 대상이에요. 행동의 대상에는 を를 붙여 「${o.kanji}を${f.masu.jp}」라고 해요.`;
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1]], ko, expl, words: [o, v.info] });
    if (kind === 'pick') {
      return pickQ(this, { right: `${o.kanji}を${f.masu.jp}。`, wrongs: [`${o.kanji}に${f.masu.jp}。`, `${o.kanji}で${f.masu.jp}。`], ko, expl, words: [o, v.info], cause: 'particle' });
    }
    const options = ['を', 'に', 'で', 'が'];
    return blankQ(this, kind, { parts, at: 1, ko, options, why: particleWhy(options, 'を', `${o.kanji}은/는 ${v.kf.dict}의 대상이라 を예요.`), expl, words: [o, v.info], cause: 'particle' });
  },
  de(ctx, kind) {
    const s = objSentence(ctx, { needAt: true });
    if (!s) return null;
    const { v, o, at } = s; const f = jpForms(v.jf);
    const parts = [{ ...Nn(at), block: 0 }, { ...P('で'), block: 0 }, { ...Nn(o), block: 1 }, { ...P('を'), block: 1, applies: 'o' }, { jp: f.masu.jp, kana: f.masu.yomi, role: 'v' }];
    const ko = `${at.ko}에서 ${koObj(o, v)} ${v.kf.masu}.`;
    const expl = `${at.kanji}(${at.ko})은/는 ${v.kf.dict}라는 행동을 하는 장소예요. 행동하는 장소에는 で — 「${at.kanji}で」(${at.ko}에서).`;
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1], [2, 3]], ko, expl, words: [at, o, v.info] });
    const options = ['で', 'に', 'を', 'へ'];
    return blankQ(this, kind, { parts, at: 1, ko, options, why: particleWhy(options, 'で', `${at.kanji}은/는 가는 곳이 아니라 ${v.kf.dict} 행동을 하는 곳이라 で예요.`), expl, words: [at, o, v.info], cause: 'particle' });
  },
  'ni-dest'(ctx, kind) {
    const v = pickVerb(ctx, (fr) => fr.dest);
    if (!v) return null;
    const d = pickNoun(ctx, v.frame.dest.length ? v.frame.dest : ['dest', 'eatAt'], { only: v.frame.destOnly });
    if (!d) return null;
    const f = jpForms(v.jf);
    const parts = [{ ...Nn(d), block: 0 }, { ...P('に'), block: 0 }, { jp: f.masu.jp, kana: f.masu.yomi, role: 'v' }];
    const ko = `${d.ko}에 ${v.kf.masu}.`;
    const expl = `${f.masu.jp}(${v.kf.dict})는 움직여 가는 동사라, 가는 곳 ${d.kanji}에 に(또는 へ)를 붙여요.`;
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1]], ko, expl, words: [d, v.info] });
    const options = ['に', 'で', 'を', 'が'];
    return blankQ(this, kind, { parts, at: 1, ko, options, accepted: ['へ'], why: particleWhy(options, 'に', `${d.kanji}은/는 ${v.kf.dict}의 도착점이라 に(へ)예요.`), expl, words: [d, v.info], cause: 'particle' });
  },
  'ni-time'(ctx, kind) {
    const s = objSentence(ctx);
    if (!s) return null;
    const { v, o } = s; const f = jpForms(v.jf);
    const [tk, tko] = pickOne(Object.entries(TIMES.ni), ctx.rng);
    const t = wordInfo(ctx, tk, tko) || { kanji: tk, kana: tk, ko: tko };
    const parts = [{ jp: tk, kana: t.kana, role: 't', block: 0 }, { ...P('に'), block: 0 }, { ...Nn(o), block: 1 }, { ...P('を'), block: 1, applies: 'o' }, { jp: f.masu.jp, kana: f.masu.yomi, role: 'v' }];
    const ko = `${tko}에 ${koObj(o, v)} ${v.kf.masu}.`;
    const expl = `${tk}(${tko})은 콕 집은 때라 に를 붙여요. 毎日 · 明日 · 昨日에는 안 붙여요.`;
    if (kind === 'pick') {
      const [bk, bko] = pickOne(Object.entries(TIMES.bare), ctx.rng);
      const right = `${bk}、${o.kanji}を${f.masu.jp}。`;
      return pickQ(this, { right, wrongs: [`${bk}に${o.kanji}を${f.masu.jp}。`, `${bk}で${o.kanji}を${f.masu.jp}。`], ko: `${bko} ${koObj(o, v)} ${v.kf.masu}.`,
        expl: `${bk}(${bko})는 「지금을 기준으로 한 때」라 に를 붙이지 않아요.`, words: [o, v.info], cause: 'particle' });
    }
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1], [2, 3]], ko, expl, words: [o, v.info] });
    const options = ['に', 'で', 'を', 'が'];
    return blankQ(this, kind, { parts, at: 1, ko, options, why: particleWhy(options, 'に', `${tk}은 때를 콕 집은 말이라 に예요.`), expl, words: [o, v.info], cause: 'particle' });
  },
  masen(ctx, kind) { return formMaker(this, ctx, kind, 'masuNeg', (f) => [f.masu.jp, f.masuPast.jp, `${f.dict.jp}ません`], 'masuNeg'); },
  mashita(ctx, kind) { return formMaker(this, ctx, kind, 'masuPast', (f) => [f.masu.jp, f.masuNeg.jp, `${f.ta.jp}です`], 'masuPast', { past: true }); },
  masendeshita(ctx, kind) { return formMaker(this, ctx, kind, 'masuNegPast', (f) => [f.masuNeg.jp, f.masuPast.jp, `${f.stem.jp}ませんました`], 'masuNegPast', { past: true }); },
  'iru-aru'(ctx, kind) {
    const live = ctx.rng() < 0.5;
    const where = pickNoun(ctx, live ? ['zoo'] : ['room'], {});
    const n = live ? pickNoun(ctx, ['animal']) : pickNoun(ctx, ['thing', 'read']);
    if (!where || !n) return null;
    const pred = live ? 'います' : 'あります';
    const parts = [{ ...Nn(where), block: 0 }, { ...P('に'), block: 0 }, { ...Nn(n), block: 1 }, { ...P('が'), block: 1 }, { jp: pred, kana: pred, role: 'v' }];
    const ko = `${where.ko}에 ${josa(n.ko, '이/가')} 있습니다.`;
    const expl = live ? `${n.kanji}(${n.ko})은/는 스스로 움직이는 동물이라 います.` : `${n.kanji}(${n.ko})은/는 물건이라 あります.`;
    if (kind === 'order') return orderQ(this, { parts, blocks: [[0, 1], [2, 3]], ko, expl, words: [where, n] });
    if (kind === 'type' && ctx.rng() < 0.5) {
      const options = ['が', 'を', 'で', 'へ'];
      return blankQ(this, kind, { parts, at: 3, ko, options, why: particleWhy(options, 'が', '있는 것에는 が예요.'), expl: `있는 것(${n.kanji})에는 が, 있는 곳(${where.kanji})에는 に.`, words: [where, n], cause: 'particle' });
    }
    const options = ['います', 'あります', 'です', 'ありません'];
    return blankQ(this, kind, { parts, at: 4, ko, showKo: true, options,
      why: live ? { あります: `あります는 물건 · 식물에 써요. ${n.kanji}은/는 동물이라 います.`, です: '「~입니다」라서 「있다」가 아니에요.', ありません: '「없습니다」예요.' }
        : { います: `います는 사람 · 동물에 써요. ${n.kanji}은/는 물건이라 あります.`, です: '「~입니다」라서 「있다」가 아니에요.', ありません: '「없습니다」예요.' },
      expl, words: [where, n], cause: 'form' });
  },
  'adj-i'(ctx, kind) { return adjMaker(this, ctx, kind, 'i'); },
  'adj-na'(ctx, kind) { return adjMaker(this, ctx, kind, 'na'); },
  tekudasai(ctx, kind) { return formMaker(this, ctx, kind, 'tekudasai', (f, v) => [v.w.group === '1' ? `${f.stem.jp}てください` : `${f.masu.jp}ください`, `${f.dict.jp}ください`, f.naide.jp], 'please'); },
  naide(ctx, kind) { return formMaker(this, ctx, kind, 'naide', (f) => [`${f.masuNeg.jp}でください`, f.tekudasai.jp, `${f.dict.jp}ないでください`], 'dont'); },
  kara(ctx, kind) {
    const options0 = shuffle(REASONS, ctx.rng);
    for (const r of options0) {
      if (!ctx.idx.has(r.adj)) continue;
      const adjKnown = ctx.known.has(r.adj);
      if (!adjKnown && ctx.prep.left <= 0 && !ctx.prep.used.has(r.adj)) continue;
      const subj = pickNoun(ctx, [r.subj]);
      if (!subj) continue;
      const v = pickVerb(ctx, (fr, k) => k === r.then.verb);
      if (!v) continue;
      if (!adjKnown && !ctx.prep.used.has(r.adj)) { ctx.prep.left -= 1; ctx.prep.used.add(r.adj); }
      const f = jpForms(v.jf);
      const a = ctx.idx.get(r.adj);
      const ka = koAdj(ADJ_I[r.adj].ko);
      const verb = r.then.neg ? f.masuNeg : f.masu;
      const the = r.subj === 'dest' ? 'その' : 'この';
      const parts = [X(the), Nn(subj), P('は'), { jp: `${r.adj}です`, kana: `${a.kana}です`, role: 'v' }, P('から'), X('、'), { jp: verb.jp, kana: verb.yomi, role: 'v' }];
      const ko = `${the === 'この' ? '이' : '그'} ${josa(subj.ko, '은/는')} ${ka.because} ${r.then.neg ? v.kf.masuNeg : v.kf.masu}.`;
      const expl = `앞 문장(${r.adj}です)이 뒤 행동의 이유라서 から. 「~이니까 · ~라서」.`;
      const words = [subj, wordInfo(ctx, r.adj, ka.pol.replace(/습니다$|니다$/, '다')), v.info];
      if (kind === 'order') return null;
      const options = ['から', 'まで', 'けど', 'を'];
      return blankQ(this, kind, { parts, at: 4, ko, showKo: true, options, accepted: ['ので'],
        why: { まで: 'まで는 「~까지」(끝)예요.', けど: 'けど는 「~지만」(반대로 잇기)이라 뜻이 반대가 돼요.', を: 'を는 행동의 대상에 붙어요.' }, expl, words, cause: 'particle' });
    }
    return null;
  },
  mashou(ctx, kind) {
    const invite = ctx.rng() < 0.5;
    return formMaker(this, ctx, kind, invite ? 'masenka' : 'mashou', (f) => [invite ? f.mashou.jp : f.masenka.jp, f.masu.jp, f.masuPast.jp], invite ? 'invite' : 'lets', { together: true });
  },
  tai(ctx, kind) { return formMaker(this, ctx, kind, 'tai', (f) => [`${f.dict.jp}たいです`, `${f.te.jp}たいです`, `${f.stem.jp}たくです`], 'want'); },
  teiru(ctx, kind) { return formMaker(this, ctx, kind, 'teiru', (f, v) => [v.w.group === '1' ? `${f.stem.jp}ています` : `${f.dict.jp}ています`, `${f.te.jp}いました`, f.masu.jp], 'prog', { now: true }); },
  temoii(ctx, kind) { return formMaker(this, ctx, kind, 'temoii', (f, v) => [v.w.group === '1' ? `${f.stem.jp}てもいいですか` : `${f.dict.jp}もいいですか`, `${f.te.jp}はいけませんか`, `${f.ta.jp}もいいですか`], 'mayQ', { here: true }); },
  tewa(ctx, kind) { return formMaker(this, ctx, kind, 'tewa', (f, v) => [`${f.te.jp}もいいです`, v.w.group === '1' ? `${f.stem.jp}てはいけません` : `${f.dict.jp}はいけません`, `${f.ta.jp}はいけません`], 'mustNot', { here: true }); },
  takoto(ctx, kind) { return formMaker(this, ctx, kind, 'takoto', (f) => [`${f.masuPast.jp}ことがあります`, `${f.dict.jp}ことがあります`, `${f.te.jp}ことがあります`], 'exp'); },
  dekiru(ctx, kind) { return formMaker(this, ctx, kind, 'dekiru', (f) => [`${f.masu.jp}ことができます`, `${f.ta.jp}ことができます`, `${f.te.jp}ことができます`], 'can'); },
  tekara(ctx, kind) {
    const a = objSentence(ctx);
    const b = objSentence(ctx);
    if (!a || !b || a.v.k === b.v.k) return null;
    const fa = jpForms(a.v.jf); const fb = jpForms(b.v.jf);
    const parts = [{ ...Nn(a.o), block: 0 }, { ...P('を'), block: 0, applies: 'o' }, { jp: fa.tekara.jp, kana: fa.tekara.yomi, role: 'v' }, X('、'), Nn(b.o), P('を'), { jp: fb.masu.jp, kana: fb.masu.yomi, role: 'v' }];
    const ko = `${koObj(a.o, a.v)} ${a.v.kf.tekara} ${koObj(b.o, b.v)} ${b.v.kf.masu}.`;
    const expl = `「~하고 나서」는 て형(${fa.te.jp}) + から. 「${fa.ta.jp}から」라고 하면 「~했으니까」(이유)가 돼요.`;
    if (kind === 'order') return null;
    const options = [fa.tekara.jp, `${fa.ta.jp}から`, `${fa.dict.jp}から`, `${fa.te.jp}まで`];
    return blankQ(this, kind, { parts, at: 2, ko, showKo: true, options, accepted: [fa.tekara.yomi],
      why: { [`${fa.ta.jp}から`]: 'た형 + から는 「~했으니까」(이유)예요.', [`${fa.dict.jp}から`]: '사전형 + から는 「~하니까」(이유)예요.', [`${fa.te.jp}まで`]: 'まで는 「~까지」예요.' },
      expl, words: [a.o, a.v.info, b.o, b.v.info], cause: 'form' });
  },
};

/* 동사 꼴을 고르는 문제(같은 동사의 다른 꼴끼리 견준다) */
function formMaker(g, ctx, kind, key, wrongsOf, koKey, { past = false, together = false, now = false, here = false } = {}) {
  const s = objSentence(ctx, { needAt: here });
  if (!s) return null;
  const { v, o, at } = s; const f = jpForms(v.jf);
  const right = f[key];
  const lead = [];
  let koLead = '';
  if (past) { const [tk, tko] = pickOne(Object.entries(TIMES.past), ctx.rng); lead.push({ jp: tk, kana: ctx.idx.get(tk)?.kana || tk, role: 't' }, X('、')); koLead = `${tko} `; }
  if (together) { lead.push(X('一緒に', 'いっしょに')); koLead = '같이 '; }
  if (now) { lead.push(X('今', 'いま'), X('、')); koLead = '지금 '; }
  if (here && at) { lead.push({ ...Nn(at), block: 0 }, { ...P('で'), block: 0, applies: 'de' }); koLead = `${at.ko}에서 `; }
  const objBlock = here ? 1 : 0;
  const parts = [...lead, { ...Nn(o), block: objBlock }, { ...P('を'), block: objBlock, applies: 'o' }, { jp: right.jp, kana: right.yomi, role: 'v' }];
  const ko = `${koLead}${koObj(o, v)} ${v.kf[koKey]}${/[?.]$/.test(v.kf[koKey]) ? '' : '.'}`;
  const words = [at, o, v.info];
  const expl = `${v.k} → 「${right.jp}」. ${GRAMMAR_USE_BY_ID[g.id].rule}`;
  if (kind === 'order') {
    const blocks = here ? [[lead.length - 2, lead.length - 1], [lead.length, lead.length + 1]] : [[lead.length, lead.length + 1]];
    if (past || together || now) return null;   // 앞에 붙은 말은 자리가 여럿이라 순서 문제로 안 낸다
    return orderQ(g, { parts, blocks, ko, expl, words });
  }
  if (kind === 'pick') return null;
  const wrongs = wrongsOf(f, v).filter((w) => w && w !== right.jp);
  const options = [right.jp, ...wrongs];
  const why = Object.fromEntries(wrongs.map((w) => [w, `「${w}」는 ${formWhy(w, f)}`]));
  return blankQ(g, kind, { parts, at: parts.length - 1, ko, showKo: true, options, accepted: [right.yomi], why, expl, words, cause: 'form', hint: `${v.k} → ?` });
}

/* 고른 꼴이 무엇인지 — 실제로 고른 것으로만 말한다 */
function formWhy(w, f) {
  const named = [
    [f.masu.jp, '「~합니다」(정중 현재)예요.'], [f.masuNeg.jp, '「~하지 않습니다」(부정)예요.'], [f.masuPast.jp, '「~했습니다」(과거)예요.'],
    [f.masuNegPast.jp, '「~하지 않았습니다」예요.'], [f.mashou.jp, '「~합시다」예요.'], [f.masenka.jp, '「~하지 않을래요?」(권유)예요.'],
    [f.tekudasai.jp, '「~해 주세요」예요.'], [f.naide.jp, '「~하지 마세요」예요.'], [`${f.te.jp}もいいです`, '「~해도 됩니다」(허락)예요.'],
    [`${f.te.jp}いました`, '「~하고 있었습니다」(과거)예요.'], [`${f.te.jp}はいけませんか`, '「~하면 안 됩니까?」예요.'],
  ];
  const hit = named.find(([jp]) => jp === w);
  return hit ? hit[1] : '없는 꼴이에요. 활용 규칙을 다시 봐요.';
}

/* 형용사 문장(です · 부정) */
function adjMaker(g, ctx, kind, type) {
  const table = type === 'i' ? ADJ_I : ADJ_NA;
  const pool = shuffle(Object.entries(table).filter(([k]) => ctx.idx.has(k)), ctx.rng);
  const known = pool.filter(([k]) => ctx.known.has(k));
  const cand = known.length ? known : (ctx.prep.left > 0 ? pool.slice(0, 1) : []);
  for (const [k, a] of cand) {
    const subj = pickNoun(ctx, a.subj);
    if (!subj) continue;
    if (!ctx.known.has(k) && !ctx.prep.used.has(k)) { ctx.prep.left -= 1; ctx.prep.used.add(k); }
    const w = ctx.idx.get(k);
    const neg = ctx.rng() < 0.5;
    const ka = koAdj(a.ko);
    const stemI = k.slice(0, -1); const stemIk = (w.kana || k).slice(0, -1);
    const right = type === 'i'
      ? (neg ? { jp: `${stemI}くないです`, yomi: `${stemIk}くないです` } : { jp: `${k}です`, yomi: `${w.kana}です` })
      : (neg ? { jp: `${k}じゃないです`, yomi: `${w.kana}じゃないです` } : { jp: `${k}です`, yomi: `${w.kana}です` });
    const accepted = type === 'na' && neg ? [`${k}ではありません`, `${k}じゃありません`, `${k}ではないです`, `${w.kana}ではありません`, `${w.kana}じゃありません`]
      : type === 'i' && neg ? [`${stemI}くありません`, `${stemIk}くありません`] : [];
    const wrongs = type === 'i'
      ? (neg ? [`${k}じゃないです`, `${k}ないです`, `${stemI}くです`] : [`${stemI}くです`, `${k}だです`, `${k}なです`])
      : (neg ? [`${k}くないです`, `${k}ないです`, `${k}なじゃないです`] : [`${k}なです`, `${k}いです`, `${k}だです`]);
    const noThis = subj && (a.subj.includes('lang') && NOUNS.lang[subj.kanji]);
    const lead = noThis ? [] : [X('この')];
    const parts = [...lead, Nn(subj), P('は'), { jp: right.jp, kana: right.yomi, role: 'v' }];
    const ko = `${noThis ? '' : '이 '}${josa(subj.ko, '은/는')} ${neg ? ka.neg : ka.pol}.`;
    const expl = type === 'i'
      ? `${k}는 い형용사라 ${neg ? `い를 く로 바꿔 「${stemI}くないです」` : `그대로 「${k}です」`}.`
      : `${k}는 な형용사라 ${neg ? `「${k}じゃないです」(ではありません)` : `「${k}です」(な를 안 붙여요)`}.`;
    const why = Object.fromEntries(wrongs.map((x) => [x, type === 'i'
      ? (x.endsWith('じゃないです') ? 'じゃないです는 な형용사 · 명사의 부정이에요. い형용사는 くない.' : '없는 꼴이에요.')
      : (x.endsWith('くないです') ? 'く를 붙이는 건 い형용사뿐이에요.' : x.endsWith('なです') ? 'です 앞에는 な를 안 붙여요(な는 명사 앞에서만).' : '없는 꼴이에요.')]));
    const words = [subj, { id: w.id, kanji: k, kana: w.kana, ko: ka.pol, prep: !ctx.known.has(k) }];
    if (kind === 'order' || kind === 'pick') return null;
    return blankQ(g, kind, { parts, at: parts.length - 1, ko, showKo: true, options: [right.jp, ...wrongs], accepted: [right.yomi, ...accepted], why, expl, words, cause: 'form' });
  }
  return null;
}

/* ═══════════ 문제 하나 만들기(재시도 포함) ═══════════ */
const KINDS = ['choice', 'type', 'order', 'pick'];
export function makeQuestion(gid, ctx, kind, avoid = new Set()) {
  const g = GRAMMAR_USE_BY_ID[gid];
  const make = MAKERS[gid];
  if (!g || !make) return null;
  for (let i = 0; i < 12; i += 1) {
    const q = make.call(g, ctx, kind);
    /* 외운 단어가 하나도 안 든 문장은 안 낸다 — 준비 단어는 모자란 자리만 채운다 */
    if (q && q.words.some((w) => !w.prep) && !avoid.has(q.qid) && !avoid.has(q.full)) return q;
  }
  return null;
}

/* 서로 다른 문장으로 n문제 — 유형은 kinds 차례로(못 만드는 유형은 다음 유형으로) */
export function makeQuestions(gid, ctx, n, kinds, avoid = new Set()) {
  const out = [];
  const seen = new Set(avoid);
  for (let i = 0; out.length < n && i < n * 4; i += 1) {
    const want = kinds[out.length % kinds.length];
    const tryKinds = [want, ...KINDS.filter((k) => k !== want)];
    let q = null;
    for (const k of tryKinds) { q = makeQuestion(gid, ctx, k, seen); if (q) break; }
    if (!q) break;
    seen.add(q.qid); seen.add(q.full);
    out.push(q);
  }
  return out;
}

/* ═══════════ 기록 · 상태 ═══════════ */
const uniq = (a) => [...new Set((a || []).filter((x) => typeof x === 'string'))].sort();
export function normalizeGU(gu) {
  const g = {};
  for (const [id, r] of Object.entries(gu?.g || {})) {
    g[id] = { pass: uniq(r?.pass), fail: uniq(r?.fail), quick: uniq(r?.quick), apply: uniq(r?.apply), qs: uniq(r?.qs).slice(-200) };
  }
  const place = gu?.place?.day ? { day: gu.place.day, res: { ...(gu.place.res || {}) } } : null;
  return { place, g, days: uniq(gu?.days) };
}

/* 두 기기를 합친다 — 날짜 · id는 합집합, 초기 진단은 먼저 본 쪽 */
export function mergeGrammarUse(a, b) {
  if (!a && !b) return undefined;
  const x = normalizeGU(a); const y = normalizeGU(b);
  const g = {};
  for (const id of new Set([...Object.keys(x.g), ...Object.keys(y.g)])) {
    const p = x.g[id] || {}; const q = y.g[id] || {};
    g[id] = { pass: uniq([...(p.pass || []), ...(q.pass || [])]), fail: uniq([...(p.fail || []), ...(q.fail || [])]), quick: uniq([...(p.quick || []), ...(q.quick || [])]),
      apply: uniq([...(p.apply || []), ...(q.apply || [])]), qs: uniq([...(p.qs || []), ...(q.qs || [])]).slice(-200) };
  }
  let place = x.place || y.place;
  if (x.place && y.place) place = x.place.day <= y.place.day ? { day: x.place.day, res: { ...y.place.res, ...x.place.res } } : { day: y.place.day, res: { ...x.place.res, ...y.place.res } };
  return { place, g, days: uniq([...x.days, ...y.days]) };
}

/* 문법 하나의 상태 */
export function statusOf(gu, gid, today = todayKey()) {
  const r = normalizeGU(gu).g[gid] || { pass: [], fail: [], quick: [], apply: [], qs: [] };
  const placeRes = gu?.place?.res?.[gid];
  const passDays = uniq([...r.pass, ...r.apply]);
  const lastPass = passDays.at(-1) || null;
  const lastFail = r.fail.at(-1) || null;
  const weak = Boolean(lastFail && (!lastPass || lastFail >= lastPass));
  const level = Math.min(RECHECK_DAYS.length, passDays.length);
  const due = lastPass ? addDays(lastPass, RECHECK_DAYS[Math.max(0, level - 1)]) : null;
  return {
    gid, level, lastPass, lastFail, weak, due, place: placeRes ?? null,
    passedToday: r.pass.includes(today), quickToday: r.quick.includes(today),
    ok: Boolean(lastPass && !weak) || (placeRes === 1 && !lastFail),
    seen: Boolean(lastPass || lastFail || placeRes != null),
    qs: r.qs,
  };
}

/* 지금 시기 */
export function modeOf(gu) {
  const n = normalizeGU(gu);
  if (!n.place) return 'place';
  return n.days.length < EXPLORE_DAYS ? 'explore' : 'repeat';
}

/* 반복 학습에서 오늘의 문법 — ① 복습일 ② 최근 틀림 ③ 선수를 마친 다음 문법(선수가 안 됐으면 선수부터) */
export function recommend(gu, today = todayKey(), canMake = () => true) {
  const st = Object.fromEntries(GRAMMAR_USE.map((g) => [g.id, statusOf(gu, g.id, today)]));
  const ok = (id) => st[id]?.ok;
  const due = GRAMMAR_USE.filter((g) => st[g.id].lastPass && !st[g.id].weak && st[g.id].due && st[g.id].due <= today && !st[g.id].passedToday && canMake(g.id));
  if (due.length) return { gid: due[0].id, why: '복습일이 된 문법' };
  const weak = GRAMMAR_USE.filter((g) => st[g.id].weak && !st[g.id].passedToday && canMake(g.id));
  if (weak.length) return { gid: weak[0].id, why: '최근 틀린 문법' };
  for (const g of GRAMMAR_USE) {
    if (ok(g.id) || st[g.id].passedToday || !canMake(g.id)) continue;
    const missing = g.pre.find((p) => !ok(p) && canMake(p));
    if (missing) return { gid: missing, why: `「${g.short}」에 필요한 기초` };
    return { gid: g.id, why: '다음 문법' };
  }
  return null;
}

/* 탐색 기간 오늘 고를 문법 넷 — 진단에서 틀린 것 → 안 본 것 → 최근 틀린 것 → 맞혔던 것 재확인(다른 날) */
export function explorePicks(gu, today = todayKey(), canMake = () => true, n = EXPLORE_GRAMMARS) {
  const st = GRAMMAR_USE.map((g) => statusOf(gu, g.id, today)).filter((s) => canMake(s.gid) && !s.passedToday);
  const placeWrong = st.filter((s) => s.place === 0 && !s.lastPass);
  const unseen = st.filter((s) => !s.seen);
  const weak = st.filter((s) => s.weak && !placeWrong.includes(s));
  const recheck = st.filter((s) => s.ok && (s.lastPass || '') < today).sort((a, b) => (a.lastPass || '').localeCompare(b.lastPass || ''));
  const out = [];
  for (const s of [...placeWrong, ...unseen, ...weak, ...recheck]) if (!out.includes(s.gid)) out.push(s.gid);
  return out.slice(0, n);
}

/* ═══════════ 세트 만들기 — 시작할 때 문제를 다 정해 둔다(새로고침해도 같은 문제) ═══════════ */
export function buildSet({ words, review, gu, today = todayKey(), gid = null, mode = null, nonce = '' }) {
  const m = mode || (gid ? 'repeat' : modeOf(gu));
  const seed = `${today}|${m}|${gid || ''}|${nonce}`;
  const ctx = makeCtx({ words, review, today, seed });
  const can = (id) => Boolean(makeQuestion(id, makeCtx({ words, review, today, seed: `${seed}|can|${id}` }), 'choice'));
  const avoidOf = (id) => new Set(statusOf(gu, id, today).qs);
  const id = `${today}:${m}:${gid || 'mix'}:${hashId(seed)}`;
  const known = ctx.known.size;
  const base = { id, day: today, mode: m, knownCount: known, prep: [], at: 0, stage: 0, recorded: false };
  if (known < MIN_KNOWN) return { ...base, empty: true, needWords: true, reason: `외운 단어가 ${known}개라 문장을 만들기 어려워요. 새로 배우기에서 단어를 조금 더 익힌 뒤에 시작해요` };
  if (m === 'place') {
    const qs1 = []; const qs2 = [];
    GRAMMAR_USE.forEach((g, i) => {
      const q = makeQuestion(g.id, ctx, 'choice', avoidOf(g.id));
      if (q) (i < PLACE_FIRST ? qs1 : qs2).push(q);
    });
    if (qs1.length < 3) return { ...base, empty: true, reason: '아직 외운 단어가 적어 진단 문장을 만들 수 없어요' };
    return finish({ ...base, stages: [{ name: 'place', label: '초기 진단', qs: qs1, answers: [] }], spare: { place2: qs2 } }, ctx);
  }
  if (m === 'explore') {
    const picks = explorePicks(gu, today, can);
    const qs = [];
    for (const p of picks) qs.push(...makeQuestions(p, ctx, 2, shuffle(['choice', 'type', 'order', 'pick'], ctx.rng).slice(0, 2), avoidOf(p)));
    if (qs.length < 4) return { ...base, empty: true, reason: '외운 단어로 만들 수 있는 문장이 모자라요' };
    return finish({ ...base, grammars: picks, stages: [{ name: 'explore', label: '탐색 테스트', qs: shuffle(qs, ctx.rng), answers: [] }] }, ctx);
  }
  const target = gid || recommend(gu, today, can)?.gid;
  if (!target) return { ...base, empty: true, reason: '오늘 확인할 문법이 없어요' };
  const avoid = avoidOf(target);
  const diag = makeQuestions(target, ctx, DIAG_SIZE, ['choice', 'type', 'order'], avoid);
  if (diag.length < DIAG_SIZE) return { ...base, gid: target, empty: true, reason: '외운 단어로 만들 수 있는 문장이 모자라요' };
  const used = new Set([...avoid, ...diag.map((q) => q.qid), ...diag.map((q) => q.full)]);
  const follow = makeQuestions(target, ctx, FOLLOW_SIZE, ['type', 'choice'], used);
  follow.forEach((q) => { used.add(q.qid); used.add(q.full); });
  const practice = makeQuestions(target, ctx, PRACTICE_SIZE, ['choice', 'order', 'type', 'choice', 'type'], used);
  practice.forEach((q) => { used.add(q.qid); used.add(q.full); });
  const spares = makeQuestions(target, ctx, 3, ['choice', 'type', 'choice'], used);
  return finish({ ...base, gid: target, seenBefore: [...avoid].filter((x) => x.includes(':')), stages: [{ name: 'diag', label: '기초 확인', qs: diag, answers: [] }], spare: { follow, practice, swap: spares } }, ctx);
}
function finish(run, ctx) {
  /* 준비 단어(아직 안 외운 낱말) — 화면이 문제 앞에 뜻을 먼저 보여 준다 */
  const prep = [...ctx.prep.used].map((k) => ctx.idx.get(k)).filter(Boolean).map((w) => ({ id: w.id, kanji: w.kanji || w.kana, kana: w.kana, mean: w.mean }));
  return { ...run, prep };
}

/* ═══════════ 채점 ═══════════ */
export function judge(q, input) {
  if (q.kind === 'order') {
    const got = (Array.isArray(input) ? input.join('') : String(input || ''));
    return q.accepted.includes(got);
  }
  if (q.kind === 'type') {
    const n = normalizeJp(String(input || ''));
    return q.accepted.some((a) => normalizeJp(a) === n);
  }
  return input === q.answer || q.accepted.includes(input);
}

/* 지금 단계의 결과 — 단어 도움으로 뺀 문제(void)는 세지 않는다 */
export function stageScore(stage) {
  const counted = stage.answers.filter((a) => a && !a.void);
  return { right: counted.filter((a) => a.ok).length, total: counted.length };
}

/* 단계 하나를 마쳤을 때 다음 — 반복 학습(진단 → 추가 / 설명+연습)과 초기 진단(앞 묶음 → 뒤 묶음) */
export function nextStage(run) {
  const cur = run.stages[run.stage];
  const { right } = stageScore(cur);
  if (cur.name === 'place') {
    if (right >= PLACE_PASS && run.spare?.place2?.length) return { name: 'place2', label: '초기 진단 · 뒤 묶음', qs: run.spare.place2, answers: [] };
    return null;
  }
  if (cur.name === 'diag') {
    if (right >= DIAG_SIZE) return null;
    if (right === DIAG_SIZE - 1 && run.spare?.follow?.length >= FOLLOW_SIZE) return { name: 'follow', label: '추가 확인', qs: run.spare.follow, answers: [], intro: 'fix' };
    if (run.spare?.practice?.length) return { name: 'practice', label: '기본 연습', qs: run.spare.practice, answers: [], intro: 'rule' };
    return null;
  }
  return null;
}

/* 세트 결과 → 기록할 것(날짜 · id 집합) */
export function outcomeOf(run, today = todayKey()) {
  const touch = {};
  const add = (gid, k, v) => { (touch[gid] ||= { pass: [], fail: [], quick: [], apply: [], qs: [] })[k].push(v); };
  let placeRes = null;
  const all = run.stages.flatMap((s) => s.answers.map((a, i) => ({ s, a, q: s.qs[i] }))).filter((x) => x.a && x.q);
  for (const { s, a, q } of all) {
    if (a.void) continue;
    add(q.gid, 'qs', q.qid);
    /* 순서 맞추기를 처음에 맞혔으면 그 안의 기초 조사(を · で)를 직접 쓴 것 */
    if (q.kind === 'order' && a.ok && a.first && s.name !== 'practice') for (const pre of q.applies || []) if (pre !== q.gid) add(pre, 'apply', today);
  }
  const by = (name) => run.stages.find((s) => s.name === name);
  if (run.mode === 'place') {
    placeRes = {};
    for (const name of ['place', 'place2']) {
      const s = by(name);
      if (!s) continue;
      s.answers.forEach((a, i) => { if (a && !a.void) placeRes[s.qs[i].gid] = a.ok ? 1 : 0; });
    }
  } else if (run.mode === 'explore') {
    const s = by('explore');
    const per = {};
    s.answers.forEach((a, i) => { if (!a || a.void) return; const g = s.qs[i].gid; (per[g] ||= []).push(a.ok); });
    /* 문법마다 두 문제 — 둘 다 맞으면 통과, 하나라도 틀리면 약점(한 문제만 남았으면 기록 안 함) */
    for (const [g, oks] of Object.entries(per)) {
      if (oks.some((x) => !x)) add(g, 'fail', today);
      else if (oks.length >= 2) add(g, 'pass', today);
    }
  } else {
    const d = by('diag'); const f = by('follow'); const p = by('practice');
    const ds = d ? stageScore(d) : { right: 0, total: 0 };
    /* 같은 문제만 다시 맞힌 것(전부 전에 푼 문제)이면 기억 확인으로 안 센다 */
    const fresh = d ? d.qs.filter((q, i) => d.answers[i] && !d.answers[i].void && !(run.seenBefore || []).includes(q.qid)).length : 0;
    if (ds.right >= DIAG_SIZE && ds.total >= DIAG_SIZE) {
      if (fresh >= 2) add(run.gid, 'pass', today);
      add(run.gid, 'quick', today);
    } else if (f) {
      const fs = stageScore(f);
      if (fs.right >= FOLLOW_SIZE) add(run.gid, 'pass', today); else add(run.gid, 'fail', today);
    } else if (p || ds.total) {
      add(run.gid, 'fail', today);
    }
  }
  for (const r of Object.values(touch)) for (const k of Object.keys(r)) r[k] = r[k].filter(Boolean);
  return { touch, placeRes, day: today };
}

/* 기록에 넣는다 — 합집합이라 두 번 넣어도 같다 */
export function applyOutcome(gu, out) {
  const cur = normalizeGU(gu);
  const add = { place: out.placeRes ? { day: out.day, res: out.placeRes } : null, g: {}, days: [out.day] };
  for (const [gid, r] of Object.entries(out.touch)) add.g[gid] = r;
  return mergeGrammarUse(cur, add);
}

/* 오늘 화면 줄 · 퀘스트 — 지금 시기와 오늘의 문법 이름 */
export function questInfo(gu, today = todayKey(), canMake = () => true) {
  const m = modeOf(gu);
  if (m === 'place') return { mode: m, label: '초기 진단', note: '문법마다 한 문제씩 · 출발점 찾기' };
  if (m === 'explore') {
    const n = normalizeGU(gu).days.length;
    const picks = explorePicks(gu, today, canMake);
    return { mode: m, label: `탐색 ${Math.min(EXPLORE_DAYS, n + 1)}일째`, note: `${picks.map((g) => GRAMMAR_USE_BY_ID[g].short).join(' · ')} · 8문제`, picks };
  }
  const r = recommend(gu, today, canMake);
  if (!r) return { mode: m, label: '오늘 확인할 문법이 없어요', note: '' };
  return { mode: m, gid: r.gid, label: `오늘의 문법 · ${GRAMMAR_USE_BY_ID[r.gid].short}`, note: `기초 확인 ${DIAG_SIZE}문제 · 필요하면 추가 연습`, why: r.why };
}

/* 검사용 — 단어 하나의 verbform 꼴 */
export const __vform = (w) => vform(w);

/* 하던 세트 — 이 기기에 적어 두고 새로고침 · 재접속해도 같은 문제 · 같은 제출 상태에서 잇는다(날이 바뀌면 버린다) */
export const GU_RUN_KEY = 'jp_grammar_use_run_v1';
export function readRun() {
  try { const r = JSON.parse(globalThis.localStorage?.getItem(GU_RUN_KEY) || 'null'); return r && r.day === todayKey() ? r : null; } catch { return null; }
}
export function writeRun(r) {
  try { if (r) globalThis.localStorage?.setItem(GU_RUN_KEY, JSON.stringify(r)); else globalThis.localStorage?.removeItem(GU_RUN_KEY); } catch { /* 못 적어도 푸는 데는 지장 없다 */ }
}

/* ★ 문법 지도 ★ 24개 문법을 한 칸씩 — 단어 지도(lib/wordmap.js)와 같은 색 단계로.
 * 안 봄 → 진단만(round1) → 확인 1일(round2) → 확인 2일(round3) → 확인 3일 이상(done), 약점은 덧칠(빨강) */
export const GRAMMAR_MAP_STATES = [
  { id: 'fresh', label: '안 봄' },
  { id: 'round1', label: '진단 · 연습만' },
  { id: 'round2', label: '확인 1일' },
  { id: 'round3', label: '확인 2일' },
  { id: 'done', label: '확인 3일+' },
];
export function grammarMapCells(gu, today = todayKey()) {
  return GRAMMAR_USE.map((g) => {
    const st = statusOf(gu, g.id, today);
    const state = st.level >= 3 ? 'done' : st.level === 2 ? 'round3' : st.level === 1 ? 'round2' : st.seen ? 'round1' : 'fresh';
    const tag = st.weak ? '복습 대상' : st.level > 0 ? `확인 ${st.level}일` : st.place === 1 ? '진단 맞음' : st.place === 0 ? '진단 틀림' : st.seen ? '연습함' : '안 봄';
    /* 진단에서 틀리고 아직 통과 못 한 문법도 약점으로 칠한다(먼저 볼 곳) */
    return { gid: g.id, short: g.short, title: g.title, level: g.level, state, weak: st.weak || (st.place === 0 && !st.lastPass), tag, due: st.lastPass && !st.weak ? st.due : null };
  });
}
