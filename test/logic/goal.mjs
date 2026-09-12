/* 설정한 학습량이 실제 세션 장수와 같은가 — 예전에 20으로 맞춰도 65가 나왔다. */
import { buildDailySession, planDailySession, splitGoal, GOAL_CHOICES } from '../../src/lib/review.js';
import {
  DAY_PRESETS, spreadGoal, goalTotal, presetOf, DEFAULT_GOALS,
} from '../../src/lib/daily.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };

const ids = Array.from({ length: 2330 }, (_, i) => `w${i}`);
const T = '2026-08-16';

// 첫날 — 복습할 게 없다
for (const g of GOAL_CHOICES) {
  const s = buildDailySession(ids, {}, { goal: g, today: T });
  ok(`첫날 ${g}장 → ${s.queue.length}장`, s.queue.length === g, `${s.queue.length}`);
}

// 며칠 뒤 — 복습이 섞인다
const prog = {};
for (let i = 0; i < 300; i++) prog[`w${i}`] = { box: (i % 3) + 1, streak: i % 3, lastSeen: '2026-08-01', rounds: 2, wrongCount: i % 4, vagueCount: 0 };
for (const g of GOAL_CHOICES) {
  const s = buildDailySession(ids, prog, { goal: g, today: T });
  const want = splitGoal(g);
  ok(`복습 있는 날 ${g}장 → ${s.queue.length}장 (복습 ${s.reviewPicked})`,
    s.queue.length === g && s.reviewPicked === want.review, `${s.queue.length}/${s.reviewPicked}`);
  ok(`  미리 센 것과 같음`, planDailySession(ids, prog, { goal: g, today: T }).total === s.queue.length);
  ok('  중복 없음', new Set(s.queue).size === s.queue.length);
}

// 복습할 게 모자라면 신규로 채운다
const few = { w0: { box: 1, streak: 0, lastSeen: '2026-08-01', rounds: 1, wrongCount: 1, vagueCount: 0 } };
const s2 = buildDailySession(ids, few, { goal: 30, today: T });
ok('복습이 1장뿐이어도 30장을 채움', s2.queue.length === 30, `${s2.queue.length} (복습 ${s2.reviewPicked})`);

// 신규가 없으면 복습으로 채운다
const allSeen = {};
ids.forEach((id, i) => { allSeen[id] = { box: 1, streak: 0, lastSeen: '2026-08-01', rounds: 1, wrongCount: 1, vagueCount: 0 }; });
const s3 = buildDailySession(ids, allSeen, { goal: 30, today: T });
ok('다 본 뒤에도 30장을 채움', s3.queue.length === 30, `${s3.queue.length} (복습 ${s3.reviewPicked})`);

// 카드가 학습량보다 적으면 있는 만큼만
const s4 = buildDailySession(ids.slice(0, 7), {}, { goal: 30, today: T });
ok('카드가 모자라면 있는 만큼', s4.queue.length === 7, String(s4.queue.length));

/* ── ★ 고르는 자리는 총량 하나 ★ ──
 *
 * 갈래마다 따로 세는 판단은 맞았다. 문제는 기본값이 셋 다 20이라 자료가
 * 쌓이면 하루가 예순 장이 됐다는 것이다 — 「20」 셋을 본 사람은 스무 장을
 * 고른 줄로 안다. 총량으로 고르고 갈래 배분은 내부에서 한다. */
console.log('\n[ 총량을 갈래로 나눈다 ]');
{
  for (const p of DAY_PRESETS) {
    const s = spreadGoal(p.total);
    ok(`${p.label} ${p.total}장이 총량과 같다`, s.fresh + s.review + s.weak === p.total,
      `${s.fresh}+${s.review}+${s.weak}`);
    /* 복습에 제일 많이 준다 — 이미 본 걸 안 잃는 것이 새로 배우는 것보다 앞선다 */
    ok(`${p.label}은 복습이 제일 많다`, s.review >= s.fresh && s.review >= s.weak,
      `복습 ${s.review} / 신규 ${s.fresh} / 약점 ${s.weak}`);
  }
  ok('총량이 작으면 약점은 0', spreadGoal(4).weak === 0, `${spreadGoal(4).weak}`);
  ok('0을 줘도 최소 한 장', spreadGoal(0).review + spreadGoal(0).fresh >= 1);
  ok('총량을 되읽을 수 있다', goalTotal(spreadGoal(20)) === 20, `${goalTotal(spreadGoal(20))}`);
  ok('옛 숫자 하나도 총량으로 읽힌다', goalTotal(15) === 45, `${goalTotal(15)}`);
}

console.log('\n[ ★ 쓰던 사람의 목표를 프리셋에 억지로 끼우지 않는다 ★ ]');
{
  /* 개편했다고 남이 맞춰 둔 값을 덮어쓰면, 설정을 만진 적 있는 사람이
     다음에 앱을 열었을 때 자기 양이 바뀌어 있다. */
  for (const p of DAY_PRESETS) {
    ok(`${p.label}은 프리셋으로 알아본다`, presetOf(spreadGoal(p.total)) === p.id,
      String(presetOf(spreadGoal(p.total))));
  }
  ok('★ 직접 맞춘 값은 프리셋이 아니다 ★',
    presetOf({ fresh: 20, review: 20, weak: 20 }) === null);
  ok('옛 기본값(60장)도 프리셋이 아니다', presetOf(20) === null);
  ok('빈 값은 지금 기본값으로 읽는다', presetOf(undefined) === presetOf(DEFAULT_GOALS));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
