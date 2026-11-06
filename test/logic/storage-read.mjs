/* 저장소에 엉뚱한 값이 들어 있어도 읽는 쪽이 기본값을 받는다.
 *
 * 「null」은 JSON으로 올바른 글이라 parse가 안 던진다. 그게 그대로 나가서 받는 쪽이
 * Object.keys(null)에서 죽고 화면이 통째로 하얘졌다(전문 프로그래머 시험에서 찾음). */
import { loadReview, loadSettings, loadStats, loadProgress, loadStreak } from '../../src/lib/storage.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l); } else { fail++; console.log('  ✗', l, e ?? ''); } };

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };
const KEYS = { review: 'jp_manabu_review_v1', settings: 'jp_manabu_settings_v1', stats: 'jp_manabu_stats_v1', progress: 'jp_manabu_progress_v1', streak: 'jp_manabu_streak_v1' };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

for (const [name, key, fn] of [['복습', KEYS.review, loadReview], ['설정', KEYS.settings, loadSettings], ['기록', KEYS.stats, loadStats], ['진행', KEYS.progress, loadProgress], ['연속일', KEYS.streak, loadStreak]]) {
  for (const bad of ['null', '123', '"글자"', '[]', '{망가짐']) {
    mem.set(key, bad);
    let v; let threw = false;
    try { v = fn(); } catch { threw = true; }
    ok(`${name}에 ${bad}가 저장돼 있어도 안 죽고 객체를 받는다`, !threw && isObj(v), threw ? '던짐' : JSON.stringify(v)?.slice(0, 60));
  }
  mem.delete(key);
}
mem.set(KEYS.review, JSON.stringify({ a: { box: 1 } }));
ok('멀쩡한 값은 그대로 읽는다', loadReview().a?.box === 1);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
