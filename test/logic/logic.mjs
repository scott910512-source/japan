/* 암기(회독) 엔진과 시험 채점의 규칙을 순수 함수 수준에서 검증한다.
   화면을 거치지 않으므로 규칙이 깨졌는지 바로 드러난다. */
import {
  VERDICT, BOX, MASTER_STREAK, applyVerdict, stateOf, emptyState,
  isSessionClear, isMastered, dueDate, isDue, dueCards, weakCards,
  buildDailySession, buildNextRound, advanceSession, nextRoundOf, summarize,
  todayKey, addDays, daysBetween,
} from '../../src/lib/review.js';
import {
  QUIZ_TYPE, QUIZ_DIR, QUIZ_SCOPE, meaningsOf, normalizeAnswer, normalizeJp,
  editDistance, checkTyping, pickDistractors, buildQuestion, buildQuiz,
  scopeWords, gradeQuiz, gradeLabel, CHOICE_COUNT,
} from '../../src/lib/quiz.js';
import { ALL_WORDS } from '../../src/data/allWords.js';

let pass = 0, fail = 0;
const ok = (l, c, e) => { if (c) { pass++; } else { fail++; console.log('  ✗', l, e !== undefined ? '— ' + e : ''); } };
const group = (n) => console.log('\n■', n);

/* ── 암기: 판정 적용 ── */
group('암기 · 판정');
{
  const e = emptyState();
  ok('처음은 미학습', e.box === BOX.NEW && e.streak === 0);

  const known = applyVerdict(e, VERDICT.KNOWN);
  ok('알아요 → 상자 3, 연속 1', known.box === BOX.KNOWN && known.streak === 1);

  const unknown = applyVerdict(known, VERDICT.UNKNOWN);
  ok('몰라요 → 연속 초기화', unknown.box === BOX.UNKNOWN && unknown.streak === 0 && unknown.wrongCount === 1);

  const vague = applyVerdict(e, VERDICT.VAGUE);
  ok('애매해요 → 상자 2', vague.box === BOX.VAGUE && vague.vagueCount === 1);

  const master = applyVerdict(e, VERDICT.MASTER);
  ok('기억했어요 → 바로 졸업', isMastered(master) && master.streak === MASTER_STREAK);

  ok('입력을 건드리지 않음', e.box === BOX.NEW && e.streak === 0);
  ok('회독 수가 오름', known.rounds === 1 && unknown.rounds === 2);
}

/* ── 암기: 세션 종료 조건 ── */
group('암기 · 세션 종료 조건');
{
  const once = applyVerdict(emptyState(), VERDICT.KNOWN);
  ok('한 번에 알면 이번 회독 끝', isSessionClear(once));

  const afterVague = applyVerdict(applyVerdict(emptyState(), VERDICT.VAGUE), VERDICT.KNOWN);
  ok('애매했던 건 한 번으로 안 끝남', !isSessionClear(afterVague));
  const twice = applyVerdict(afterVague, VERDICT.KNOWN);
  ok('애매했던 건 두 번 맞혀야 끝', isSessionClear(twice));

  ok('몰라요는 안 끝남', !isSessionClear(applyVerdict(emptyState(), VERDICT.UNKNOWN)));
}

