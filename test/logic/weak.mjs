/* 약점 장부 — 「어느 게 약한지, 금방 잊어버리는지」.
 *
 * ★ 이 검사가 있는 이유 ★
 *
 * 약점은 회독 기록(몰라요·애매해요)만 보고 셌다. 그런데 시험과 듣기는 회독에
 * 아무것도 안 쓴다 — 시험 때문에 복습 간격이 흔들리지 않게 하려고 일부러 그렇게
 * 뒀다. 그 대가로 시험에서 열 번 틀린 낱말이 「약점 0」이었고, 쉰 번 들어도
 * 아무 데도 안 남았다.
 *
 * 그리고 잊어버리는 속도를 아예 안 셌다. 틀린 횟수가 같아도 어제 외운 게 오늘
 * 무너진 낱말과 한 달 전에 외운 게 오늘 무너진 낱말은 다른 낱말이다 — 앞엣것이
 * 시험장에서 터진다.
 *
 * 그래서 여기서 지키는 것은 넷이다.
 *   · 복습 간격을 안 건드린다 (회독 저장소와 갈라져 있다)
 *   · 예전 약점은 전부 그대로 약점이다 (더하기만 한다)
 *   · 잊어버림은 「외웠던 것이 무너진 것」만 센다 (새 낱말의 몰라요가 아니다)
 *   · 기기를 합쳐도 숫자가 불어나지 않는다 */
import {
  STUCK_PER_SIGNAL, WEAK_KIND, emptyWeak, errorSignals, forgetSpeed, isWeakNow, mergeWeak,
  noteWeak, relapseNotes, relapseOf, weakEntry, weakRank, weakReasons, weakScore, weakSummary,
} from '../../src/lib/weak.js';
import { STUCK_FROM_LAP, countsAsStuck } from '../../src/lib/listen.js';
import {
  VERDICT, WEAK_THRESHOLD, applyVerdict, emptyState, isWeak, stateOf,
} from '../../src/lib/review.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 상태 만들기 — 날짜를 두고 확인된 낱말을 만든다.
   하루에 한 칸만, 그것도 복습일에만 오르니 날을 띄워서 맞혀야 한다. */
function learned(days = ['2026-01-01', '2026-01-02', '2026-01-05']) {
  let st = emptyState();
  for (const d of days) st = applyVerdict(st, VERDICT.KNOWN, d);
  return st;
}

console.log('\n[ 빈 장부 ]');
{
  const e = emptyWeak();
  ok('아무것도 안 세어져 있다', e.quizWrong === 0 && e.listen === 0 && e.forgot === 0);
  ok('잊어버린 간격은 없음(null)이다 — 0일이 아니다', e.fastDays === null);

  ok('없는 낱말을 물어도 빈 줄이 온다', weakEntry({}, 'w1').quizWrong === 0);
  ok('장부가 아예 없어도 터지지 않는다', weakEntry(undefined, 'w1').listen === 0);
  ok('쓰레기가 들어 있어도 빈 줄로 읽는다', weakEntry({ w1: 7 }, 'w1').quizWrong === 0);
  ok('음수는 0으로 읽는다', weakEntry({ w1: { quizWrong: -3 } }, 'w1').quizWrong === 0);
}

