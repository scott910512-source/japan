/* 퀘스트 시험을 풀던 자리 — 적고 · 읽고 · 낡은 것은 버린다 */
import assert from 'node:assert/strict';
import { QUIZ_KEEP_KEY, readQuizKeep, writeQuizKeep, clearQuizKeep, saneRun, keepModeOf } from '../../src/lib/quizkeep.js';
let pass = 0;
function check(label, run) { run(); pass++; console.log('✓', label); }
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m }; };
const Q = (id, type = 'choice') => ({ id: `q-${id}`, wordId: id, type, dir: 'jp-ko', prompt: '帰る', promptSub: 'かえる', answer: '돌아가다', answerSub: 'かえる',
  ...(type === 'choice' ? { options: [{ wordId: id, label: '돌아가다' }, { wordId: 'x', label: '읽다' }] } : {}) });
const RUN = { questions: [Q('a'), Q('b', 'typing'), Q('c')], answers: { 'q-a': { value: 'a', verdict: 'correct' } }, index: 1 };
const NOW = 1_800_000_000_000; const DAY = '2026-11-13';
const opt = (s, over = {}) => ({ now: NOW, today: DAY, storage: s, ...over });

check('적은 것을 그대로 읽는다 — 어느 시험 · 낸 낱말 · 문제 묶음 · 낸 답 · 지금 문항', () => {
  const s = memory();
  writeQuizKeep({ mode: 'random', ids: ['a', 'b', 'c'], run: RUN }, opt(s));
  const k = readQuizKeep(opt(s));
  assert.equal(k.mode, 'random');
  assert.deepEqual(k.ids, ['a', 'b', 'c']);
  assert.equal(k.run.index, 1);
  assert.deepEqual(k.run.answers, RUN.answers);
  assert.equal(k.run.questions.length, 3);
});
check('★ 같은 날 · 6시간 안의 것만 잇는다 ★', () => {
  const s = memory();
  writeQuizKeep({ mode: 'weak', ids: ['a'], run: RUN }, opt(s));
  assert.ok(readQuizKeep(opt(s, { now: NOW + 5 * 3600 * 1000 })));
  assert.equal(readQuizKeep(opt(s, { now: NOW + 7 * 3600 * 1000 })), null);
  assert.equal(readQuizKeep(opt(s, { today: '2026-11-14' })), null);
  assert.equal(readQuizKeep(opt(s, { now: NOW - 5 * 60 * 1000 })), null);   // 시계가 뒤로 간 기기
});
check('퀘스트 시험이 아니면 적지 않는다 · 낱말이 없어도', () => {
  const s = memory();
  writeQuizKeep({ mode: 'region', ids: ['a'], run: RUN }, opt(s));
  writeQuizKeep({ mode: 'weak', ids: [], run: RUN }, opt(s));
  assert.equal(s.raw.size, 0);
});
check('지우면 없다', () => {
  const s = memory();
  writeQuizKeep({ mode: 'weak', ids: ['a'], run: RUN }, opt(s));
  clearQuizKeep(s);
  assert.equal(readQuizKeep(opt(s)), null);
});
check('★ 모양이 어긋난 것은 얹지 않는다(시험 화면이 죽지 않게) ★', () => {
  assert.equal(saneRun(null), null);
  assert.equal(saneRun({ questions: [] }), null);
  assert.equal(saneRun({ questions: [{ id: 'q', wordId: 5 }] }), null);
  assert.equal(saneRun({ questions: [{ ...Q('a'), options: 'x' }] }), null);
  assert.equal(saneRun({ questions: [{ ...Q('a'), options: [null] }] }), null);
  assert.equal(saneRun({ questions: Array.from({ length: 300 }, (_, i) => Q(String(i))) }), null);
  const fixed = saneRun({ questions: [Q('a')], answers: [1, 2], index: 99 });
  assert.deepEqual(fixed.answers, {});
  assert.equal(fixed.index, 1);                                      // 범위를 넘으면 끝(결과 화면)
  assert.equal(saneRun({ questions: [Q('a')], index: -3 }).index, 0);
  assert.equal(saneRun({ questions: [Q('a')], index: 'x' }).index, 0);
});
check('다시 푼 판 표시(retry)는 남기고, 화면용 표시(restored)는 안 남긴다', () => {
  const r = saneRun({ ...RUN, retry: true, restored: true });
  assert.equal(r.retry, true);
  assert.equal('restored' in r, false);
  assert.equal('retry' in saneRun(RUN), false);
});
check('깨진 저장소 값은 null — 죽지 않는다', () => {
  for (const raw of ['{깨짐', '[]', 'null', '{"mode":"weak"}', JSON.stringify({ mode: 'weak', ids: ['a'], at: 'x', day: DAY })]) {
    assert.equal(readQuizKeep(opt({ getItem: () => raw })), null);
  }
  assert.equal(readQuizKeep(opt({ getItem: () => { throw new Error('막힘'); } })), null);
  writeQuizKeep({ mode: 'weak', ids: ['a'], run: RUN }, opt({ setItem: () => { throw new Error('공간 없음'); } }));
});
check('묶음이 깨졌어도 어느 시험이었는지와 낱말은 돌려준다(시험은 새로 낸다)', () => {
  const s = memory();
  s.setItem(QUIZ_KEEP_KEY, JSON.stringify({ mode: 'weak', ids: ['a', 5, 'b'], run: { questions: 'x' }, at: NOW, day: DAY }));
  const k = readQuizKeep(opt(s));
  assert.equal(k.mode, 'weak');
  assert.deepEqual(k.ids, ['a', 'b']);
  assert.equal(k.run, null);
});
check('어느 시험을 잇나: 약점 퀴즈 · 오늘 랜덤 테스트만. 지역 승급시험과 일반 시험은 아니다', () => {
  assert.equal(keepModeOf({ weak: { total: 30 } }), 'weak');
  assert.equal(keepModeOf({ flow: { kind: 'random' } }), 'random');
  assert.equal(keepModeOf({ flow: { kind: 'region' } }), null);
  assert.equal(keepModeOf({ weak: { total: 30 }, flow: { kind: 'region' } }), null);
  assert.equal(keepModeOf({}), null);
});
console.log(`통과 ${pass} / 실패 0`);
