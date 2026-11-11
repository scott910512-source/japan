/* 약점 퀴즈 — 오늘 퀘스트의 한 줄.
 *
 * 약점은 「어느 낱말이 약한가」(lib/weak.js 장부)와 「그것을 오늘 한 번 풀었나」 둘이다. 앞은 이미 있다.
 * 여기는 뒤를 적는다: 오늘 약점 퀴즈로 푼 낱말 id. 낱말이 약점에서 빠지면(맞혀서) 목록에서 사라지니
 * 「남은 몇 개」만으로는 몇 개를 풀었는지 알 수 없어서, 푼 것을 따로 적어 둔다.
 *
 * 모양: progress.weakQuiz = { day: 'YYYY-MM-DD', ids: [낱말id…] }. 날이 바뀌면 새로 시작한다.
 * progress 안에 두어서 백업·동기화에 저절로 실린다(mergeWeakQuiz). */
import { todayKey } from './review.js';

export const WEAK_QUIZ_SIZE = 30;

export function weakQuizOf(progress, today = todayKey()) {
  const q = progress?.weakQuiz;
  if (!q || q.day !== today || !Array.isArray(q.ids)) return { day: today, ids: [] };
  return { day: today, ids: [...new Set(q.ids.filter((x) => typeof x === 'string'))] };
}

/* 오늘 푼 낱말을 적는다. 같은 낱말을 또 풀어도 한 번만 센다. 바뀐 게 없으면 받은 그대로 돌려준다. */
export function noteWeakQuiz(prev, wordIds = [], today = todayKey()) {
  const cur = weakQuizOf({ weakQuiz: prev }, today);
  const add = wordIds.filter((id) => typeof id === 'string' && id && !cur.ids.includes(id));
  if (!add.length && prev && prev.day === today) return prev;
  return { day: today, ids: [...cur.ids, ...add] };
}

/* 오늘의 약점 퀴즈 상태.
   weakList — 지금 약한 낱말 id(약한 순서). 오늘 푼 것은 다음 묶음에서 뺀다.
   total    — 오늘 몫: 푼 것 + 앞으로 풀 것, 서른을 넘지 않는다. 약점이 모자라면 그만큼만. */
export function weakQuizState(progress, weakList = [], today = todayKey(), size = WEAK_QUIZ_SIZE, seal = 0) {
  const doneIds = weakQuizOf(progress, today).ids;
  const left = weakList.filter((id) => !doneIds.includes(id));
  const done = Math.min(size, doneIds.length);
  /* ★ 한 번 마친 약점 퀴즈는 그날 계속 마친 것이다 ★ 약한 낱말이 열둘뿐이라 12 / 12로 마쳤는데, 뒤 단계에서
     틀린 낱말이 약점으로 들어오면 몫이 18로 늘어 「12 / 18」로 돌아갔다. 마친 순간의 몫(seal)을 채웠으면 거기서 끝이다. */
  if (seal > 0 && doneIds.length >= seal) {
    return { done, total: done, complete: true, ids: left.slice(0, size) };
  }
  const total = Math.min(size, doneIds.length + left.length);
  return {
    done, total,
    complete: total > 0 && done >= total,
    /* 이번에 풀 낱말 — 남은 몫만큼. 오늘 몫을 다 했는데 또 누르면 새로 서른 */
    ids: left.slice(0, done >= total ? size : total - done),
  };
}

/* 두 기기를 합친다 — 같은 날이면 푼 것을 합치고, 날이 다르면 나중 날이 이긴다 */
export function mergeWeakQuiz(a, b) {
  if (!a || !a.day) return b || {};
  if (!b || !b.day) return a;
  if (a.day !== b.day) return a.day > b.day ? a : b;
  return { day: a.day, ids: [...new Set([...(a.ids || []), ...(b.ids || [])])] };
}