console.log('\n[ 적기 ]');
{
  let L = {};
  L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.QUIZ_WRONG }]);
  ok('시험 오답이 한 번 적힌다', weakEntry(L, 'w1').quizWrong === 1);

  L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.QUIZ_WRONG }]);
  ok('두 번 틀리면 2가 된다', weakEntry(L, 'w1').quizWrong === 2);

  L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.QUIZ_RIGHT }]);
  ok('맞힌 것은 다른 칸에 쌓인다', weakEntry(L, 'w1').quizRight === 1);
  ok('틀린 칸은 안 줄어든다 — 틀린 적이 있었다는 사실은 남는다', weakEntry(L, 'w1').quizWrong === 2);

  L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.LISTEN }, { id: 'w2', kind: WEAK_KIND.LISTEN }]);
  ok('한 번에 여러 줄을 적는다', weakEntry(L, 'w1').listen === 1 && weakEntry(L, 'w2').listen === 1);

  /* ★ 아무것도 안 바뀌면 받은 장부를 그대로 돌려준다 ★
     새 객체를 주면 화면이 다시 그려지고 저장이 한 번 돈다. 모르는 종류가
     들어왔을 때 조용히 그렇게 되는 게 제일 찾기 어려운 쪽이다. */
  ok('빈 목록은 그대로 돌려준다', noteWeak(L, []) === L);
  ok('모르는 종류는 아무것도 안 바꾼다', noteWeak(L, [{ id: 'w1', kind: '헛것' }]) === L);
  ok('id가 없는 줄은 건너뛴다', noteWeak(L, [{ kind: WEAK_KIND.LISTEN }]) === L);

  const before = weakEntry(L, 'w1').quizWrong;
  noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.QUIZ_WRONG }]);
  ok('받은 장부를 고치지 않는다 — 새 객체를 돌려준다', weakEntry(L, 'w1').quizWrong === before);
}

console.log('\n[ 잊어버림 — 외웠던 것이 무너진 것만 ]');
{
  /* 처음 보는 낱말의 「몰라요」는 아직 안 배운 것이다. 그걸 잊어버림으로 세면
     새 낱말을 배울 때마다 장부가 부풀고, 정작 무너진 낱말이 그 사이에 묻힌다. */
  ok('처음 보는 낱말의 몰라요는 잊어버림이 아니다',
    relapseOf(emptyState(), VERDICT.UNKNOWN, '2026-02-01') === null);

  const once = applyVerdict(emptyState(), VERDICT.KNOWN, '2026-01-01');
  ok('한 번 맞힌 것(기억 단계 1)이 무너지면 잊어버림이다',
    relapseOf(once, VERDICT.UNKNOWN, '2026-01-08') !== null, `level=${once.level}`);

  const st = learned();
  const r = relapseOf(st, VERDICT.UNKNOWN, '2026-01-15');
  ok('며칠 만에 무너졌는지를 센다', r?.days === 10, `promotedOn=${st.promotedOn} → ${r?.days}일`);

  ok('애매해요도 잊어버림으로 센다 — 외운 낱말이 긴가민가해진 건 시험장에서 틀리는 쪽이다',
    relapseOf(st, VERDICT.VAGUE, '2026-01-15') !== null);
  ok('알아요는 잊어버림이 아니다', relapseOf(st, VERDICT.KNOWN, '2026-01-15') === null);
  ok('이미 알아요도 아니다', relapseOf(st, VERDICT.MASTER, '2026-01-15') === null);

  /* ★ 간격은 마지막으로 올라간 날부터 센다 ★
     lastSeen을 쓰면 복습일 전에 미리 연습한 날이 끼어들어 0일로 찍힌다 —
     미리 연습한 것으로는 기억 단계가 안 오르니, 확인받은 날이 기준이어야 한다. */
  const early = applyVerdict(st, VERDICT.KNOWN, '2026-01-10');   // 복습일 전 — 안 오른다
  ok('미리 연습한 날은 기준이 안 된다', early.promotedOn === st.promotedOn,
    `promotedOn 그대로 ${early.promotedOn}`);
  ok('그래서 간격이 0일로 안 찍힌다', relapseOf(early, VERDICT.UNKNOWN, '2026-01-15')?.days === 10);

  ok('없는 상태를 줘도 터지지 않는다', relapseOf(null, VERDICT.UNKNOWN, '2026-01-01') === null);
}

