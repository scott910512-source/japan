/* 동사 활용 예외 — lib/conjugate.js (2026-11-17 QA B02) */
import assert from 'node:assert/strict';
import { conjugate } from '../../src/lib/conjugate.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
check('★ ある → ない(あらない ×) ★', () => assert.equal(conjugate('ある', '1').nai, 'ない'));
check('★ 존경어는 ます형 어간이 い ★', () => {
  assert.equal(conjugate('いらっしゃる', '1').masu, 'いらっしゃいます');
  assert.equal(conjugate('おっしゃる', '1').masu, 'おっしゃいます');
  assert.equal(conjugate('なさる', '1').masuNeg, 'なさいません');
  assert.equal(conjugate('くださる', '1').mashita, 'くださいました');
  assert.equal(conjugate('いらっしゃる', '1').nai, 'いらっしゃらない');
});
check('★ 가능형이 없는 동사는 가능형 칸이 비어 드릴에 안 나온다 ★', () => {
  for (const [k, g] of [['できる', '2'], ['わかる', '1'], ['みえる', '2'], ['きこえる', '2'], ['ある', '1']]) {
    assert.equal(conjugate(k, g).potentialDict, null, k);
    assert.equal(conjugate(k, g).potentialMasu, null, k);
  }
});
check('問う → とうて · とうた', () => { const f = conjugate('とう', '1'); assert.equal(f.te, 'とうて'); assert.equal(f.ta, 'とうた'); });
check('沿う 같은 다른 う동사는 표대로(そって)', () => assert.equal(conjugate('そう', '1').te, 'そって'));
check('★ 한자 来る는 来ます(します ×) ★', () => { const f = conjugate('来る', '3'); assert.equal(f.masu, '来ます'); assert.equal(f.nai, '来ない'); });
check('보통 동사는 그대로', () => {
  assert.equal(conjugate('いく', '1').te, 'いって');
  assert.equal(conjugate('たべる', '2').potentialDict, 'たべられる');
  assert.equal(conjugate('べんきょうする', '3').masu, 'べんきょうします');
  assert.equal(conjugate('くる', '3').nai, 'こない');
  assert.equal(conjugate('いる', '2').potentialDict, 'いられる');
});
console.log(`통과 ${pass} / 실패 0`);
