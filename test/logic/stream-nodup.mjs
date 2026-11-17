/* 쭉 퀴즈 한 판 안에서 맞힌 문제는 다시 안 나온다 — lib/stream.js pickNext (2026-11-17 QA B07) */
import assert from 'node:assert/strict';
import { newSession, pickNext, record } from '../../src/lib/stream.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
const pool = Array.from({ length: 40 }, (_, i) => ({ id: `w${i}`, kind: 'word', d: i % 5 }));
check('★ 20문제를 다 맞히면 20문제가 전부 다르다 ★', () => {
  let s = newSession(); const ids = [];
  let seed = 1; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 20; i++) { const it = pickNext(pool, s, rng); ids.push(it.id); s = record(s, it, true); }
  assert.equal(new Set(ids).size, 20, ids.join(','));
});
check('틀린 것은 다시 나올 수 있다', () => {
  let s = newSession(); const first = pool[0];
  s = record(s, first, false);
  const small = pool.slice(0, 1);
  assert.equal(pickNext(small, s, () => 0.1).id, first.id);
});
check('낼 게 바닥나면(다 맞힘) 그래도 하나는 낸다', () => {
  let s = newSession(); const small = pool.slice(0, 3);
  for (const it of small) s = record(s, it, true);
  assert.ok(pickNext(small, s, () => 0.5));
});
console.log(`통과 ${pass} / 실패 0`);
