/* 약점 퀴즈 — 오늘 몫을 세는 규칙 */
import { WEAK_QUIZ_SIZE, weakQuizOf, noteWeakQuiz, weakQuizState, mergeWeakQuiz } from '../../src/lib/weakquiz.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => { if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };
const T = '2026-11-02'; const Y = '2026-11-01';

console.log('\n[ 오늘 푼 낱말 ]');
{
  ok('몫은 서른', WEAK_QUIZ_SIZE === 30);
  ok('기록이 없으면 빈 것', weakQuizOf(undefined, T).ids.length === 0 && weakQuizOf({}, T).ids.length === 0);
  ok('어제 것은 오늘 0', weakQuizOf({ weakQuiz: { day: Y, ids: ['a', 'b'] } }, T).ids.length === 0);
  const one = noteWeakQuiz(undefined, ['a'], T);
  ok('적으면 오늘 날짜로 남는다', one.day === T && one.ids.join() === 'a');
  const dup = noteWeakQuiz(one, ['a'], T);
  ok('★ 같은 낱말은 한 번만 센다 ★', dup === one && dup.ids.length === 1);
  ok('다른 낱말은 더해진다', noteWeakQuiz(one, ['b', 'c'], T).ids.join() === 'a,b,c');
  ok('날이 바뀌면 새로 시작', noteWeakQuiz({ day: Y, ids: ['a', 'b'] }, ['c'], T).ids.join() === 'c');
  ok('엉뚱한 값은 무시', noteWeakQuiz(one, [null, 3, ''], T) === one);
}

console.log('\n[ 오늘 몫 ]');
{
  const N = WEAK_QUIZ_SIZE;
  const mk = (n, from = 1) => Array.from({ length: n }, (_, i) => `w${from + i}`);
  const weak = mk(N + 2);
  const fresh = weakQuizState({}, weak, T);
  ok('약점이 많으면 서른 문제', fresh.total === N && fresh.done === 0 && fresh.ids.length === N && !fresh.complete, `${fresh.total}/${fresh.ids.length}`);
  ok('약한 순서대로 앞에서 고른다', fresh.ids.join() === mk(N).join());
  const few = weakQuizState({}, ['w1', 'w2'], T);
  ok('★ 약점이 모자라면 그만큼만 ★', few.total === 2 && few.ids.length === 2);
  ok('약점이 없으면 몫이 0이고 완료도 아니다', weakQuizState({}, [], T).total === 0 && !weakQuizState({}, [], T).complete);

  const half = weakQuizState({ weakQuiz: { day: T, ids: ['w1', 'w2'] } }, mk(N + 4, 3), T);
  ok('★ 두 개 풀고 나가면 남은 스물여덟을 이어서 ★', half.done === 2 && half.total === N && half.ids.length === N - 2 && !half.complete, `${half.done}/${half.total}/${half.ids.length}`);
  ok('푼 낱말은 다음 묶음에 안 나온다', !half.ids.includes('w1') && !half.ids.includes('w2'));

  const done = weakQuizState({ weakQuiz: { day: T, ids: mk(N) } }, [`w${N + 1}`, `w${N + 2}`], T);
  ok('★ 서른을 풀었으면 완료 ★', done.done === N && done.complete);
  ok('완료 뒤에 또 누르면 다음 약점을 더 푼다(몫은 그대로 완료)', done.ids.join() === `w${N + 1},w${N + 2}`);

  /* 맞혀서 약점에서 빠져도 푼 수는 안 줄어든다 */
  const cleared = weakQuizState({ weakQuiz: { day: T, ids: ['w1', 'w2', 'w3'] } }, ['w4'], T);
  ok('★ 푼 것이 약점에서 빠져도 푼 수는 그대로 ★', cleared.done === 3 && cleared.total === 4 && cleared.ids.join() === 'w4', JSON.stringify(cleared));
  const allDoneSmall = weakQuizState({ weakQuiz: { day: T, ids: ['w1', 'w2'] } }, [], T);
  ok('약점이 다 사라져도 푼 만큼은 완료', allDoneSmall.done === 2 && allDoneSmall.total === 2 && allDoneSmall.complete);
}

console.log('\n[ 기기 합치기 ]');
{
  const a = { day: T, ids: ['a', 'b'] }; const b = { day: T, ids: ['b', 'c'] };
  ok('같은 날이면 푼 것을 합친다', mergeWeakQuiz(a, b).ids.join() === 'a,b,c');
  ok('날이 다르면 나중 날', mergeWeakQuiz({ day: Y, ids: ['x'] }, a).day === T && mergeWeakQuiz(a, { day: Y, ids: ['x'] }).day === T);
  ok('한쪽이 없으면 다른 쪽', mergeWeakQuiz(undefined, a) === a && mergeWeakQuiz(a, undefined) === a);
}

console.log('\n[ 마친 약점 퀴즈는 뒤에서 약점이 늘어도 마친 것이다 ]');
{
  /* 약한 낱말이 열둘뿐이라 12 / 12로 마쳤다. 그 뒤 쭉 퀴즈에서 틀린 여섯 낱말이 약점으로 들어왔다 */
  const done12 = { weakQuiz: { day: T, ids: Array.from({ length: 12 }, (_, i) => `d${i}`) } };
  const later = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
  const open = weakQuizState(done12, later, T);
  ok('(전) 몫이 18로 늘어 12 / 18 — 덜 끝난 것으로 돌아갔다', open.total === 18 && open.done === 12 && open.complete === false);
  const sealed = weakQuizState(done12, later, T, undefined, 12);
  ok('★ 마친 몫(12)을 적어 두면 12 / 12 마쳤어요 그대로다 ★', sealed.complete === true && sealed.done === 12 && sealed.total === 12, JSON.stringify(sealed));
  ok('또 누르면 새로 들어온 약점을 풀 수 있다', sealed.ids.join() === later.join());
  ok('몫을 아직 못 채웠으면 적어 둔 값이 있어도 덜 끝난 것', weakQuizState({ weakQuiz: { day: T, ids: ['d0'] } }, later, T, undefined, 12).complete === false);
  ok('적어 둔 값이 없으면 예전과 같다', JSON.stringify(weakQuizState(done12, later, T, undefined, 0)) === JSON.stringify(open));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
