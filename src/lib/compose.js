import { VERDICT, stateOf, todayKey } from './review.js';
import { weakEntry } from './weak.js';
import { KIND, difficultyOf, newSession, pickNext, record } from './stream.js';
import { withinGoal } from './goal.js';
import { editDistance } from './quiz.js';
import { normalizeJp, phoneticJp } from './jptext.js';

/* 문장 만들기 — 배운 문장을 내 손으로 만들어 본다.
 *
 * 쭉 퀴즈가 「알아보는가」를 묻는다면 이쪽은 「만들 수 있는가」를 묻는다. 네 갈래다.
 *
 *   조립      한국어 뜻을 보고 일본어 조각을 순서대로 눌러 문장을 만든다(어순·조사)
 *   빈칸      문장의 빈칸에 조사·부사를 고른다(답이 하나가 되게 짜 둔 자료)
 *   쓰기      한국어 뜻을 보고 일본어 문장을 직접 쓴다
 *   내 문장   내가 만든 문장을 AI가 고쳐 준다(내 키가 있을 때)
 *
 * 문장을 어느 것에서 내나: 이미 본 문장만, 목표 급수 안에서만. 약한 문장이 더 자주 나오는
 * 규칙은 쭉 퀴즈와 같은 것(stream.js)을 그대로 쓴다 — 두 벌로 두면 한쪽만 고쳐진다.
 *
 * ★ 복습 간격에 반영한다 ★ 조립과 쓰기만이다. 문장 카드(회독 id)에 붙는 연습이라서다.
 * 빈칸 자료는 회독 카드가 아니고(일상문법과 같은 자료), 내 문장은 카드가 아니다. */

export const COMPOSE_MODE = { BUILD: 'build', BLANK: 'blank', WRITE: 'write', FREE: 'free' };
export const COMPOSE_MODES = [
  { id: 'build', label: '조립', sub: '조각을 순서대로 눌러요' },
  { id: 'blank', label: '빈칸', sub: '조사·부사를 골라요' },
  { id: 'write', label: '쓰기', sub: '뜻을 보고 직접 써요' },
  { id: 'free', label: '내 문장', sub: 'AI가 고쳐 줘요' },
];

export const WRITE_MIN = 8;     // 너무 짧은 문장(すみません 같은 인사)은 쓰기가 인사 암기가 된다
export const WRITE_MAX = 32;    // 너무 긴 문장은 손으로 치다 지친다

/* 낼 수 있는 문장의 풀 — 이미 본 것만, 목표 안에서만. mode가 build면 조각이 있는 문장만. */
export function composePool({
  sentences = [], review = {}, ledger = null, goal, mode = COMPOSE_MODE.WRITE, hasChunks = () => true, today = todayKey(),
} = {}) {
  const items = [];
  for (const s of sentences) {
    if (!review[s.id]?.lastSeen || !withinGoal(s.level, goal)) continue;
    if (mode === COMPOSE_MODE.BUILD && !hasChunks(s.id)) continue;
    if (mode === COMPOSE_MODE.WRITE) {
      const n = normalizeJp(s.kanji).length;
      if (n < WRITE_MIN || n > WRITE_MAX) continue;
    }
    items.push({ id: s.id, kind: KIND.SENTENCE, level: s.level || null, d: difficultyOf(stateOf(review, s.id), weakEntry(ledger, s.id), today) });
  }
  return items;
}

/* ── 채점: 쓰기 ──
 *
 * 문장은 단어보다 표기가 많다 — 한자로 써도, 히라가나로 써도, 마침표가 있어도 없어도 같은
 * 문장이다. 소리가 같으면(장음을 모음으로 쓴 것까지) 맞다. 한두 글자 다르면 close로 돌려줘
 * 사람이 정하게 한다. 다른 말로 맞게 쓴 경우는 여기서 알 수 없다 — AI 첨삭이 그 자리다. */
export function judgeWrite(sentence, input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { verdict: 'wrong' };
  const accepted = [sentence.kanji, sentence.kana].filter(Boolean);
  const mine = normalizeJp(raw);
  if (!mine) return { verdict: 'wrong' };
  if (accepted.some((a) => normalizeJp(a) === mine)) return { verdict: 'correct', expected: sentence.kanji };
  const heard = phoneticJp(raw);
  if (accepted.some((a) => phoneticJp(a) === heard)) return { verdict: 'correct', expected: sentence.kanji };
  const best = Math.min(...accepted.map((a) => editDistance(normalizeJp(a), mine)));
  const len = normalizeJp(sentence.kanji).length;
  const limit = len >= 10 ? 2 : 1;
  return { verdict: best <= limit ? 'close' : 'wrong', expected: sentence.kanji };
}

/* ── 복습 판정 ──
 * 조립: 한 번에 맞히면 알아요, 고쳐서 맞히면 애매해요(조각이 보였으니 반만 쳐 준다).
 * 쓰기: 맞으면 알아요, 틀리면 몰라요(아무것도 안 보고 썼다). */
export const buildVerdict = (firstTry) => (firstTry ? VERDICT.KNOWN : VERDICT.VAGUE);
export const writeVerdict = (ok) => (ok ? VERDICT.KNOWN : VERDICT.UNKNOWN);

/* ── 빈칸: 답이 하나가 되게 짜 둔 자료(일상문법·부사)를 한 줄로 ── */
export function clozeItems(...sets) {
  const out = [];
  for (const group of sets) {
    for (const s of group || []) {
      for (const it of s.items || []) out.push({ ...it, set: s.label || s.title || s.id });
    }
  }
  return out;
}
export const clozePool = (items) => items.map((it) => ({ id: it.id, kind: 'cloze', d: 0 }));

export { newSession, pickNext, record };