/* ── 암기: 복습 간격 ── */
group('암기 · 복습 간격');
{
  const T = '2026-01-10';
  const mk = (box, streak, lastSeen = T) => ({ ...emptyState(), box, streak, lastSeen });

  ok('미학습은 복습 대상 아님', dueDate(emptyState()) === null);
  // 졸업해도 영영 빠지지는 않는다 — 간격만 벌어진다. 안 그러면 다 잊는다.
  ok('졸업하면 한 달 뒤', dueDate(mk(BOX.KNOWN, MASTER_STREAK)) === '2026-02-09', dueDate(mk(BOX.KNOWN, MASTER_STREAK)));
  ok('그다음은 석 달 뒤', dueDate(mk(BOX.KNOWN, 5)) === '2026-04-10', dueDate(mk(BOX.KNOWN, 5)));
  ok('그 뒤로는 반년 간격', dueDate(mk(BOX.KNOWN, 6)) === '2026-07-09', dueDate(mk(BOX.KNOWN, 6)));
  ok('졸업 표시는 그대로', isMastered(mk(BOX.KNOWN, MASTER_STREAK)) === true);
  ok('몰라요는 다음 날', dueDate(mk(BOX.UNKNOWN, 0)) === '2026-01-11');
  ok('애매해요는 다음 날', dueDate(mk(BOX.VAGUE, 0)) === '2026-01-11');
  ok('알아요 1연속 → 1일', dueDate(mk(BOX.KNOWN, 1)) === '2026-01-11');
  ok('알아요 2연속 → 3일', dueDate(mk(BOX.KNOWN, 2)) === '2026-01-13');
  ok('알아요 3연속 → 7일', dueDate(mk(BOX.KNOWN, 3)) === '2026-01-17');

  ok('간격이 갈수록 벌어짐',
    daysBetween(T, dueDate(mk(BOX.KNOWN, 1))) < daysBetween(T, dueDate(mk(BOX.KNOWN, 2)))
    && daysBetween(T, dueDate(mk(BOX.KNOWN, 2))) < daysBetween(T, dueDate(mk(BOX.KNOWN, 3))));

  ok('예정일이 되면 복습', isDue(mk(BOX.KNOWN, 1), '2026-01-11'));
  ok('예정일 전에는 아님', !isDue(mk(BOX.KNOWN, 1), '2026-01-10'));
  ok('밀린 것도 복습', isDue(mk(BOX.KNOWN, 1), '2026-03-01'));

  // 월·연 경계
  ok('월말을 넘김', addDays('2026-01-30', 3) === '2026-02-02');
  ok('연말을 넘김', addDays('2026-12-30', 3) === '2027-01-02');
  ok('윤년 2월', addDays('2028-02-28', 1) === '2028-02-29');
}

/* ── 암기: 복습 큐 ── */
group('암기 · 복습 큐');
{
  const prog = {};
  const ids = [];
  for (let i = 0; i < 150; i++) {
    const id = `w${i}`; ids.push(id);
    prog[id] = { ...emptyState(), box: BOX.UNKNOWN, streak: 0, lastSeen: '2026-01-01' };
  }
  const due = dueCards(ids, prog, '2026-02-01');
  ok('하루 상한을 지킴', due.length === 100, due.length);

  prog.w0.lastSeen = '2025-12-01'; // 가장 오래 밀린 것
  ok('오래 밀린 것부터', dueCards(ids, prog, '2026-02-01')[0] === 'w0');

  prog.w1 = { ...emptyState(), box: BOX.KNOWN, streak: MASTER_STREAK, lastSeen: '2026-01-01' };
  ok('졸업한 건 안 나옴', !dueCards(ids, prog, '2026-02-01').includes('w1'));

  ok('빈 목록도 안전', dueCards([], {}, '2026-02-01').length === 0);
  ok('기록 없는 id도 안전', dueCards(['없음'], {}, '2026-02-01').length === 0);
}

/* ── 암기: 취약 단어 ── */
group('암기 · 취약 단어');
{
  const prog = {
    a: { ...emptyState(), wrongCount: 3, lastSeen: '2026-01-01' },
    b: { ...emptyState(), wrongCount: 1, vagueCount: 2, lastSeen: '2026-01-01' },
    c: { ...emptyState(), wrongCount: 2, lastSeen: '2026-01-01' },
    d: { ...emptyState(), wrongCount: 9, box: BOX.KNOWN, streak: MASTER_STREAK, lastSeen: '2026-01-01' },
  };
  const weak = weakCards(['a', 'b', 'c', 'd'], prog);
  ok('기준을 넘으면 취약', weak.includes('a') && weak.includes('b'));
  ok('기준 미만은 제외', !weak.includes('c'));
  ok('졸업했으면 제외', !weak.includes('d'));
}

