/* 문법 카드 소리 — 조사 は는 わ, へ는 え로 읽게 넘긴다(lib/jptext.js grammarSpoken · cardSpeech). 화면 글자는 그대로 */
import assert from 'node:assert/strict';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { grammarSpoken, cardSpeech } from '../../src/lib/jptext.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
const byId = new Map(ALL_WORDS.map((w) => [w.id, w]));

check('★ 조사 한 글자: は → わ, へ → え ★', () => {
  assert.equal(cardSpeech(byId.get('gp-n5-001')), 'わ');
  assert.equal(cardSpeech(byId.get('gp-n5-002')), 'わ');
  assert.equal(cardSpeech(byId.get('gp-n5-015')), 'え');
});
check('문형 속 조사도: ではありません · てはいけない · には · とは', () => {
  assert.equal(grammarSpoken('ではありません'), 'でわありません');
  assert.equal(grammarSpoken('てはいけない'), 'てわいけない');
  assert.equal(grammarSpoken('わけにはいかない'), 'わけにわいかない');
  assert.equal(grammarSpoken('とはかぎらない'), 'とわかぎらない');
});
check('조각을 이어 적은 읽기는 쉬어 읽는다', () => {
  assert.equal(cardSpeech(byId.get('gp-n5-003')), 'わ、が');
  assert.equal(grammarSpoken('ほどはない'), 'ほど、わない');
});
check('★ 낱말 첫 글자 は는 그대로: 始める · はず · 反面 · 初めて ★', () => {
  for (const k of ['はじめる', 'はずだ', 'はずがない', 'はんめん', 'てはじめて', 'をはじめ']) assert.equal(grammarSpoken(k), k);
});
check('★ 모든 문법 카드: 소리에 남은 は는 낱말 첫 글자뿐 · へ 한 글자 없음 ★', () => {
  const bad = ALL_WORDS.filter((w) => w.grammar).map((w) => [w.id, cardSpeech(w)])
    .filter(([, s]) => /は(?!じめ|ず|んめん)/.test(s) || s === 'へ');
  assert.deepEqual(bad, []);
});
check('낱말 카드는 손대지 않는다(花 はな는 はな)', () => {
  assert.equal(cardSpeech({ kanji: '花', kana: 'はな', type: 'noun' }), 'はな');
});
console.log(`통과 ${pass} / 실패 0`);
