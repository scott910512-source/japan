/* 오늘의 학습 큐.
 *
 * 이 큐가 잘못 짜이면 앱을 켜자마자 보는 게 잘못된다 — 제일 앞에 있는 기능이라
 * 여기가 조용히 어긋나면 나머지가 다 멀쩡해도 소용이 없다.
 *
 * 특히 두 가지를 본다.
 *   - 같은 게 두 번 들어가지 않는지 (약점이면서 복습일인 카드가 있다)
 *   - 첫 문제가 약점이 아닌지 (시작하자마자 모르는 게 나오면 그날은 거기서 끝난다) */
import {
  buildDailyStudyQueue, planToday, classifyDaily, estimateMinutes, normalizeGoals,
  DEFAULT_GOALS, HARD_WRONG, WEAK_THRESHOLD, SENTENCE_SHARE,
} from '../../src/lib/daily.js';
import { applyVerdict, emptyState, todayKey, addDays, VERDICT } from '../../src/lib/review.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

const TODAY = '2026-08-20';
const W = (n) => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, kind: 'word' }));
const S = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, kind: 'sentence' }));

/* 회독 기록을 손으로 만든다 — 실제 판정 함수를 써야 진짜 모양이 나온다 */
const seen = (verdicts, lastSeen) => {
  let st = emptyState();
  for (const v of verdicts) st = applyVerdict(st, v, lastSeen, 1000);
  return { ...st, lastSeen };
};
const known = (daysAgo) => seen([VERDICT.KNOWN], addDays(TODAY, -daysAgo));
const weak = (daysAgo) => seen([VERDICT.UNKNOWN, VERDICT.UNKNOWN, VERDICT.UNKNOWN], addDays(TODAY, -daysAgo));
// 몰라요를 열 번 넘게 쌓은 카드 — 한 판에 두 번 만나야 한다
const stuck = (daysAgo) => seen(Array(HARD_WRONG + 2).fill(VERDICT.UNKNOWN), addDays(TODAY, -daysAgo));

console.log('── 세 갈래로 겹치지 않게 나눈다');
{
  const pool = [...W(6), ...S(2)];
  const review = {
    w0: known(5),          // 복습일이 지남
    w1: known(0),          // 오늘 봤으니 아직 아님
    w2: weak(5),           // 약점이면서 복습일이기도 하다
    w3: weak(0),           // 약점인데 복습일은 아직
    // w4, w5, s0, s1 은 처음
  };
  const g = classifyDaily(pool, review, TODAY);
  ok('복습은 복습일이 된 것만', g.due.map((x) => x.id).join(',') === 'w0', g.due.map((x) => x.id).join(','));
  ok('약점은 복습일과 상관없이', g.weak.map((x) => x.id).sort().join(',') === 'w2,w3', g.weak.map((x) => x.id).join(','));
  ok('처음 보는 것은 신규', g.fresh.map((x) => x.id).sort().join(',') === 'e'.replace('e', 's0,s1,w4,w5'), g.fresh.map((x) => x.id).join(','));

  /* 겹치면 같은 게 두 번 나온다 */
  const all = [...g.due, ...g.weak, ...g.fresh].map((x) => x.id);
  ok('세 갈래가 안 겹침', new Set(all).size === all.length, all.join(','));
  ok('문장도 갈래에 들어감', g.fresh.some((x) => x.kind === 'sentence'));
}

