/* 동사 활용 예외 — lib/conjugate.js (2026-11-17 QA B02) */
import assert from 'node:assert/strict';
import { conjugate, NO_POTENTIAL_KANJI } from '../../src/lib/conjugate.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { grammarQuiz } from '../../src/lib/grammarQuiz.js';
import { GRAMMAR_MODULES } from '../../src/data/grammar.js';

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
/* ── 2026-11-18 QA FIX-01: 儲かる 같은 자발 · 상태 동사 ── */
const verbs = ALL_WORDS.filter((w) => w.type === 'verb' && ['1', '2', '3'].includes(String(w.group)));
check(`★ 자료의 동사 ${verbs.length}개 전부: 가능형 없음 목록의 동사는 가능형이 비어 있다 ★`, () => {
  const bad = verbs.filter((w) => (NO_POTENTIAL_KANJI.has(w.kanji) || NO_POTENTIAL_KANJI.has(`${w.kanji}:${w.kana}`))
    && conjugate(w.kana, String(w.group), w)?.potentialDict);
  assert.deepEqual(bad.map((w) => w.kanji), []);
});
check('★ 儲かる · 見つかる · 助かる · 要る · 似合う는 가능형이 없다 ★', () => {
  for (const [kanji, kana] of [['儲かる', 'もうかる'], ['見つかる', 'みつかる'], ['助かる', 'たすかる'], ['要る', 'いる'], ['似合う', 'にあう'], ['間に合う', 'まにあう'], ['異なる', 'ことなる'], ['鳴る', 'なる'], ['開く', 'あく']]) {
    assert.equal(conjugate(kana, kana === 'いる' ? '1' : '1', { kanji })?.potentialDict ?? null, null, kanji);
  }
});
check('가나가 같아도 다른 동사는 그대로: なる(되다) → なれる, いる(있다) → いられる, 開く(ひらく) → ひらける', () => {
  assert.equal(conjugate('なる', '1', { kanji: 'なる' }).potentialDict, 'なれる');
  assert.equal(conjugate('いる', '2', { kanji: '居る' }).potentialDict, 'いられる');
  assert.equal(conjugate('ひらく', '1', { kanji: '開く' }).potentialDict, 'ひらける');
});
check('noPotential: true 표시도 가능형을 비운다', () => assert.equal(conjugate('はしる', '1', { kanji: '走る', noPotential: true }).potentialDict, null));
check('★ 기초문법 가능형 세트를 200번 뽑아도 목록의 동사가 안 나온다 ★', () => {
  const mod = GRAMMAR_MODULES.find((m) => m.id === 'potential');
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 200; i += 1) {
    for (const q of grammarQuiz(ALL_WORDS, mod, {}, rnd)) {
      assert.ok(!NO_POTENTIAL_KANJI.has(q.word.kanji) && !NO_POTENTIAL_KANJI.has(`${q.word.kanji}:${q.word.kana}`), q.word.kanji);
      assert.ok(q.answer, q.word.kanji);
    }
  }
});
console.log(`통과 ${pass} / 실패 0`);
