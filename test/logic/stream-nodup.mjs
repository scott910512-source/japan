/* 쭉 퀴즈 한 판 안에서 맞힌 문제는 다시 안 나온다 — lib/stream.js pickNext (2026-11-17 QA B07) */
import assert from 'node:assert/strict';
import { newSession, pickNext, record, RETRY_GAP } from '../../src/lib/stream.js';

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
/* 2026-11-18 QA FIX-03: 틀린 것도 판 안에서 최대 한 번만 더, RETRY_GAP문제 뒤에 */
const run = (wrongSet, count = 20, seed0 = 3) => {
  let s = newSession(); const ids = [];
  let seed = seed0; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < count; i++) {
    const it = pickNext(pool, s, rng); ids.push({ id: it.id, retry: Boolean(it.retry) });
    s = record(s, it, !(wrongSet.has(it.id) && !it.retry));
  }
  return ids;
};
check('★ 처음에 틀린 것은 정확히 한 번 더, 그 사이에 8문제 넘게 ★', () => {
  for (let seed = 1; seed < 30; seed++) {
    const first = run(new Set(), 1, seed)[0].id;
    const ids = run(new Set([first]), 20, seed);
    const at = ids.map((x, i) => (x.id === first ? i : -1)).filter((i) => i >= 0);
    assert.equal(at.length, 2, `${seed}: ${at}`);
    assert.ok(at[1] - at[0] - 1 >= RETRY_GAP, `${seed}: ${at}`);
    assert.ok(ids[at[1]].retry, 'retry 표시');
  }
});
check('★ 다 틀려도 한 판(20문제)에서 같은 문제는 많아야 두 번 ★', () => {
  for (let seed = 1; seed < 30; seed++) {
    const ids = run(new Set(pool.map((p) => p.id)), 20, seed);
    const c = {}; for (const x of ids) c[x.id] = (c[x.id] || 0) + 1;
    assert.ok(Object.values(c).every((v) => v <= 2), JSON.stringify(c));
  }
});
check('다시 낸 문제를 또 틀려도 세 번째는 없다(풀이 넉넉하면)', () => {
  let s = newSession(); const ids = [];
  for (let i = 0; i < 30; i++) { const it = pickNext(pool, s, () => 0.01); ids.push(it.id); s = record(s, it, false); }
  const c = {}; for (const id of ids) c[id] = (c[id] || 0) + 1;
  assert.ok(Object.values(c).every((v) => v <= 2), JSON.stringify(c));
});
console.log(`통과 ${pass} / 실패 0`);
