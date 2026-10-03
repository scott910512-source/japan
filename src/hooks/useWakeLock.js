import { useEffect } from 'react';

/* 화면이 꺼지지 않게 붙잡아 둔다 — 듣는 동안만.
 *
 * ★ 못 잡는 것은 실패가 아니다 ★
 *
 * 이 기능은 「있으면 좋은 것」이다. 아이폰 사파리에는 아예 없고, 권한을
 * 거절당할 수도 있고, 뒤로 돌아가 있는 동안에는 요청 자체가 거부된다.
 * 그 어느 경우에도 듣기는 그대로 돌아야 한다 — 박자와 음성은 화면과 상관이
 * 없다. 그래서 여기서 나는 모든 실패는 조용히 삼킨다.
 *
 * 빈 catch가 여럿 보이는데 지우면 안 된다. 각각 다른 실패를 받는다 —
 * request가 그 자리에서 던지는 경우, 나중에 거절되는 경우, 놓는 데 실패하는
 * 경우다. 하나만 빠져도 듣기 화면이 통째로 죽는다.
 *
 * ★ 돌아오면 다시 잡는다 ★
 *
 * 브라우저는 화면이 뒤로 가면 이 걸쇠를 말없이 놓는다. 그리고 돌아올 때
 * 스스로 다시 잡아 주지는 않는다. 여태 판을 시작할 때 한 번만 잡고 있었으니,
 * 전화를 한 번 받고 돌아오면 그 뒤로는 화면이 1분마다 꺼졌다 — 달리는
 * 중에 그걸 다시 켜려면 주머니에서 폰을 꺼내야 한다.
 *
 * 그래서 앞으로 돌아올 때마다 손에 없으면 다시 잡는다. 이미 쥐고 있으면
 * 아무것도 안 한다. */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    if (typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;

    let done = false;      // 효과가 끝났다 — 늦게 온 응답은 바로 놓는다
    let held = null;

    const grab = () => {
      if (done || held) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      let p;
      try {
        p = navigator.wakeLock.request('screen');
      } catch {
        return;   // 그 자리에서 던지는 기기가 있다
      }
      p?.then?.((s) => {
        if (done) { try { s.release?.(); } catch { /* 무시 */ } return; }
        held = s;
        /* 브라우저가 놓으면 우리 손에서도 비워 둔다 — 안 비우면 돌아왔을 때
           「이미 쥐고 있다」고 착각해서 다시 안 잡는다. */
        s.addEventListener?.('release', () => { if (held === s) held = null; });
      })?.catch?.(() => { /* 거절당해도 듣기는 돈다 */ });
    };

    grab();
    const onShow = () => { if (document.visibilityState === 'visible') grab(); };
    document.addEventListener?.('visibilitychange', onShow);

    return () => {
      done = true;
      document.removeEventListener?.('visibilitychange', onShow);
      try { held?.release?.()?.catch?.(() => {}); } catch { /* 무시 */ }
      held = null;
    };
  }, [active]);
}
