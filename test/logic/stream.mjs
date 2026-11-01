/* 쭉 퀴즈의 출제 규칙.
 *
 * 지키는 것:
 *   · 외운 것만 나온다, 목표 급수를 넘는 건 안 나온다
 *   · 약한 것이 더 자주 나온다(몇 배나 되는지가 아니라 「더」), 방금 낸 건 건너뛴다
 *   · 첫 대답만 기록하고, 맞히면 「알아요」 틀리면 「몰라요」다
 *   · 어느 종류든 같은 모양의 문제가 나오고 채점이 맞다 */
import { buildPool, difficultyOf, weightOf, newSession, pickNext, record, shouldRecord, verdictFor,
  questionFor, judge, summarize, poolCounts, KIND, WEIGHT_CAP, RECENT_BLOCK } from '../../src/lib/stream.js';
import { applyVerdict, VERDICT, todayKey, addDays, stateOf } from '../../src/lib/review.js';
import { goalOf, withinGoal, n3Included, GOAL_LEVELS, DEFAULT_GOAL } from '../../src/lib/goal.js';
import { DEFAULT_SETTINGS } from '../../src/lib/storage.js';
import { pickSyncedSettings } from '../../src/lib/merge.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
/* 고정 난수 — 테스트가 우연에 안 기댄다 */
const seeded = (seed = 1) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

const today = todayKey();
const mk = (id, level, mean, kanji = id, kana = id) => ({ id, level, mean, kanji, kana });
const WORDS = [
  ...Array.from({ length: 12 }, (_, i) => mk(`n5-${i}`, 'N5', `뜻5-${i}`, `語${i}`, `ご${i}`)),
  ...Array.from({ length: 6 }, (_, i) => mk(`n4-${i}`, 'N4', `뜻4-${i}`, `話${i}`, `わ${i}`)),
  ...Array.from({ length: 6 }, (_, i) => mk(`n3-${i}`, 'N3', `뜻3-${i}`, `書${i}`, `か${i}`)),
];
const seenAll = Object.fromEntries(WORDS.map((w) => [w.id, applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -3))]));

console.log('\n[ 목표 레벨 ]');
ok('기본 목표는 N3', DEFAULT_GOAL === 'N3' && goalOf({}) === 'N3' && DEFAULT_SETTINGS.goalLevel === 'N3');
ok('모르는 값이면 기본으로', goalOf({ goalLevel: 'N1' }) === 'N3' && goalOf({ goalLevel: '엉뚱' }) === 'N3' && goalOf(null) === 'N3');
ok('고를 수 있는 급수는 자료가 있는 N5·N4·N3', GOAL_LEVELS.join() === 'N5,N4,N3');
ok('목표 N4면 N3는 목표 밖', withinGoal('N5', 'N4') && withinGoal('N4', 'N4') && !withinGoal('N3', 'N4'));
ok('급수를 모르는 것은 넘지 않는다', withinGoal(null, 'N5') && withinGoal(undefined, 'N5'));
ok('N3 코스 자료는 목표가 N3일 때만', n3Included('N3') && !n3Included('N4') && !n3Included('N5'));
ok('★ 목표는 기기 사이에 동기화된다 ★', pickSyncedSettings({ goalLevel: 'N4' }).goalLevel === 'N4');

