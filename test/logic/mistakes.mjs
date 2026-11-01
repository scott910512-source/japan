import assert from 'node:assert/strict';
import { activeMistakes, judgeMistake, mergeMistakes, prioritizeMistakes, recordMistake } from '../../src/lib/mistakes.js';
import { buildQuiz, QUIZ_SCOPE, scopeWords } from '../../src/lib/quiz.js';
let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }
const attempt = { id: 'word:w1:jp-ko', ref: 'w1', source: 'word', kind: '뜻', prompt: '涙', chosen: '물', correct: '눈물', explanation: '氵 + 戻', options: ['물', '눈물'], ok: false };
const wrong = recordMistake({}, attempt, '2026-11-01', 100);
check('a first wrong answer persists exact question, choice and explanation immediately', () => {
  const row = wrong[attempt.id]; assert.equal(row.wrongChosen, '물'); assert.equal(row.correct, '눈물'); assert.equal(row.due, '2026-11-01'); assert.equal(row.explanation, '氵 + 戻');
});
check('repeated correct clicks on one date cannot erase the weakness', () => {
  let book = wrong;
  for (let i = 1; i < 20; i++) book = recordMistake(book, { ...attempt, chosen: '눈물', ok: true }, '2026-11-01', 100 + i);
  assert.equal(activeMistakes(book).length, 1); assert.equal(book[attempt.id].wrongChosen, '물');
});
const once = recordMistake(wrong, { ...attempt, ok: true }, '2026-11-02', 200);
const recovered = recordMistake(once, { ...attempt, ok: true }, '2026-11-03', 300);
check('two separate dates recover the item and schedule later review', () => { assert.equal(activeMistakes(recovered, '2026-11-03').length, 0); assert.equal(recovered[attempt.id].due, '2026-11-10'); assert.equal(activeMistakes(recovered, '2026-11-10').length, 1); });
check('a relapse resets recovery while retaining previous counts', () => {
  const row = recordMistake(recovered, attempt, '2026-11-05', 400)[attempt.id]; assert.equal(row.wrong, 2); assert.deepEqual(row.successes, {}); assert.equal(row.resolved, false);
});
check('sync is idempotent and merges successes without double counting', () => {
  assert.deepEqual(mergeMistakes(wrong, wrong), wrong);
  assert.deepEqual(mergeMistakes(once, recovered), mergeMistakes(recovered, once));
  assert.equal(mergeMistakes(once, recovered)[attempt.id].resolved, true);
  const secondDevice = recordMistake(wrong, { ...attempt, ok: true }, '2026-11-03', 300);
  assert.equal(mergeMistakes(once, secondDevice)[attempt.id].due, '2026-11-10');
});
check('an unseen wrong word is in the next weak test after only one error', () => {
  const words = [{ id: 'w1' }, { id: 'w2' }]; assert.deepEqual(scopeWords(words, {}, QUIZ_SCOPE.WEAK, null, wrong), [words[0]]);
});
check('next test reserves a place for the unresolved item and keeps other content', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}` }));
  const next = prioritizeMistakes(items.reverse(), wrong, (item) => item.id, 10);
  assert.equal(next[0].id, 'w1'); assert.equal(new Set(next).size, 10);
});
check('normal quiz generation actually includes a previous error', () => {
  const words = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, kanji: `単語${i}`, kana: `たんご${i}`, mean: `뜻${i}`, level: 'N5' }));
  assert.ok(buildQuiz(words, { count: 10, mistakes: wrong, rng: () => .99 }).some((q) => q.wordId === 'w1'));
});
check('a displayed multi-meaning answer and each accepted alias remain correct', () => {
  const row = { correct: '다투다; 경쟁하다', accepted: ['다투다', '경쟁하다'] };
  assert.equal(judgeMistake(row, '다투다; 경쟁하다'), true); assert.equal(judgeMistake(row, '경쟁하다'), true);
});
check('Japanese long vowels remain meaningful in retests', () => {
  assert.equal(judgeMistake({ correct: 'ビール', accepted: ['びいる'] }, 'ビル'), false);
  assert.equal(judgeMistake({ correct: 'ビール', accepted: ['びいる'] }, 'びいる'), true);
});
check('a correct practice today lets older pending errors appear next', () => {
  const another = recordMistake(wrong, { ...attempt, id: 'other', ref: 'w2' }, '2026-11-01', 150);
  const next = recordMistake(another, { ...attempt, ok: true }, '2026-11-01', 200);
  assert.equal(activeMistakes(next, '2026-11-01')[0].id, 'other');
});
console.log(`통과 ${pass} / 실패 0`);
