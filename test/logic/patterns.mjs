/* 문형 연습 자동 문장 — data/sentences.js (2026-11-17 QA B03) */
import assert from 'node:assert/strict';
import { PATTERNS, withJosa, firstMean } from '../../src/data/sentences.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
const P = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
const built = (id) => ALL_WORDS.filter(P[id].wordFilter).map((w) => ({ w, ...P[id].build(w) }));

check('★ 한국어 조사는 받침대로 ★', () => {
  assert.equal(withJosa('메뉴', '이/가'), '메뉴가'); assert.equal(withJosa('바다', '을/를'), '바다를');
  assert.equal(withJosa('책', '이/가'), '책이'); assert.equal(withJosa('물', '을/를'), '물을');
});
check('뜻은 하나만(「가격; 값」 → 「가격」, 괄호 · 슬래시 뺌)', () => {
  assert.equal(firstMean('가격; 값'), '가격'); assert.equal(firstMean('기념품/선물'), '기념품'); assert.equal(firstMean('배(신체)'), '배');
});
check('★ 어떤 문장에도 「이/가」 「을/를」 「;」가 그대로 남지 않는다 ★', () => {
  for (const id of ['kore-desu', 'ga-arimasu', 'ga-suki', 'o-kudasai']) {
    for (const b of built(id)) assert.ok(!/이\/가|을\/를|;/.test(b.kr), `${id}: ${b.kr}`);
  }
});
check('★ 사람 · 가족은 います, あります로 안 나온다(店員があります ×) ★', () => {
  const people = built('ga-arimasu').filter((b) => (b.w.tags || []).some((t) => t === '사람' || t === '가족'));
  assert.ok(people.length > 0);
  assert.ok(people.every((b) => b.jp.endsWith('がいます')), people.find((b) => !b.jp.endsWith('がいます'))?.jp);
});
check('★ 시간 · 추상 낱말은 존재문에 안 나온다(今日があります ×) ★', () => {
  assert.ok(!built('ga-arimasu').some((b) => b.w.kanji === '今日'));
  assert.ok(!built('ga-arimasu').some((b) => (b.w.tags || []).includes('시간')));
});
check('★ 「をください」 「これは」에 사람 · 장소가 안 들어간다(友達をください · これは駅です ×) ★', () => {
  for (const id of ['o-kudasai', 'kore-desu']) {
    assert.ok(!built(id).some((b) => ['友達', '駅', '店員'].includes(b.w.kanji)), id);
    assert.ok(!built(id).some((b) => (b.w.tags || []).some((t) => ['사람', '가족', '장소'].includes(t))), id);
  }
});
check('문형마다 넣을 낱말은 넉넉하다', () => { for (const id of ['kore-desu', 'ga-arimasu', 'ga-suki', 'o-kudasai']) assert.ok(built(id).length >= 50, id); });
console.log(`통과 ${pass} / 실패 0`);
