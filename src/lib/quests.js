/* 오늘의 퀘스트 — 복습·약점·새로 배우기 말고 하루 몫을 따로 세는 것들.
 *
 * 복습·새로 배우기는 오늘 계획(plan)이 세고, 약점 퀴즈는 lib/weakquiz.js가 센다. 여기는 「한 판을
 * 풀었나」 같은 단순한 하루 몫이다. 지금은 쭉 퀴즈(스무 문제)와 오늘 랜덤 테스트.
 *
 * 모양: progress.quests = { day: 'YYYY-MM-DD', stream: 푼 문제 수 }. 날이 바뀌면 0부터 시작한다.
 * progress 안에 두어서 백업·동기화에 저절로 실린다(mergeQuests). */
import { todayKey } from './review.js';

export const STREAM_QUEST_SIZE = 20;

export function questsOf(progress, today = todayKey()) {
  const q = progress?.quests;
  if (!q || q.day !== today) return { day: today, stream: 0, random: 0 };
  return { day: today, stream: Math.max(0, Number(q.stream) || 0), random: Math.max(0, Number(q.random) || 0) };
}

/* 풀었다고 적는다. 바뀐 게 없으면 받은 그대로 돌려준다 */
export function noteQuest(prev, key, n = 1, today = todayKey()) {
  if (!n || n < 0) return prev;
  const cur = questsOf({ quests: prev }, today);
  return { ...cur, [key]: (cur[key] || 0) + n };
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
    out[k] = Math.max(Number(a[k]) || 0, Number(b[k]) || 0);
  }
  return out;
}