console.log('\n── 갈래마다 제 목표를 가진다');
{
  const pool = W(300);
  const review = {};
  for (let i = 0; i < 60; i++) review[`w${i}`] = known(5);        // 복습 60
  for (let i = 60; i < 120; i++) review[`w${i}`] = weak(5);       // 약점 60
  const p = planToday(pool, review, { today: TODAY });
  ok('셋을 다 채운다', p.total === 60, `${p.total}개`);
  ok('복습 20', p.review === 20, String(p.review));
  ok('약점 20', p.weak === 20, String(p.weak));
  ok('신규 20', p.fresh === 20, String(p.fresh));
  ok('기본값이 20/20/20', DEFAULT_GOALS.fresh === 20 && DEFAULT_GOALS.review === 20 && DEFAULT_GOALS.weak === 20);

  /* ★ 서로 안 빌린다 ★
     예전엔 하나를 4:3:3으로 쪼갰다. 그러면 복습이 밀린 날 신규가 여섯 장으로
     줄어서, 진도가 밀린 벌로 새로 배우는 걸 뺏겼다. */
  const noReview = planToday(W(300), {}, { today: TODAY });
  ok('복습이 없어도 신규는 제 몫만', noReview.fresh === 20, `신규 ${noReview.fresh}`);
  ok('복습이 없으면 그냥 0', noReview.review === 0 && noReview.weak === 0);

  const onlyReview = {};
  for (let i = 0; i < 200; i++) onlyReview[`w${i}`] = known(9);
  const noFresh = planToday(W(200), onlyReview, { today: TODAY });
  ok('신규가 없어도 복습은 제 몫만', noFresh.review === 20, `복습 ${noFresh.review}`);
  ok('신규가 없으면 그냥 0', noFresh.fresh === 0);

  // 갈래마다 따로 정할 수 있다
  const custom = planToday(pool, review, { goals: { fresh: 5, review: 30, weak: 0 }, today: TODAY });
  ok('갈래마다 따로 정한다', custom.fresh === 5 && custom.review === 30 && custom.weak === 0,
    `${custom.fresh}/${custom.review}/${custom.weak}`);
}

console.log('\n── 갈래를 골라서 짤 수 있다');
{
  /* 홈에서 「단어 외우기」와 「복습하기」를 따로 누른다. 한 판에 다 섞으면
     「복습만 하고 싶다」가 안 된다. */
  const pool = W(300);
  const review = {};
  for (let i = 0; i < 60; i++) review[`w${i}`] = known(5);
  for (let i = 60; i < 120; i++) review[`w${i}`] = weak(5);

  const f = planToday(pool, review, { lanes: ['fresh'], today: TODAY });
  ok('신규만 고르면 신규만', f.total === 20 && f.fresh === 20 && f.review === 0 && f.weak === 0,
    `${f.fresh}/${f.review}/${f.weak}`);

  const b = planToday(pool, review, { lanes: ['review', 'weak'], today: TODAY });
  ok('복습·약점만 고르면 신규가 안 섞인다', b.fresh === 0 && b.total === 40,
    `${b.fresh}/${b.review}/${b.weak}`);

  const q = buildDailyStudyQueue(pool, review, { lanes: ['fresh'], today: TODAY });
  ok('큐에도 신규만', q.queue.every((x) => x.bucket === 'fresh'), q.queue.map((x) => x.bucket).join(',').slice(0, 40));

  ok('안 고르면 셋 다', planToday(pool, review, { today: TODAY }).total === 60);
}

console.log('\n── 몰라요가 열 번 넘으면 한 판에 두 번');
{
  /* 열 번 넘게 틀렸다는 건 그 카드를 만나는 방식이 안 통하고 있다는 뜻이다.
     스무 장 중 한 장으로 묻히면 영영 안 외워진다. */
  const pool = W(100);
  const review = {};
  for (let i = 0; i < 5; i++) review[`w${i}`] = stuck(5);      // 열 번 넘게 틀린 것 5개
  for (let i = 5; i < 40; i++) review[`w${i}`] = weak(5);      // 그냥 약점 35개

  const b = buildDailyStudyQueue(pool, review, { lanes: ['weak'], today: TODAY });
  const ids = b.queue.map((x) => x.id);
  const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
  ok('많이 틀린 게 두 번 나온다', twice.length === 5, `${twice.length}개 (${twice.join(',')})`);
  ok('두 번 나오는 건 열 번 넘게 틀린 것뿐',
    twice.every((id) => Number(id.slice(1)) < 5), twice.join(','));

  /* 목표를 넘겨서 늘리지 않는다 — 그러면 제일 안 외워지는 사람의 하루가 제일 길어진다 */
  ok('몫 안에서 두 자리를 쓴다', b.queue.length === 20, `${b.queue.length}개`);

  /* 붙여 놓으면 두 번째가 그냥 따라 나온다 — 방금 본 걸 다시 보는 건 외운 게 아니다 */
  const gaps = twice.map((id) => {
    const at = ids.map((x, i) => (x === id ? i : -1)).filter((i) => i >= 0);
    return at[1] - at[0];
  });
  ok('두 번째는 멀리 떨어져 있다', gaps.every((g) => g >= 3), gaps.join(','));

  /* 세 번 틀린 정도로는 두 번 안 나온다 */
  const mild = buildDailyStudyQueue(W(100), Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [`w${i}`, weak(5)]),
  ), { lanes: ['weak'], today: TODAY });
  const mildIds = mild.queue.map((x) => x.id);
  ok('세 번 틀린 건 한 번만', new Set(mildIds).size === mildIds.length);

  ok('기준이 열 번', HARD_WRONG === 10);
}