console.log('\n[ 판정 꾸러미에서 골라내기 ]');
{
  const review = { w1: learned(), w2: emptyState() };
  const notes = relapseNotes(review, { w1: VERDICT.UNKNOWN, w2: VERDICT.UNKNOWN }, '2026-01-15');
  ok('외웠던 낱말만 골라진다', notes.length === 1 && notes[0].id === 'w1',
    notes.map((n) => n.id).join());
  ok('종류는 잊어버림이다', notes[0].kind === WEAK_KIND.FORGOT);
  ok('간격이 실려 있다', notes[0].days === 10);
  ok('맞힌 판정만 들어오면 빈손이다',
    relapseNotes(review, { w1: VERDICT.KNOWN }, '2026-01-15').length === 0);
  ok('빈 꾸러미도 괜찮다', relapseNotes(review, {}, '2026-01-15').length === 0);
  ok('장부 없이도 괜찮다', relapseNotes(undefined, { w1: VERDICT.UNKNOWN }, '2026-01-15').length === 0);
}

console.log('\n[ 간격은 제일 짧은 것을 남긴다 ]');
{
  /* 평균을 내면 한 번 금방 잊은 사실이 오래 버틴 횟수에 묻힌다 —
     제일 빨리 무너진 때가 그 낱말의 실력이다. */
  let L = noteWeak({}, [{ id: 'w1', kind: WEAK_KIND.FORGOT, days: 30 }]);
  ok('처음 것이 들어간다', weakEntry(L, 'w1').fastDays === 30);
  L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.FORGOT, days: 2 }]);
  ok('더 짧은 것이 이긴다', weakEntry(L, 'w1').fastDays === 2);
  L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.FORGOT, days: 60 }]);
  ok('더 긴 것은 안 덮는다', weakEntry(L, 'w1').fastDays === 2);
  ok('횟수는 그동안 쌓였다', weakEntry(L, 'w1').forgot === 3);

  const noDays = noteWeak({}, [{ id: 'w2', kind: WEAK_KIND.FORGOT }]);
  ok('간격을 안 주면 횟수만 센다', weakEntry(noDays, 'w2').forgot === 1 && weakEntry(noDays, 'w2').fastDays === null);
}

console.log('\n[ 잊어버리는 속도 — 사람 말로 ]');
{
  const say = (forgot, fastDays) => forgetSpeed({ ...emptyWeak(), forgot, fastDays });
  ok('무너진 적이 없으면 아무 말도 안 한다', say(0, null) === null);
  ok('횟수는 있는데 간격을 모르면 말하지 않는다 — 「안 잊는다」가 아니다', say(2, null) === null);
  ok('하루', say(1, 1) === '하루 만에 잊어요', say(1, 1));
  ok('사흘', say(1, 3) === '사흘 안에 잊어요', say(1, 3));
  ok('한 주', say(1, 7) === '한 주 안에 잊어요', say(1, 7));
  ok('한 달', say(1, 30) === '한 달 안에 잊어요', say(1, 30));
  ok('그보다 오래', say(1, 120) === '오래 뒤에 잊어요', say(1, 120));
}

