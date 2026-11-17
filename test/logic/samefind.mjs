/* 이미 단어장에 있는 낱말인가 — lib/wordFilters.js findSameWord (2026-11-17) */
import assert from 'node:assert/strict';
import { findSameWord } from '../../src/lib/wordFilters.js';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { dedupeSentences } from '../../src/lib/cards.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
const W = [
  { id: 'a', kanji: '地下鉄', kana: 'ちかてつ', level: 'N5' },
  { id: 'b', kanji: '橋', kana: 'はし' },
  { id: 'c', kanji: 'ありがとう', kana: 'ありがとう' },
  { id: 'd', kanji: '雨', kana: 'あめ' },
  { id: 'e', kanji: '〜ために', kana: 'ために', grammar: true },
];
check('★ 기본 단어장에 있는 낱말은 찾는다(표기로) ★', () => assert.equal(findSameWord(W, { jp: '地下鉄', kana: 'ちかてつ' })?.id, 'a'));
check('읽기가 같은 다른 낱말(箸)은 같은 것으로 안 본다', () => assert.equal(findSameWord(W, { jp: '箸', kana: 'はし' }), null));
check('가나로만 쓴 것은 가나 낱말과 견준다', () => assert.equal(findSameWord(W, { jp: 'ありがとう' })?.id, 'c'));
check('가나 あめ는 한자 낱말 雨와 같은 것으로 안 본다(사탕일 수 있다)', () => assert.equal(findSameWord(W, { jp: 'あめ' }), null));
check('물결표 · 띄어쓰기는 무시', () => assert.equal(findSameWord(W, { jp: 'ために' })?.id, 'e'));
check('빈 것은 없다', () => assert.equal(findSameWord(W, { jp: '' }), null));
check('실제 단어장: 地下鉄 · 電車 · 頑張る는 있다', () => ['地下鉄', '電車', '頑張る'].forEach((k) => assert.ok(findSameWord(ALL_WORDS, { jp: k }), k)));
check('★ 같은 일본어 문장은 학습 풀에 하나만 ★', () => {
  const cards = [{ id: 'fd-012', kanji: 'これをください。' }, { id: 'dl-116', kanji: 'これをください' }, { id: 'x', kanji: '別です。' }];
  assert.deepEqual(dedupeSentences(cards, {}).map((c) => c.id), ['fd-012', 'x']);
});
check('이미 공부한 쪽이 남는다', () => {
  const cards = [{ id: 'fd-012', kanji: 'これをください。' }, { id: 'dl-116', kanji: 'これをください。' }];
  assert.deepEqual(dedupeSentences(cards, { 'dl-116': { lastSeen: '2026-11-01', rounds: 3 } }).map((c) => c.id), ['dl-116']);
});
console.log(`통과 ${pass} / 실패 0`);
