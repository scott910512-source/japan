import { useEffect, useRef } from 'react';

/* 아래에서 올라오는 시트.
 *
 * ★ 창인데 창이라고 말하지 않았다 ★
 *
 * 배경과 내용은 그렸지만 이게 「창」이라는 표시가 없었다. 스크린리더는 그냥
 * 페이지 중간의 글로 읽고, 키보드로는 Tab이 시트를 지나쳐 뒤쪽 화면을 돈다 —
 * 열려 있는 창 안에서 Tab을 눌렀는데 초점이 보이지 않는 곳으로 간다.
 *
 * 셋을 더한다.
 *   창이라고 말한다            role=dialog · aria-modal · 이름
 *   열면 초점을 안으로 옮긴다   안 옮기면 Tab이 뒤쪽부터 돈다
 *   닫으면 있던 자리로 되돌린다 안 되돌리면 초점이 문서 맨 위로 튄다
 *
 * 닫힌 시트가 초점에 안 걸리는 것은 이미 CSS가 한다(visibility: hidden).
 *
 * 초점은 시트 자체에 준다. 첫 버튼에 주면, 글상자를 먼저 띄우는 시트
 * (물어보기)에서 그 글상자의 초점을 빼앗는다. */
export default function BottomSheet({ open, onClose, label = '시트', children }) {
  const box = useRef(null);
  const came = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    came.current = document.activeElement;

    /* 미끄러져 들어오는 중에 옮기면 스크롤이 튄다 — 다 올라온 뒤에 옮긴다.
       이미 시트 안에 초점이 있으면(자동으로 글상자를 잡는 시트) 건드리지 않는다. */
    const t = setTimeout(() => {
      if (box.current && !box.current.contains(document.activeElement)) {
        box.current.focus?.();
      }
    }, 80);

    const focusables = () => [...(box.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ) || [])].filter((el) => !el.disabled && el.offsetParent !== null);

    const onKey = (e) => {
      if (e.key === 'Escape') {
        /* 제일 위에 있는 것부터 닫힌다 — 시트가 열려 있는데 뒤쪽 화면이
           같이 닫히면 하던 학습이 통째로 날아간다. */
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      /* 초점을 시트 안에 가둔다. 밖으로 나가면 안 보이는 화면의 버튼을 밟는다 */
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      // 닫히면 눌렀던 자리로 되돌린다. 사라진 요소면 아무 일도 안 일어난다.
      came.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`sheet-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <div
        ref={box}
        className={`sheet${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        /* 닫혀 있으면 접근성 트리에서도 빠진다. 보이는 것은 CSS가 막지만
           읽는 것은 이쪽이 막는다. */
        aria-hidden={open ? undefined : 'true'}
        tabIndex={-1}
      >
        <div className="sheet-handle" />
        {children}
      </div>
    </>
  );
}
