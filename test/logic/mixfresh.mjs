/* 새로 배우기에 문법 · 회화 표현을 고르게 섞기 — lib/cards.js mixFresh (2026-11-16) */
import assert from 'node:assert/strict';
import { mixFresh, MIX_EVERY } from '../../src/lib/cards.js';
import { buildPlan } from '../../src/lib/plan.js';

let pass = 0;
const check = (label, run) => { run(); pass++; console.log('✓', label); };

const words = [
  ...Array.from({ length: 60 }, (_, i) => ({ id: `w${i}`, kanji: `語${i}`, tags: ['일상'] })),
  ...Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, kanji: `会${i}`, tags: ['회화', '일상'] })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, kanji: `〜文${i}`, grammar: true, tags: ['문법'] })),
];
const byId = new Map(words.map((w) => [w.id, w]));
const pool = words.map((w) => ({ id: w.id, kind: 'word' }));

check('★ 새로 배우기 20칸 중 문법 2 · 회화 5가 고르게 끼어 있다 ★', () => {
  const first = mixFresh(pool, byId, {}).slice(0, MIX_EVERY).map((c) => c.id[0]);
  assert.equal(first.filter((k) => k === 'g').length, 2, first.join(''));
  assert.equal(first.filter((k) => k === 'c').length, 5, first.join(''));
  assert.equal(first[9], 'g'); assert.equal(first[19], 'g');
});
check('각 무리 안에서는 원래 차례를 지킨다', () => {
  const out = mixFresh(pool, byId, {});
  const ws = out.filter((c) => c.id[0] === 'w').map((c) => Number(c.id.slice(1)));
  assert.deepEqual(ws, [...ws].sort((a, b) => a - b));
  assert.equal(out.length, pool.length);
});
check('이미 본 것은 섞지 않고 뒤로(복습 · 약점은 따로 줄을 세운다)', () => {
  const review = { w0: { lastSeen: '2026-11-01' }, g0: { lastSeen: '2026-11-01' } };
  const out = mixFresh(pool, byId, review);
  assert.deepEqual(out.slice(-2).map((c) => c.id).sort(), ['g0', 'w0']);
});
check('문법 · 회화가 없으면 그대로', () => {
  const plain = pool.filter((c) => c.id[0] === 'w');
  assert.equal(mixFresh(plain, byId, {}), plain);
});
check('★ 오늘 계획의 새로 배우기에도 그대로 들어간다 ★', () => {
  const p = buildPlan(mixFresh(pool, byId, {}), {}, { goals: { fresh: 20, review: 0, weak: 0 }, today: '2026-11-16' });
  const ids = p.assigned.filter((x) => x.bucket === 'fresh').map((x) => x.id[0]);
  assert.equal(ids.length, 20);
  assert.equal(ids.filter((k) => k === 'g').length, 2);
  assert.equal(ids.filter((k) => k === 'c').length, 5);
});
console.log(`통과 ${pass} / 실패 0`);
