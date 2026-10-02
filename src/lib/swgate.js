/* 새 버전으로 언제 갈아끼우나 — 규칙만.
 *
 * ★ 왜 또 고치나 ★
 *
 * 「학습 중이면 미룬다」로 두 번 고쳤다. 처음엔 저장된 회독 세션만 봤고(듣기·
 * 시험·코스가 구멍이었다), 다음엔 화면들이 스스로 알리게 했다(lib/busy.js).
 * 그런데도 「처음 들어가면 한 번 홈으로 튕긴다」가 남았다.
 *
 * 남은 구멍은 「학습 중」이 아니었다. 갈아끼우기는 곧 새로고침이고, 이 앱은
 * 주소가 없다 — 어느 화면에 있었든 새로고침하면 홈이다. 그러니 판정을 안
 * 하는 자리에서도 새로고침은 그대로 「튕김」이다. 배포를 올린 다음 앱을 열면
 * 몇 초 뒤에 갱신이 잡히고, 그 사이 사람이 탭 하나를 눌렀으면 그 자리가
 * 사라진다. 한 배포에 한 번씩 꼭 일어난다.
 *
 * ★ 그래서 기준을 바꾼다 ★
 *
 * 「학습 중인가」가 아니라 「지금 이 새로고침이 보이는가」로 묻는다.
 *
 *   안 보고 있을 때(hidden)      갈아끼운다. 돌아오면 새 버전이 떠 있다
 *   홈에 그대로 있을 때           갈아끼운다. 새로고침해도 다시 홈이라 티가 안 난다
 *   그 밖에                       미룬다. 보고 있는 화면을 뺏지 않는다
 *
 * 미루기만 하면 영영 안 바뀔까 봐 걱정되는데, 그렇지 않다. 앱을 한 번 내려놓기만
 * 하면 그때 적용된다. 그것도 싫은 사람을 위해 설정에 「최신 버전 받기」가 있다.
 *
 * 규칙을 화면에서 떼어 둔다 — main.jsx는 registerSW를 부르는 자리라 검사에서
 * 통째로 불러올 수가 없다. 규칙만 여기 있으면 눌러 보지 않고도 지킬 수 있다. */

export const WHY = {
  NONE: 'none',         // 받아 둔 새 버전이 없다
  STUDYING: 'studying', // 하던 판이 있다
  LOOKING: 'looking',   // 보고 있는 화면이 있다 — 새로고침하면 그 자리가 사라진다
  OK: 'ok',
};

/* 갈아끼워도 되나.
 *
 *   pending     받아 둔 새 버전이 있는가
 *   busy        화면이 「하던 중」이라고 알렸는가 (lib/busy.js)
 *   hasSession  저장된 회독 세션이 남아 있는가
 *   visible     지금 화면이 보이는가
 *
 * busy는 둘을 겸한다 — 판정하는 자리(듣기·시험·코스·회독)와, 홈이 아닌
 * 자리(탭·밀어 넣은 화면). 둘 다 「새로고침하면 잃는 것이 있다」는 같은 뜻이다. */
export function updateGate({ pending, busy, hasSession, visible } = {}) {
  if (!pending) return WHY.NONE;
  if (hasSession) return WHY.STUDYING;
  /* 안 보고 있으면 지금이 제일 좋은 때다. 하던 판이 없는 한, 돌아왔을 때
     새 버전이 떠 있는 것이 사람 눈에는 「앱을 다시 켠 것」과 같다. */
  if (!visible) return WHY.OK;
  if (busy) return WHY.LOOKING;
  return WHY.OK;
}

export function shouldApplyUpdate(state) {
  return updateGate(state) === WHY.OK;
}

/* 미뤘다는 것을 한 번은 알려야 한다 — 조용히 미루면 왜 안 바뀌는지 모른다.
   무엇 때문에 미뤘는지에 따라 할 말이 다르다. */
export function waitingLabel(why) {
  if (why === WHY.STUDYING) return '새 버전이 준비됐어요 · 학습을 마치면 적용돼요';
  if (why === WHY.LOOKING) return '새 버전이 준비됐어요 · 앱을 내려놨다 열면 적용돼요';
  return null;
}