console.log('\n── 옛 설정도 읽힌다');
{
  /* 목표가 셋으로 갈라지기 전에는 숫자 하나였다. 20장 하던 사람이 갑자기
     60장이 되지 않게, 자기가 정한 값을 세 갈래에 그대로 편다. */
  ok('숫자 하나면 셋에 그대로', JSON.stringify(normalizeGoals(15)) === JSON.stringify({ fresh: 15, review: 15, weak: 15 }));
  ok('빠진 칸은 기본값', normalizeGoals({ fresh: 5 }).review === 20);
  ok('아무것도 없으면 기본값', normalizeGoals().fresh === 20);
  ok('음수는 0으로', normalizeGoals({ fresh: -3, review: 0, weak: 0 }).fresh === 0);
}

console.log('\n── 데이터가 적으면 자동으로 맞춘다');
{
  /* 어제 시작한 사람 — 복습도 약점도 없다. 비율만 지키면 6개밖에 안 나온다. */
  const p = planToday(W(100), {}, { goals: 20, today: TODAY });
  ok('처음 켠 사람도 목표만큼', p.total === 20, `${p.total}개`);
  ok('전부 신규로', p.fresh === 20, `신규 ${p.fresh}`);

  /* 복습만 잔뜩 밀린 사람 */
  const review = {};
  for (let i = 0; i < 50; i++) review[`w${i}`] = known(9);
  const q = planToday(W(50), review, { goals: 20, today: TODAY });
  ok('신규가 없으면 복습으로 채움', q.total === 20 && q.review === 20, `복습 ${q.review} 신규 ${q.fresh}`);

  /* 있는 것보다 목표가 크면 있는 만큼만 */
  const r = planToday(W(5), {}, { goals: 30, today: TODAY });
  ok('있는 만큼만 나옴', r.total === 5, `${r.total}개`);

  ok('목표가 0이면 빈 큐', planToday(W(10), {}, { goals: 0, today: TODAY }).total === 0);
  ok('단어가 없어도 안 죽음', planToday([], {}, { goals: 20, today: TODAY }).total === 0);
}

console.log('\n── 졸업한 건 한참 뒤에 한 번만');
{
  /* 졸업했다고 영영 빼면 외운 게 조용히 새어 나간다. 그렇다고 매일 내보내면
     졸업한 뜻이 없다. 복습일이 될 때까지만 뺀다. */
  const grad = (daysAgo) => {
    let st = emptyState();
    for (let i = 0; i < 5; i++) st = applyVerdict(st, VERDICT.KNOWN, addDays(TODAY, -daysAgo), 1000);
    return { ...st, lastSeen: addDays(TODAY, -daysAgo) };
  };

  const soon = classifyDaily(W(3), { w0: grad(10) }, TODAY);
  const all1 = [...soon.due, ...soon.weak, ...soon.fresh].map((x) => x.id);
  ok('졸업한 지 얼마 안 됐으면 안 나옴', !all1.includes('w0'), all1.join(','));

  const late = classifyDaily(W(3), { w0: grad(400) }, TODAY);
  const all2 = [...late.due, ...late.weak, ...late.fresh].map((x) => x.id);
  ok('한참 지나면 복습으로 다시 나옴', late.due.some((x) => x.id === 'w0'), all2.join(','));
  ok('그때도 신규로는 안 셈', !late.fresh.some((x) => x.id === 'w0'));
}

