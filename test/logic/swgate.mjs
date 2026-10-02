/* 새 버전으로 언제 갈아끼우나.
 *
 * ★ 이 검사가 있는 이유 ★
 *
 * 「처음 들어가면 한 번 홈으로 튕긴다」를 세 번째로 고친 자리다.
 *
 *   1차  저장된 회독 세션만 봤다 — 듣기·시험·N3 코스는 저장소에 안 남아서
 *        「끊길 게 없다」로 읽혔고, 듣던 판이 통째로 사라졌다
 *   2차  화면들이 스스로 알리게 했다(lib/busy.js) — 그래도 남았다
 *   3차  기준이 틀렸다. 「학습 중인가」가 아니었다
 *
 * 갈아끼우기는 곧 새로고침이고, 이 앱은 주소가 없다 — 어느 화면에 있었든
 * 새로고침하면 홈이다. 그러니 판정을 안 하는 자리에서도 새로고침은 그대로
 * 튕김이다. 배포를 올린 다음 앱을 열면 몇 초 뒤에 갱신이 잡히는데, 그 사이
 * 탭 하나를 눌렀으면 그 자리가 사라진다. 한 배포에 한 번씩 꼭 일어난다.
 *
 * 그래서 묻는 것이 바뀌었다 — 「지금 이 새로고침이 보이는가」.
 * 여기서 지키는 것은 둘이다.
 *   · 보고 있는 자리를 뺏지 않는다
 *   · 그렇다고 영영 안 바뀌지도 않는다 (안 보일 때·홈에 있을 때는 바꾼다) */
import { WHY, shouldApplyUpdate, updateGate, waitingLabel } from '../../src/lib/swgate.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 기본은 「앱을 열어 홈을 보고 있고, 받아 둔 새 버전이 있다」 */
const base = { pending: true, busy: false, hasSession: false, visible: true };
const at = (p) => updateGate({ ...base, ...p });

console.log('\n[ 받아 둔 게 없으면 할 일이 없다 ]');
{
  ok('안 받았으면 아무것도 안 한다', at({ pending: false }) === WHY.NONE);
  ok('안 받았으면 숨어 있어도 그대로', at({ pending: false, visible: false }) === WHY.NONE);
  ok('빈손으로 물어도 안 죽는다', updateGate() === WHY.NONE);
  ok('알릴 말도 없다', waitingLabel(WHY.NONE) === null);
}

console.log('\n[ ★ 보고 있는 화면은 안 뺏는다 ★ ]');
{
  /* 여기가 「처음 들어가면 한 번 튕긴다」의 자리다. 학습 탭을 눌러 둔 사람은
     판정을 하고 있지 않지만, 새로고침하면 그 탭이 사라지고 홈이 뜬다. */
  ok('★ 홈이 아닌 자리를 보고 있으면 미룬다 ★', at({ busy: true }) === WHY.LOOKING);
  ok('미뤘다고 알려 준다', waitingLabel(WHY.LOOKING).includes('내려놨다 열면'),
    waitingLabel(WHY.LOOKING));
  ok('하던 판이 있으면 미룬다', at({ hasSession: true }) === WHY.STUDYING);
  ok('그때는 다른 말을 한다', waitingLabel(WHY.STUDYING).includes('학습을 마치면'),
    waitingLabel(WHY.STUDYING));

  /* 둘이 겹치면 하던 판 쪽을 말한다 — 「학습을 마치면」이 더 가까운 안내다 */
  ok('둘 다면 하던 판 쪽', at({ busy: true, hasSession: true }) === WHY.STUDYING);
}

console.log('\n[ ★ 그래도 언젠가는 바뀐다 ★ ]');
{
  /* 미루기만 하는 규칙이면 영영 옛 화면을 본다. 고친 게 안 보이는 것도
     튕기는 것 못지않게 나쁘다 — 바꿀 수 있는 틈을 둘 남긴다. */
  ok('★ 안 보고 있을 때 바꾼다 ★', at({ visible: false }) === WHY.OK);
  ok('보던 자리가 있어도 내려놓으면 바꾼다 — 돌아오면 새 버전이다',
    at({ visible: false, busy: true }) === WHY.OK);
  ok('★ 홈에 그대로 있으면 바꾼다 ★ — 새로고침해도 다시 홈이라 티가 안 난다',
    at({}) === WHY.OK);
}

console.log('\n[ 하던 판은 숨어 있어도 안 건드린다 ]');
{
  /* 회독 세션은 저장소에 남아서 이어하기로 돌아갈 수 있다. 그래도 안 바꾼다 —
     이어하기 줄을 거쳐야 돌아가는 것과 그 자리에 그대로 있는 것은 다르다.
     그리고 숨어 있는 동안 바꿔 봐야 돌아왔을 때 하던 자리는 이미 없다. */
  ok('숨어 있어도 하던 판이 있으면 안 바꾼다',
    at({ visible: false, hasSession: true }) === WHY.STUDYING);
}

console.log('\n[ shouldApplyUpdate — 한 글자로 ]');
{
  ok('홈에서 켜져 있으면 바꾼다', shouldApplyUpdate(base) === true);
  ok('보던 자리가 있으면 안 바꾼다', shouldApplyUpdate({ ...base, busy: true }) === false);
  ok('안 받았으면 안 바꾼다', shouldApplyUpdate({ ...base, pending: false }) === false);
  ok('숨어 있으면 바꾼다', shouldApplyUpdate({ ...base, visible: false, busy: true }) === true);
  ok('하던 판이 있으면 안 바꾼다', shouldApplyUpdate({ ...base, hasSession: true }) === false);
}

console.log('\n[ 모든 경우 — 여덟 가지 ]');
{
  /* 받아 둔 게 있다고 치고 세 칸을 전부 돌려 본다. 표로 적어 두면 나중에
     규칙을 손댈 때 무엇이 바뀌는지가 한눈에 보인다. */
  const rows = [];
  for (const busy of [false, true]) {
    for (const hasSession of [false, true]) {
      for (const visible of [false, true]) {
        const why = updateGate({ pending: true, busy, hasSession, visible });
        rows.push(`${visible ? '보임' : '숨음'}/${busy ? '보던자리' : '홈'}/${hasSession ? '판있음' : '판없음'} → ${why}`);
      }
    }
  }
  console.log('   ' + rows.join('\n   '));
  const okCount = rows.filter((r) => r.endsWith('ok')).length;
  /* 바꾸는 경우는 셋이다 — 판이 없을 때의 (숨음/홈), (보임/홈), (숨음/보던자리).
     나머지 다섯은 판이 있거나(넷) 보이는 자리를 보고 있다(하나). */
  ok('여덟 가지 중 셋에서 바꾼다', okCount === 3, `${okCount}가지`);
  ok('판이 있으면 어느 경우에도 안 바꾼다',
    rows.filter((r) => r.includes('판있음')).every((r) => r.endsWith('studying')));
  ok('보이는데 보던 자리가 있으면 안 바꾼다',
    rows.filter((r) => r.startsWith('보임/보던자리')).every((r) => !r.endsWith('ok')));
  ok('숨어 있고 판이 없으면 늘 바꾼다',
    rows.filter((r) => r.startsWith('숨음') && r.includes('판없음')).every((r) => r.endsWith('ok')));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