console.log('\n[ 약점 판정 — 예전 것은 전부 그대로 약점이다 ]');
{
  /* ★ 더하기만 한다 ★
     회독 쪽 기준(isWeak)에 걸리던 것이 여기서 빠지면 같은 이름이 두 숫자를
     갖게 된다 — 이 앱에서 한 번 겪은 일이다(약점이 화면마다 14·6·25·53·56). */
  const wrong3 = { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 3 };
  ok('회독에서 세 번 틀린 것은 예전에도 약점이었다', isWeak(wrong3) === true);
  ok('지금도 약점이다', isWeakNow(wrong3, emptyWeak()) === true);

  const wrong2 = { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 2 };
  ok('두 번은 아직 약점이 아니다', isWeakNow(wrong2, emptyWeak()) === false);

  /* ★ 시험에서 틀린 것이 모자란 한 칸을 채운다 ★
     여태 이게 안 됐다. 회독에서 두 번 + 시험에서 다섯 번 틀린 낱말이
     「약점 아님」이었다. */
  const quizToo = weakEntry({ w: { quizWrong: 1 } }, 'w');
  ok('회독 두 번 + 시험 한 번이면 약점이다', isWeakNow(wrong2, quizToo) === true);

  const onlyQuiz = { ...emptyState(), lastSeen: '2026-01-01' };
  ok('시험에서만 세 번 틀려도 약점이다',
    isWeakNow(onlyQuiz, weakEntry({ w: { quizWrong: 3 } }, 'w')) === true);

  /* 잊어버림은 한 번으로도 세다. 외운 줄 알았던 게 무너진 것이라
     틀린 횟수 한 번과 같은 무게로 셀 수가 없다. */
  ok('금방 잊어버린 것은 한 번으로도 약점이다',
    isWeakNow(onlyQuiz, weakEntry({ w: { forgot: 1, fastDays: 1 } }, 'w')) === true);

  /* ★ 듣기만으로는 약점이 아니다 ★
     많이 들은 것은 약점의 「정도」지 「여부」가 아니다. 안 그러면 쉰 번 들은
     멀쩡한 낱말이 약점 목록에 올라온다. */
  ok('쉰 번 들었어도 틀린 적이 없으면 약점이 아니다',
    isWeakNow(onlyQuiz, weakEntry({ w: { listen: 50 } }, 'w')) === false);

  /* 졸업한 카드에 「취약」이 붙으면 졸업이라는 말이 취소된다 */
  const done = learned(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-12']);
  ok('졸업한 카드는 약점이 아니다', isWeakNow(done, weakEntry({ w: { quizWrong: 9 } }, 'w')) === false,
    `level=${done.level}`);

  ok('없는 상태는 약점이 아니다', isWeakNow(null, emptyWeak()) === false);
  ok('문턱은 회독 쪽 상수를 쓴다', WEAK_THRESHOLD === 3);
}

console.log('\n[ 장부를 안 주면 예전과 똑같다 ]');
{
  /* 오늘 학습의 약점 갈래(daily.js)와 시험 범위가 이 함수로 갈아탔다.
     장부를 안 넘기는 자리가 아직 있어서, 그때 값이 예전과 같아야 한다. */
  const st = { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 2, vagueCount: 1 };
  ok('errorSignals는 몰라요+애매해요다', errorSignals(st, null) === 3);
  ok('빈 줄을 줘도 같다', errorSignals(st, emptyWeak()) === 3);
  ok('그래서 약점 판정도 같다', isWeakNow(st, null) === isWeak(st));
}

console.log('\n[ ★ 듣다가 안 뗀 것도 쌓인다 ★ ]');
{
  /* 여태 듣기만 해서는 약점이 0이었다. 들은 횟수는 「얼마나 만났나」지
     「되나 안 되나」가 아니라서 신호로 안 셌다 — 쉰 번 들은 멀쩡한 낱말까지
     약점이 되면 안 되니까. 그래서 달리면서 한 시간을 들어도 아무것도 안
     남았다.
     세 바퀴째에도 「다 외웠어요」에 손이 안 간 낱말은 다르다. 그건 사람이
     직접 낸 신호다. */
  ok('첫 바퀴는 안 센다 — 처음 만난 것이다', countsAsStuck(0) === false);
  ok('둘째 바퀴도 넘긴다 — 한 번 더 들어 보는 중일 수 있다', countsAsStuck(1) === false);
  ok('★ 셋째 바퀴부터 센다 ★', countsAsStuck(2) === true, `바퀴 ${STUCK_FROM_LAP}부터`);
  ok('그 뒤로는 계속 센다', countsAsStuck(9) === true);
  ok('빈손이 와도 안 죽는다', countsAsStuck() === false && countsAsStuck(null) === false);

  let L = {};
  for (let i = 0; i < 4; i++) L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.STUCK }]);
  ok('바퀴가 쌓인다', weakEntry(L, 'w1').stuck === 4, `${weakEntry(L, 'w1').stuck}바퀴`);

  /* ★ 한 바퀴를 한 신호로 세면 안 된다 ★
     스무 개짜리 구간을 열 바퀴 돌면 안 뗀 낱말이 전부 약점이 되고, 그러면
     약점 목록이 그냥 「안 뗀 것 목록」이라 무엇부터 볼지를 다시 못 정한다. */
  const base = { ...emptyState(), lastSeen: '2026-01-01' };
  const after = (n) => {
    let m = {};
    for (let i = 0; i < n; i++) m = noteWeak(m, [{ id: 'w', kind: WEAK_KIND.STUCK }]);
    return weakEntry(m, 'w');
  };
  ok(`${STUCK_PER_SIGNAL}바퀴에 신호 하나`, errorSignals(base, after(STUCK_PER_SIGNAL)) === 1);
  ok('세 바퀴로는 아직 약점이 아니다', isWeakNow(base, after(3)) === false);
  ok('여덟 바퀴도 아직', isWeakNow(base, after(8)) === false, `신호 ${errorSignals(base, after(8))}`);
  ok('★ 아홉 바퀴를 못 떼면 약점 ★', isWeakNow(base, after(9)) === true,
    `신호 ${errorSignals(base, after(9))}`);

  ok('점수도 바퀴만큼 오른다', weakScore(base, after(4)) > weakScore(base, after(1)));
  ok('바퀴 수로만 줄 세워지지 않게 열 점에서 멈춘다',
    weakScore(base, after(50)) === weakScore(base, after(10)), `${weakScore(base, after(50))}점`);

  ok('왜 약한지에 적힌다', weakReasons(base, after(5)).some((t) => t === '안 뗀 채로 5바퀴'),
    weakReasons(base, after(5)).join(' · '));
}

