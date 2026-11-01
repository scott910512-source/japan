import assert from 'node:assert/strict';
import { hunterProfile } from '../../src/lib/hunter.js';
import { REGIONS } from '../../src/data/hunterTheme.js';

let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }
const word = { id: 'n5-1', level: 'N5' };
const learned = { lastSeen: '2026-11-01', level: 1, rounds: 1 };
const fixture = { words: [word], review: { [word.id]: learned } };
check('empty data grants no rewards and does not invent an ability score', () => {
  const p = hunterProfile(); assert.equal(p.xp, 0); assert.equal(p.level, 1); assert.equal(p.skills[0].pct, null); assert.equal(p.badges.filter((b) => b.earned).length, 0);
});
check('the first learned card grants XP exactly once', () => assert.equal(hunterProfile(fixture).xp, 10));
check('repeating a card cannot farm XP', () => assert.equal(hunterProfile({ ...fixture, review: { [word.id]: { ...learned, rounds: 10000, lastSeen: '2026-12-20' } } }).xp, 10));
check('self-reported known cards grant no automatic rewards', () => assert.equal(hunterProfile({ ...fixture, review: { [word.id]: { ...learned, selfKnown: true } } }).xp, 0));
check('lesson, test and scenario rewards ignore repeated completions', () => {
  const progress = { n3: { lessons: { 'g:1': { done: true, tries: 50 } }, tests: { 't:ch0': { best: .8, tries: 200, total: 15 } } }, rpg: { exp: 99999, stages: { conbini: { cleared: 100, checkpoint: .8 } } } };
  const p = hunterProfile({ progress }); assert.equal(p.xp, 120); assert.equal(p.recommended, 4); assert.equal(p.skills[3].pct, 80);
});
check('level boundaries have exact progress and positive next targets', () => {
  const review = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`w${i}`, learned]));
  const p = hunterProfile({ review }); assert.equal(p.level, 3); assert.equal(p.percent, 0); assert.equal(p.ceiling, 900);
});
check('existing records survive derivation without migration or mutation', () => {
  const before = JSON.stringify(fixture); hunterProfile(fixture); assert.equal(JSON.stringify(fixture), before);
});
check('six regions have real learning routes and the kanji entry', () => {
  assert.equal(REGIONS.length, 6); assert.equal(REGIONS.flatMap((r) => r.missions).length, 18); assert.ok(REGIONS.flatMap((r) => r.missions).some((m) => m.id === 'kanji'));
});
console.log(`통과 ${pass} / 실패 0`);
