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
/* ── 2026-11-18 QA FIX-02: 존재문 전수 검사 ── */
const exist = built('ga-arimasu');
const jpOf = (k) => exist.filter((b) => b.w.kanji === k).map((b) => b.jp);
check('★ 사물 · 추상 · 신체는 います가 아니다(国 · 目 · 耳 · 鼻 · 髪 · 話 · 声) ★', () => {
  for (const k of ['国', '目', '耳', '鼻', '髪', '話', '声']) assert.ok(!jpOf(k).some((j) => j.endsWith('がいます')), `${k}: ${jpOf(k)}`);
});
check('★ 의문사 · 방향 · 지시어는 존재문에 안 나온다(どなた · 北 · 南 · あっち · 側 · 所) ★', () => {
  for (const k of ['どなた', '北', '南', 'あっち', '側', '所', '誰か', 'みんな']) assert.equal(jpOf(k).length, 0, k);
});
check('★ 魚がいます / 물고기가 있습니다(생선 ×) ★', () => {
  const b = exist.find((x) => x.w.kanji === '魚');
  assert.ok(b && b.jp === "魚がいます" && b.kr === "물고기가 있습니다", JSON.stringify(b));
});
check('사람 · 동물은 그대로 います(友達 · 先生 · 犬 · 猫)', () => {
  for (const k of ['友達', '先生', '犬', '猫']) assert.ok(jpOf(k).every((j) => j.endsWith('がいます')) && jpOf(k).length > 0, k);
});
check('★ 조리 · 식습관 같은 추상명사는 「これは」 「ください」 「あります」에 안 나온다 ★', () => {
  for (const id of ['kore-desu', 'o-kudasai', 'ga-arimasu']) {
    assert.ok(!built(id).some((b) => ['冷凍', '保存', '乾杯', '味付け', '外食', '二次会', '食事'].includes(b.w.kanji)), id);
  }
});
check('★ 비교 문형(これはあれより〜です)도 문장이 나온다 · 기분 형용사는 빠진다 ★', () => {
  const id = PATTERNS.find((p) => p.jp.includes('より')).id;
  const rows = built(id);
  assert.ok(rows.length >= 30, `${rows.length}`);
  assert.ok(!rows.some((b) => ['嬉しい', '悲しい', '痛い', '眠い'].includes(b.w.kanji)));
  assert.ok(rows.every((b) => !String(b.kr).includes('undefined')));
});
console.log(`통과 ${pass} / 실패 0`);
