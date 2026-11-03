import assert from 'node:assert/strict';
import { GRAMMAR_MODULES } from '../../src/data/grammar.js';
import { grammarQuiz, grammarAttempt } from '../../src/lib/grammarQuiz.js';
import { recordMistake } from '../../src/lib/mistakes.js';

const words = ['のむ', 'かく', 'よむ', 'はなす', 'かう', 'もつ', 'あるく', 'およぐ', 'あそぶ', 'わたる', 'のる', 'まつ'].map((kana, i) => ({ id: `test-${i}`, type: 'verb', kana, kanji: kana, group: '1' }));
const module = GRAMMAR_MODULES[0];
let pass = 0;
try {
  for (const mod of GRAMMAR_MODULES) {
    const set = grammarQuiz(words, mod);
    assert.equal(set.length, 10);
    assert.equal(new Set(set.map((q) => q.id)).size, 10);
    assert.ok(set.every((q) => q.options.includes(q.answer) && new Set(q.options.map((s) => s.trim())).size === q.options.length));
    pass++;
  }
  assert.deepEqual(grammarQuiz([], module), []); pass++;
  const small = grammarQuiz(words.slice(0, 1), GRAMMAR_MODULES.find((m) => m.id === 'te'));
  assert.equal(small.length, 1); pass++;
  const set = grammarQuiz(words, module);
  const q = set[0];
  const attempt = grammarAttempt(module, q, q.options.find((x) => x !== q.answer));
  assert.equal(attempt.ok, false); assert.equal(attempt.ref, q.id); pass++;
  const book = recordMistake({}, attempt, '2026-11-03', 1);
  assert.ok(grammarQuiz(words, module, book).slice(0, 4).some((item) => item.id === q.id)); pass++;
  const recovered = recordMistake(book, grammarAttempt(module, q, q.answer), '2026-11-03', 2);
  assert.equal(recovered[q.id].resolved, false); assert.equal(recovered[q.id].wrongChosen, attempt.chosen); pass++;
  const verbsWithDuplicate = [...words, { ...words[0], id: 'duplicate-same-word' }];
  const duplicateSet = grammarQuiz(verbsWithDuplicate, module);
  assert.equal(new Set(duplicateSet.map((q) => `${q.word.kana}:${q.formKey}`)).size, duplicateSet.length); pass++;
  console.log(`통과 ${pass} / 실패 0`);
} catch (error) { console.error(error); console.log(`통과 ${pass} / 실패 1`); process.exitCode = 1; }
