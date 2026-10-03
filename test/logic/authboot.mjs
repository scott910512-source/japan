/* 로그인 확인과 로그인 문.
 *
 * ★ 이 검사가 지키는 것 ★
 *
 * 앱을 켜면 서버에 「이 기기에 로그인된 세션이 있나」를 묻고, 답이 올 때까지
 * 「학습 기록을 확인하고 있어요」를 띄운다. 그 물음에 catch가 없었다 —
 * 약속이 깨지면 확인이 끝났다는 표시가 영영 안 서고, 그 화면에 갇힌다.
 * 새로고침해도 같은 자리다. 비행기 모드로 앱을 켜 보면 바로 그 상태다.
 *
 * 깨지지 않고 그냥 안 오는 경우도 있다. 끝내 도착하지 않는 연결은 거절도
 * 안 되니 catch로도 안 잡힌다 — 그래서 기다림에 끝을 둬야 한다.
 *
 * 성공·실패·예외·시간초과 넷 다 사람이 고를 수 있는 자리까지 가야 한다.
 * 그 「고를 수 있는 자리」가 로그인 문이고, 거기에는 전에 로그인한 적
 * 있으면 오프라인으로 계속하는 길이 있다 — 서버가 죽어 있어도 기기에 있는
 * 것으로 공부할 수 있어야 한다. */
import { AUTH_READY_TIMEOUT, authGate, sessionFrom } from '../../src/lib/authboot.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 응답에서 세션 꺼내기 ]');
{
  /* ★ 여기서 던지면 그게 바로 영영 멈추는 화면이다 ★
     모양이 달라도 끝까지 간다. 세션이 없는 것과 못 읽은 것은 둘 다 null로
     같게 다룬다 — 어느 쪽이든 할 일은 로그인 문을 보여 주는 것이다. */
  ok('세션을 꺼낸다', sessionFrom({ data: { session: { user: { id: 'u1' } } } })?.user.id === 'u1');
  ok('세션이 없으면 null', sessionFrom({ data: { session: null } }) === null);
  ok('data가 없어도 안 죽는다', sessionFrom({}) === null);
  ok('빈손이어도 안 죽는다', sessionFrom() === null);
  ok('null이어도 안 죽는다', sessionFrom(null) === null);
  ok('모양이 영 다른 것이 와도 안 죽는다', sessionFrom({ error: '헛것' }) === null);
  ok('글자가 와도 안 죽는다', sessionFrom('헛것') === null);
}

console.log('\n[ 기다림에는 끝이 있다 ]');
{
  /* 더 짧으면 느린 지하철 와이파이에서 멀쩡한 로그인도 문을 보게 되고,
     더 길면 서버가 죽었을 때 사람이 「고장났다」고 판단하고 앱을 닫는다. */
  ok('★ 영원히 기다리지 않는다 ★',
    Number.isFinite(AUTH_READY_TIMEOUT) && AUTH_READY_TIMEOUT > 0, `${AUTH_READY_TIMEOUT}ms`);
  ok('너무 짧지 않다 — 토큰 갱신 왕복 한 번은 들어간다',
    AUTH_READY_TIMEOUT >= 3000, `${AUTH_READY_TIMEOUT}ms`);
  ok('너무 길지 않다 — 그 전에 앱을 닫는다',
    AUTH_READY_TIMEOUT <= 10000, `${AUTH_READY_TIMEOUT}ms`);
}

console.log('\n[ 무엇을 보여 줄까 ]');
{
  const sess = { user: { id: 'u1' } };

  ok('확인 중이면 기다리는 화면',
    authGate({ configured: true, ready: false, session: null }) === 'loading');
  ok('확인이 끝나고 세션이 없으면 로그인 문',
    authGate({ configured: true, ready: true, session: null }) === 'gate');
  ok('세션이 있으면 앱',
    authGate({ configured: true, ready: true, session: sess }) === 'app');

  /* ★ 시간초과로 끝낸 뒤 세션이 늦게 와도 들어간다 ★
     시간초과는 「세션이 없다」고 적지 않는다. 기다리기만 그만둔다 —
     늦게 도착한 세션은 로그인 상태 변화로 들어오고, 그때 앱이 열린다. */
  ok('★ 확인 전에 세션이 들어와도 앱으로 ★',
    authGate({ configured: true, ready: false, session: sess }) === 'app');

  /* ★ 오프라인으로 계속 ★
     서버가 죽어 있어도 기기에 있는 것으로 공부할 수 있어야 한다. */
  ok('★ 오프라인으로 계속을 고르면 앱 ★',
    authGate({ configured: true, ready: true, session: null, offlinePass: true }) === 'app');
  ok('확인이 안 끝났어도 그 선택은 유효하다',
    authGate({ configured: true, ready: false, session: null, offlinePass: true }) === 'app');

  /* 서버를 안 쓰는 앱이면 로그인이 없다 — 거기서 문을 띄우면 들어갈 길이 없다 */
  ok('★ 서버를 안 쓰면 그냥 앱 ★',
    authGate({ configured: false, ready: false, session: null }) === 'app');
  ok('빈손으로 불러도 멈추지 않는다 — loading이 기본',
    authGate() === 'loading');
}

console.log('\n[ ★ 네 갈래 어디로 가도 갇히지 않는다 ★ ]');
{
  /* 성공 · 실패 · 예외 · 시간초과. 넷 다 확인이 끝났다고 적고 나오므로,
     ready는 참이 된다 — 그러면 문이든 앱이든 사람이 고를 수 있는 자리다. */
  const 끝난뒤 = [
    ['성공 — 세션 있음', { ready: true, session: { user: { id: 'u' } } }],
    ['성공 — 세션 없음', { ready: true, session: null }],
    ['실패(거절)', { ready: true, session: null }],
    ['예외(그 자리에서 던짐)', { ready: true, session: null }],
    ['시간초과', { ready: true, session: null }],
  ];
  for (const [name, st] of 끝난뒤) {
    const g = authGate({ configured: true, ...st });
    ok(`${name} → 기다리는 화면에 안 갇힌다`, g !== 'loading', g);
  }
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
