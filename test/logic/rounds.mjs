/* 회독 단계 — 이 앱이 무엇을 하는 앱인지 한 줄로 말하는 것.
 *
 * 여태 회독은 여러 기능 중 하나처럼 보였다. 그런데 실제로 이 앱이 하는 일은
 * 「한 카드를 네 번 맞힐 때까지 간격을 벌려 가며 다시 만나게 하는 것」이고,
 * 나머지는 다 그 주위에 붙은 연습이다.
 *
 * 여기서 지키는 것은 하나 — 회독 수를 새로 만들지 않는다. review.js가 복습
 * 간격을 정할 때 쓰는 그 숫자를 그대로 읽는다. 두 벌로 두면 화면에 뜬 회독
 * 수와 실제 복습 간격이 어긋나고, 그건 아무도 못 알아챈다. */
import {
  ROUND_MAX, STAGES, roundOf, stageOf, roundSummary, dotsOf, roundLabel,
} from '../../src/lib/rounds.js';
import { applyVerdict, emptyState, todayKey, VERDICT, MASTER_STREAK } from '../../src/lib/review.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const TODAY = todayKey();
/* 실제로 판정을 먹여서 만든다. 손으로 상태를 지어내면 review.js가 규칙을
   바꿔도 이 검사는 옛 규칙 위에서 계속 통과한다. */
const after = (verdicts) => verdicts.reduce(
  (st, v) => applyVerdict(st, v, TODAY),
  emptyState(),
);
const K = VERDICT.KNOWN;
const X = VERDICT.UNKNOWN;

console.log('\n[ 회독 수 ]');
ok('안 본 카드는 0회독', roundOf(emptyState()) === 0);
ok('한 번 맞히면 1회독', roundOf(after([K])) === 1);
ok('두 번 이어서 맞히면 2회독', roundOf(after([K, K])) === 2);
ok('네 번이 끝', roundOf(after([K, K, K, K, K, K])) === ROUND_MAX, `${ROUND_MAX}`);
ok('끝이 review.js와 같다', ROUND_MAX === MASTER_STREAK);

/* ★ 회독은 「몇 번 봤나」가 아니라 「얼마나 붙었나」다 ★
   틀리면 0으로 돌아간다. 그때 회독 수를 그대로 두면 「3회독인데 모른다」는
   말이 되고, 화면과 실제 복습 간격이 어긋난다. */
ok('틀리면 처음으로 돌아간다', roundOf(after([K, K, K, X])) === 0, `${roundOf(after([K, K, K, X]))}`);
ok('다시 맞히면 다시 1회독', roundOf(after([K, K, K, X, K])) === 1);

console.log('\n[ 단계 ]');
ok('단계는 여섯', STAGES.length === 6, STAGES.map((s) => s.label).join(' / '));
ok('단계마다 설명이 있다', STAGES.every((s) => s.label && s.sub));
ok('안 본 것', stageOf(emptyState()) === 'fresh');
ok('한 번 봤으면 1회독', stageOf(after([K])) === 'round1');
ok('두 번', stageOf(after([K, K])) === 'round2');
ok('세 번', stageOf(after([K, K, K])) === 'round3');
ok('네 번이면 완료', stageOf(after([K, K, K, K])) === 'done');
/* 틀린 카드는 회독이 0으로 돌아가도 「아직」이 아니다 — 본 적은 있다 */
ok('틀려도 안 본 것으로는 안 돌아간다', stageOf(after([K, K, X])) === 'round1');

/* ★ 완료는 「다시는 안 나옴」이 아니다 ★
   그렇게 보이면 완료된 카드가 다시 나올 때 고장으로 읽힌다. 한 달 · 석 달 ·
   반년으로 간격만 벌리며 계속 만난다 — 그게 장기복습이다. */
ok('완료한 뒤로 더 만나면 장기복습',
  stageOf(after([K, K, K, K, K, K, K])) === 'long',
  stageOf(after([K, K, K, K, K, K, K])));
ok('장기복습이라고 적어 준다', STAGES.find((s) => s.id === 'long').label === '장기복습');

console.log('\n[ 점 ]');
ok('점은 넷', dotsOf(emptyState()).length === ROUND_MAX);
ok('안 봤으면 다 비었다', dotsOf(emptyState()).every((d) => !d));
ok('2회독이면 둘만 찼다', dotsOf(after([K, K])).filter(Boolean).length === 2);
ok('완료면 다 찼다', dotsOf(after([K, K, K, K])).every(Boolean));
/* 숫자만 적으면 4가 끝인지 10이 끝인지 모른다 — 점은 끝도 같이 말한다 */
ok('완료 뒤에도 다 찬 채로', dotsOf(after([K, K, K, K, K, K, K])).every(Boolean));

console.log('\n[ 한 줄 설명 ]');
ok('안 본 것', roundLabel(emptyState()) === '처음 보는 카드');
ok('보는 중이면 몇 회독인지', roundLabel(after([K, K])) === `2 / ${ROUND_MAX} 회독`);
ok('완료', roundLabel(after([K, K, K, K])) === '완료');

console.log('\n[ 전체 현황 ]');
{
  const review = {
    a: after([K]), b: after([K, K]), c: after([K, K, K]),
    d: after([K, K, K, K]), e: after([K, K, K, K, K, K, K]),
  };
  const sum = roundSummary(['a', 'b', 'c', 'd', 'e', 'f'], review);
  ok('단계마다 세어진다',
    sum.round1 === 1 && sum.round2 === 1 && sum.round3 === 1 && sum.done === 1 && sum.long === 1,
    JSON.stringify(sum));
  /* 「아직」을 빼지 않는다 — 남은 게 얼마인지가 진도의 절반이다 */
  ok('안 본 것도 센다', sum.fresh === 1, `${sum.fresh}`);
  ok('빠짐 없이 센다', Object.values(sum).reduce((a, b) => a + b, 0) === 6);
  ok('빈 기록으로도 안 죽는다', roundSummary(['x'], {}).fresh === 1);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