/* ── 암기: 하루 세션 구성 ── */
group('암기 · 하루 세션');
{
  const ids = Array.from({ length: 300 }, (_, i) => `w${i}`);
  const prog = {};
  for (let i = 0; i < 40; i++) prog[`w${i}`] = { ...emptyState(), box: BOX.UNKNOWN, lastSeen: '2026-01-01' };
  for (let i = 40; i < 50; i++) prog[`w${i}`] = { ...emptyState(), box: BOX.KNOWN, streak: MASTER_STREAK, lastSeen: '2026-01-01' };

  const s = buildDailySession(ids, prog, { goal: 60, today: '2026-02-01' });
  ok('학습량만큼 담음', s.queue.length === 60, s.queue.length);
  ok('복습이 1/4', s.reviewPicked === 15, s.reviewPicked);
  ok('나머지는 신규', s.newPicked === 45, s.newPicked);
  // 졸업한 카드도 한 달이 지났으면 확인차 들어온다 (여기선 2026-01-01 → 2026-02-01)
  const grad = s.queue.filter((id) => { const n = Number(id.slice(1)); return n >= 40 && n < 50; }).length;
  ok('졸업한 것도 오래되면 다시 나옴', grad > 0, String(grad));
  // 다만 몰라요만 뽑히고 나머지가 굶으면 안 된다
  const wrongPicked = s.queue.filter((id) => Number(id.slice(1)) < 40).length;
  ok('몰라요가 복습을 다 먹지 않음', wrongPicked < 15, String(wrongPicked));
  ok('중복 없음', new Set(s.queue).size === s.queue.length);
  ok('남은 신규를 셈', s.freshLeft === 250 - 45, s.freshLeft);

  const empty = buildDailySession([], {}, {});
  ok('빈 단어장도 안전', empty.queue.length === 0 && empty.reviewPicked === 0);

  const allNew = buildDailySession(ids.slice(0, 5), {}, { newCount: 50, reviewCount: 15 });
  ok('복습할 게 없으면 신규만', allNew.reviewPicked === 0 && allNew.newPicked === 5);
}

/* ── 암기: 세션 진행 ── */
group('암기 · 세션 진행');
{
  let session = { queue: ['a', 'b', 'c'], roundIds: ['a', 'b', 'c'], round: 1, reinserted: [], done: 0 };
  let prog = {};

  let r = advanceSession(session, prog, 'a', VERDICT.UNKNOWN);
  session = r.session; prog = r.progress;
  ok('몰라요는 이번 회독에 다시 나옴', session.queue.includes('a'));
  ok('큐에서 한 번만 다시 넣음', session.queue.filter((x) => x === 'a').length === 1);

  r = advanceSession(session, prog, 'a', VERDICT.UNKNOWN);
  session = r.session; prog = r.progress;
  ok('두 번째 몰라요는 다시 안 넣음', !session.queue.includes('a'));

  r = advanceSession(session, prog, 'b', VERDICT.KNOWN);
  session = r.session; prog = r.progress;
  ok('알아요는 큐에서 빠짐', !session.queue.includes('b'));
  ok('처리 수를 셈', session.done === 3, session.done);

  r = advanceSession(session, prog, 'c', VERDICT.KNOWN);
  session = r.session; prog = r.progress;
  ok('큐가 비었음', session.queue.length === 0);

  const step = nextRoundOf(session, prog);
  ok('안 끝난 카드가 있으면 다음 회독', step.kind === 'next' && step.session.round === 2);
  ok('다음 회독은 남은 것만', step.session.queue.length === 1 && step.session.queue[0] === 'a');
  ok('다음 회독에서 재삽입 기록을 비움', step.session.reinserted.length === 0);

  // 다 맞히면 종료
  const done = advanceSession(step.session, prog, 'a', VERDICT.KNOWN);
  ok('전부 끝나면 세션 종료', nextRoundOf(done.session, done.progress).kind === 'done');

  // 3회독까지만 — 당일 무한 루프 방지
  let s2 = { queue: [], roundIds: ['x'], round: 3, reinserted: [], done: 0 };
  const carry = nextRoundOf(s2, { x: { ...emptyState(), box: BOX.UNKNOWN, lastSeen: '2026-01-01' } });
  ok('3회독을 넘기면 내일로 넘김', carry.kind === 'done' && carry.reason === 'carryover');

  ok('큐가 남아 있으면 계속', nextRoundOf({ queue: ['z'], roundIds: ['z'], round: 1 }, {}).kind === 'continue');
}

