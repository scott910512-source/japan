import { useEffect } from 'react';

export function useLayerNavigation({ deck, sub, setDeck, setSub }) {
  /* ── ★ 뒤로가기로 학습을 잃지 않는다 ★ ──
   *
   * 회독 화면이나 메뉴가 덮여 있을 때 뒤로가기를 누르면 앱을 그냥 벗어났다.
   * 안드로이드와 홈 화면 앱에서는 그게 제일 자연스러운 「닫기」 동작인데,
   * 여기서는 앱이 닫히는 것으로 읽힌다.
   *
   * 덮인 게 있으면 그것만 닫는다. 회독 화면을 닫아도 세션은 저장돼 있어서
   * 오늘 화면의 이어하기로 그 자리에 돌아간다 — 화면의 닫기 버튼과 같다.
   *
   * 덮인 게 없으면 막지 않는다. 거기서 붙잡으면 앱에서 나갈 길이 없어진다.
   *
   * ★ 자리는 딱 하나만, 그리고 우리가 되돌리지 않는다 ★
   *
   * 처음에는 화면에서 닫을 때 넣어 둔 자리도 history.back()으로 같이 뺐다.
   * 뒤로가기가 한 번 헛도는 걸 막으려던 것인데, back()은 비동기라서 닫고 바로
   * 다시 여는 흐름에서 엉뚱한 자리를 뺐다 — 앱 밖으로 나가 버렸고 듣기·디자인
   * 검사가 통째로 멈췄다. 헛도는 한 번보다 앱에서 튕기는 게 훨씬 나쁘다.
   *
   * 그래서 우리가 history를 되돌리지 않는다. 자리가 있는지는 history.state로
   * 보니 몇 개를 넣었는지 셀 필요도 없다 — 있으면 안 넣고, 없으면 하나 넣는다.
   * 화면 버튼으로 닫은 뒤 뒤로가기를 누르면 그 자리를 쓰면서 아무 일도 안
   * 일어나고, 한 번 더 누르면 앱을 벗어난다. */
  const layerOpen = Boolean(deck || sub);

  useEffect(() => {
    if (!layerOpen) return;
    if (window.history.state?.jp === 'layer') return;   // 이미 자리가 있다
    window.history.pushState({ jp: 'layer' }, '');
  }, [layerOpen]);

  useEffect(() => {
    const onPop = () => {
      // 위에 덮인 것부터 하나씩. 회독 → 메뉴 순이다.
      if (deck) { setDeck(null); return; }
      if (sub) { setSub(null); }
      /* 덮인 게 없으면 아무것도 안 한다 — 브라우저가 하던 대로 나간다.
         화면에서 닫아 둔 자리가 남아 있었다면 이 한 번이 그걸 쓴다. */
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [deck, sub]);

}
