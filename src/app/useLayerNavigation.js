import { useEffect, useRef, useSyncExternalStore } from 'react';
import { NAV_SENTINEL, onLayerChange, onPopState } from '../lib/navhistory.js';
import { closeTopSheet, sheetDepth, subscribeSheets } from '../lib/sheets.js';

/* 뒤로가기로 학습을 잃지 않는다.
 *
 * 회독 화면이나 메뉴가 덮여 있을 때 뒤로가기를 누르면 앱을 그냥 벗어났다.
 * 안드로이드와 홈 화면 앱에서는 그게 제일 자연스러운 「닫기」 동작인데,
 * 여기서는 앱이 닫히는 것으로 읽힌다. 덮인 게 있으면 그것만 닫는다 —
 * 회독 화면을 닫아도 세션은 저장돼 있어서 오늘 화면의 이어하기로 돌아간다.
 *
 * 무엇을 세우고 쓸지 정하는 규칙은 lib/navhistory.js에 있다. 거기 있어야
 * 하는 이유는 그게 타이밍 문제이기 때문이다 — 특히 「닫고 바로 다시 열기」는
 * 눌러 봐서는 못 잡는다. 전에 그 자리에서 앱 밖으로 튕겨서 한 번 되돌렸다.
 *
 * ★ 표시는 ref에 둔다 ★
 *
 * 자리가 있는지(owned)와 부른 back이 도착했는지(pending)는 화면에 안 그린다.
 * state로 두면 바뀔 때마다 앱 전체가 다시 그려지고, 더 나쁜 것은 popstate
 * 처리 중에 묵은 값을 읽는다는 점이다 — 그 순간에는 지금 값이 필요하다. */
export function useLayerNavigation({ deck, sub, setDeck, setSub }) {
  /* 몇 층이 덮여 있나. 회독 판과 밀어 넣은 메뉴는 따로 세는 게 맞다 —
     판 위에 메뉴가 열릴 수 있고, 그때 뒤로가기는 한 번에 한 층만 닫는다. */
  /* ★ 시트도 한 층이다 ★
     문법의 「시제」, 듣기의 「시작 전 묻기」 같은 시트는 화면 안의 지역
     상태라 여기서 몰랐다. 그래서 시트가 떠 있을 때 뒤로가기를 누르면
     시트가 아니라 화면이 통째로 닫혔다. 시트 장부(lib/sheets.js)를 구독해
     떠 있는 수만큼 층으로 세고, 닫을 때는 시트부터 닫는다. */
  const sheets = useSyncExternalStore(subscribeSheets, sheetDepth, () => 0);
  const depth = (deck ? 1 : 0) + (sub ? 1 : 0) + sheets;

  /* popstate 처리가 지금 층 수를 알아야 한다. 효과에 depth를 의존성으로
     넣어 듣는 자리를 매번 다시 붙이면, 붙이는 사이에 온 pop을 놓친다. */
  const depthRef = useRef(depth);
  depthRef.current = depth;
  const deckRef = useRef(deck);
  deckRef.current = deck;

  const owned = useRef(false);
  const pending = useRef(false);

  /* history.state가 우리 자리인지 본다. 다른 자리에 얹어 밀면 그 앱(또는
     브라우저)의 자리를 덮는다. */
  const pushSentinel = () => {
    if (typeof window === 'undefined') return;
    if (window.history.state?.jp === NAV_SENTINEL) { owned.current = true; return; }
    window.history.pushState({ jp: NAV_SENTINEL }, '');
  };

  const apply = (r) => {
    owned.current = r.owned;
    pending.current = r.pending;
    if (r.act === 'push') pushSentinel();
    else if (r.act === 'back') window.history.back();
  };

  /* 층이 열리거나 닫혔다 */
  useEffect(() => {
    apply(onLayerChange({
      depth, owned: owned.current, pending: pending.current,
    }));
    // apply는 ref만 건드린다 — 의존성에 넣을 것이 없다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth]);

  /* 뒤로가기가 눌렸다, 또는 우리가 부른 back이 도착했다 */
  useEffect(() => {
    const onPop = () => {
      const r = onPopState({
        depth: depthRef.current, owned: owned.current, pending: pending.current,
      });
      /* 자리를 다시 세우는 일을 먼저 한다. 닫으면 위의 효과가 돌면서 또
         판단하는데, 그때는 이미 세워져 있어야 자리가 둘로 늘지 않는다. */
      owned.current = r.owned;
      pending.current = r.pending;
      if (r.act === 'push') pushSentinel();
      if (!r.close) return;
      // 위에 덮인 것부터 하나씩. 시트 → 회독 → 메뉴 순이다.
      if (closeTopSheet()) return;
      if (deckRef.current) { setDeck(null); return; }
      setSub(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setDeck, setSub]);
}
