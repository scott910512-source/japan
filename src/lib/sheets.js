/* 떠 있는 시트의 장부 — 뒤로가기가 시트부터 닫게.
 *
 * ★ 뭐가 틀렸나 ★
 *
 * 문법의 「시제」 시트, 자동 듣기의 「시작 전 묻기」 시트가 떠 있을 때 폰
 * 뒤로가기를 누르면 시트만 닫히는 게 아니라 문법·듣기 화면까지 통째로
 * 나갔다. 뒤로가기 층 세기(useLayerNavigation)가 회독 판과 밀어 넣은
 * 화면만 세고, 시트는 각 화면의 지역 상태라 몰랐기 때문이다. 배경을 누르면
 * 시트만 닫히는데 뒤로가기는 화면을 닫으니, 같은 「닫기」가 두 결과를 냈다.
 *
 * ★ 지금 방식 ★
 *
 * 시트가 열리면 여기 닫는 손잡이를 적어 두고, 닫히면 지운다. 층 세기는
 * 이 장부의 길이를 한 층으로 세고, 뒤로가기가 오면 맨 위 시트부터 닫는다.
 * 시트가 어느 화면 안에 있는지는 몰라도 된다 — 열린 순서만 안다.
 *
 * React 바깥의 작은 저장소다. 화면이 useSyncExternalStore로 구독한다. */

const stack = [];
const subs = new Set();
const emit = () => { for (const fn of subs) fn(); };

/* 시트가 열렸다. 닫는 손잡이를 적고, 지우는 함수를 돌려준다. */
export function pushSheet(close) {
  const entry = { close };
  stack.push(entry);
  emit();
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) { stack.splice(i, 1); emit(); }
  };
}

/* 지금 떠 있는 시트 수 */
export function sheetDepth() {
  return stack.length;
}

/* 맨 위 시트를 닫는다. 닫을 게 있었으면 true. */
export function closeTopSheet() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close?.();
  return true;
}

export function subscribeSheets(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/* 검사용 — 다음 검사가 앞 검사의 시트를 물려받지 않게 */
export function resetSheets() {
  stack.length = 0;
  emit();
}
