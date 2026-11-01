import { BOX, VERDICT, daysBetween, stateOf, todayKey } from './review.js';
import { weakEntry, weakScore } from './weak.js';
import { QUIZ_DIR, QUIZ_TYPE, buildQuestion, judgeTyping } from './quiz.js';
import { n3Included, withinGoal } from './goal.js';

/* 쭉 퀴즈 — 외운 것을 끊지 않고 이어서 묻는다.
 *
 * 단어 시험(quiz.js)은 10~50문제에서 끝나고 한 종류만 낸다. 이건 「그만」을 누를 때까지
 * 이어지고, 단어·한자·문법·문장을 섞고, 약한 것이 더 자주 나온다. 화면이 붙지 않은 순수
 * 함수만 둔다. 무작위는 rng를 주입받아 테스트에서 고정한다.
 *
 * ★ 무엇이 더 자주 나오나 ★
 *
 * 어려운 것이 아니라 「내게 약한 것」이다. 약한 정도(difficultyOf)는 이미 앱이 쌓아 둔
 * 것으로 잰다 — 몰라요·애매해요를 누른 횟수, 시험에서 틀린 횟수, 외웠다가 무너진 것,
 * 복습일이 지난 것. 낱말마다 레벨(N5·N3)로 어렵다고 치지 않는다. N3 낱말도 내가 잘
 * 알면 약한 게 아니다.
 *
 * ★ 복습 간격에 반영한다 ★
 *
 * 맞히면 「알아요」, 틀리면 「몰라요」 판정이 회독 기록에 들어간다(applyVerdicts) — 그래서
 * 틀린 것은 오늘 복습에 올라가고, 복습일에 맞히면 기억 단계가 오른다. 단어 시험(quiz.js)은
 * 일부러 간격을 안 건드린다고 적어 두었는데, 이쪽은 「외운 것을 평가한다」가 목적이라
 * 평가가 곧 기록이어야 한다.
 *
 * 다만 한 낱말을 한 판에서 여러 번 만날 수 있다. 첫 대답만 기록한다(shouldRecord) —
 * 틀린 뒤 곧바로 맞혔다고 「몰라요」가 지워지면 안 되고, 세 번 틀렸다고 몰라요가 세 번
 * 쌓이면 약점이 부풀려진다. 같은 판의 되풀이는 연습이다. */

export const KIND = { WORD: 'word', KANJI: 'kanji', GRAMMAR: 'grammar', SENTENCE: 'sentence' };
export const KIND_LABEL = { word: '단어', kanji: '한자', grammar: '문법', sentence: '문장' };

export const WEIGHT_CAP = 12;     // 약한 것이 쉬운 것보다 최대 열세 배 자주
export const RECENT_BLOCK = 5;    // 방금 낸 다섯 개는 다시 안 낸다(풀이 넉넉할 때)
export const MIN_POOL = 4;        // 보기를 만들려면 이만큼은 있어야 한다

/* ── 얼마나 약한가 ── */

export function difficultyOf(st, rec, today = todayKey()) {
  const s = st || {};
  let d = weakScore(s, rec);
  if (s.box === BOX.UNKNOWN) d += 3;
  else if (s.box === BOX.VAGUE) d += 2;
  const late = s.due ? daysBetween(s.due, today) : 0;
  if (late > 0) d += Math.min(3, late);          // 복습일이 지난 것은 잊기 시작한 것
  d -= Math.min(4, s.level || 0) * 0.5;          // 오래 기억에 올라간 것은 덜 묻는다
  return Math.max(0, d);
}

export const weightOf = (d) => 1 + Math.min(WEIGHT_CAP, Math.max(0, d));

/* ── 풀: 외운 것만 ──
 *
 * 한 번이라도 본 것(lastSeen)만 낸다. 평가가 목적이라 안 배운 걸 묻지 않는다.
 * n3는 N3 코스 자료의 id — { kanjiIds, grammarIds }. 목표가 N3 이상일 때만 들어간다. */
