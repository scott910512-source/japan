/* 오늘의 퀘스트 — 복습·약점·새로 배우기 말고 하루 몫을 따로 세는 것들.
 *
 * 복습·새로 배우기는 오늘 계획(plan)이 세고, 약점 퀴즈는 lib/weakquiz.js가 센다. 여기는 「한 판을
 * 풀었나」 같은 단순한 하루 몫이다. 지금은 쭉 퀴즈(스무 문제)와 오늘 랜덤 테스트.
 *
 * 모양: progress.quests = { day: 'YYYY-MM-DD', stream: 푼 문제 수 }. 날이 바뀌면 0부터 시작한다.
 * progress 안에 두어서 백업·동기화에 저절로 실린다(mergeQuests). */
import { todayKey } from './review.js';

export const STREAM_QUEST_SIZE = 20;
/* 문장 퀘스트 — 새 문장 몇 개를 배우나. 새로 배우기에서 문장 카드가 빠져서, 새 문장은 이 퀘스트로만 들어온다 */
export const SENTENCE_QUEST_SIZE = 5;

export function questsOf(progress, today = todayKey()) {
  const q = progress?.quests;
  if (!q || q.day !== today) return { day: today, stream: 0, random: 0, sentenceIds: [], sentenceSkip: false };
  return {
    day: today,
    stream: Math.max(0, Number(q.stream) || 0),
    random: Math.max(0, Number(q.random) || 0),
    sentenceIds: Array.isArray(q.sentenceIds) ? q.sentenceIds.filter((x) => typeof x === 'string') : [],
    sentenceSkip: Boolean(q.sentenceSkip),
  };
}

/* 풀었다고 적는다. 바뀐 게 없으면 받은 그대로 돌려준다 */
export function noteQuest(prev, key, n = 1, today = todayKey()) {
  if (!n || n < 0) return prev;
  const cur = questsOf({ quests: prev }, today);
  return { ...cur, [key]: (cur[key] || 0) + n };
}

/* ── 문장 퀘스트 ──
 *
 * 오늘 배울 새 문장 몇 개를 처음 시작할 때 정해 두고(sentenceIds) 그 id를 적는다. 몇 개를 배웠나는 복습 기록에서 센다 —
 * 정해 둔 문장 중 오늘 판정을 받은 것(lastSeen이 오늘). 따로 세는 숫자를 두지 않아서 되돌리기·동기화에 어긋나지 않는다.
 *
 * 건너뛰기(sentenceSkip)를 누르면 오늘 퀘스트에서 빠지고 하루 흐름도 이 단계를 넘어간다. 내일은 다시 나온다. */
export function planSentenceQuest(prev, ids, today = todayKey()) {
  const cur = questsOf({ quests: prev }, today);
  if (cur.sentenceIds.length) return prev && prev.day === today ? prev : { ...cur };   // 이미 정했으면 그대로(다시 정하면 배우던 게 바뀐다)
  return { ...cur, sentenceIds: ids.filter((x) => typeof x === 'string') };
}
export function skipSentenceQuest(prev, skip = true, today = todayKey()) {
  const cur = questsOf({ quests: prev }, today);
  return { ...cur, sentenceSkip: Boolean(skip) };
}

/* 아직 안 본 문장 중에서 오늘 배울 것을 고른다.
 *   cards — 문장 카드(목표 레벨 안으로 미리 걸러서 넘긴다)  review — 복습 기록 */
export function pickNewSentences(cards = [], review = {}, size = SENTENCE_QUEST_SIZE) {
  const out = [];
  for (const c of cards) {
    if (out.length >= size) break;
    if (!c || !c.id || review?.[c.id]?.lastSeen) continue;
    out.push(c.id);
  }
  return out;
}

/* 문장 퀘스트 상태.
 *   available — 아직 안 본 문장이 있나(없고 시작도 안 했으면 줄을 안 만든다)
 *   null이면 줄이 없다. skipped면 오늘은 건너뛴 것 — 줄도 흐름도 빠진다. */
export function sentenceQuestState(progress, review, available, today = todayKey(), size = SENTENCE_QUEST_SIZE) {
  const q = questsOf(progress, today);
  const ids = q.sentenceIds;
  if (q.sentenceSkip) return { skipped: true, done: 0, total: size, complete: false, ids };
  if (!ids.length && !available) return null;
  const total = ids.length || size;
  const done = ids.filter((id) => review?.[id]?.lastSeen === today).length;
  return { skipped: false, done, total, complete: ids.length > 0 && done >= ids.length, ids };
}

/* 쭉 퀴즈 퀘스트 상태. 외운 것이 하나도 없으면(맛보기뿐이면) 줄을 안 만든다 — 채울 수 없는 몫이다 */
export function streamQuestState(progress, hasMemorized, today = todayKey(), size = STREAM_QUEST_SIZE) {
  const done = Math.min(size, questsOf(progress, today).stream);
  if (!hasMemorized && done === 0) return null;
  return { done, total: size, complete: done >= size };
}

/* 오늘 랜덤 테스트 상태 — 한 번 보면 끝이라 0 또는 1이다.
   볼 낱말이 모자라고(available=false) 아직 안 봤으면 줄을 안 만든다 */
export function randomQuestState(progress, available, today = todayKey()) {
  const done = questsOf(progress, today).random > 0 ? 1 : 0;
  if (!available && !done) return null;
  return { done, total: 1, complete: done >= 1 };
}

/* 두 기기 합치기 — 같은 날이면 큰 쪽(더하면 다시 합칠 때마다 불어난다), 날이 다르면 나중 날 */
export function mergeQuests(a, b) {
  if (!a || !a.day) return b || {};
  if (!b || !b.day) return a;
  if (a.day !== b.day) return a.day > b.day ? a : b;
  const out = { day: a.day };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'day') continue;
    if (Array.isArray(a[k]) || Array.isArray(b[k])) { out[k] = [...new Set([...(a[k] || []), ...(b[k] || [])])]; continue; }   // 문장 퀘스트 id — 합친다
    if (typeof a[k] === 'boolean' || typeof b[k] === 'boolean') { out[k] = Boolean(a[k]) || Boolean(b[k]); continue; }       // 건너뜀 — 한쪽이라도 건너뛰었으면
    out[k] = Math.max(Number(a[k]) || 0, Number(b[k]) || 0);
  }
  return out;
}
