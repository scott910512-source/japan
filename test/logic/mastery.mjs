/* 같은 날 반복과 장기 숙련도.
 *
 * ★ 오늘 네 번 맞힌 것은 「오늘 외웠다」이지 「사흘 뒤에도 안다」가 아니다 ★
 *
 * 예전엔 「알아요」를 누를 때마다 streak을 올렸고 streak 4면 졸업이었다.
 * 그래서 한 자리에서 네 번 누르면 그 카드는 졸업하고 30일 동안 안 나왔다.
 * 게다가 복습일을 lastSeen에서 계산해서, 기한 전에 미리 연습만 해도 확인받을
 * 날이 계속 뒤로 밀렸다.
 *
 * 이제 둘로 나뉜다.
 *   streak  이번 판의 연속 — 판이 언제 끝나는지만 정한다
 *   level   날짜를 두고 확인된 기억 — 복습 간격을 정한다 */
import {
  applyVerdict, emptyState, stateOf, dueDate, isDue, isMastered, isSelfKnown,
  isDoneEnough, isSessionClear, migrateState, intervalOf, MASTER_STREAK, VERDICT,
  addDays, nextReviewLabel, selfKnownLabel, MASTERY_RULE,
} from '../../src/lib/review.js';
import { roundOf, stageOf, roundSummary } from '../../src/lib/rounds.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const K = VERDICT.KNOWN; const X = VERDICT.UNKNOWN; const V = VERDICT.VAGUE;
const D0 = '2026-09-05';

console.log('\n[ ★ 필수 회귀 2 — 같은 날 알아요 네 번으로 졸업하지 않는다 ★ ]');
{
  let st = emptyState();
  for (let i = 0; i < 4; i++) st = applyVerdict(st, K, D0);
  ok('★ 졸업 안 함 ★', !isMastered(st), `level ${st.level}`);
  ok('회독은 한 칸만 올랐다', st.level === 1, `${st.level}`);
  ok('이번 판의 연속은 그대로 센다', st.streak === 4, `${st.streak}`);
  /* 판이 언제 끝나는지는 streak이 정한다 — 그 기능은 안 없앤다 */
  ok('한 번 맞히면 이번 판에서는 정리된다', isSessionClear(st));
  ok('★ 다음 복습이 30일 뒤가 아니다 ★', dueDate(st) === '2026-09-06', dueDate(st));
  ok('열 번을 눌러도 마찬가지', (() => {
    let s2 = emptyState();
    for (let i = 0; i < 10; i++) s2 = applyVerdict(s2, K, D0);
    return s2.level === 1;
  })());
}

console.log('\n[ 날짜를 두고 확인하면 오른다 ]');
{
  let st = emptyState(); let day = D0; const log = [];
  for (let i = 0; i < 4; i++) {
    st = applyVerdict(st, K, day);
    log.push(`${day}→L${st.level}`);
    day = st.due;                 // 복습일에 맞춰 다시 온다
  }
  ok('네 번 만에 졸업', isMastered(st), log.join(' '));
  ok('간격이 벌어진다', dueDate(st) === '2026-10-16', dueDate(st));
  ok('회독 수와 level이 같다', roundOf(st) === MASTER_STREAK);
  ok('단계는 완료', stageOf(st) === 'done');
}