console.log('\n[ 풀 — 외운 것만, 목표 안에서만 ]');
{
  const review = { ...seenAll };
  const all = buildPool({ words: WORDS, review, goal: 'N3', today });
  ok('N3 목표: 본 단어 24개가 다 든다', all.length === 24, `${all.length}`);
  const n4 = buildPool({ words: WORDS, review, goal: 'N4', today });
  ok('★ 목표 N4: N3 단어는 안 나온다 ★', n4.length === 18 && !n4.some((it) => it.id.startsWith('n3-')), `${n4.length}`);
  const n5 = buildPool({ words: WORDS, review, goal: 'N5', today });
  ok('목표 N5: N5만', n5.length === 12);
  const partial = { 'n5-0': review['n5-0'], 'n5-1': review['n5-1'] };
  ok('★ 한 번도 안 본 단어는 안 나온다 ★', buildPool({ words: WORDS, review: partial, goal: 'N3', today }).length === 2);
  const n3 = buildPool({
    words: [], review: { 'k:体': review['n5-0'], 'g:wa-ga': review['n5-0'], 'k:首': undefined },
    n3: { kanjiIds: ['k:体', 'k:首'], grammarIds: ['g:wa-ga'] }, goal: 'N3', today,
  });
  ok('N3 한자·문법도 본 것만 든다', n3.length === 2 && poolCounts(n3).kanji === 1 && poolCounts(n3).grammar === 1);
  ok('목표 N4면 N3 한자·문법이 빠진다', buildPool({ words: [], review: { 'k:体': review['n5-0'] }, n3: { kanjiIds: ['k:体'], grammarIds: [] }, goal: 'N4', today }).length === 0);
}

console.log('\n[ 얼마나 약한가 ]');
{
  const strong = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -3)), level: 4 };
  let weak = applyVerdict(undefined, VERDICT.UNKNOWN, addDays(today, -3));
  weak = applyVerdict(weak, VERDICT.UNKNOWN, addDays(today, -2));
  const dStrong = difficultyOf(strong, null, today);
  const dWeak = difficultyOf(weak, null, today);
  ok('★ 자꾸 틀린 것이 잘 아는 것보다 약하다 ★', dWeak > dStrong, `${dWeak} > ${dStrong}`);
  ok('약한 정도는 0 밑으로 안 간다', difficultyOf({ level: 5 }, null, today) >= 0);
  ok('복습일이 지난 것은 더 약하다', difficultyOf({ ...strong, due: addDays(today, -5) }, null, today) > difficultyOf({ ...strong, due: addDays(today, 5) }, null, today));
  ok('★ 가중치는 상한이 있다 — 약한 것이 판을 독차지하지 않는다 ★', weightOf(999) === 1 + WEIGHT_CAP && weightOf(0) === 1);
  ok('약할수록 무겁다', weightOf(dWeak) > weightOf(dStrong));
}

console.log('\n[ 뽑기 ]');
{
  /* 약한 단어 하나, 나머지는 잘 아는 단어 — 약한 쪽이 더 자주 나와야 한다 */
  let weakSt = applyVerdict(undefined, VERDICT.UNKNOWN, addDays(today, -3));
  weakSt = applyVerdict(weakSt, VERDICT.UNKNOWN, addDays(today, -2));
  const review = {};
  for (const w of WORDS) review[w.id] = { ...applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -3)), level: 4, due: addDays(today, 10) };
  review['n5-0'] = weakSt;
  const pool = buildPool({ words: WORDS, review, goal: 'N3', today });
  const rng = seeded(7);
  const counts = {};
  let session = newSession();
  for (let i = 0; i < 600; i++) {
    const it = pickNext(pool, session, rng);
    counts[it.id] = (counts[it.id] || 0) + 1;
    session = { ...session, recent: [...session.recent, it.id].slice(-20) };   // 대답은 안 적고 최근만
  }
  const avgOthers = (600 - counts['n5-0']) / 23;
  ok('★ 약한 단어가 평균보다 훨씬 자주 나온다 ★', counts['n5-0'] > avgOthers * 3, `약한 것 ${counts['n5-0']}번 · 나머지 평균 ${avgOthers.toFixed(1)}번`);
  ok('잘 아는 단어도 나온다(굶기지 않는다)', Object.keys(counts).length === 24, `${Object.keys(counts).length}종`);

  /* 방금 낸 것은 건너뛴다 */
  let s2 = newSession();
  let repeats = 0; let prev = null;
  const rng2 = seeded(3);
  for (let i = 0; i < 300; i++) {
    const it = pickNext(pool, s2, rng2);
    const recent5 = s2.recent.slice(-RECENT_BLOCK);
    if (recent5.includes(it.id)) repeats++;
    s2 = record(s2, it, true);
    prev = it;
  }
  ok('★ 방금 낸 다섯 개는 다시 안 나온다 ★', repeats === 0, `${repeats}번`);
  ok('빈 풀이면 null', pickNext([], newSession()) === null);
  ok('풀이 하나뿐이어도 멈추지 않는다', pickNext([pool[0]], record(newSession(), pool[0], true))?.id === pool[0].id);

  /* 판 안에서 적응한다 — 틀리면 더 나오고 맞히면 덜 나온다 */
  const item = pool[5];
  const wrongSession = record(newSession(), item, false);
  const rightSession = record(newSession(), item, true);
  ok('틀리면 이 판에서 더 자주 나오게 된다', wrongSession.bump[item.id] > 0 && rightSession.bump[item.id] < 0);
}

