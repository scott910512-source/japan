import { useEffect, useRef } from 'react';

/* 학습 화면 키보드 단축키.
 * PC에서 카드를 빠르게 넘길 때 쓴다. 맵의 키는 e.key 또는 e.code 둘 다 받는다
 * (스페이스는 e.key가 ' ', e.code가 'Space'라 헷갈리기 쉽다). */
export function useHotkeys(map) {
  // 매 렌더마다 이벤트를 다시 붙이지 않으면서도 최신 핸들러를 보게 한다
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && el.closest('input, textarea, select, [contenteditable]')) return;

      const handler = ref.current[e.key] ?? ref.current[e.code];
      if (!handler) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