console.log('\n[ ★ 필수 회귀 3 — 기한 전 반복으로 복습일이 안 밀린다 ★ ]');
{
  let st = applyVerdict(emptyState(), K, D0);   // due 2026-09-06
  const first = st.due;
  // 같은 날 계속 연습
  for (let i = 0; i < 5; i++) st = applyVerdict(st, K, D0);
  ok('★ 복습일이 그대로 ★', st.due === first, `${first} → ${st.due}`);
  ok('level도 그대로', st.level === 1, `${st.level}`);

  /* 복습일이 지나서 오면 그때 오른다 */
  const ripe = applyVerdict(st, K, '2026-09-06');
  ok('복습일이 되면 오른다', ripe.level === 2, `${ripe.level}`);
  ok('그때 간격이 벌어진다', ripe.due === '2026-09-09', ripe.due);

  /* 하루가 지나도 복습일 전이면 안 오른다 — 「매일 미리 연습」으로도 못 올린다 */
  let early = applyVerdict(emptyState(), K, D0);
  early = applyVerdict(early, K, '2026-09-06');   // due 2026-09-09, L2
  const keep = early.due;
  early = applyVerdict(early, K, '2026-09-07');   // 아직 기한 전
  ok('기한 전 다른 날에 해도 안 오른다', early.level === 2, `${early.level}`);
  ok('그 날짜도 복습일을 안 민다', early.due === keep, `${keep} → ${early.due}`);
}

console.log('\n[ 실패하면 내려가고 재학습으로 잇는다 ]');
{
  let st = emptyState(); let day = D0;
  for (let i = 0; i < 4; i++) { st = applyVerdict(st, K, day); day = st.due; }
  ok('졸업한 상태', isMastered(st));
  const bad = applyVerdict(st, X, '2026-11-01');
  ok('★ 졸업이 풀린다 ★', !isMastered(bad));
  ok('맨 아래로 내려간다', bad.level === 0, `${bad.level}`);
  ok('오늘 다시 만난다', bad.due === '2026-11-01' && isDue(bad, '2026-11-01'));

  const vague = applyVerdict(st, V, '2026-11-01');
  ok('애매해요는 한 칸만 내린다', vague.level === MASTER_STREAK - 1, `${vague.level}`);
  ok('애매해요도 오늘 다시 만난다', isDue(vague, '2026-11-01'));
}

console.log('\n[ 검증된 숙련과 자가 신고를 가른다 ]');
{
  const self = applyVerdict(emptyState(), VERDICT.MASTER, D0);
  ok('「이미 알아요」는 그대로 있다', isSelfKnown(self));
  ok('★ 검증된 숙련으로는 안 센다 ★', !isMastered(self));
  ok('그래도 큐에서는 빠진다', isDoneEnough(self));
  ok('단계에 따로 적힌다', stageOf(self) === 'self', stageOf(self));
  /* 통계에서 섞이면 「내가 확인한 것」과 「앱이 확인한 것」을 구별 못 한다 */
  const sum = roundSummary(['a'], { a: self });
  ok('현황에서도 따로 센다', sum.self === 1 && sum.done === 0, JSON.stringify(sum));
}

console.log('\n[ ★ 필수 회귀 9 — 옛 기록을 손상시키지 않는다 ★ ]');
{
  /* 옛 기록에는 「어느 날 맞혔는가」가 없다. 없는 이력을 지어내지 않는다 —
     지금 사용자가 보고 있는 상태를 그대로 옮기고, 새 규칙은 여기서부터. */
  const old = {
    box: 3, streak: 3, lastSeen: '2026-08-01', seenAt: 1,
    rounds: 5, wrongCount: 1, vagueCount: 0,
  };
  const m = migrateState(old);
  ok('회독 수가 그대로 보인다', m.level === 3, `${m.level}`);
  ok('복습일이 옛 규칙 그대로', m.due === '2026-08-08', m.due);
  ok('오늘 또 오르지 않게 표시한다', m.promotedOn === '2026-08-01');
  ok('틀린 횟수가 안 사라진다', m.wrongCount === 1);
  ok('자가 신고로 오해하지 않는다', m.selfKnown === false);
  ok('두 번 옮겨도 안 바뀐다', migrateState(m).level === 3 && migrateState(m).due === m.due);

  // 한 번도 안 본 카드
  const fresh = migrateState(undefined);
  ok('빈 기록도 안 죽는다', fresh.level === 0 && fresh.due === null);
  ok('stateOf가 알아서 옮긴다', stateOf({ a: old }, 'a').level === 3);

  /* 새 기록은 건드리지 않는다 */
  const modern = applyVerdict(emptyState(), K, D0);
  ok('새 기록은 그대로 통과', migrateState(modern).due === modern.due);
}