console.log('\n[ 기록 — 첫 대답만, 맞히면 알아요 · 틀리면 몰라요 ]');
{
  const item = { id: 'n5-1', kind: KIND.WORD, d: 0 };
  let s = newSession();
  ok('처음엔 기록한다', shouldRecord(s, item.id));
  s = record(s, item, false);
  ok('★ 한 번 답하면 같은 판에서는 더 기록 안 한다 ★', !shouldRecord(s, item.id));
  s = record(s, item, true);
  ok('★ 틀린 뒤 맞혀도 첫 기록(틀림)은 그대로 ★', s.recorded[item.id] === false);
  ok('판 기록(log)에는 둘 다 남는다', s.log.length === 2 && s.asked[item.id] === 2);
  ok('맞히면 알아요, 틀리면 몰라요', verdictFor(true) === VERDICT.KNOWN && verdictFor(false) === VERDICT.UNKNOWN);
  ok('연속 정답과 최고 기록', record(record(record(newSession(), item, true), item, true), item, false).best === 2);
  ok('틀리면 연속이 0', record(record(newSession(), item, true), item, false).streak === 0);
  /* ★ 복습 간격에 실제로 반영된다 — 같은 판정 함수를 거친다 ★ */
  const before = applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -4));
  const after = applyVerdict(before, verdictFor(false), today);
  ok('★ 틀리면 오늘 복습에 올라온다(due = 오늘) ★', after.due === today && after.level === 0);
  const due = { ...before, due: today, level: 1 };
  ok('★ 복습일에 맞히면 기억 단계가 오른다 ★', applyVerdict(due, verdictFor(true), today).level === 2);
}