console.log('\n[ 「다 외웠어요」를 누르면 바퀴 수가 0으로 ]');
{
  /* 그 수의 뜻이 「아직 안 뗀 채로」라서, 뗀 순간 더는 참이 아니다.
     안 되돌리면 방금 외운 낱말이 약점 목록 맨 위에 그대로 남는다. */
  let L = {};
  for (let i = 0; i < 9; i++) L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.STUCK }]);
  const base = { ...emptyState(), lastSeen: '2026-01-01' };
  ok('떼기 전에는 약점', isWeakNow(base, weakEntry(L, 'w1')) === true);

  L = noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.CLEARED }]);
  ok('★ 바퀴 수가 0이 된다 ★', weakEntry(L, 'w1').stuck === 0);
  ok('그래서 약점에서 빠진다', isWeakNow(base, weakEntry(L, 'w1')) === false);
  ok('들은 횟수는 그대로다 — 들은 건 들은 것이다',
    weakEntry(noteWeak(L, [{ id: 'w1', kind: WEAK_KIND.LISTEN }]), 'w1').listen === 1);

  /* 틀린 적이 있던 낱말은 떼었다고 약점에서 안 빠진다 — 그건 다른 신호다 */
  const wrong = { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 3 };
  ok('회독에서 틀린 적이 있으면 떼어도 약점', isWeakNow(wrong, weakEntry(L, 'w1')) === true);

  ok('되돌릴 게 없으면 장부를 안 건드린다',
    noteWeak(L, [{ id: '새낱말', kind: WEAK_KIND.CLEARED }]) === L);
}

