/* 새 버전으로 언제 갈아끼우나.
 *
 * ★ 이 검사가 있는 이유 ★
 *
 * 「학습 중이면 미룬다」는 규칙은 있었는데, 학습 중인지를 회독 세션
 * (localStorage)으로만 판단했다. 그 뒤로 저장소에 안 남는 자리가 늘었다 —
 * 자동 듣기로 판을 돌리는 중, 시험을 절반 푼 상태, N3 코스에서 문제를 푸는
 * 중. 그 자리들은 「끊길 게 없다」로 읽혀서, 배포가 올라온 뒤 앱을 다시
 * 앞으로 꺼내는 순간 화면이 통째로 새로 떴다.
 *
 * 쓰는 사람에게는 「자꾸 튕기고 리셋된다」로 보인다. 회독 기록은 멀쩡한데
 * 하던 자리가 사라지니 기록까지 날아간 것처럼 느껴진다.
 *
 * 화면이 스스로 알리는 구조라, 여기서 지키는 것은 그 표시가 제대로 서고
 * 내려가는지다. 내려가지 않으면 반대 문제가 생긴다 — 영영 갱신이 안 된다. */
import { busyKeys, isBusy, markBusy } from '../../src/lib/busy.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 표시 세우기 · 내리기 ]');
{
  ok('처음에는 아무것도 안 하고 있다', isBusy() === false);

  markBusy('listen', true);
  ok('듣기를 시작하면 선다', isBusy() === true, busyKeys().join());

  markBusy('listen', false);
  ok('판을 닫으면 내려간다 — 안 내려가면 영영 갱신이 안 된다', isBusy() === false);
}

console.log('\n[ 여러 자리가 겹칠 때 ]');
{
  /* 듣다가 시험으로 넘어가는 길이 있다. 한쪽이 닫혔다고 다른 쪽까지
     끊기면 안 된다 — 둘 다 내려가야 비로소 갈아끼운다. */
  markBusy('listen', true);
  markBusy('quiz', true);
  ok('둘 다 서 있다', busyKeys().length === 2, busyKeys().join());

  markBusy('listen', false);
  ok('★ 하나가 내려가도 다른 하나가 남아 있으면 미룬다 ★', isBusy() === true, busyKeys().join());

  markBusy('quiz', false);
  ok('둘 다 내려가면 끝', isBusy() === false);
}

console.log('\n[ 같은 표시를 두 번 ]');
{
  /* 화면이 다시 그려질 때마다 같은 열쇠로 다시 부른다. 그때마다 쌓이면
     한 번 내려서는 안 내려간다. */
  markBusy('n3', true);
  markBusy('n3', true);
  markBusy('n3', true);
  ok('세 번 세워도 하나', busyKeys().length === 1, busyKeys().join());
  markBusy('n3', false);
  ok('한 번 내리면 내려간다', isBusy() === false);
}

console.log('\n[ 모르는 열쇠를 내려도 안 죽는다 ]');
{
  markBusy('없는것', false);
  ok('안 세운 것을 내려도 그만', isBusy() === false);
  markBusy('listen', true);
  markBusy('없는것', false);
  ok('남아 있는 것은 그대로', isBusy() === true, busyKeys().join());
  markBusy('listen', false);
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