console.log('\n── 순서 (시작하자마자 모르는 게 나오면 그날은 끝난다)');
{
  const pool = W(200);
  const review = {};
  for (let i = 0; i < 40; i++) review[`w${i}`] = known(5);
  for (let i = 40; i < 80; i++) review[`w${i}`] = weak(5);
  // 순서만 보는 자리라 총 스무 장으로 맞춰 둔다
  const MIX20 = { review: 8, weak: 6, fresh: 6 };

  for (let n = 0; n < 12; n++) {   // 섞이니까 여러 번 본다
    const b = buildDailyStudyQueue(pool, review, { goals: MIX20, today: TODAY });
    if (b.queue[0].bucket === 'weak') { ok('첫 문제가 약점이 아님', false, `${n}번째에서 약점으로 시작`); break; }
    if (n === 11) ok('첫 문제가 약점이 아님', true, '12번 다 아님');
  }

  const b = buildDailyStudyQueue(pool, review, { goals: MIX20, today: TODAY });
  ok('목표만큼 큐가 나옴', b.queue.length === 20, `${b.queue.length}개`);
  ok('큐에 같은 게 두 번 없음', new Set(b.queue.map((x) => x.id)).size === b.queue.length);
  ok('앞 세 개는 복습으로 연다', b.queue.slice(0, 3).every((x) => x.bucket === 'review'),
    b.queue.slice(0, 3).map((x) => x.bucket).join(','));

  /* 약점이 한 군데 몰리면 그 구간에서 지친다 */
  const at = b.queue.map((x, i) => (x.bucket === 'weak' ? i : -1)).filter((i) => i >= 0);
  const spread = at.length > 1 ? Math.max(...at) - Math.min(...at) : 0;
  ok('약점이 흩어져 있음', spread >= b.queue.length / 2, `${at.join(',')} (${b.queue.length}개 중)`);

  /* 약점이 없는 사람은 그냥 흘러가야 한다 */
  const nw = buildDailyStudyQueue(W(50), {}, { goals: 10, today: TODAY });
  ok('약점이 없어도 큐가 나옴', nw.queue.length === 10 && nw.weak === 0);
}

console.log('\n── 단어와 문장을 한 큐에');
{
  const pool = [...W(50), ...S(50)];
  const b = buildDailyStudyQueue(pool, {}, { goals: 30, today: TODAY });
  ok('둘 다 섞여 나옴',
    b.queue.some((x) => x.kind === 'word') && b.queue.some((x) => x.kind === 'sentence'),
    `단어 ${b.queue.filter((x) => x.kind === 'word').length} 문장 ${b.queue.filter((x) => x.kind === 'sentence').length}`);
  const p = planToday(pool, {}, { goals: 30, today: TODAY });
  ok('미리 보는 숫자에도 나뉘어 있음', p.words + p.sentences === p.total, `${p.words}+${p.sentences}=${p.total}`);
  ok('반반이면 반반쯤 나옴', Math.abs(p.words - p.sentences) <= 2, `단어 ${p.words} 문장 ${p.sentences}`);

  /* 실제 비율 — 단어가 문장보다 훨씬 많다. 1:1로 뽑으면 문장이 먼저 동나고
     그다음부터는 단어만 나온다. 남은 양에 비례해야 둘이 비슷하게 끝난다. */
  const real = [...W(2330), ...S(600)];
  const q = planToday(real, {}, { goals: 20, today: TODAY });
  ok('많은 쪽이 더 많이 나옴', q.words > q.sentences, `단어 ${q.words} 문장 ${q.sentences}`);
  ok('적은 쪽도 빠지진 않음', q.sentences >= 2, `문장 ${q.sentences}`);

  /* 한 종류밖에 없으면 그냥 그것만 */
  ok('단어만 있으면 단어만', planToday(W(50), {}, { goals: 10, today: TODAY }).words === 10);
  ok('문장만 있으면 문장만', planToday(S(50), {}, { goals: 10, today: TODAY }).sentences === 10);
}

