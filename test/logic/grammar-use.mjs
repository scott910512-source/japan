/* 외운 단어로 문법 활용 — lib/grammarUse.js (2026-11-19)
 * 단어 선정 · 문장 만들기 · 시기(초기 진단 → 탐색 10일 → 반복) · 진단 3/2/0~1 경로 · 기록 합치기 */
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { ALL_WORDS } from '../../src/data/allWords.js';
import { BOX } from '../../src/lib/review.js';
import * as G from '../../src/lib/grammarUse.js';

let pass = 0;
const check = (l, f) => { f(); pass++; console.log('✓', l); };
const T = '2026-11-19';
const W = ALL_WORDS.filter((w) => !w.grammar);
const byKanji = new Map(W.map((w) => [w.kanji || w.kana, w]));
const knownState = { lastSeen: '2026-11-10', level: 2, box: BOX.KNOWN, fx: { mean: { lv: 2 }, read: { lv: 0 }, prod: { lv: 0 } } };
const ALL_KNOWN = Object.fromEntries(W.map((w) => [w.id, knownState]));
const reviewOf = (kanjis, st = knownState) => Object.fromEntries(kanjis.map((k) => byKanji.get(k)).filter(Boolean).map((w) => [w.id, st]));

check('★ 단어 선정 기준: 뜻 칸 확인 > 오늘 알아요 > 자가 신고, 최근 몰라요 · 열어만 본 것은 뺀다 ★', () => {
  assert.equal(G.wordTier({ lastSeen: '2026-11-10', fx: { mean: { lv: 1 } }, box: BOX.KNOWN }, T), 3);
  assert.equal(G.wordTier({ lastSeen: T, level: 0, box: BOX.KNOWN }, T), 2);
  assert.equal(G.wordTier({ lastSeen: '2026-11-10', level: 0, box: BOX.VAGUE, selfKnown: true }, T), 1);
  assert.equal(G.wordTier({ lastSeen: '2026-11-18', level: 2, box: BOX.UNKNOWN }, T), 0, '최근 몰라요');
  assert.equal(G.wordTier({ lastSeen: '2026-11-10', level: 0, box: BOX.NEW }, T), 0, '열어만 봄');
  assert.equal(G.wordTier(undefined, T), 0);
});

check('★ 모든 문법이 아는 단어로 문장을 만든다 · 유형 둘 이상 ★', () => {
  for (const g of G.GRAMMAR_USE) {
    const ctx = G.makeCtx({ words: ALL_WORDS, review: ALL_KNOWN, today: T, seed: g.id });
    const kinds = new Set(['choice', 'type', 'order', 'pick'].filter((k) => G.makeQuestion(g.id, ctx, k)));
    assert.ok(kinds.has('choice') && kinds.size >= 2, `${g.id}: ${[...kinds]}`);
  }
});

/* 전수 생성 — 검수용 덤프(test/out/grammar-use-sentences.txt) + 규칙 검사 */
const dump = [];
const all = [];
for (const g of G.GRAMMAR_USE) {
  dump.push(`\n## ${g.id} ${g.title}`);
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const ctx = G.makeCtx({ words: ALL_WORDS, review: ALL_KNOWN, today: T, seed: `${g.id}#${i}` });
    for (const k of ['choice', 'type', 'order', 'pick']) {
      const q = G.makeQuestion(g.id, ctx, k);
      if (!q || seen.has(`${k}|${q.full}`)) continue;
      seen.add(`${k}|${q.full}`); all.push(q);
      dump.push(`[${k}] ${q.kind === 'order' ? q.pieces.join(' / ') : q.text} → ${q.answer}${q.accepted.length > 1 ? ` (인정 ${q.accepted.slice(1).join(', ')})` : ''}${q.options ? ` 보기 ${q.options.join(' | ')}` : ''} ‖ ${q.ko}`);
    }
  }
}
try { mkdirSync(new URL('../out/', import.meta.url), { recursive: true }); writeFileSync(new URL('../out/grammar-use-sentences.txt', import.meta.url), dump.join('\n')); } catch { /* 덤프는 덤일 뿐 */ }