console.log('\n[ 문제 만들기·채점 ]');
{
  const wordById = new Map(WORDS.map((w) => [w.id, w]));
  const SENT = Array.from({ length: 8 }, (_, i) => ({ id: `s-${i}`, kanji: `文${i}です。`, kana: `ぶん${i}です。`, mean: `문장${i}이에요.`, level: 'N5', place: '식당' }));
  const sentenceById = new Map(SENT.map((s) => [s.id, s]));
  const ctx = (seed = 5) => ({ wordById, wordPool: WORDS, sentenceById, sentencePool: SENT, rng: seeded(seed),
    n3Question: (id) => (id === 'k:体' ? { q: '【体重】の読み方は？', sub: '体 — 몸 체', options: ['たいじゅう', 'しんたい', 'じしん'], answer: 'たいじゅう', expl: '체중', speak: 'たいじゅう' } : null) });

  let sawChoice = false; let sawTyping = false; let ok4 = true; let answerIn = true;
  for (let seed = 1; seed < 80; seed++) {
    const q = questionFor({ id: 'n5-3', kind: KIND.WORD, d: seed % 2 ? 0 : 6 }, ctx(seed));
    if (q.mode === 'choice') { sawChoice = true; if (q.options.length !== 4) ok4 = false; if (!q.options.some((o) => o.key === q.correct)) answerIn = false; }
    else sawTyping = true;
  }
  ok('단어: 보기가 넷이고 정답이 안에 있다', ok4 && answerIn && sawChoice);
  ok('★ 익숙한 단어는 직접 쓰기도 나온다 ★', sawTyping);
  const weakQs = Array.from({ length: 60 }, (_, i) => questionFor({ id: 'n5-3', kind: KIND.WORD, d: 8 }, ctx(i + 1)));
  ok('★ 약한 단어는 늘 보기가 있는 문제다 ★', weakQs.every((q) => q.mode === 'choice'));

  const sq = questionFor({ id: 's-2', kind: KIND.SENTENCE, d: 3 }, ctx(9));
  ok('문장: 보기 넷, 정답이 안에, 겹치지 않는다', sq.options.length === 4 && sq.options.some((o) => o.key === 's-2') && new Set(sq.options.map((o) => o.label)).size === 4);
  ok('문장: 정답 글자가 보기 안에 있다', sq.options.find((o) => o.key === sq.correct).label === sq.answerText);
  ok('문장이 모자라면 문제를 안 만든다(보기를 못 채운다)',
    questionFor({ id: 's-2', kind: KIND.SENTENCE, d: 3 }, { ...ctx(1), sentencePool: SENT.slice(0, 2) }) === null);

  const kq = questionFor({ id: 'k:体', kind: KIND.KANJI, d: 3 }, ctx());
  ok('N3 한자·문법: 같은 모양으로 맞춰진다', kq.mode === 'choice' && kq.options.length === 3 && kq.correct === 'たいじゅう' && kq.prompt.includes('体重'));
  ok('없는 id는 null(화면이 다음 문제로 넘어간다)', questionFor({ id: 'k:없음', kind: KIND.KANJI, d: 1 }, ctx()) === null && questionFor({ id: 'zz', kind: KIND.WORD, d: 1 }, ctx()) === null);

  /* 채점 */
  ok('보기: 정답 키면 맞다', judge(sq, 's-2').verdict === 'correct' && judge(sq, 's-3').verdict === 'wrong');
  const typing = { mode: 'typing', word: { id: 'x', kanji: 'ビール', kana: 'ビール', mean: '맥주' }, dir: 'ko-jp' };
  ok('직접 쓰기: 표기가 맞으면 맞다', judge(typing, 'ビール').verdict === 'correct');
  ok('★ 맥주와 빌딩은 다르다(ビル) — 소리를 가르는 차이는 틀림 ★', judge(typing, 'ビル').verdict === 'wrong');
  ok('빈 입력은 틀림', judge(typing, '').verdict === 'wrong');
  const typingKo = { mode: 'typing', word: { id: 'y', kanji: '水', kana: 'みず', mean: '물' }, dir: 'jp-ko' };
  ok('뜻을 쓰는 문제: 맞는 뜻', judge(typingKo, '물').verdict === 'correct');
}

console.log('\n[ 평가 ]');
{
  const log = [
    { id: 'a', kind: 'word', ok: true }, { id: 'b', kind: 'word', ok: false }, { id: 'b', kind: 'word', ok: false },
    { id: 'c', kind: 'kanji', ok: true }, { id: 'd', kind: 'sentence', ok: false }, { id: 'e', kind: 'grammar', ok: true },
  ];
  const r = summarize(log);
  ok('정답률', r.total === 6 && r.right === 3 && r.pct === 50);
  ok('종류별 정답률', r.byKind.word.total === 3 && r.byKind.word.pct === 33 && r.byKind.kanji.pct === 100 && r.byKind.sentence.pct === 0);
  ok('★ 다시 볼 것: 많이 틀린 것부터 ★', r.missed[0].id === 'b' && r.missed[0].n === 2 && r.missed.length === 2);
  ok('빈 판도 안 죽는다', summarize([]).total === 0 && summarize([]).pct === 0 && summarize().missed.length === 0);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
