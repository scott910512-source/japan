/* 기기 두 대 합치기 — 순서를 바꿔도 같은 결과가 나오는가. */
import { mergeReview, mergeStats, mergeStreak, mergeCustomWords, mergeMemos } from '../../src/lib/merge.js';
import { applyVerdict, emptyState, VERDICT } from '../../src/lib/review.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? '— ' + e : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };
const same = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
};

const study = (from, to, verdict, day, at) => {
  const out = {};
  for (let i = from; i <= to; i++) out[`w-${i}`] = applyVerdict(emptyState(), verdict, day, at);
  return out;
};

// 아이폰 1~50 (어제), 아이패드 41~70 (오늘) — 41~50이 겹친다
const phone = study(1, 50, VERDICT.KNOWN, '2026-08-16', 1_000);
const pad = study(41, 70, VERDICT.KNOWN, '2026-08-17', 2_000);

const A = mergeReview(pad, mergeReview(phone, {}));   // 폰 → 패드
const B = mergeReview(phone, mergeReview(pad, {}));   // 패드 → 폰

ok('한 장도 안 잃는다', Object.keys(A).length === 70, `${Object.keys(A).length}장`);
ok('순서를 바꿔도 같다', same(A, B));
ok('겹친 카드는 나중에 본 쪽', A['w-45'].lastSeen === '2026-08-17', A['w-45'].lastSeen);
ok('한쪽에만 있던 것도 남는다', Boolean(A['w-1'] && A['w-70']));
ok('다시 합쳐도 안 불어난다', same(mergeReview(A, A), A));

// 같은 날, 같은 카드를 두 기기에서 다르게 판정
const amKnown = { 'w-9': applyVerdict(emptyState(), VERDICT.KNOWN, '2026-08-17', 1_000) };
const pmUnknown = { 'w-9': applyVerdict(emptyState(), VERDICT.UNKNOWN, '2026-08-17', 2_000) };
const first = mergeReview(pmUnknown, mergeReview(amKnown, {}));
const second = mergeReview(amKnown, mergeReview(pmUnknown, {}));
ok('같은 날이면 나중에 누른 쪽이 이긴다', first['w-9'].box === 1, `box ${first['w-9'].box}`);
ok('올리는 순서를 바꿔도 마찬가지', second['w-9'].box === 1, `box ${second['w-9'].box}`);
ok('틀린 횟수는 둘 중 큰 값', first['w-9'].wrongCount === 1);

// 시각 기록이 없던 옛 기록과 섞여도 안 깨진다
const old = { 'w-3': { box: 3, streak: 2, lastSeen: '2026-08-10', rounds: 2, wrongCount: 0, vagueCount: 0 } };
const fresh = { 'w-3': applyVerdict(emptyState(), VERDICT.UNKNOWN, '2026-08-17', 5_000) };
ok('옛 기록보다 새 기록이 이긴다', mergeReview(fresh, old)['w-3'].box === 1);
ok('날짜가 앞서면 옛 기록이 이긴다', mergeReview(old, { 'w-3': { ...fresh['w-3'] } })['w-3'].lastSeen === '2026-08-17');

// 나머지 갈래
ok('통계는 큰 쪽 (합치지 않는다)',
  mergeStats({ d: { studied: 30 } }, { d: { studied: 50 } }).d.studied === 50);
ok('연속일은 큰 쪽', mergeStreak({ count: 3, lastDate: '2026-08-16' }, { count: 5, lastDate: '2026-08-17' }).count === 5);
ok('내 단어는 양쪽 다', mergeCustomWords([{ id: 'a' }], [{ id: 'b' }]).length === 2);
ok('메모는 나중에 고친 쪽',
  mergeMemos({ x: { text: '새것', at: '2026-08-17' } }, { x: { text: '옛것', at: '2026-08-10' } }).x.text === '새것');

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