check(`문장 ${all.length}개 — 정답은 보기에 있고 보기는 서로 다르다 · 해석 · 설명이 있다`, () => {
  for (const q of all) {
    if (q.options) { assert.ok(q.options.includes(q.answer), q.full); assert.equal(new Set(q.options).size, q.options.length, q.full); assert.ok(q.options.length >= 3, q.full); }
    assert.ok(q.ko && !/undefined|null/.test(q.ko), q.full);
    assert.ok(q.expl && !/undefined/.test(q.expl), q.full);
    assert.ok(!/undefined|null/.test(q.full), q.full);
  }
});
check('★ 자연스러운 문장 규칙: 동물은 います · 물건은 あります, 가는 곳은 に/へ, 会う · 乗る는 を 문제에 안 나온다 ★', () => {
  for (const q of all.filter((x) => x.gid === 'iru-aru')) {
    if (/(犬|猫|鳥)が/.test(q.full)) assert.ok(q.full.includes('います'), q.full); else assert.ok(q.full.includes('あります'), q.full);
  }
  for (const q of all.filter((x) => x.gid === 'ni-dest')) assert.ok(/(行き|来|帰り)ます/.test(q.full), q.full);
  for (const q of all.filter((x) => ['o', 'masu', 'de'].includes(x.gid))) assert.ok(!/会います|乗ります/.test(q.full), q.full);
  for (const q of all.filter((x) => x.gid === 'ni-time' && x.kind !== 'pick')) assert.ok(/(日曜日|土曜日|週末)に/.test(q.full), q.full);
});
check('★ 복수 정답: 가는 곳은 に · へ 둘 다 맞다 · ので도 이유로 인정 ★', () => {
  const q = all.find((x) => x.gid === 'ni-dest' && x.kind === 'type');
  assert.ok(G.judge(q, 'に') && G.judge(q, 'へ') && !G.judge(q, 'で'));
  const k = all.find((x) => x.gid === 'kara' && x.kind === 'type');
  assert.ok(G.judge(k, 'から') && G.judge(k, 'ので'));
});
check('★ 동사 예외 활용: 行く → 行って, 来る → 来て(きて), する → して ★', () => {
  const qs = all.filter((x) => x.gid === 'tekudasai');
  const iku = qs.find((x) => x.full.includes('行'));
  const sa = qs.find((x) => /して/.test(x.full));
  if (iku) assert.ok(iku.full.includes('行って'), iku.full);
  if (sa) assert.ok(/してください/.test(sa.full), sa.full);
  const kuru = G.jpForms(await_vform('来る'));
  assert.equal(kuru.te.jp, '来て'); assert.equal(kuru.te.yomi, 'きて'); assert.equal(kuru.tekudasai.yomi, 'きてください');
});
function await_vform(k) {
  const w = byKanji.get(k);
  return { ...G.__vform(w) };
}
check('순서 맞추기는 바꿔도 되는 묶음 순서를 모두 인정한다(図書館で本を = 本を図書館で)', () => {
  const q = all.find((x) => x.kind === 'order' && x.gid === 'de');
  assert.ok(q.accepted.length === 2, q.accepted.join(' / '));
  assert.ok(G.judge(q, q.accepted[1]) && !G.judge(q, q.pieces.slice().reverse()));
});

/* ── 첫날 · 외운 단어가 적은 사람 ── */
check('★ 첫날(외운 단어 몇 개)도 초기 진단을 연다 — 모자라면 준비 단어 3개까지 ★', () => {
  const few = reviewOf(['パン', '食べる', '水', '飲む', '本', '読む', '学校', '行く'], { lastSeen: T, level: 0, box: BOX.KNOWN });
  const run = G.buildSet({ words: ALL_WORDS, review: few, gu: null, today: T });
  assert.equal(run.mode, 'place');
  assert.ok(!run.empty, run.reason);
  assert.ok(run.stages[0].qs.length >= 6, `${run.stages[0].qs.length}`);
  assert.ok(run.prep.length <= G.PREP_MAX, run.prep.map((p) => p.kanji).join(','));
});
check('외운 단어가 하나도 없으면 진단을 안 열고 이유를 말한다', () => {
  const run = G.buildSet({ words: ALL_WORDS, review: {}, gu: null, today: T });
  assert.ok(run.empty && run.reason);
});

