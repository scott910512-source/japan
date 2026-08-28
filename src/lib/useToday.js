import { useEffect, useState } from 'react';
import { todayKey } from './review.js';

/* 오늘 날짜를 화면에 묶어 둔다.
 *
 * 날짜를 렌더 안에서 `todayKey()`로 그때그때 부르면, 값이 바뀌어도 리액트가
 * 모른다. 그래서 자정을 넘겨 공부하면 오늘 탭은 새 날로 리셋되는데 기록
 * 달력은 어제 달에 머물렀다 — 같은 앱 안에서 두 화면이 다른 날을 가리켰고,
 * 새로고침해야 맞아졌다.
 *
 * 자정에 한 번 깨워서 다시 그린다. 화면을 덮어 뒀다 다시 열 때도 확인한다 —
 * 배경에서는 타이머가 안 도는 기기가 있다. */
export function useToday() {
  const [day, setDay] = useState(() => todayKey());

  useEffect(() => {
    let timer;

    const check = () => {
      const now = todayKey();
      setDay((prev) => (prev === now ? prev : now));
    };

    const arm = () => {
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
      // setTimeout은 24.8일이 넘으면 넘쳐서 즉시 돈다. 자정까지는 그보다 짧지만 막아 둔다.
      timer = setTimeout(() => { check(); arm(); }, Math.min(midnight - now, 2 ** 31 - 1));
    };

    const onWake = () => { if (document.visibilityState === 'visible') { check(); arm(); } };

    arm();
    document.addEventListener('visibilitychange', onWake);
    // 잠갔다 켜는 경로가 기기마다 다르다. 둘 중 하나만 와도 맞춰지게 둘 다 듣는다.
    window.addEventListener('focus', onWake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, []);

  return day;
}
