/* 퀘스트 시험(약점 퀴즈 · 오늘 랜덤 테스트)을 풀던 자리를 기기에 적어 둔다.
 *
 * 시험 화면은 문제 묶음과 낸 답을 화면 안에만 들고 있었다. 그래서 풀다가 새로고침하면(또는 폰이 앱을 내렸다 올리면)
 * 「마지막에 있던 자리」(lastplace)가 시험 화면은 다시 열어 주는데, 그게 퀘스트 시험이었다는 것도 어디까지 풀었는지도
 * 몰라서 일반 「단어 시험」 설정 화면이 떴고, 퀘스트로 다시 들어가면 1번부터였다.
 *
 * 여기에 적는 것: 어느 퀘스트 시험인지(mode) · 그 시험에 낸 낱말(ids) · 문제 묶음과 낸 답과 지금 문항(run).
 * 같은 날, 오래되지 않은 것만 잇는다(lastplace와 같은 6시간). 시험 화면을 스스로 닫으면 지운다 — 그건 그만둔 것이다.
 * 회독 판은 따로 이어하기가 있어 여기서 다루지 않는다. 지역 승급시험은 한 번에 보는 시험이라 잇지 않는다. */
import { todayKey } from './review.js';
import { PLACE_MAX_AGE } from './lastplace.js';

export const QUIZ_KEEP_KEY = 'jp_quiz_keep_v1';
export const KEEP_MODES = ['weak', 'random'];
const MAX_QUESTIONS = 200;

const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };

/* 시험 화면이 그대로 쓸 수 있는 묶음인가 — 모양이 어긋난 것을 얹으면 시험 화면이 죽는다 */
export function saneRun(run) {
  if (!run || typeof run !== 'object') return null;
  const questions = Array.isArray(run.questions) ? run.questions : null;
  if (!questions || !questions.length || questions.length > MAX_QUESTIONS) return null;
  const okQ = (q) => q && typeof q === 'object' && typeof q.id === 'string' && typeof q.wordId === 'string'
    && typeof q.type === 'string' && typeof q.prompt === 'string' && typeof q.answer === 'string'
    && (q.options === undefined || (Array.isArray(q.options) && q.options.every((o) => o && typeof o === 'object' && typeof o.wordId === 'string')));
  if (!questions.every(okQ)) return null;
  const answers = run.answers && typeof run.answers === 'object' && !Array.isArray(run.answers) ? run.answers : {};
  const index = Number.isInteger(run.index) ? Math.min(Math.max(run.index, 0), questions.length) : 0;
  return { questions, answers, index, ...(run.retry ? { retry: true } : {}) };
}

/* 적어 둔 것을 돌려준다. 없거나 낡았거나 모양이 이상하면 null */
export function readQuizKeep({ now = Date.now(), today = todayKey(), storage = store() } = {}) {
  try {
    const raw = storage?.getItem(QUIZ_KEEP_KEY);
    if (!raw) return null;
    const k = JSON.parse(raw);
    if (!k || typeof k !== 'object' || !KEEP_MODES.includes(k.mode)) return null;
    if (typeof k.at !== 'number' || now - k.at > PLACE_MAX_AGE || now < k.at - 60000) return null;
    if (k.day !== today) return null;
    const ids = Array.isArray(k.ids) ? k.ids.filter((id) => typeof id === 'string') : [];
    if (!ids.length) return null;
    return { mode: k.mode, ids, run: saneRun(k.run) };
  } catch { return null; }
}

export function writeQuizKeep({ mode, ids, run }, { now = Date.now(), today = todayKey(), storage = store() } = {}) {
  if (!KEEP_MODES.includes(mode) || !Array.isArray(ids) || !ids.length) return;
  try {
    storage?.setItem(QUIZ_KEEP_KEY, JSON.stringify({ mode, ids, run: saneRun(run), at: now, day: today }));
  } catch { /* 못 적어도 시험은 계속된다 */ }
}

export function clearQuizKeep(storage = store()) {
  try { storage?.removeItem(QUIZ_KEEP_KEY); } catch { /* 무시 */ }
}

/* 이 시험 화면이 어느 퀘스트 시험인가 — 약점 퀴즈 · 오늘 랜덤 테스트만 잇는다 */
export function keepModeOf({ weak = null, flow = null } = {}) {
  if (flow) return flow.kind === 'random' ? 'random' : null;
  return weak ? 'weak' : null;
}
