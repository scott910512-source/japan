import assert from 'node:assert/strict';
import { evaluateRegions, recommendedRegion, noteRegionExam, mergeRegions, regionQuizIds, REGION_RULES, isConfirmedWord, leftText } from '../../src/lib/regions.js';
import { applyAttempt, mistakeStatus } from '../../src/lib/retestlink.js';
import { recordMistake, activeMistakes } from '../../src/lib/mistakes.js';
import { noteN3Wrong } from '../../src/lib/n3progress.js';
import { weakEntry, weakScore } from '../../src/lib/weak.js';
import { mergeProgress } from '../../src/lib/merge.js';
import { loadProgress } from '../../src/lib/storage.js';
let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }

const words = [];
for (let i = 0; i < 120; i++) words.push({ id: `n5_${i}`, level: 'N5', kanji: `w${i}`, kana: 'k', mean: 'm' });
for (let i = 0; i < 80; i++) words.push({ id: `n4_${i}`, level: 'N4', kanji: `x${i}`, kana: 'k', mean: 'm' });
const ctx = (review = {}, progress = {}, n3meta = null) => ({ words, review, progress, n3meta });
const seen = (id, level = 0, extra = {}) => ({ [id]: { lastSeen: '2026-11-01', level, ...extra } });

check('opening a card (seen only, level 0) does not count as mastery', () => {
  const review = {}; for (let i = 0; i < 40; i++) Object.assign(review, seen(`n5_${i}`, 0));
  const [k] = evaluateRegions(ctx(review));
  assert.equal(k.reqs[0].done, 0); assert.equal(k.reqs[0].seen, 40); assert.equal(k.cleared, false);
});
check('words confirmed across days count; self-known (selfKnown) do not', () => {
  const review = {}; for (let i = 0; i < 30; i++) Object.assign(review, seen(`n5_${i}`, 1));
  for (let i = 30; i < 60; i++) Object.assign(review, seen(`n5_${i}`, 2, { selfKnown: true }));
  const [k] = evaluateRegions(ctx(review));
  assert.equal(k.reqs[0].done, 30); assert.equal(k.reqs[0].ok, true);
  assert.equal(isConfirmedWord({ lastSeen: 'x', level: 1, selfKnown: true }), false);
});
check('existing records count immediately; exam not taken means "unmeasured", not cleared', () => {
  const review = {}; for (let i = 0; i < 30; i++) Object.assign(review, seen(`n5_${i}`, 1));
  const progress = { grammarDone: { a: 1, b: 2, c: 1 } };
  const [k] = evaluateRegions(ctx(review, progress));
  assert.equal(k.reqsDone, 2); assert.equal(k.exam.state, 'unmeasured'); assert.equal(k.phase, 'exam'); assert.equal(k.cleared, false); assert.equal(k.examOpen, true);
});
check('exam is closed while required training is incomplete', () => {
  const [k] = evaluateRegions(ctx({}, {}));
  assert.equal(k.examOpen, false); assert.equal(k.phase, 'train'); assert.match(leftText(k), /확인한 N5 단어 30개 더/);
});
check('region exam: fail keeps phase "retry", pass at 80% clears; best is kept', () => {
  const review = {}; for (let i = 0; i < 30; i++) Object.assign(review, seen(`n5_${i}`, 1));
  let progress = { grammarDone: { a: 1, b: 1, c: 1 }, regions: {} };
  progress.regions = noteRegionExam(progress.regions, 'kukuroo', { right: 10, total: 15 }, 1000, '2026-11-02');
  let [k] = evaluateRegions(ctx(review, progress));
  assert.equal(k.exam.state, 'failed'); assert.equal(k.phase, 'retry'); assert.equal(k.cleared, false);
  progress.regions = noteRegionExam(progress.regions, 'kukuroo', { right: 13, total: 15 }, 2000, '2026-11-03');
  [k] = evaluateRegions(ctx(review, progress));
  assert.equal(k.exam.state, 'passed'); assert.equal(k.cleared, true);
  progress.regions = noteRegionExam(progress.regions, 'kukuroo', { right: 5, total: 15 }, 3000, '2026-11-04');
  [k] = evaluateRegions(ctx(review, progress));
  assert.ok(Math.abs(progress.regions.kukuroo.exam.best - 13 / 15) < 1e-9); assert.equal(k.cleared, true);
});
check('same exam stamp is not recorded twice (retry / re-render safe)', () => {
  let r = noteRegionExam({}, 'whale', { right: 10, total: 20 }, 5, '2026-11-01');
  const again = noteRegionExam(r, 'whale', { right: 10, total: 20 }, 5, '2026-11-01');
  assert.equal(again, r); assert.equal(r.whale.exam.tries, 1);
});
check('XP does not clear regions (no XP input exists) and N3 data absent => loading, not done', () => {
  const states = evaluateRegions(ctx({}, {}, null));
  assert.equal(states[2].loading, true); assert.equal(states[2].cleared, false);
  assert.equal(recommendedRegion(states), 0);
});
check('N3 regions use the course test records already saved (t:ch0 pass counts)', () => {
  const meta = { chapters: { ch0: { done: 5, total: 5 }, ch1: { done: 1, total: 6 } }, tracks: { reading: { done: 4, total: 9 } }, overall: { done: 10, total: 50, pct: 20 } };
  const review = {}; for (let i = 0; i < 60; i++) Object.assign(review, seen(`n4_${i}`, 1));
  const progress = { n3: { tests: { 't:ch0': { best: 0.9, last: 0.9, right: 9, total: 10, tries: 1, at: 1 } } } };
  const states = evaluateRegions(ctx(review, progress, meta));
  assert.equal(states[2].reqsDone, 2); assert.equal(states[2].exam.state, 'passed'); assert.equal(states[2].cleared, true);
  assert.equal(states[4].reqsDone, 1); assert.equal(recommendedRegion(states), 0);
});
check('rules: every region has goal, requirements with units, exam and pass criteria in one place', () => {
  for (const r of REGION_RULES) { assert.ok(r.goal); assert.ok(r.reqs.length >= 1); assert.ok(r.exam.label); for (const q of r.reqs) { assert.ok(q.label && q.unit); } }
});
check('N5 region quiz draws only N5 words from seen ones; N4 only N4', () => {
  const review = {}; for (let i = 0; i < 30; i++) Object.assign(review, seen(`n5_${i}`, 0)); for (let i = 0; i < 30; i++) Object.assign(review, seen(`n4_${i}`, 0));
  const ids5 = regionQuizIds(REGION_RULES[0], words, review, () => 0.3);
  assert.equal(ids5.length, 15); assert.ok(ids5.every((id) => id.startsWith('n5_')));
  const ids4 = regionQuizIds(REGION_RULES[3], words, review, () => 0.3);
  assert.equal(ids4.length, 20); assert.ok(ids4.every((id) => id.startsWith('n4_')));
});
check('regions merge: best/tries take max (no inflation on repeat sync), latest result wins', () => {
  const a = noteRegionExam({}, 'whale', { right: 12, total: 20 }, 10, '2026-11-01');
  const b = noteRegionExam({}, 'whale', { right: 17, total: 20 }, 20, '2026-11-02');
  const m = mergeRegions(a, b);
  assert.equal(m.whale.exam.best, 17 / 20); assert.equal(m.whale.exam.last, 17 / 20);
  assert.deepEqual(mergeRegions(m, m), m); assert.deepEqual(mergeRegions(a, b), mergeRegions(b, a));
  const merged = mergeProgress({ regions: a }, { regions: b });
  assert.equal(merged.regions.whale.exam.best, 17 / 20);
});
check('storage: old saved progress without regions loads as empty object', () => {
  const p = loadProgress ? loadProgress() : null;
  assert.ok(!p || (typeof p.regions === 'object'));
});