console.log('\n[ 점수 — 제일 약한 것부터 ]');
{
  const base = { ...emptyState(), lastSeen: '2026-01-01' };
  const rec = (p) => weakEntry({ w: p }, 'w');

  ok('아무 일도 없으면 0점', weakScore(base, emptyWeak()) === 0);
  ok('회독 몰라요가 애매해요보다 무겁다',
    weakScore({ ...base, wrongCount: 1 }, emptyWeak()) > weakScore({ ...base, vagueCount: 1 }, emptyWeak()));
  ok('시험 오답은 회독 몰라요와 같은 무게다 — 둘 다 떠올리지 못한 것이다',
    weakScore(base, rec({ quizWrong: 1 })) === weakScore({ ...base, wrongCount: 1 }, emptyWeak()));
  ok('잊어버림이 한 번 틀린 것보다 무겁다',
    weakScore(base, rec({ forgot: 1 })) > weakScore({ ...base, wrongCount: 1 }, emptyWeak()));
  ok('금방 잊어버린 쪽이 더 무겁다',
    weakScore(base, rec({ forgot: 1, fastDays: 1 })) > weakScore(base, rec({ forgot: 1, fastDays: 60 })));

  ok('많이 들은 것은 조금 올라간다 — 귀로는 익었는데 떠올리지 못하는 쪽이다',
    weakScore(base, rec({ quizWrong: 1, listen: 25 })) > weakScore(base, rec({ quizWrong: 1 })));
  ok('그래도 듣기만으로 많이 안 오른다 (최대 3)',
    weakScore(base, rec({ listen: 500 })) === 3);

  ok('맞히기 시작하면 내려간다',
    weakScore(base, rec({ quizWrong: 2, quizRight: 3 })) < weakScore(base, rec({ quizWrong: 2 })));
  ok('0 밑으로는 안 간다 — 음수 점수로 목록이 뒤집히면 안 된다',
    weakScore(base, rec({ quizRight: 99 })) === 0);
}

console.log('\n[ 왜 약점인지 ]');
{
  const st = { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 2, vagueCount: 1 };
  const why = weakReasons(st, weakEntry({ w: { quizWrong: 3, listen: 12, forgot: 1, fastDays: 2 } }, 'w'));
  ok('잊어버림이 제일 앞이다', why[0].includes('외웠다가'), why.join(' · '));
  ok('회독 몰라요가 적힌다', why.some((t) => t === '회독 몰라요 2번'), why.join(' · '));
  ok('시험 오답이 적힌다', why.some((t) => t === '시험 오답 3번'));
  ok('애매해요가 적힌다', why.some((t) => t === '애매해요 1번'));
  ok('들은 횟수가 적힌다', why.some((t) => t === '12번 들었어요'));

  ok('아무 일도 없으면 아무 말도 안 한다',
    weakReasons({ ...emptyState() }, emptyWeak()).length === 0);
}

console.log('\n[ 목록 ]');
{
  const review = {
    a: { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 3 },      // 약점 — 9점
    b: { ...emptyState(), lastSeen: '2026-01-01' },                      // 시험에서만 틀림
    c: { ...emptyState(), lastSeen: '2026-01-01' },                      // 멀쩡
  };
  const ledger = {
    b: { quizWrong: 1, forgot: 2, fastDays: 1, at: 100 },
    c: { listen: 40, at: 50 },
  };
  const ids = ['a', 'b', 'c'];

  const rank = weakRank(ids, review, ledger);
  ok('멀쩡한 것은 안 들어온다', rank.length === 2, rank.map((r) => r.id).join());
  ok('제일 약한 것이 앞이다 — 외웠다가 두 번 무너진 b',
    rank[0].id === 'b', rank.map((r) => `${r.id}:${r.score}`).join(' '));
  ok('점수가 실려 온다', rank[0].score > rank[1].score);

  const sum = weakSummary(ids, review, ledger);
  ok('약점 수를 센다', sum.total === 2);
  ok('시험 오답을 모아 센다', sum.quizWrong === 1);
  ok('잊어버린 횟수를 모아 센다', sum.forgot === 2);
  ok('금방 잊는 낱말 수를 센다', sum.fast === 1);
  ok('맨 위 다섯 개를 들고 온다', sum.top.length === 2 && sum.top[0].id === 'b');
  ok('약점이 아닌 것의 듣기 횟수는 안 센다 — 그건 공부한 양이지 약점이 아니다',
    sum.listen === 0, `listen=${sum.listen}`);

  /* 점수가 같으면 최근에 틀린 것이 먼저다 — 오늘 틀린 것이 반년 전보다 급하다 */
  const tie = weakRank(['x', 'y'], {
    x: { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 3 },
    y: { ...emptyState(), lastSeen: '2026-01-01', wrongCount: 3 },
  }, { x: { at: 1 }, y: { at: 999 } });
  ok('같은 점수면 최근 것이 먼저', tie[0].id === 'y', tie.map((r) => r.id).join());

  ok('빈 목록도 괜찮다', weakRank([], {}, {}).length === 0);
  ok('장부가 없어도 회독 기록만으로 돈다', weakRank(ids, review, undefined).length === 1);
}

