/* 기기 두 대 합치기 — 순서를 바꿔도 같은 결과가 나오는가. */
import { mergeReview, mergeStats, mergeStreak, mergeCustomWords, mergeMemos, mergeProgress, mergeConj, mergeRpg } from '../../src/lib/merge.js';
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

/* 동사 활용 성적 — 아이폰에서 1형을 풀고 아이패드에서 2형을 풀었으면 둘 다 남아야 한다.
   그리고 더하면 안 된다: 같은 기기에서 동기화를 두 번만 눌러도 숫자가 두 배가 된다. */
{
  const phone = { forms: { '1|masu': { right: 8, wrong: 2 } }, words: { 'v-nomu': { right: 3, wrong: 1 } } };
  const pad = { forms: { '2|ta': { right: 4, wrong: 0 } }, words: { 'v-taberu': { right: 2, wrong: 0 } } };
  const m = mergeConj(phone, pad);
  ok('두 기기에서 푼 게 다 남는다', Boolean(m.forms['1|masu'] && m.forms['2|ta']), Object.keys(m.forms).join(','));
  ok('동사별 성적도 둘 다', Object.keys(m.words).length === 2, Object.keys(m.words).join(','));

  const same = mergeConj(phone, phone);
  ok('같은 걸 두 번 합쳐도 안 늘어난다', same.forms['1|masu'].right === 8, String(same.forms['1|masu'].right));

  const both = mergeConj(
    { forms: { '1|masu': { right: 8, wrong: 2 } } },
    { forms: { '1|masu': { right: 3, wrong: 9 } } },
  );
  ok('겹치면 각각 큰 쪽', both.forms['1|masu'].right === 8 && both.forms['1|masu'].wrong === 9,
    JSON.stringify(both.forms['1|masu']));

  /* progress를 통째로 덮으면 다른 기기 성적이 사라진다 — 그게 이 갈래를 만든 이유다 */
  const merged = mergeProgress(
    { bookmarks: ['a'], conj: phone },
    { bookmarks: ['b'], conj: pad },
  );
  ok('progress로 합쳐도 안 사라짐', Object.keys(merged.conj.forms).length === 2, Object.keys(merged.conj.forms).join(','));
  ok('책갈피는 그대로 합쳐짐', merged.bookmarks.length === 2);

  /* 활용 칸이 아예 없던 옛 기록 */
  ok('한쪽에 칸이 없어도 안 깨짐', Object.keys(mergeConj(undefined, pad).forms).length === 1);
  ok('양쪽 다 없어도 빈 것으로', Object.keys(mergeProgress({}, {}).conj.forms).length === 0);
}

/* ── 일본 생존 — 두 기기에서 깬 판 ──
   여기서 더하면 폰에서 두 번 태블릿에서 두 번 깬 사람이 네 번 깬 걸로
   기록된다. 같은 판을 두 기기가 본 것뿐인데 EXP도 두 배가 된다. */
{
  const phone = { exp: 400, stages: { conbini: { learned: true, checkpoint: 0.9, cleared: 2, best: 480 } } };
  const pad = { exp: 250, stages: { conbini: { learned: true, checkpoint: 0.8, cleared: 3, best: 300 } } };
  const m = mergeRpg(phone, pad);
  ok('EXP는 큰 쪽 — 더하지 않는다', m.exp === 400, String(m.exp));
  ok('깬 횟수도 큰 쪽', m.stages.conbini.cleared === 3, String(m.stages.conbini.cleared));
  ok('최고점은 큰 쪽', m.stages.conbini.best === 480, String(m.stages.conbini.best));

  const twice = mergeRpg(phone, phone);
  ok('같은 걸 두 번 합쳐도 안 늘어난다', twice.exp === 400 && twice.stages.conbini.cleared === 2,
    JSON.stringify(twice));

  const one = mergeRpg({ exp: 0, stages: {} }, pad);
  ok('한쪽만 했어도 남는다', one.stages.conbini.cleared === 3 && one.exp === 250);
  ok('한쪽에서만 체크포인트를 넘겼으면 넘긴 것', mergeRpg(
    { stages: { conbini: { learned: false, checkpoint: 0 } } },
    { stages: { conbini: { learned: true, checkpoint: 0.85 } } },
  ).stages.conbini.learned === true);

  ok('칸이 아예 없던 옛 기록도 안 깨짐', mergeProgress({}, {}).rpg.exp === 0);
  ok('progress로 합쳐도 안 사라짐',
    mergeProgress({ rpg: phone }, { rpg: pad }).rpg.stages.conbini.best === 480);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
