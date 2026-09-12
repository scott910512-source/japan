/* 회독 단계 — 이 앱이 무엇을 하는 앱인지 한 눈에 보이게 하는 것.
 *
 * 회독은 여태 여러 기능 중 하나처럼 보였다. 그런데 실제로 이 앱이 하는 일은
 * 「한 카드를 네 번 맞힐 때까지 간격을 벌려 가며 다시 만나게 하는 것」이고,
 * 나머지는 다 그 주위에 붙은 연습이다. 그 뼈대가 화면에 안 보이니 사용자
 * 눈에는 메뉴 열두 개짜리 앱으로 보였다.
 *
 * 그래서 카드 하나가 지금 어디쯤 왔는지를 한 가지 말로 정한다. 「알아요」를
 * 이어서 몇 번 골랐는가 — review.js가 이미 그걸로 복습 간격을 정하니,
 * 새 숫자를 만들지 않고 그것을 그대로 읽는다. 두 벌로 두면 반드시 어긋난다.
 *
 *   아직 안 봄     한 번도 안 봤다
 *   확인 1~3단계   보고 있는 중. 복습일에 확인된 횟수가 그대로 단계다
 *   익숙함         복습일에 네 번 확인됐다 (MASTER_STREAK)
 *   장기복습      익숙해진 뒤로도 한 달·석 달·반년에 한 번씩 다시 만난다
 *
 * ★ 「n회독」이라고 부르지 않는다 ★
 *
 * 「회독」 하나로 세 가지를 부르고 있었다 — 한 판 안의 반복, 날짜를 나눈 확인,
 * 범위를 정해 다시 도는 학습(회독 학습 메뉴). 셋이 같은 말을 쓰니 「3회독」이
 * 오늘 세 번 본 것인지 사흘에 나눠 세 번 확인한 것인지 알 수 없었다.
 * 여기 있는 것은 날짜를 나눈 확인이라 「확인 n단계」로 부른다.
 *
 * sub도 고쳤다. 「두 번 이어서 맞혔어요」는 한자리에서 몰아서 되는 것처럼
 * 읽히는데, 단계는 하루에 한 칸만, 그것도 복습일에만 오른다.
 *
 * 「완료」와 「장기복습」을 가르는 이유는, 완료가 「다시는 안 나옴」이 아니기
 * 때문이다. 그렇게 보이면 완료된 카드가 다시 나올 때 고장으로 읽힌다. */

import { BOX, MASTER_STREAK, stateOf, isMastered, isSelfKnown } from './review.js';

export const ROUND_MAX = MASTER_STREAK;   // 네 번 이어서 맞히면 완료

export const STAGES = [
  { id: 'fresh', label: '아직 안 봄', sub: '한 번도 안 봤어요' },
  { id: 'round1', label: '확인 1단계', sub: '복습일에 한 번 확인했어요' },
  { id: 'round2', label: '확인 2단계', sub: '다른 날에 두 번 확인했어요' },
  { id: 'round3', label: '확인 3단계', sub: '한 번만 더 확인하면 익숙함이에요' },
  { id: 'done', label: '익숙함', sub: `복습일에 ${MASTER_STREAK}번 확인했어요` },
  { id: 'long', label: '장기복습', sub: '한 달 · 석 달 · 반년에 한 번씩' },
  /* 앱이 확인한 적은 없다. 「이미 알아요」로 사용자가 직접 뺀 것이라
     검증된 완료와 같은 칸에 세지 않는다. */
  { id: 'self', label: '이미 알아요', sub: '내가 직접 뺀 것 — 앱이 확인한 건 아니에요' },
];

/* 카드 한 장이 몇 회독인가. 0이면 아직 안 봤거나 다시 처음으로 돌아간 것이다.
 *
 * 틀리면 streak이 0으로 돌아간다. 그때 회독 수를 그대로 두면 「3회독인데
 * 모른다」는 말이 되고, 화면과 실제가 어긋난다 — 회독은 「몇 번 봤나」가
 * 아니라 「얼마나 붙었나」를 세는 숫자다. */
/* 회독 수 = 날짜를 두고 확인된 횟수(level)다.
   이번 판의 연속(streak)이 아니다 — 같은 날 네 번 누른 것을 4회독이라 부르면
   화면의 회독 수와 실제 복습 간격이 어긋난다. */
export function roundOf(st) {
  if (!st?.lastSeen) return 0;
  return Math.min(ROUND_MAX, st.level || 0);
}

export function stageOf(st) {
  if (!st?.lastSeen) return 'fresh';
  if (isSelfKnown(st)) return 'self';
  if (isMastered(st)) {
    /* 완료한 뒤로 간격이 한 달 넘게 벌어졌으면 장기복습으로 본다.
       rounds는 이 카드를 몇 번 판정했는지라, 완료 뒤에도 계속 는다. */
    return (st.rounds || 0) > ROUND_MAX + 1 ? 'long' : 'done';
  }
  const r = roundOf(st);
  if (r >= 3) return 'round3';
  if (r === 2) return 'round2';
  return 'round1';
}

/* 전체가 어느 단계에 얼마나 있는지. 기록 화면이 이걸로 막대를 그린다.
   보고 있는 것만 세지 않는다 — 「아직」이 얼마나 남았는지가 진도의 절반이다. */
export function roundSummary(ids, review) {
  const out = { fresh: 0, round1: 0, round2: 0, round3: 0, done: 0, long: 0, self: 0 };
  for (const id of ids) out[stageOf(stateOf(review, id))] += 1;
  return out;
}

/* 「● ● ○ ○」로 그릴 점 넷. 화면이 이걸 그대로 받는다.
   숫자만 적으면 4가 끝인지 10이 끝인지 모른다 — 점은 끝이 어디인지도 같이 말한다. */
export function dotsOf(st) {
  const r = roundOf(st);
  const full = isMastered(st) || isSelfKnown(st);
  return Array.from({ length: ROUND_MAX }, (_, i) => (full || i < r));
}

/* 이 카드가 지금 어떤 상태인지 한 줄로. 회독 화면이 카드 위에 적는다.
 *
 * 이름은 STAGES에서 가져온다. 여기서 또 적어 두면 같은 상태가 막대에서는
 * 「익숙함」, 카드 위에서는 「완료」로 불린다. */
export function roundLabel(st) {
  const stage = stageOf(st);
  if (stage === 'fresh') return '처음 보는 카드';
  const found = STAGES.find((s) => s.id === stage);
  if (stage === 'self' || stage === 'done' || stage === 'long') return found.label;
  /* 「2 / 4 회독」은 오늘 두 번 본 것처럼 읽힌다 — 날짜를 나눈 확인이라고 적는다 */
  return `확인 ${roundOf(st)} / ${ROUND_MAX}단계`;
}

export { BOX };
