/* 목표 레벨.
 *
 * 이 앱의 목표는 N3다. 그걸 코드 여기저기에 「N3」로 적어 두면 목표를 바꾸는 사람(N4에서
 * 멈추고 싶은 사람, 아직 N5를 다지는 사람)에게 맞출 방법이 없다. 목표는 설정에 한 칸으로
 * 두고(settings.goalLevel), 쓰는 쪽은 이 파일을 거쳐 읽는다.
 *
 * ★ 자료가 있는 급수만 고른다 ★
 * 단어·문법·한자 자료가 N5~N3까지라 N2·N1은 고를 수 없다. 자료가 없는 목표를 고르게 하면
 * 쭉 퀴즈가 빈손이 된다. 자료가 늘면 GOAL_LEVELS에 한 줄 더하면 된다.
 *
 * 목표가 하는 일: 쭉 퀴즈와 문장 만들기에서 목표 급수를 넘는 자료는 안 나온다. 학습 자료를
 * 숨기지는 않는다 — 단어·문법·한자 화면은 그대로다. */

export const GOAL_LEVELS = ['N5', 'N4', 'N3'];
export const DEFAULT_GOAL = 'N3';

const RANK = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };

export function levelRank(level) {
  return RANK[level] || 0;
}

/* 설정에서 목표를 읽는다. 없거나 모르는 값이면 기본(N3). */
export function goalOf(settings) {
  const g = settings?.goalLevel;
  return GOAL_LEVELS.includes(g) ? g : DEFAULT_GOAL;
}

/* 이 급수의 자료가 목표 안인가.
 * 급수를 모르는(null) 것은 넘지 않는 것으로 본다 — 근거 없이 어렵다고 치지 않는다.
 * (급수 없는 낱말을 N5로 세는 것과 같은 판단이다 — lib/wordFilters.js) */
export function withinGoal(level, goal = DEFAULT_GOAL) {
  if (!level) return true;
  const r = levelRank(level);
  return r === 0 ? true : r <= levelRank(goal);
}

/* N3 코스 자료(문법·한자·독해·청해)는 N3 급이다. 목표가 N3 이상일 때만 나온다. */
export function n3Included(goal = DEFAULT_GOAL) {
  return levelRank(goal) >= RANK.N3;
}

export function goalNote(goal = DEFAULT_GOAL) {
  const upTo = GOAL_LEVELS.slice(0, GOAL_LEVELS.indexOf(goal) + 1).join(' · ');
  return `${upTo} 자료가 쭉 퀴즈와 문장 만들기에 나와요`;
}