console.log('\n[ 간격표 ]');
ok('1회독 하루', intervalOf(1) === 1);
ok('2회독 사흘', intervalOf(2) === 3);
ok('4회독 한 달', intervalOf(4) === 30);
ok('졸업 뒤에도 계속 만난다', intervalOf(9) === 180, `${intervalOf(9)}`);

console.log('\n[ ★ 안내 문구는 실제 복습일에서 만든다 ★ ]');
{
  /* 판정 화면 둘이 「졸업 처리했어요 — 한 달 뒤에 한 번만 다시 나와요」를
     적어 두었다. 그런데 그 판정이 실제로 잡는 복습일은 180일 뒤다.
     사용자는 한 달을 기다리는데 앱은 반년을 셌다. */
  const st = applyVerdict(emptyState(), VERDICT.MASTER, D0);
  const label = selfKnownLabel(st, D0);
  ok('★ 「한 달」이라고 하지 않는다 ★', !label.includes('한 달'), label);
  ok('실제 간격(반년)을 말한다', /6달/.test(label), label);
  ok('날짜도 실제 due와 맞다', dueDate(st) === addDays(D0, 180), dueDate(st));

  /* ★ 졸업이라고 부르지 않는다 ★
     이 판정은 자가 신고다. 코드는 selfKnown으로 따로 적어 검증된 숙련과
     구별하는데, 화면만 둘을 같은 말로 불렀다. */
  ok('★ 졸업이라고 하지 않는다 ★', !label.includes('졸업'), label);
  ok('자가 신고임을 말한다', /이미 아는/.test(label), label);
  ok('실제로도 검증된 숙련이 아니다', isMastered(st) === false && isSelfKnown(st) === true);
}

console.log('\n[ 복습일 문구가 간격마다 달라진다 ]');
{
  const at = (days) => nextReviewLabel({ lastSeen: D0, due: addDays(D0, days), level: 1 }, D0);
  ok('오늘', at(0) === '오늘 다시 나와요', at(0));
  ok('내일', at(1) === '내일 다시 나와요', at(1));
  ok('사흘', at(3) === '3일 뒤에 다시 나와요', at(3));
  ok('한 달', at(30) === '한 달쯤 뒤에 다시 나와요', at(30));
  ok('석 달', at(90) === '3달쯤 뒤에 다시 나와요', at(90));
  ok('반년', at(180) === '6달쯤 뒤에 다시 나와요', at(180));
  /* 지난 복습일은 「지났다」가 아니라 「오늘」이다 — 오늘 큐에 들어오니까 */
  ok('밀린 것은 오늘', at(-5) === '오늘 다시 나와요', at(-5));
  ok('한 번도 안 본 것은 문구가 없다', nextReviewLabel(emptyState(), D0) === null);
}

console.log('\n[ ★ 완료 규칙을 한자리 반복으로 설명하지 않는다 ★ ]');
{
  /* 기록 화면이 「'알아요'를 이어서 네 번 고르면 완료예요」라고 적어 두었다.
     한자리에서 네 번 누르면 되는 것처럼 읽히는데, 실제로는 하루에 한 칸만,
     복습일에만 오른다. mastery.mjs 앞쪽에서 그 동작을 이미 검사한다. */
  ok('★ 「이어서」로 설명하지 않는다 ★', !MASTERY_RULE.includes('이어서'), MASTERY_RULE);
  ok('하루 한 칸을 말한다', /하루에 한 칸/.test(MASTERY_RULE));
  ok('복습일 조건을 말한다', /복습일/.test(MASTERY_RULE));
  ok('필요한 횟수를 말한다', MASTERY_RULE.includes(String(MASTER_STREAK)));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
