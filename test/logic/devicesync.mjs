/* 기기에만 두던 공부 기록을 계정에 싣고 합치기 — lib/devicesync.js */
import assert from 'node:assert/strict';
import { collectExtra, mergeExtra, applyExtra, EXTRA_WHOLE, EXTRA_LISTS, EXTRA_COUNTERS } from '../../src/lib/devicesync.js';
import { ACCOUNT_DATA_KEYS } from '../../src/lib/accountswitch.js';

let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const J = JSON.stringify;
const P = EXTRA_WHOLE.plan; const S = EXTRA_WHOLE.session; const A = EXTRA_LISTS.asks.key; const T = EXTRA_LISTS.translations.key;

/* 한 번의 동기화: 이 기기 묶음 + 서버 묶음 → 합쳐서 이 기기에 얹고 서버로 올린 것을 돌려준다 */
function sync(storage, server, now) {
  const local = collectExtra(storage, now);
  const merged = mergeExtra(local, server.extra);
  const changed = applyExtra(merged, storage);
  server.extra = merged;
  return changed;
}

check('★ 컴퓨터에서 한 오늘 계획 · 이어하기가 폰으로 간다 ★', () => {
  const server = {};
  const pc = mem({ [P]: J({ date: '2026-11-15', done: 3 }), [S]: J({ deck: 'n5', i: 7 }) });
  sync(pc, server, 1000);
  const phone = mem();
  const changed = sync(phone, server, 2000);
  assert.deepEqual(JSON.parse(phone.getItem(P)), { date: '2026-11-15', done: 3 });
  assert.deepEqual(JSON.parse(phone.getItem(S)), { deck: 'n5', i: 7 });
  assert.ok(changed.includes('plan') && changed.includes('session'));
});
check('나중에 바뀐 쪽이 이긴다 — 폰에서 더 하면 컴퓨터가 그걸 받는다', () => {
  const server = {};
  const pc = mem({ [P]: J({ done: 3 }) });
  sync(pc, server, 1000);
  const phone = mem();
  sync(phone, server, 2000);
  phone.setItem(P, J({ done: 5 }));
  sync(phone, server, 3000);
  sync(pc, server, 4000);                                    // 컴퓨터는 그동안 안 바꿨다
  assert.deepEqual(JSON.parse(pc.getItem(P)), { done: 5 });
});
check('★ 새 기기의 빈 칸이 계정 기록을 지우지 않는다 ★', () => {
  const server = {};
  sync(mem({ [P]: J({ done: 3 }) }), server, 1000);
  const fresh = mem();
  sync(fresh, server, 9000);
  assert.deepEqual(server.extra.whole.plan.v, { done: 3 });
});
check('이어하기를 끝내서(비워서) 지우면 다른 기기에서도 지워진다', () => {
  const server = {};
  const pc = mem({ [S]: J({ i: 7 }) });
  sync(pc, server, 1000);
  const phone = mem();
  sync(phone, server, 2000);
  phone.removeItem(S);
  sync(phone, server, 3000);
  sync(pc, server, 4000);
  assert.equal(pc.getItem(S), null);
});
check('★ 물어본 것 · 번역 기록은 두 기기 것을 합친다 ★', () => {
  const server = {};
  const pc = mem({ [A]: J([{ key: 'k1', q: '지하철', at: 10 }]), [T]: J([{ id: 'tr-1', korean: '화장실', at: 10 }]) });
  const phone = mem({ [A]: J([{ key: 'k2', q: '역', at: 20 }]) });
  sync(pc, server, 1000);
  sync(phone, server, 2000);
  sync(pc, server, 3000);
  assert.deepEqual(JSON.parse(pc.getItem(A)).map((a) => a.key), ['k2', 'k1']);
  assert.deepEqual(JSON.parse(phone.getItem(A)).map((a) => a.key), ['k2', 'k1']);
  assert.deepEqual(JSON.parse(phone.getItem(T)).map((a) => a.id), ['tr-1']);
});
check('★ 한 기기에서 지운 번역은 다른 기기에서 되살아나지 않는다 ★', () => {
  const server = {};
  const pc = mem({ [T]: J([{ id: 'tr-1', at: 10 }, { id: 'tr-2', at: 20 }]) });
  sync(pc, server, 1000);
  const phone = mem();
  sync(phone, server, 2000);
  phone.setItem(T, J([{ id: 'tr-2', at: 20 }]));             // 폰에서 tr-1을 지웠다
  sync(phone, server, 3000);
  sync(pc, server, 4000);
  assert.deepEqual(JSON.parse(pc.getItem(T)).map((a) => a.id), ['tr-2']);
});
check('요청이 오가는 사이에 이 기기에서 바꾼 것은 덮지 않는다', () => {
  const server = {};
  sync(mem({ [P]: J({ done: 9 }) }), server, 5000);         // 다른 기기가 더 나중
  const pc = mem({ [P]: J({ done: 1 }) });
  const local = collectExtra(pc, 1000);
  local.whole.plan.at = 1;                                  // 이 기기 것은 오래됐다
  const merged = mergeExtra(local, server.extra);
  pc.setItem(P, J({ done: 2 }));                            // 그 사이에 한 문제 더 했다
  applyExtra(merged, pc);
  assert.deepEqual(JSON.parse(pc.getItem(P)), { done: 2 });
});
check('계정마다 따로 — 지문 기록도 계정 전환 때 같이 보관된다', () => {
  assert.ok(ACCOUNT_DATA_KEYS.includes('jp_manabu_extra_meta_v1'));
  for (const k of [...Object.values(EXTRA_WHOLE), ...Object.values(EXTRA_LISTS).map((l) => l.key), ...Object.values(EXTRA_COUNTERS)]) assert.ok(ACCOUNT_DATA_KEYS.includes(k), k);
});
check('묶음이 없는 옛 서버 · 옛 기기와도 산다', () => {
  assert.equal(mergeExtra(undefined, undefined), undefined);
  const local = collectExtra(mem({ [P]: J({ done: 1 }) }), 1000);
  assert.equal(mergeExtra(local, undefined), local);
});
const U = EXTRA_COUNTERS.ttsUsage;
const used = (st) => JSON.parse(st.getItem(U) || '{}');
check('★ 음성 사용량은 두 기기에서 쓴 만큼 더해진다(두 번 세지 않는다) ★', () => {
  const server = {};
  const pc = mem({ [U]: J({ '2026-11': 1000 }) });
  const phone = mem({ [U]: J({ '2026-11': 300 }) });
  sync(pc, server, 1000);
  sync(phone, server, 2000);
  sync(pc, server, 3000);
  assert.equal(used(pc)['2026-11'], 1300);
  assert.equal(used(phone)['2026-11'], 1300);
  sync(pc, server, 4000); sync(phone, server, 5000); sync(pc, server, 6000);   // 몇 번을 맞춰도
  assert.equal(used(pc)['2026-11'], 1300);
  phone.setItem(U, J({ '2026-11': used(phone)['2026-11'] + 200 }));           // 폰에서 200자 더
  sync(phone, server, 7000); sync(pc, server, 8000);
  assert.equal(used(pc)['2026-11'], 1500);
  assert.equal(used(phone)['2026-11'], 1500);
});
check('이야기 · 말하기 설정 · 요즘 일본어도 다른 기기로 간다', () => {
  const server = {};
  const pc = mem({ [EXTRA_WHOLE.storyPrefs]: J({ rate: 0.8 }), [EXTRA_WHOLE.speakPrefs]: J({ gap: 3 }), [EXTRA_WHOLE.trends]: J({ at: 5, items: [{ jp: 'エモい' }] }) });
  sync(pc, server, 1000);
  const phone = mem();
  const changed = sync(phone, server, 2000);
  assert.deepEqual(JSON.parse(phone.getItem(EXTRA_WHOLE.storyPrefs)), { rate: 0.8 });
  assert.deepEqual(JSON.parse(phone.getItem(EXTRA_WHOLE.speakPrefs)), { gap: 3 });
  assert.equal(JSON.parse(phone.getItem(EXTRA_WHOLE.trends)).items[0].jp, 'エモい');
  assert.ok(changed.includes('trends'));
});
console.log(`통과 ${pass} / 실패 0`);