console.log('\n── 문장이 오늘을 다 차지하지 않게 (뚜껑)');
{
  /* 문장에는 레벨이 없어서, 레벨을 좁힐수록 단어만 줄고 문장은 그대로다.
     남은 수에 비례해 뽑으니 스무 개 중 열한 개가 문장이 됐었다. */
  const n5 = [...W(534), ...S(600)];      // N5만 켠 사람의 실제 후보 수
  const p = planToday(n5, {}, { goals: 20, today: TODAY });
  ok('문장이 절반을 안 넘음', p.sentences <= 10, `문장 ${p.sentences} / 단어 ${p.words}`);
  ok('개수는 그대로 채움', p.total === 20, `${p.total}개`);

  ok('목표가 커도 비율은 같음', planToday(n5, {}, { goals: 30, today: TODAY }).sentences <= 15);
  ok('목표가 작아도', planToday(n5, {}, { goals: 10, today: TODAY }).sentences <= 5);

  /* 뚜껑이 문장을 0으로 만들면 안 된다 — 그러려고 비례배분을 넣었다 */
  ok('문장이 아예 빠지진 않음', planToday(n5, {}, { goals: 20, today: TODAY }).sentences >= 2);

  /* 단어가 모자라면 억지로 채우느라 개수를 줄이지는 않는다 */
  const few = [...W(5), ...S(600)];
  const q = planToday(few, {}, { goals: 20, today: TODAY });
  ok('바꿔 넣을 단어가 없으면 개수를 지킴', q.total === 20, `${q.total}개`);
  ok('그때는 뚜껑을 넘겨도 둠', q.sentences > 10, `문장 ${q.sentences}`);

  /* 큐에도 같은 수가 나와야 한다 — 미리 보여 준 숫자와 실제가 다르면 안 된다 */
  const b = buildDailyStudyQueue(n5, {}, { goals: 20, today: TODAY });
  ok('큐에도 뚜껑이 걸림', b.queue.filter((x) => x.kind === 'sentence').length <= 10,
    `문장 ${b.queue.filter((x) => x.kind === 'sentence').length}`);
  ok('큐에 같은 게 두 번 없음', new Set(b.queue.map((x) => x.id)).size === b.queue.length);
  ok('앞머리는 여전히 복습으로 열림', b.queue[0].bucket !== 'weak');

  ok('상수가 절반', SENTENCE_SHARE === 0.5);
}

console.log('\n── 예상 시간');
{
  ok('문장이 단어보다 오래 걸림',
    estimateMinutes(S(10)) > estimateMinutes(W(10)),
    `단어10=${estimateMinutes(W(10))}분 문장10=${estimateMinutes(S(10))}분`);
  ok('0분이라고 안 함', estimateMinutes(W(1)) >= 1, `${estimateMinutes(W(1))}분`);
  ok('빈 것은 0분', estimateMinutes([]) === 0);
  ok('20개면 3분쯤', estimateMinutes(W(20)) === 3, `${estimateMinutes(W(20))}분`);
}

console.log('\n── 남은 것도 알려 준다');
{
  const review = {};
  for (let i = 0; i < 50; i++) review[`w${i}`] = known(5);
  const p = planToday(W(200), review, { goals: 20, today: TODAY });
  ok('오늘 못 담은 복습을 셈', p.left.review === 50 - p.review, `${p.left.review}개 남음`);
  ok('신규도', p.left.fresh === 150 - p.fresh, `${p.left.fresh}개 남음`);
}

console.log('\n── 약점 기준');
ok('회독 쪽과 같은 기준', WEAK_THRESHOLD === 3);
{
  const review = { w0: seen([VERDICT.VAGUE, VERDICT.VAGUE], addDays(TODAY, -5)) };
  const g = classifyDaily(W(1), review, TODAY);
  ok('두 번 애매하면 아직 약점 아님', g.weak.length === 0);
  const r2 = { w0: seen([VERDICT.VAGUE, VERDICT.VAGUE, VERDICT.VAGUE], addDays(TODAY, -5)) };
  ok('세 번이면 약점', classifyDaily(W(1), r2, TODAY).weak.length === 1);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
