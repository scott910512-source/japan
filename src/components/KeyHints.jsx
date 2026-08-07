// 키보드 단축키 안내. 마우스·키보드가 있는 기기에서만 보인다(CSS로 제어).
export default function KeyHints({ revealed }) {
  return (
    <div className="keyhints">
      <span><kbd>Space</kbd> 듣기</span>
      <span><kbd>Enter</kbd> {revealed ? '알아요' : '뜻 보기'}</span>
      <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 판정</span>
      <span><kbd>0</kbd> 이미 외웠어요</span>
      <span><kbd>←</kbd> 되돌리기</span>
    </div>
  );
}