/* ── 암기: 집계 ── */
group('암기 · 집계');
{
  const prog = {
    a: { ...emptyState(), box: BOX.KNOWN, streak: MASTER_STREAK, lastSeen: '2026-01-01' },
    b: { ...emptyState(), box: BOX.UNKNOWN, lastSeen: '2026-01-01' },
  };
  const s = summarize(['a', 'b', 'c'], prog);
  ok('졸업·학습중·미학습을 나눔', s.mastered === 1 && s.learning === 1 && s.fresh === 1);
  ok('본 단어 = 졸업 + 학습중', s.seen === 2);
  ok('합이 전체와 같음', s.mastered + s.learning + s.fresh === s.total);
}

/* ── 시험: 답 정규화 ── */
group('시험 · 답 맞히기');
{
  ok('뜻을 조각으로 나눔', JSON.stringify(meaningsOf({ mean: '다투다;경쟁하다' })) === '["다투다","경쟁하다"]');
  ok('쉼표·슬래시도 나눔', meaningsOf({ mean: '꽤, 제법/제법' }).length === 3);
  ok('빈 뜻도 안전', meaningsOf({ mean: '' }).length === 0 && meaningsOf({}).length === 0);

  ok('괄호 주석을 무시', normalizeAnswer('부엌(주방)') === '부엌');
  ok('띄어쓰기를 무시', normalizeAnswer(' 부 엌 ') === '부엌');
  ok('가타카나를 히라가나로', normalizeJp('ラーメン') === 'らめん');

  ok('같은 문자열은 거리 0', editDistance('abc', 'abc') === 0);
  ok('한 글자 차이는 1', editDistance('abc', 'abd') === 1);
  ok('빈 문자열도 안전', editDistance('', 'abc') === 3);

  const w = { kanji: '台所', kana: 'だいどころ', mean: '부엌;주방' };
  ok('뜻 중 하나만 맞아도 정답', checkTyping(w, QUIZ_DIR.JP_KO, '주방') === 'correct');
  ok('띄어쓰기가 달라도 정답', checkTyping(w, QUIZ_DIR.JP_KO, ' 부엌 ') === 'correct');
  ok('한자로 써도 정답', checkTyping(w, QUIZ_DIR.KO_JP, '台所') === 'correct');
  ok('가나로 써도 정답', checkTyping(w, QUIZ_DIR.KO_JP, 'だいどころ') === 'correct');
  ok('오타는 거의 맞음', checkTyping(w, QUIZ_DIR.KO_JP, 'だいところ') === 'close');
  ok('전혀 다르면 오답', checkTyping(w, QUIZ_DIR.JP_KO, '학교') === 'wrong');
  ok('빈 답은 오답', checkTyping(w, QUIZ_DIR.JP_KO, '') === 'wrong' && checkTyping(w, QUIZ_DIR.JP_KO, '   ') === 'wrong');

  // 짧은 답에서 한 글자를 봐주면 다른 단어가 정답이 된다
  const short = { kanji: '木', kana: 'き', mean: '나무' };
  ok('짧은 답은 오타를 안 봐줌', checkTyping(short, QUIZ_DIR.KO_JP, 'し') === 'wrong');
}

