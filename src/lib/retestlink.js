/* 오답 다시 풀기 결과를 기록에 이어 붙인다 — 틀린 문제 · 약한 낱말 · N3 오답이 한 번에 같이 움직인다.
 *
 * ★ 왜 이어야 하나 ★
 *   오답 재시험에서 맞혀도 약점 장부와 N3 오답은 모르고 있었다. 같은 낱말이 「오답 해결」인데 「약점」으로
 *   남거나, 다시 틀렸는데 약점은 그대로였다. 저장소는 셋(progress.mistakes · progress.weak · progress.n3.wrong)으로
 *   그대로 두고, 다시 풀기 한 번이 세 곳에 한 번씩만 적히게 한다.
 *
 * ★ 두 번 세지 않는다 ★
 *   이 길은 오답노트의 「다시 풀기」(attempt.retest)만 탄다. 단어 시험 · 쭉 퀴즈 · 문장 만들기 같은 기존 퀴즈는
 *   자기 콜백으로 약점 장부를 이미 적으니, 그쪽 시도는 여기서 약점 장부를 건드리지 않는다.
 *   같은 응시(retestKey)를 두 번 받으면(재시도 · 동기화 뒤 재전송) 아무것도 안 바꾼다.
 *
 * ★ 한 번 맞혔다고 약점이 사라지지 않는다 ★
 *   맞히면 약점 점수는 1만 줄어든다(quizRight +1). 오답 「해결」은 서로 다른 두 날짜에 맞혀야 하고
 *   그 뒤 7일 뒤에 한 번 더 기억을 확인한다. 같은 날 여러 번 맞혀도 한 번이다. 복습 간격(SRS)은 건드리지 않는다. */
import { recordMistake } from './mistakes.js';
import { noteWeak, WEAK_KIND } from './weak.js';
import { noteN3Wrong } from './n3progress.js';
import { todayKey } from './review.js';

/* 다시 풀기에서 약점 장부로 이어질 수 있는 낱말 id인가 — 낱말 카드를 가리키는 ref만 */
export function isWordRef(ref, wordIds) {
  return Boolean(ref) && Boolean(wordIds?.has?.(ref));
}

/* 다시 풀기 한 번을 progress에 적는다. 바뀐 게 없으면 받은 progress를 그대로 돌려준다. */
export function applyAttempt(progress, attempt, { wordIds = null, today = todayKey(), at = Date.now() } = {}) {
  const p = progress || {};
  if (!attempt?.id || typeof attempt.ok !== 'boolean') return p;
  const isRetest = Boolean(attempt.retest);
  /* 같은 응시를 두 번 받으면 무시 */
  if (isRetest && attempt.retestKey && p.mistakes?.[attempt.id]?.retestKey === attempt.retestKey) return p;

  const mistakes = recordMistake(p.mistakes, attempt, today, at);
  let next = mistakes === p.mistakes ? p : { ...p, mistakes };
  if (!isRetest) return next;

  /* 약점 장부 — 낱말 카드를 가리키는 오답만 */
  if (isWordRef(attempt.ref, wordIds)) {
    const weak = noteWeak(p.weak, [{ id: attempt.ref, kind: attempt.ok ? WEAK_KIND.QUIZ_RIGHT : WEAK_KIND.QUIZ_WRONG }], at);
    if (weak !== p.weak) next = { ...next, weak };
  }
  /* N3 오답 — 코스 문제를 다시 풀었으면 거기도 같은 규칙(두 번 이어 맞히면 빠진다)으로 */
  if (attempt.source === 'n3' && String(attempt.id).startsWith('n3:')) {
    const qid = String(attempt.id).slice(3);
    const n3 = p.n3;
    if (n3 && (attempt.ok ? n3.wrong?.[qid] : true)) {
      const wrong = noteN3Wrong(n3.wrong, qid, attempt.ok, { cat: n3.wrong?.[qid]?.cat, ref: attempt.ref ?? null, at });
      if (wrong !== n3.wrong) next = { ...next, n3: { ...n3, wrong } };
    }
  }
  return next;
}

/* 오답 한 줄의 상태 — 「왜 아직 남아 있나 / 왜 복습이 잡혀 있나」를 말해 준다.
 *   open      아직 해결 전. 다른 날 맞힌 횟수를 같이 말한다
 *   resolved  서로 다른 두 날짜에 맞혀 해결. 7일 뒤 기억 확인이 잡혀 있다
 *   check     해결한 오답의 기억 확인 차례 */
export function mistakeStatus(row, today = todayKey()) {
  if (!row) return null;
  const days = Object.values(row.successes || {}).filter((t) => t > (row.lastWrongAt || 0)).length;
  if (!row.resolved) {
    return days >= 1
      ? { state: 'open', label: '한 번 맞혔어요 · 다른 날 한 번 더 맞히면 해결', days }
      : { state: 'open', label: '다시 풀 차례 · 서로 다른 두 날에 맞히면 해결', days };
  }
  if (row.due && row.due > today) return { state: 'resolved', label: `오답 해결 · 기억 확인 복습 ${row.due} 예정`, days };
  return { state: 'check', label: '오답 해결 · 기억 확인 복습 차례', days };
}
