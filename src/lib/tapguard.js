/* 같은 자리를 연달아 누른 것은 한 번으로 본다.
 *
 * 손가락이 튀거나 마우스가 두 번 눌리면 둘째 클릭이 그 자리에 새로 나온 단추에 들어간다 — 「답 보기」를 눌렀는데
 * 같은 자리에 나온 「알아요」까지 눌려서 모르는 카드가 아는 것으로 기록되는 식이다. 그래서 0.2초 안에 같은 자리
 * (24px 안)를 또 누른 것은 버린다. 다른 자리는 바로 받는다 — 빠르게 이어 누르는 것은 그대로다.
 *
 * 글자를 치는 칸은 건드리지 않는다(두 번 눌러 낱말을 고르는 것이 원래 동작이다). 코드가 낸 클릭(el.click())도 그대로 둔다.
 * 틈은 단축키와 같은 값이다(lib/useHotkeys.js SAME_INPUT_GAP_MS). */
import { SAME_INPUT_GAP_MS } from './useHotkeys.js';

export const SAME_SPOT_PX = 24;
const FREE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), label, video, audio, [data-rapid]';

/* prev · next = { at(ms), x, y }. 버려야 하면 true */
export function isRepeatTap(prev, next, gap = SAME_INPUT_GAP_MS, near = SAME_SPOT_PX) {
  if (!prev) return false;
  const dt = next.at - prev.at;
  return dt >= 0 && dt < gap && Math.abs(next.x - prev.x) <= near && Math.abs(next.y - prev.y) <= near;
}

export function installTapGuard(target = window) {
  let last = null;
  const onClick = (e) => {
    if (!e.isTrusted) return;
    if (e.target?.closest?.(FREE)) return;
    const now = { at: e.timeStamp, x: e.clientX, y: e.clientY };
    if (isRepeatTap(last, now)) { e.preventDefault(); e.stopPropagation(); return; }
    last = now;
  };
  target.addEventListener('click', onClick, true);
  return () => target.removeEventListener('click', onClick, true);
}
