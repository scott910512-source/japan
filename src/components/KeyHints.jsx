import { useHasKeyboard } from '../lib/useHotkeys.js';

/* 키보드 단축키 안내.
 * 키보드가 없는 폰에서는 자리만 차지하므로 감춘다. 다만 iPadOS는 키보드를 꽂아도
 * 미디어 쿼리로 가려지지 않아서, 실제로 키를 한 번 누른 적이 있으면 그때부터 보여준다. */
export default function KeyHints({ revealed }) {
  const hasKeyboard = useHasKeyboard();
  return (
    <div className={`keyhints${hasKeyboard ? ' show' : ''}`}>
      <span><kbd>Space</kbd> 듣기</span>
      <span><kbd>Enter</kbd> {revealed ? '알아요' : '뜻 보기'}</span>
      <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 판정</span>
      <span><kbd>0</kbd> 이미 외웠어요</span>
      <span><kbd>←</kbd> 되돌리기</span>
    </div>
  );
}