/* ── 시기 ── */
const placeDone = { place: { day: '2026-11-01', res: Object.fromEntries(G.GRAMMAR_USE.map((g, i) => [g.id, i < 5 ? 1 : 0])) }, g: {}, days: ['2026-11-01'] };
check('★ 시기: 진단 전 → 초기 진단, 10일 미만 → 탐색, 10일 뒤 → 반복 ★', () => {
  assert.equal(G.modeOf(null), 'place');
  assert.equal(G.modeOf(placeDone), 'explore');
  const ten = { ...placeDone, days: Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`) };
  assert.equal(G.modeOf(ten), 'repeat');
});
check('★ 탐색: 문법 넷 × 2문제 = 8문제, 진단에서 틀린 것부터 ★', () => {
  const run = G.buildSet({ words: ALL_WORDS, review: ALL_KNOWN, gu: placeDone, today: T });
  assert.equal(run.mode, 'explore');
  assert.equal(run.stages[0].qs.length, 8);
  assert.deepEqual(run.grammars, G.GRAMMAR_USE.slice(5, 9).map((g) => g.id));
  const per = {}; for (const q of run.stages[0].qs) (per[q.gid] ||= new Set()).add(q.kind);
  assert.ok(Object.values(per).every((k) => k.size === 2), '문법마다 유형 둘');
});
check('초기 진단: 기초 12개 → 8개 넘게 맞으면 뒤 묶음까지, 아니면 끝', () => {
  const run = G.buildSet({ words: ALL_WORDS, review: ALL_KNOWN, gu: null, today: T });
  const s = run.stages[0];
  s.answers = s.qs.map((q, i) => ({ ok: i < 9, first: true }));
  assert.equal(G.nextStage(run)?.name, 'place2');
  s.answers = s.qs.map((q, i) => ({ ok: i < 5, first: true }));
  assert.equal(G.nextStage(run), null);
  const out = G.outcomeOf(run, T);
  assert.equal(Object.keys(out.placeRes).length, s.qs.length);
  const gu = G.applyOutcome(null, out);
  assert.equal(G.statusOf(gu, s.qs[0].gid, T).lastPass, null, '진단 한 문제로는 통과가 아니다');
});

/* ── 반복 학습: 진단 3 → 3/3 · 2/3 · 0~1 ── */
const tenDays = { ...placeDone, days: Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`) };
const repeatRun = (gid = 'o') => G.buildSet({ words: ALL_WORDS, review: ALL_KNOWN, gu: tenDays, today: T, gid });
check('★ 3/3 → 빠른 통과(설명 · 연습 없음), 같은 날 「오늘 확인 완료」 ★', () => {
  const run = repeatRun();
  assert.equal(run.stages[0].qs.length, G.DIAG_SIZE);
  assert.ok(new Set(run.stages[0].qs.map((q) => q.kind)).size >= 2, '유형 둘 이상');
  assert.equal(new Set(run.stages[0].qs.map((q) => q.full)).size, 3, '서로 다른 문장');
  run.stages[0].answers = run.stages[0].qs.map(() => ({ ok: true, first: true }));
  assert.equal(G.nextStage(run), null);
  const gu = G.applyOutcome(tenDays, G.outcomeOf(run, T));
  const st = G.statusOf(gu, 'o', T);
  assert.ok(st.passedToday && st.quickToday && st.level === 1 && st.due === '2026-11-20');
});
check('★ 2/3 → 추가 확인 2문제(새 문장) · 둘 다 맞으면 통과, 아니면 복습 대상 ★', () => {
  const run = repeatRun();
  run.stages[0].answers = [{ ok: true }, { ok: false }, { ok: true }];
  const f = G.nextStage(run);
  assert.equal(f.name, 'follow'); assert.equal(f.qs.length, 2);
  assert.ok(f.qs.every((q) => !run.stages[0].qs.some((d) => d.full === q.full)), '새 문장');
  run.stages.push({ ...f, answers: [{ ok: true }, { ok: true }] }); run.stage = 1;
  assert.ok(G.statusOf(G.applyOutcome(tenDays, G.outcomeOf(run, T)), 'o', T).passedToday);
  run.stages[1].answers = [{ ok: true }, { ok: false }];
  const st = G.statusOf(G.applyOutcome(tenDays, G.outcomeOf(run, T)), 'o', T);
  assert.ok(!st.passedToday && st.weak);
});
check('★ 0~1/3 → 설명 + 연습 5문제, 문항 수가 늘지 않는다 ★', () => {
  const run = repeatRun();
  run.stages[0].answers = [{ ok: false }, { ok: true }, { ok: false }];
  const p = G.nextStage(run);
  assert.equal(p.name, 'practice'); assert.equal(p.qs.length, G.PRACTICE_SIZE); assert.equal(p.intro, 'rule');
  run.stages.push({ ...p, answers: p.qs.map(() => ({ ok: true })) }); run.stage = 1;
  assert.equal(G.nextStage(run), null, '연습 뒤에 또 단계가 붙지 않는다');
  const st = G.statusOf(G.applyOutcome(tenDays, G.outcomeOf(run, T)), 'o', T);
  assert.ok(st.weak && !st.passedToday, '연습을 다 맞혀도 같은 날 통과로 안 친다');
});
check('★ 단어 도움으로 뺀 문제(void)는 문법 채점에 안 들어간다 ★', () => {
  const run = repeatRun();
  run.stages[0].answers = [{ ok: true }, { void: true, ok: false }, { ok: true }];
  assert.deepEqual(G.stageScore(run.stages[0]), { right: 2, total: 2 });
});
check('★ 같은 날 같은 문제를 여러 번 맞혀도 단계는 한 번만 · 다른 날에 올라간다 ★', () => {
  let gu = tenDays;
  for (let i = 0; i < 3; i++) { const run = repeatRun(); run.stages[0].answers = run.stages[0].qs.map(() => ({ ok: true })); gu = G.applyOutcome(gu, G.outcomeOf(run, T)); }
  assert.equal(G.statusOf(gu, 'o', T).level, 1);
  const run2 = G.buildSet({ words: ALL_WORDS, review: ALL_KNOWN, gu, today: '2026-11-20', gid: 'o' });
  run2.stages[0].answers = run2.stages[0].qs.map(() => ({ ok: true }));
  gu = G.applyOutcome(gu, G.outcomeOf(run2, '2026-11-20'));
  assert.equal(G.statusOf(gu, 'o', '2026-11-20').level, 2);
  assert.ok(run2.stages[0].qs.every((q) => !G.statusOf(tenDays, 'o').qs.includes(q.qid)), '다음 날은 다른 문장');
});
check('★ 통과한 뒤 틀리면 약점으로 돌아가 오늘의 문법이 된다 ★', () => {
  let gu = G.applyOutcome(tenDays, { touch: { o: { pass: ['2026-11-10'], fail: [], quick: [], apply: [], qs: [] } }, day: '2026-11-10' });
  gu = G.applyOutcome(gu, { touch: { o: { pass: [], fail: ['2026-11-18'], quick: [], apply: [], qs: [] } }, day: '2026-11-18' });
  assert.ok(G.statusOf(gu, 'o', T).weak);
  assert.equal(G.recommend(gu, T).gid, 'o');
});
check('오늘의 문법 순서: 복습일 > 최근 틀림 > 다음 문법(선수가 안 됐으면 선수부터)', () => {
  const fresh = { place: { day: '2026-11-01', res: {} }, g: {}, days: tenDays.days };
  assert.equal(G.recommend(fresh, T).gid, 'desu');
  const gu = G.applyOutcome(fresh, { touch: { desu: { pass: ['2026-11-15'], fail: [], quick: [], apply: [], qs: [] } }, day: '2026-11-15' });
  assert.equal(G.recommend(gu, T).gid, 'desu', '복습일(1일 뒤)이 지났다');
  const nx = G.recommend(G.applyOutcome(gu, { touch: { desu: { pass: [T], fail: [], quick: [], apply: [], qs: [] } }, day: T }), T);
  assert.equal(nx.gid, 'wa');
});
check('★ 기초를 상위 문제(순서 맞추기)에서 처음에 맞게 쓰면 그 기초의 확인으로 센다 — 나왔다는 이유로는 안 센다 ★', () => {
  const run = repeatRun('de');
  const i = run.stages[0].qs.findIndex((q) => q.kind === 'order');
  run.stages[0].answers = run.stages[0].qs.map((q, j) => ({ ok: true, first: j === i }));
  const out = G.outcomeOf(run, T);
  assert.ok(out.touch.o?.apply?.includes(T), JSON.stringify(out.touch));
  run.stages[0].answers = run.stages[0].qs.map(() => ({ ok: false, first: true }));
  assert.ok(!G.outcomeOf(run, T).touch.o?.apply?.length);
});
check('★ 두 기기 합치기 — 같은 기록을 두 번 넣어도 늘지 않는다 ★', () => {
  const run = repeatRun(); run.stages[0].answers = run.stages[0].qs.map(() => ({ ok: true }));
  const out = G.outcomeOf(run, T);
  const a = G.applyOutcome(tenDays, out); const b = G.applyOutcome(a, out);
  assert.deepEqual(a, b);
  const m = G.mergeGrammarUse(a, G.applyOutcome(tenDays, out));
  assert.deepEqual(m.g.o.pass, [T]);
  assert.deepEqual(G.mergeGrammarUse(a, b), a);
});
check('세트는 시작할 때 문제를 다 정한다(같은 날 같은 문법은 같은 세트)', () => {
  assert.deepEqual(repeatRun().stages[0].qs.map((q) => q.qid), repeatRun().stages[0].qs.map((q) => q.qid));
});
console.log(`통과 ${pass} / 실패 0`);
