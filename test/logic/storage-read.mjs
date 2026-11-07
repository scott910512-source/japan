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

/* 하루 목표: 옛 설정(번호 없음)은 한 번 새 수량(복습 30 · 새로 20 · 약점 3)으로 바뀌고, 그 뒤로 직접 바꾼 값은 지킨다 */
mem.set(KEYS.settings, JSON.stringify({ goals: { fresh: 8, review: 9, weak: 3 } }));
{
  const g = loadSettings().goals;
  ok('★ 옛 설정은 새 수량으로 맞춰진다 ★', g.review === 30 && g.fresh === 20 && g.weak === 3, JSON.stringify(g));
}
mem.set(KEYS.settings, JSON.stringify({ goals: { fresh: 5, review: 12, weak: 2 }, goalsV: 3 }));
{
  const g = loadSettings().goals;
  ok('★ 새 번호가 적힌 뒤 직접 바꾼 값은 지킨다 ★', g.review === 12 && g.fresh === 5 && g.weak === 2, JSON.stringify(g));
}
mem.set(KEYS.settings, JSON.stringify({ dailyGoal: 15 }));
ok('옛 숫자 하나(dailyGoal)도 새 수량으로', loadSettings().goals.review === 30);
mem.delete(KEYS.settings);
ok('설정이 없으면 기본값이 새 수량', loadSettings().goals.review === 30 && loadSettings().goalsV === 3);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