export function buildPool({
  words = [], sentences = [], n3 = {}, review = {}, ledger = null, goal, today = todayKey(),
} = {}) {
  const items = [];
  const seen = (id) => Boolean(review[id]?.lastSeen);
  const add = (id, kind, level) => {
    const st = stateOf(review, id);
    items.push({ id, kind, level: level || null, d: difficultyOf(st, weakEntry(ledger, id), today) });
  };
  for (const w of words) if (seen(w.id) && withinGoal(w.level || 'N5', goal)) add(w.id, KIND.WORD, w.level);
  for (const s of sentences) if (seen(s.id) && withinGoal(s.level, goal)) add(s.id, KIND.SENTENCE, s.level);
  if (n3Included(goal)) {
    for (const id of n3.kanjiIds || []) if (seen(id)) add(id, KIND.KANJI, 'N3');
    for (const id of n3.grammarIds || []) if (seen(id)) add(id, KIND.GRAMMAR, 'N3');
  }
  return items;
}

export function poolCounts(pool = []) {
  const out = { word: 0, kanji: 0, grammar: 0, sentence: 0 };
  for (const it of pool) out[it.kind] += 1;
  return out;
}

/* ── 한 판 ── */

export function newSession() {
  return { bump: {}, asked: {}, recent: [], recorded: {}, log: [], streak: 0, best: 0 };
}

const weightIn = (it, session) => weightOf(it.d + (session.bump[it.id] || 0));

