/* 완주 카드 — 몇 장 끝냈나 · 판정 셋 · 다음으로.
   Study.jsx에서 떼어 냈다. 동작은 그대로다. */
export default function FinishCard({ finished, deck, settings, onClose, onHome, onNext, onUndo }) {
  const t = finished.tally || {};
  const known = (t.known || 0) + (t.master || 0);
  return (
    <div className="study">
      <div className="finish">
        <div className="fin-badge">🎉</div>
        <h2>{finished.reason === 'clear' ? '오늘 회독 완주!' : '오늘은 여기까지'}</h2>

        {/* 무엇을 했는지가 결과다. 「장」은 서로 다른 카드, 「번」은 누른 횟수 —
            몰라요가 섞이면 둘이 달라져서, 한 낱말로 뭉뚱그리면 거짓이 된다. */}
        <div className="fin-big">
          <b>{finished.cleared}</b>
          <span>/ {finished.total}장 끝냄</span>
        </div>

        <div className="fin-grid">
          <div className="fin-cell ok"><b>{known}</b><span>알아요</span></div>
          <div className="fin-cell mid"><b>{t.vague || 0}</b><span>애매해요</span></div>
          <div className="fin-cell no"><b>{t.unknown || 0}</b><span>몰라요</span></div>
        </div>

        <p className="fin-lines">
          <span>{deck.label} · {finished.done}번 봤어요 · 약 {finished.minutes}분</span>
          {finished.carried > 0 && <span>남은 {finished.carried}장은 내일 복습 큐에서 만나요</span>}
          {deck.intro ? <span>오늘 목표 {deck.intro.total}장</span> : null}
        </p>

        {/* 끝날 때마다 홈으로 돌려보내면 매번 「다음에 뭐 하지」를 다시 정해야 한다.
            그날의 다음 순서를 알고 있으면 그걸 먼저 내민다. */}
        {onNext && deck.next ? (
          <>
            <button className="submit-btn" onClick={onNext}>
              다음: {deck.next.label}
            </button>
            <button className="ghost-btn" onClick={onHome || onClose}>홈으로</button>
          </>
        ) : (
          <button className="submit-btn" onClick={onHome || onClose}>홈으로</button>
        )}
        {onUndo && (
          <button className="ghost-btn" onClick={onUndo}>↩ 마지막 판정 되돌리기</button>
        )}
      </div>
    </div>
  );
}
