/* 낱말의 세 칸 — 뜻 · 읽기 · 떠올리기 (lib/review.js, 2026-11-19)
 * 한자 · 읽기 · 뜻이 다 붙어야 외운 것이다. 칸마다 날짜를 둔 확인을 따로 세고, 카드 단계는 가장 낮은 칸이다. */
import assert from 'node:assert/strict';
import {
  applyVerdict, withFacets, migrateFacets, facetLevels, weakestFacet, facetsEven, isMastered, isWordCard, needsReading, VERDICT, addDays,
} from '../../src/lib/review.js';
import { stepForFacet, facetForStep, STEP } from '../../src/lib/steps.js';
import { stageOf } from '../../src/lib/rounds.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
const W = { id: 'w1', kanji: '食べる', kana: 'たべる', mean: '먹다', type: 'verb' };
const KANA = { id: 'w2', kanji: 'ちょっと', kana: 'ちょっと', mean: '조금', type: 'adv' };
const T = '2026-11-19';
const mastered = { lastSeen: '2026-11-01', seenAt: 1, level: 4, box: 2, due: '2026-12-01', promotedOn: '2026-11-01', rounds: 8, streak: 3, wrongCount: 0, vagueCount: 0 };

check('★ 옛 「외움」은 「뜻만 확인됨」으로 — 뜻 4, 읽기 · 떠올리기 0, 외움 아님 ★', () => {
  const m = withFacets(mastered, W);
  assert.equal(m.fx.mean.lv, 4); assert.equal(m.fx.read.lv, 0); assert.equal(m.fx.prod.lv, 0); assert.equal(m.fx.listen.lv, 0);
  assert.equal(m.level, 0); assert.equal(isMastered(m), false);
});
check('★ 옮겨도 다음 복습일은 그대로(하루에 몰려 나오지 않는다) ★', () => assert.equal(withFacets(mastered, W).due, '2026-12-01'));
check('가나로만 쓰는 낱말은 읽기 칸이 없다', () => {
  assert.equal(needsReading(KANA), false);
  const m = withFacets(mastered, KANA);
  assert.deepEqual(m.fx.read, { na: 1 });
  assert.equal(facetLevels(m).map((f) => f.key).join(), 'mean,prod,listen');
});
check('자가 신고(이미 알아요)는 건드리지 않는다', () => { const s = { ...mastered, selfKnown: true }; assert.equal(withFacets(s, W), s); });
check('판정은 그 칸에만 — 읽기를 알아요 하면 읽기만 오른다', () => {
  const m = withFacets(mastered, W);
  const a = applyVerdict(m, VERDICT.KNOWN, '2026-12-01', 1, 'read');
  assert.equal(a.fx.read.lv, 1); assert.equal(a.fx.prod.lv, 0); assert.equal(a.fx.mean.lv, 4);
  assert.equal(a.level, 0);   // 떠올리기가 아직 0
});
check('★ 네 칸이 다 4단계가 돼야 외움 ★', () => {
  let s = withFacets(undefined, W);
  let d = T;
  for (let i = 0; i < 6; i++) {
    for (const f of ['mean', 'read', 'prod']) s = applyVerdict(s, VERDICT.KNOWN, d, 1, f);
    d = addDays(d, 40);
  }
  assert.equal(isMastered(s), false, '듣기가 아직 0이면 외움 아님');
  for (let i = 0; i < 6; i++) { s = applyVerdict(s, VERDICT.KNOWN, d, 1, 'listen'); d = addDays(d, 40); }
  assert.ok(isMastered(s), JSON.stringify(s.fx));
  const broken = applyVerdict(s, VERDICT.UNKNOWN, d, 1, 'read');
  assert.equal(broken.level, 0); assert.equal(isMastered(broken), false);
  assert.ok(broken.fx.mean.lv >= 4, '뜻은 그대로');
});
check('같은 날 여러 번 맞혀도 칸마다 하루 한 칸', () => {
  let s = withFacets(undefined, W);
  for (let i = 0; i < 5; i++) s = applyVerdict(s, VERDICT.KNOWN, T, 1, 'mean');
  assert.equal(s.fx.mean.lv, 1);
});
check('칸 이름이 없으면(옛 호출) 뜻 칸으로', () => {
  const s = applyVerdict(withFacets(undefined, W), VERDICT.KNOWN, T);
  assert.equal(s.fx.mean.lv, 1); assert.equal(s.fx.read.lv, 0);
});
check('문장 · 문법 카드는 칸이 없다(예전 그대로)', () => {
  assert.equal(isWordCard({ id: 's', type: 'sentence', kind: 'sentence' }), false);
  assert.equal(isWordCard({ id: 'g', type: 'etc', grammar: true }), false);
  const s = applyVerdict(undefined, VERDICT.KNOWN, T);
  assert.equal(s.fx, undefined); assert.equal(s.level, 1);
});
check('★ 옛 기록 옮기기: 낱말만, 바뀐 게 없으면 같은 객체 ★', () => {
  const byId = new Map([[W.id, W], ['s1', { id: 's1', type: 'sentence', kind: 'sentence' }]]);
  const rv = { w1: mastered, s1: mastered };
  const out = migrateFacets(rv, byId);
  assert.ok(out.w1.fx && !out.s1.fx);
  assert.equal(migrateFacets(out, byId), out);
});
check('기억 단계 화면(stageOf)도 가장 낮은 칸 기준', () => {
  const m = withFacets(mastered, W);
  assert.notEqual(stageOf(m), 'done');
});
check('★ 오늘 묻는 칸: 가장 약한 칸 → 단계 ★', () => {
  const m = withFacets(mastered, W);
  assert.equal(weakestFacet(m, '2026-12-01'), 'read');
  assert.equal(stepForFacet('read', { meanLevel: 4 }), STEP.RECALL);
  assert.equal(stepForFacet('prod', { meanLevel: 4 }), STEP.PRODUCE);
  assert.equal(stepForFacet('read', { meanLevel: 0 }), STEP.READ, '처음 배우는 낱말은 읽기부터');
});
check('단계 → 칸: 읽는 법 · 소리 내어 = 읽기, 한→일 = 떠올리기, 읽기 = 뜻, 듣기 = 듣기', () => {
  assert.equal(facetForStep(STEP.RECALL), 'read'); assert.equal(facetForStep(STEP.SPEAK), 'read');
  assert.equal(facetForStep(STEP.PRODUCE), 'prod'); assert.equal(facetForStep(STEP.READ), 'mean'); assert.equal(facetForStep(STEP.LISTEN), 'listen');
  assert.equal(facetForStep(null, { direction: 'mean-kanji' }), 'prod');
});
check('세 칸이 고르면(facetsEven) 예전 단계 순서, 고르지 않으면 약한 칸', () => {
  assert.equal(facetsEven(withFacets(undefined, W)), true);
  assert.equal(facetsEven(withFacets(mastered, W)), false);
});
check('★ 세 칸 기록(듣기 칸 없음)은 듣기 칸만 0에서 붙인다 — 다른 칸 · 복습일 그대로 ★', () => {
  const three = { ...mastered, level: 2, due: '2026-12-05', fx: { mean: { lv: 3, due: '2026-12-20', on: null }, read: { lv: 2, due: '2026-12-05', on: null }, prod: { lv: 2, due: '2026-12-10', on: null } } };
  const m = withFacets(three, W);
  assert.equal(m.fx.mean.lv, 3); assert.equal(m.fx.read.lv, 2); assert.equal(m.fx.prod.lv, 2);
  assert.deepEqual(m.fx.listen, { lv: 0, due: '2026-12-05', on: null });
  assert.equal(m.level, 0); assert.equal(m.due, '2026-12-05');
  const byId = new Map([[W.id, W]]);
  const out = migrateFacets({ w1: three }, byId);
  assert.ok(out.w1.fx.listen); assert.equal(migrateFacets(out, byId), out, '두 번 옮겨도 그대로');
});
check('★ 듣기 칸: 듣기 단계로 묻고, 눈으로만이면 미룬다 ★', () => {
  const s = { ...withFacets(undefined, W), lastSeen: T };
  const st = { ...s, fx: { mean: { lv: 2, due: T }, read: { lv: 2, due: T }, prod: { lv: 2, due: T }, listen: { lv: 0, due: T } } };
  assert.equal(weakestFacet(st, T), 'listen');
  assert.equal(stepForFacet('listen', { meanLevel: 2 }), STEP.LISTEN);
  assert.notEqual(weakestFacet(st, T, { canListen: false }), 'listen');
  const a = applyVerdict(st, VERDICT.KNOWN, T, 1, facetForStep(STEP.LISTEN));
  assert.equal(a.fx.listen.lv, 1); assert.equal(a.fx.mean.lv, 2);
});
check('「이미 알아요」는 네 칸 모두 채운다', () => {
  const s = applyVerdict(withFacets(undefined, W), VERDICT.MASTER, T);
  assert.equal(s.fx.listen.lv, s.fx.mean.lv);
});
console.log(`통과 ${pass} / 실패 0`);