console.log('\n[ 복습 간격은 안 건드린다 ]');
{
  /* ★ 이게 이 장부의 존재 이유다 ★
     시험 성적을 회독 저장소에 넣으면 다음에 누군가 그 값으로 복습 간격을
     계산한다. 안 하기로 정한 일이 저절로 일어나는 자리를 만들지 않는다. */
  const review = { w1: learned() };
  const before = JSON.stringify(review);
  const L = noteWeak({}, [
    { id: 'w1', kind: WEAK_KIND.QUIZ_WRONG },
    { id: 'w1', kind: WEAK_KIND.LISTEN },
    { id: 'w1', kind: WEAK_KIND.FORGOT, days: 1 },
  ]);
  ok('장부에 적어도 회독 기록은 그대로다', JSON.stringify(review) === before);
  ok('복습일도 그대로다', stateOf(review, 'w1').due === learned().due,
    stateOf(review, 'w1').due);
  ok('장부에는 쌓였다', weakEntry(L, 'w1').quizWrong === 1 && weakEntry(L, 'w1').listen === 1);
}

console.log('\n[ 기기 합치기 ]');
{
  /* 더하면 같은 기기에서 동기화를 두 번 눌러도 숫자가 두 배가 된다 —
     활용 성적(mergeConj)에서 겪은 자리라 같은 방식으로 둔다. */
  const phone = { w1: { quizWrong: 3, quizRight: 1, listen: 10, stuck: 6, forgot: 1, fastDays: 7, at: 100 } };
  const tab = { w1: { quizWrong: 2, quizRight: 5, listen: 40, stuck: 0, forgot: 2, fastDays: 2, at: 200 } };

  const m = mergeWeak(phone, tab);
  ok('횟수는 큰 쪽', weakEntry(m, 'w1').quizWrong === 3 && weakEntry(m, 'w1').listen === 40);
  ok('맞힌 것도 큰 쪽', weakEntry(m, 'w1').quizRight === 5);
  ok('잊어버린 횟수도 큰 쪽', weakEntry(m, 'w1').forgot === 2);
  /* 한쪽에서 「다 외웠어요」로 0이 됐어도 큰 쪽이 남는다 — 다른 기기에서
     아직 안 뗐으면 안 뗀 것이다. 뗀 쪽에서 한 번 더 누르면 그때 0이 된다. */
  ok('안 뗀 바퀴도 큰 쪽', weakEntry(m, 'w1').stuck === 6, `${weakEntry(m, 'w1').stuck}바퀴`);
  ok('간격만 작은 쪽 — 제일 빨리 무너진 때가 그 낱말의 실력이다', weakEntry(m, 'w1').fastDays === 2);
  ok('시각은 나중 쪽', weakEntry(m, 'w1').at === 200);

  ok('두 번 합쳐도 같다 — 더하기였으면 두 배가 된다',
    JSON.stringify(mergeWeak(m, tab)) === JSON.stringify(m));
  ok('순서를 바꿔도 같다', JSON.stringify(mergeWeak(tab, phone)) === JSON.stringify(m));

  const one = mergeWeak({ a: { listen: 1 } }, { b: { listen: 2 } });
  ok('한쪽에만 있는 낱말도 남는다', Object.keys(one).length === 2);
  ok('한쪽 간격만 있으면 그게 남는다',
    weakEntry(mergeWeak({ w: { forgot: 1, fastDays: 5 } }, { w: { forgot: 1 } }), 'w').fastDays === 5);
  ok('둘 다 없으면 없음이다',
    weakEntry(mergeWeak({ w: { forgot: 1 } }, { w: { forgot: 1 } }), 'w').fastDays === null);
  ok('빈손끼리 합쳐도 괜찮다', Object.keys(mergeWeak()).length === 0);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
