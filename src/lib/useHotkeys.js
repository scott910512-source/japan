import { useEffect, useRef, useState } from 'react';

/* 물리 키보드가 붙어 있는지.
 * iPadOS는 키보드를 꽂아도 pointer를 coarse로 보고해서 미디어 쿼리로는 못 가른다.
 * 그래서 "실제로 키를 눌렀는가"로 판단한다. 한 번 눌렀으면 계속 기억한다. */
const SEEN_KEY = 'jp_manabu_has_keyboard_v1';

let hasKeyboard = (() => {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
})();
const listeners = new Set();

function markKeyboard() {
  if (hasKeyboard) return;
  hasKeyboard = true;
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* 무시 */ }
  listeners.forEach((fn) => fn(true));
}

export function useHasKeyboard() {
  const [value, setValue] = useState(hasKeyboard);
  useEffect(() => {
    if (hasKeyboard) { setValue(true); return undefined; }
    listeners.add(setValue);
    return () => listeners.delete(setValue);
  }, []);
  return value;
}

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
      markKeyboard();
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