/* ── 시험: 출제 ── */
group('시험 · 출제');
{
  let seed = 7;
  const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

  const q = buildQuestion(ALL_WORDS[0], { type: QUIZ_TYPE.CHOICE, dir: QUIZ_DIR.JP_KO }, ALL_WORDS, rng);
  ok('보기가 4개', q.options.length === CHOICE_COUNT, q.options.length);
  ok('정답이 보기에 있음', q.options.some((o) => o.wordId === q.wordId));
  ok('보기가 서로 다름', new Set(q.options.map((o) => o.wordId)).size === CHOICE_COUNT);
  ok('일→한은 한자를 묻고 뜻을 고름', q.prompt === ALL_WORDS[0].kanji && q.answer === ALL_WORDS[0].mean);

  const q2 = buildQuestion(ALL_WORDS[0], { type: QUIZ_TYPE.CHOICE, dir: QUIZ_DIR.KO_JP }, ALL_WORDS, rng);
  ok('한→일은 뜻을 묻고 한자를 고름', q2.prompt === ALL_WORDS[0].mean && q2.answer === ALL_WORDS[0].kanji);

  // 핵심: 정답과 뜻이 겹치는 보기가 나오면 안 된다
  let ambiguous = 0, short = 0;
  for (let i = 0; i < 1200; i++) {
    const word = ALL_WORDS[Math.floor(rng() * ALL_WORDS.length)];
    const ds = pickDistractors(word, ALL_WORDS, 3, rng);
    if (ds.length < 3) short++;
    const mine = new Set(meaningsOf(word));
    if (ds.some((d) => meaningsOf(d).some((m) => mine.has(m)))) ambiguous++;
    const seen = new Set();
    for (const d of ds) for (const m of meaningsOf(d)) { if (seen.has(m)) ambiguous++; seen.add(m); }
  }
  ok('정답과 뜻이 겹치는 보기가 없음', ambiguous === 0, `${ambiguous}건`);
  ok('보기 3개를 늘 채움', short === 0, `${short}건 부족`);

  const quiz = buildQuiz(ALL_WORDS, { count: 20, type: QUIZ_TYPE.MIX, dir: QUIZ_DIR.MIX, rng });
  ok('요청한 수만큼 출제', quiz.length === 20);
  ok('같은 단어를 두 번 안 냄', new Set(quiz.map((x) => x.wordId)).size === 20);
  ok('섞기는 객관식·주관식을 번갈아', quiz.filter((x) => x.type === QUIZ_TYPE.CHOICE).length === 10);
  ok('섞기는 방향도 번갈아', quiz.filter((x) => x.dir === QUIZ_DIR.JP_KO).length === 10);
  ok('문제 id가 겹치지 않음', new Set(quiz.map((x) => x.id)).size === 20);

  ok('단어보다 많이 요청해도 안전', buildQuiz(ALL_WORDS.slice(0, 3), { count: 20, rng }).length === 3);
  ok('빈 단어장도 안전', buildQuiz([], { count: 20, rng }).length === 0);
}

/* ── 시험: 범위 ── */
group('시험 · 범위');
{
  const words = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const review = {
    a: { lastSeen: '2026-01-01', wrongCount: 2 },
    b: { lastSeen: '2026-01-01', wrongCount: 0, vagueCount: 0 },
  };
  ok('전체는 다 나옴', scopeWords(words, review, QUIZ_SCOPE.ALL).length === 3);
  ok('외운 것만', scopeWords(words, review, QUIZ_SCOPE.SEEN).map((w) => w.id).join() === 'a,b');
  ok('틀린 것만', scopeWords(words, review, QUIZ_SCOPE.WEAK).map((w) => w.id).join() === 'a');
}

/* ── 시험: 채점 ── */
group('시험 · 채점');
{
  const qs = [{ id: 'q1', wordId: 'w1' }, { id: 'q2', wordId: 'w2' }, { id: 'q3', wordId: 'w3' }];
  const g = gradeQuiz(qs, { q1: { verdict: 'correct' }, q2: { verdict: 'wrong' } });
  ok('맞은 수를 셈', g.correct === 1);
  ok('안 푼 문제는 오답', g.wrong.length === 2);
  ok('오답 단어를 모음', g.wrongIds.join() === 'w2,w3');
  ok('점수는 백분율', g.score === 33, g.score);
  ok('거의 맞음은 정답이 아님', gradeQuiz(qs, { q1: { verdict: 'close' } }).correct === 0);
  ok('빈 시험도 안전', gradeQuiz([], {}).score === 0);
  ok('만점', gradeQuiz(qs, { q1: { verdict: 'correct' }, q2: { verdict: 'correct' }, q3: { verdict: 'correct' } }).score === 100);

  ok('90점 이상 완벽', gradeLabel(90).tone === 'great');
  ok('70점 잘함', gradeLabel(70).tone === 'good');
  ok('50점 조금만 더', gradeLabel(50).tone === 'okay');
  ok('0점 다시', gradeLabel(0).tone === 'weak');
}

/* ── 시험이 회독을 건드리지 않는지 ── */
group('시험 · 회독과 분리');
{
  const before = { w1: { ...emptyState(), box: BOX.KNOWN, streak: 2, lastSeen: '2026-01-01' } };
  const snapshot = JSON.stringify(before);
  const qs = buildQuiz(ALL_WORDS.slice(0, 5), { count: 5, review: before });
  gradeQuiz(qs, {});
  scopeWords(ALL_WORDS.slice(0, 5), before, QUIZ_SCOPE.WEAK);
  ok('출제·채점이 회독 기록을 바꾸지 않음', JSON.stringify(before) === snapshot);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