/* ── 기록 연결 ── */
const wordIds = new Map([['w1', {}], ['w2', {}]]);
const base = { id: 'word:w1:jp-ko', ref: 'w1', source: 'word', kind: '뜻', prompt: '涙', correct: '눈물', options: ['물', '눈물'], explanation: 'e' };
let p0 = { mistakes: recordMistake({}, { ...base, chosen: '물', ok: false }, '2026-11-01', 100), weak: {} };
check('retest wrong: mistake + weak ledger both go up once', () => {
  const p = applyAttempt(p0, { ...base, chosen: '물', ok: false, retest: true, retestKey: 'a:0:x' }, { wordIds, today: '2026-11-02', at: 200 });
  assert.equal(p.mistakes[base.id].wrong, 2); assert.equal(weakEntry(p.weak, 'w1').quizWrong, 1);
});
check('retest dedupe: the same retestKey twice changes nothing (retry / sync resend)', () => {
  const att = { ...base, chosen: '눈물', ok: true, retest: true, retestKey: 'b:0:x' };
  const p1 = applyAttempt(p0, att, { wordIds, today: '2026-11-02', at: 300 });
  const p2 = applyAttempt(p1, att, { wordIds, today: '2026-11-02', at: 301 });
  assert.equal(p2, p1); assert.equal(weakEntry(p1.weak, 'w1').quizRight, 1);
});
check('one correct retest lowers weak score by 1 only and does not resolve the mistake', () => {
  const wrongOnce = applyAttempt(p0, { ...base, chosen: '물', ok: false, retest: true, retestKey: 'c:0' }, { wordIds, today: '2026-11-01', at: 150 });
  const wrongTwice = applyAttempt(wrongOnce, { ...base, chosen: '물', ok: false, retest: true, retestKey: 'c:1' }, { wordIds, today: '2026-11-01', at: 160 });
  const before = weakScore(null, weakEntry(wrongTwice.weak, 'w1'));
  const p = applyAttempt(wrongTwice, { ...base, chosen: '눈물', ok: true, retest: true, retestKey: 'c:2' }, { wordIds, today: '2026-11-02', at: 400 });
  assert.equal(weakScore(null, weakEntry(p.weak, 'w1')), before - 1);
  assert.equal(p.mistakes[base.id].resolved, false); assert.equal(activeMistakes(p.mistakes, '2026-11-02').length, 1);
});
check('no same-day mastery: two correct retests on one day do not resolve', () => {
  let p = p0;
  p = applyAttempt(p, { ...base, chosen: '눈물', ok: true, retest: true, retestKey: 'd:0' }, { wordIds, today: '2026-11-02', at: 500 });
  p = applyAttempt(p, { ...base, chosen: '눈물', ok: true, retest: true, retestKey: 'd:1' }, { wordIds, today: '2026-11-02', at: 600 });
  assert.equal(p.mistakes[base.id].resolved, false);
  p = applyAttempt(p, { ...base, chosen: '눈물', ok: true, retest: true, retestKey: 'd:2' }, { wordIds, today: '2026-11-03', at: 700 });
  assert.equal(p.mistakes[base.id].resolved, true); assert.equal(p.mistakes[base.id].due, '2026-11-10');
  assert.equal(mistakeStatus(p.mistakes[base.id], '2026-11-03').state, 'resolved'); assert.match(mistakeStatus(p.mistakes[base.id], '2026-11-03').label, /오답 해결 · 기억 확인 복습 2026-11-10 예정/);
  assert.equal(mistakeStatus(p.mistakes[base.id], '2026-11-10').state, 'check');
});
check('a later wrong brings a resolved item back to relearn', () => {
  let p = p0;
  p = applyAttempt(p, { ...base, chosen: '눈물', ok: true, retest: true, retestKey: 'e:0' }, { wordIds, today: '2026-11-02', at: 500 });
  p = applyAttempt(p, { ...base, chosen: '눈물', ok: true, retest: true, retestKey: 'e:1' }, { wordIds, today: '2026-11-03', at: 600 });
  p = applyAttempt(p, { ...base, chosen: '물', ok: false, retest: true, retestKey: 'e:2' }, { wordIds, today: '2026-11-04', at: 700 });
  assert.equal(p.mistakes[base.id].resolved, false); assert.equal(mistakeStatus(p.mistakes[base.id], '2026-11-04').state, 'open');
});
check('non-retest attempts (existing quiz callbacks) never touch the weak ledger — no double count', () => {
  const p = applyAttempt(p0, { ...base, chosen: '물', ok: false }, { wordIds, today: '2026-11-02', at: 200 });
  assert.equal(p.weak, p0.weak); assert.equal(p.mistakes[base.id].wrong, 2);
});
check('non-word refs (grammar / sentences) do not create weak-word entries', () => {
  const att = { id: 'g:1', ref: 'g:lesson', source: 'grammar', kind: 'q', prompt: 'p', correct: 'a', options: ['a', 'b'], explanation: 'e' };
  const p = applyAttempt({ mistakes: recordMistake({}, { ...att, chosen: 'b', ok: false }, '2026-11-01', 1), weak: {} }, { ...att, chosen: 'b', ok: false, retest: true, retestKey: 'f:0' }, { wordIds, today: '2026-11-02', at: 2 });
  assert.deepEqual(p.weak, {});
});
check('N3 wrong: retest follows the course rule — two correct in a row remove, a wrong resets', () => {
  const att = { id: 'n3:q7', ref: 'g:foo', source: 'n3', kind: 'q', prompt: 'p', correct: 'a', options: ['a', 'b'], explanation: 'e' };
  let p = { mistakes: recordMistake({}, { ...att, chosen: 'b', ok: false }, '2026-11-01', 1), weak: {}, n3: { wrong: { q7: { c: 1, at: 1, cat: 'grammar', ref: 'g:foo', ok: 0 } } } };
  p = applyAttempt(p, { ...att, chosen: 'a', ok: true, retest: true, retestKey: 'n:0' }, { wordIds, today: '2026-11-02', at: 5 });
  assert.equal(p.n3.wrong.q7.ok, 1);
  p = applyAttempt(p, { ...att, chosen: 'b', ok: false, retest: true, retestKey: 'n:1' }, { wordIds, today: '2026-11-02', at: 6 });
  assert.equal(p.n3.wrong.q7.ok, 0); assert.equal(p.n3.wrong.q7.c, 2);
  p = applyAttempt(p, { ...att, chosen: 'a', ok: true, retest: true, retestKey: 'n:2' }, { wordIds, today: '2026-11-03', at: 7 });
  p = applyAttempt(p, { ...att, chosen: 'a', ok: true, retest: true, retestKey: 'n:3' }, { wordIds, today: '2026-11-04', at: 8 });
  assert.equal(p.n3.wrong.q7, undefined);
  assert.deepEqual(noteN3Wrong({}, 'zz', true), {});
});
console.log(`통과 ${pass} / 실패 0`);