/* 다음에 낼 것. 약한 것이 더 잘 뽑히되, 방금 낸 것은 건너뛴다. */
export function pickNext(pool, session, rng = Math.random) {
  if (!pool.length) return null;
  const blockN = pool.length > RECENT_BLOCK * 2 ? RECENT_BLOCK : 1;
  const block = new Set(session.recent.slice(-blockN));
  const open = pool.filter((it) => !block.has(it.id));
  const list = open.length ? open : pool;
  const weights = list.map((it) => weightIn(it, session));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < list.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

/* 첫 대답만 기록한다 — 위 머리말 */
export const shouldRecord = (session, id) => !(id in session.recorded);

export const verdictFor = (ok) => (ok ? VERDICT.KNOWN : VERDICT.UNKNOWN);

/* 대답을 판에 적는다. 틀리면 이 판 안에서 더 자주 나오고(곧 다시 만난다), 맞히면 덜 나온다. */
export function record(session, item, ok) {
  const bump = { ...session.bump };
  bump[item.id] = Math.max(-4, Math.min(6, (bump[item.id] || 0) + (ok ? -2 : 3)));
  const recorded = shouldRecord(session, item.id) ? { ...session.recorded, [item.id]: ok } : session.recorded;
  const streak = ok ? session.streak + 1 : 0;
  return {
    ...session,
    bump,
    recorded,
    asked: { ...session.asked, [item.id]: (session.asked[item.id] || 0) + 1 },
    recent: [...session.recent, item.id].slice(-20),
    log: [...session.log, { id: item.id, kind: item.kind, ok }],
    streak,
    best: Math.max(session.best, streak),
  };
}

/* ── 문제 만들기 ──
 *
 * ctx: { wordById, wordPool, sentenceById, sentencePool, n3Question(id, rng), rng }
 * 어느 종류든 같은 모양으로 돌려준다 — 화면이 종류를 몰라도 그린다.
 *   { id, kind, mode: 'choice'|'typing', tag, prompt, sub, promptJp, options:[{key,label,sub}],
 *     correct(key), answerText, answerSub, word?, dir?, speak, explain, why } */

const shuffle = (list, rng) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

function wordQuestion(item, ctx, rng) {
  const word = ctx.wordById.get(item.id);
  if (!word) return null;
  /* 약한 낱말은 보기가 있는 쪽으로, 익숙한 낱말은 직접 쓰게도 한다 */
  const typing = item.d < 2 && rng() < 0.4;
  const dir = rng() < 0.5 ? QUIZ_DIR.JP_KO : QUIZ_DIR.KO_JP;
  const q = buildQuestion(word, { type: typing ? QUIZ_TYPE.TYPING : QUIZ_TYPE.CHOICE, dir }, ctx.wordPool, rng);
  const jpFirst = dir === QUIZ_DIR.JP_KO;
  return {
    id: item.id,
    kind: KIND.WORD,
    mode: typing ? 'typing' : 'choice',
    tag: `${jpFirst ? '뜻을 고르세요' : '일본어로 뭘까요'}${typing ? ' · 직접 입력' : ''}`,
    prompt: q.prompt,
    sub: q.promptSub,
    promptJp: jpFirst,
    options: typing ? [] : q.options.map((o) => ({ key: o.wordId, label: o.label, sub: o.sub })),
    correct: word.id,
    answerText: q.answer,
    answerSub: q.answerSub,
    word,
    dir,
    speak: word.kana || word.kanji,
    explain: word.example ? `${word.example} — ${word.exampleKo || ''}` : '',
  };
}

function sentenceQuestion(item, ctx, rng) {
  const s = ctx.sentenceById.get(item.id);
  if (!s) return null;
  const jpFirst = rng() < 0.5;
  const text = (x) => (jpFirst ? x.mean : x.kanji);
  const others = [];
  for (const o of shuffle(ctx.sentencePool, rng)) {
    if (others.length >= 3) break;
    if (o.id === s.id || text(o) === text(s) || others.some((x) => text(x) === text(o))) continue;
    others.push(o);
  }
  if (others.length < 3) return null;
  return {
    id: item.id,
    kind: KIND.SENTENCE,
    mode: 'choice',
    tag: jpFirst ? '문장의 뜻을 고르세요' : '알맞은 일본어 문장은?',
    prompt: jpFirst ? s.kanji : s.mean,
    sub: jpFirst ? s.kana : null,
    promptJp: jpFirst,
    options: shuffle([s, ...others], rng).map((x) => ({ key: x.id, label: text(x), sub: jpFirst ? null : x.kana })),
    correct: s.id,
    answerText: text(s),
    answerSub: jpFirst ? null : s.kana,
    speak: s.kana || s.kanji,
    explain: s.place || '',
  };
}

/* N3 코스 문제(한자·문법). lib/n3.js의 questionForCard가 만든 문제를 같은 모양으로 맞춘다. */
function n3Question(item, ctx, rng) {
  const q = ctx.n3Question?.(item.id, rng);
  if (!q || !Array.isArray(q.options) || q.options.length < 2) return null;
  return {
    id: item.id,
    kind: item.kind,
    mode: 'choice',
    tag: item.kind === KIND.KANJI ? '한자' : '문법',
    prompt: q.q,
    sub: q.sub || null,
    promptJp: true,
    options: q.options.map((o) => ({ key: o, label: o, sub: null })),
    correct: q.answer,
    answerText: q.answer,
    answerSub: null,
    speak: q.speak || null,
    explain: q.expl || '',
    why: q.why || null,
  };
}

export function questionFor(item, ctx) {
  const rng = ctx.rng || Math.random;
  if (item.kind === KIND.WORD) return wordQuestion(item, ctx, rng);
  if (item.kind === KIND.SENTENCE) return sentenceQuestion(item, ctx, rng);
  return n3Question(item, ctx, rng);
}

/* 대답을 채점한다. 'correct' | 'close' | 'wrong' (+ why).
 * 직접 쓰기의 close(한 글자 오타)는 화면이 「맞게 처리」를 물을 수 있게 따로 돌려준다. */
export function judge(q, input) {
  if (q.mode === 'choice') return { verdict: input === q.correct ? 'correct' : 'wrong' };
  return judgeTyping(q.word, q.dir, input);
}

/* ── 평가 ── */
export function summarize(log = []) {
  const total = log.length;
  const right = log.filter((e) => e.ok).length;
  const byKind = {};
  for (const k of Object.values(KIND)) {
    const mine = log.filter((e) => e.kind === k);
    if (mine.length) {
      const r = mine.filter((e) => e.ok).length;
      byKind[k] = { total: mine.length, right: r, pct: Math.round((r / mine.length) * 100) };
    }
  }
  /* 다시 볼 것 — 한 번이라도 틀린 낱말. 틀린 횟수가 많은 것부터 */
  const wrongCount = {};
  for (const e of log) if (!e.ok) wrongCount[e.id] = (wrongCount[e.id] || 0) + 1;
  const missed = Object.entries(wrongCount).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }));
  return { total, right, pct: total ? Math.round((right / total) * 100) : 0, byKind, missed };
}
