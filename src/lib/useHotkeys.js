import { useEffect, useRef, useState } from 'react';

/* 물리 키보드가 붙어 있는지.
 * iPadOS는 키보드를 꽂아도 pointer를 coarse로 보고해서 미디어 쿼리로는 못 가른다.
 * 그래서 "실제로 키를 눌렀는가"로 판단한다. 한 번 눌렀으면 계속 기억한다. */
const SEEN_KEY = 'jp_manabu_has_keyboard_v1';

let hasKeyboard = (() => {
  try { return localStorage.getItem(SEEN_KEY) === '1' || window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; }
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
export function useHotkeys(map, { enabled = true, scope: externalScope, rapid = false } = {}) {
  // 매 렌더마다 이벤트를 다시 붙이지 않으면서도 최신 핸들러를 보게 한다
  const scope = useRef(null);
  const ref = useRef(null);
  ref.current = { map, enabled, scope: externalScope || scope, rapid };

  useEffect(() => {
    const entry = { ref };
    owners.add(entry);
    const onKey = (e) => {
      if (activeOwner() !== entry) return;
      if (e.repeat && !e.target?.closest?.('input, textarea, select, [contenteditable]')) {
        const map = ref.current.map;
        if (map[e.code] || map[e.key]) e.preventDefault();
        return;
      }
      if (!shortcutEvent(e)) return;
      const el = e.target;
      if ((e.code === 'Space' || e.key === 'Enter') && el instanceof HTMLElement
        && (el.closest('a, summary, [role="tab"], [role="slider"]')
          || (tabFocus && el.closest('button')))) return;
      const editor = el instanceof HTMLElement && el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
      // 채점으로 disabled 된 입력칸은 일부 브라우저에서 초점을 계속 가진다.
      // 그때 Enter까지 막으면 키보드만으로 다음 문제에 갈 수 없다.
      if (editor && !editor.disabled && e.key !== 'Escape') return;

      // IMEs and number pads can report Process/Unidentified/End rather than
      // the printed key. Fall back to its physical position outside editors.
      const letter = /^Key([A-Z])$/.exec(e.code)?.[1];
      const digit = !e.shiftKey && /^(?:Digit|Numpad)([0-9])$/.exec(e.code)?.[1];
      const bindings = ref.current.map;
      const handler = bindings[e.code] ?? (digit ? bindings[digit] : undefined)
        ?? bindings[e.key]
        ?? (letter ? bindings[letter.toLowerCase()] ?? bindings[letter] : undefined);
      if (!handler) return;
      markKeyboard();
      e.preventDefault();
      e.stopPropagation();
      /* ★ 같은 키를 연달아 누른 것은 한 번으로 본다 ★ 「답 보기」(Enter) 바로 뒤에 Enter가 한 번 더 들어가면
         그대로 「알아요」로 기록된다. 손이 튀어 두 번 눌린 것을 판정으로 적지 않게, 같은 키는 0.2초 안에 다시 안 받는다.
         다른 키는 바로 받는다(1 → 2처럼 빠르게 이어 누르는 것은 그대로).
         같은 키를 일부러 이어 누르는 화면(짝 맞추기의 1 → 1, 문장 조립의 1 · 1 · 1)은 rapid로 이 틈을 끈다. */
      const id = e.code || e.key;
      const now = typeof e.timeStamp === 'number' && e.timeStamp > 0 ? e.timeStamp : Date.now();
      if (!ref.current.rapid && tooSoon(lastKey, { id, at: now })) return;
      lastKey = { id, at: now };
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => { owners.delete(entry); window.removeEventListener('keydown', onKey); };
  }, []);
  return externalScope || scope;
}

/* 같은 키(같은 자리의 클릭)를 다시 받기까지 두는 틈. lib/tapguard.js의 클릭도 같은 값을 쓴다 */
export const SAME_INPUT_GAP_MS = 200;
export const tooSoon = (prev, next, gap = SAME_INPUT_GAP_MS) => Boolean(prev && prev.id === next.id && next.at - prev.at >= 0 && next.at - prev.at < gap);
let lastKey = null;

// 한 번 누른 키는 가장 안쪽의 현재 화면 하나만 처리한다. 시트 뒤의 학습은 멈춘다.
const owners = new Set();
let tabFocus = false;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab') tabFocus = true; }, true);
  document.addEventListener('pointerdown', () => { tabFocus = false; }, true);
}
function visible(el) { return el?.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }
function activeOwner() {
  const dialog = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(visible).at(-1);
  let active = null;
  for (const owner of owners) {
    const { enabled, map, scope } = owner.ref.current;
    const root = scope.current;
    if (!enabled || !Object.keys(map).length || (root && !visible(root))) continue;
    if (dialog && (!root || !dialog.contains(root))) continue;
    const prev = active?.ref.current.scope.current;
    if (!active || (root && (!prev || prev.contains(root)))) active = owner;
  }
  return active;
}

export function shortcutEvent(e) {
  return !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat
    && !e.isComposing && !e.nativeEvent?.isComposing && (e.keyCode !== 229 || /^(?:Digit|Numpad)[0-9]$/.test(e.code));
}

/* 모든 선택형 문제의 공통 조작. 키보드로 풀기 시작하면 설명은 Enter로 넘긴다. */
export function useQuizHotkeys({ options = [], onChoose, onNext, onSpeak, onQuit, enabled = true, scope, legacyNext = false }) {
  const [keyboard, setKeyboard] = useState(false);
  const bindings = Object.fromEntries(options.slice(0, 9).map((option, i) => [i + 1, () => { setKeyboard(true); onChoose?.(option, true); }]));
  const root = useHotkeys({ ...bindings,
    ...(legacyNext && options.length < 5 ? { 5: () => { setKeyboard(true); onNext?.(); } } : {}),
    Enter: () => { setKeyboard(true); onNext?.(); },
    Space: onSpeak,
    Escape: onQuit,
  }, { enabled, scope });
  return { scope: root, keyboard, takeControl: () => setKeyboard(true) };
}
