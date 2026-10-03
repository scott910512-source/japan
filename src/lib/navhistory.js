/* 뒤로가기와 덮인 화면 — 누가 history를 쥐는가.
 *
 * ★ 이 앱에는 주소가 없다 ★
 *
 * 화면을 주소로 나누지 않았다. 그래서 새로고침하면 늘 홈이다. 그 대신
 * 덮인 화면(회독 판 · 밀어 넣은 메뉴)이 열릴 때 history에 자리 하나를 밀어
 * 넣고, 뒤로가기가 그 자리를 쓰면 덮인 것을 닫는다. 안 그러면 뒤로가기가
 * 앱을 통째로 벗어나는데, 안드로이드와 홈 화면 앱에서는 그게 「닫기」라
 * 손이 먼저 간다.
 *
 * ★ 전에 뭐가 틀렸나 ★
 *
 * 두 가지가 있었다.
 *
 *   ① 화면 버튼으로 닫으면 밀어 둔 자리가 그대로 남았다. 그 뒤에 뒤로가기를
 *      누르면 그 자리를 쓰면서 아무 일도 안 일어난다 — 한 번이 먹히지 않고
 *      두 번째에 앱을 벗어난다. 눌렀는데 아무 일도 안 나는 그 한 번이
 *      「뒤로가기가 안 먹는다」로 읽힌다.
 *   ② 층이 둘일 때(회독 판 위에 메뉴) 자리는 하나뿐이었다. 뒤로가기로 위층을
 *      닫으면 그 자리는 이미 쓰였는데 아래층은 아직 열려 있다. 그 상태에서
 *      한 번 더 누르면 덮인 화면을 두고 앱을 벗어난다.
 *
 * ①을 고치려고 전에 history.back()을 불러 봤는데, back()은 비동기라서 닫고
 * 바로 다시 여는 흐름에서 엉뚱한 자리를 뺐다 — 앱 밖으로 튕겼다. 그래서
 * 그때는 되돌렸다.
 *
 * ★ 지금 방식 ★
 *
 * back()은 쓴다. 대신 「우리가 부른 back이 도착했다」를 표시로 들고 있고,
 * 도착했을 때 층이 아직(또는 다시) 열려 있으면 자리를 새로 세운다. 닫고 바로
 * 다시 여는 그 흐름이 여기서 막힌다 — back이 늦게 도착해도 열린 층에는 늘
 * 자리가 하나 붙어 있다.
 *
 * 층 수로만 판단하니 무엇이 열렸는지는 알 필요가 없다. 규칙을 순수 함수로
 * 둔 이유가 그것이다 — 브라우저를 눌러 보지 않고 표로 확인한다. */

export const NAV_SENTINEL = 'layer';

/* 덮인 층이 열리거나 닫혔다. 자리를 세울까, 쓸까, 그대로 둘까.
 *
 *   depth    지금 열려 있는 층 수 (0이면 덮인 게 없다)
 *   owned    우리가 밀어 둔 자리가 지금 있나
 *   pending  우리가 부른 back이 아직 도착 안 했나
 *
 * act: 'push' 자리를 하나 민다 · 'back' 우리 자리를 쓴다 · 'none' 그대로 */
export function onLayerChange({ depth = 0, owned = false, pending = false } = {}) {
  /* 층이 열렸는데 자리가 없다 — 하나 민다. 이미 있으면 안 민다(자리는 하나만).
     back이 도착하기 전이면 기다린다 — 도착했을 때 열려 있으면 그쪽이 세운다. */
  if (depth > 0) {
    if (owned || pending) return { act: 'none', owned, pending };
    return { act: 'push', owned: true, pending };
  }
  /* 다 닫혔는데 자리가 남아 있다 — 우리가 쓴다. 안 쓰면 다음 뒤로가기 한 번이
     헛돌고, 쓰는 사람에게 그건 「뒤로가기가 안 먹는다」다. */
  if (owned && !pending) return { act: 'back', owned, pending: true };
  return { act: 'none', owned, pending };
}

/* 뒤로가기가 눌렸다(또는 우리가 부른 back이 도착했다).
 *
 *   depth  지금(닫기 전) 열려 있는 층 수
 *
 * close: 맨 위 한 층을 닫을까 · act: 자리를 다시 세울까 */
export function onPopState({ depth = 0, owned = false, pending = false } = {}) {
  if (pending) {
    /* 우리가 부른 back이 도착했다. 사람이 누른 게 아니니 아무것도 안 닫는다.
       그 사이에 층이 다시 열렸으면 자리를 새로 세운다 — 「닫고 바로 다시
       열기」에서 자리가 없어지는 구멍이 여기서 막힌다. */
    if (depth > 0) return { act: 'push', close: false, owned: true, pending: false };
    return { act: 'none', close: false, owned: false, pending: false };
  }

  /* 사람이 눌렀다. 우리가 밀어 둔 자리는 이 pop이 썼다. */
  if (depth === 0) {
    /* 덮인 게 없으면 막지 않는다 — 거기서 붙잡으면 앱에서 나갈 길이 없어진다. */
    return { act: 'none', close: false, owned: false, pending: false };
  }

  /* 맨 위 한 층을 닫는다. 아래에 층이 남으면 자리를 다시 세운다 —
     안 세우면 다음 뒤로가기가 덮인 화면을 두고 앱을 벗어난다. */
  const rest = depth - 1;
  return { act: rest > 0 ? 'push' : 'none', close: true, owned: rest > 0, pending: false };
}
