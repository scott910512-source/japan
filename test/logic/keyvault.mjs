import assert from 'node:assert/strict';
import { packKeys, unpackKeys, looksPacked, reconcileKeys } from '../../src/lib/keyvault.js';
let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }

check('AI 키가 없으면 예전 봉투 모양 그대로(음성 키 글자) — 업데이트 전 기기도 읽는다', () => {
  assert.equal(packKeys({ gttsKey: 'AIzaTTS' }), 'AIzaTTS');
  assert.deepEqual(unpackKeys('AIzaTTS'), { gttsKey: 'AIzaTTS', geminiKey: '' });
});
check('두 키를 묶었다 풀면 그대로다', () => {
  const p = packKeys({ gttsKey: 'T', geminiKey: 'G' });
  assert.deepEqual(unpackKeys(p), { gttsKey: 'T', geminiKey: 'G' });
  assert.deepEqual(unpackKeys(packKeys({ geminiKey: 'G' })), { gttsKey: '', geminiKey: 'G' });
});
check('못 읽는 것은 null, 우연히 {로 시작하는 키는 키로 본다', () => {
  assert.equal(unpackKeys(null), null); assert.equal(unpackKeys(''), null);
  assert.deepEqual(unpackKeys('{not json'), { gttsKey: '{not json', geminiKey: '' });
});
check('★ 컴퓨터에만 있던 AI 키가 휴대폰으로 온다 ★', () => {
  // 컴퓨터: 두 키가 있고 계정에는 예전 봉투(음성 키만)
  const pc = reconcileKeys({ gttsKey: 'T', geminiKey: 'G' }, unpackKeys('T'));
  assert.deepEqual(pc.pull, {}); assert.deepEqual(unpackKeys(pc.push), { gttsKey: 'T', geminiKey: 'G' });
  // 휴대폰: 키가 없고 계정에 새 봉투
  const phone = reconcileKeys({}, unpackKeys(pc.push));
  assert.deepEqual(phone.pull, { gttsKey: 'T', geminiKey: 'G' }); assert.equal(phone.push, null);
});
check('같으면 다시 올리지 않는다(동기화할 때마다 쓰지 않게)', () => {
  const stored = unpackKeys(packKeys({ gttsKey: 'T', geminiKey: 'G' }));
  assert.equal(reconcileKeys({ gttsKey: 'T', geminiKey: 'G' }, stored).push, null);
  assert.equal(reconcileKeys({ gttsKey: 'T' }, unpackKeys('T')).push, null);
  assert.equal(reconcileKeys({}, null).push, null);
});
check('한쪽 키만 있는 기기끼리 합쳐진다', () => {
  const r = reconcileKeys({ geminiKey: 'G' }, unpackKeys('T'));
  assert.deepEqual(r.pull, { gttsKey: 'T' }); assert.deepEqual(unpackKeys(r.push), { gttsKey: 'T', geminiKey: 'G' });
});
check('이 기기의 키가 우선이다(예전 음성 키 규칙 그대로)', () => {
  const r = reconcileKeys({ gttsKey: 'NEW' }, unpackKeys('OLD'));
  assert.deepEqual(r.pull, {}); assert.equal(r.push, 'NEW');
});
check('업데이트 전 버전이 묶음을 음성 키 칸에 넣은 흔적을 알아본다', () => {
  assert.equal(looksPacked(packKeys({ gttsKey: 'T', geminiKey: 'G' })), true);
  assert.equal(looksPacked('AIzaTTS'), false); assert.equal(looksPacked(''), false);
});
console.log(`통과 ${pass} / 실패 0`);
