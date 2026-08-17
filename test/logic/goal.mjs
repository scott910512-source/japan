/* 설정한 학습량이 실제 세션 장수와 같은가 — 예전에 20으로 맞춰도 65가 나왔다. */
import { buildDailySession, planDailySession, splitGoal, GOAL_CHOICES } from '../../src/lib/review.js';

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

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
