import { IconArrowLeft } from '../../components/Icons.jsx';

/* 회독 화면의 머리 — 닫기 · 몇 장째 · 되돌리기 · 진행 막대 · 남은 수와 회독.
   Study.jsx(700줄)에서 떼어 냈다. 동작은 그대로다. */
const ROUND_LABEL = (round) => (round === 1 ? '1회독 (전체)' : `${round}회독 (틀린 것만 복습)`);

export default function StudyHeader({ session, deck, onClose, onUndo, hasKeyboard }) {
  const pct = session.total ? Math.min(100, Math.round((session.done / session.total) * 100)) : 0;
  return (
    <div className="studyhead">
      <div className="sh-row">
        <button className="sh-close" onClick={onClose} aria-label="학습 종료"><IconArrowLeft /></button>
        <div className="sh-title">{deck.label} {session.done} / {session.total}</div>
        <button className="sh-undo" onClick={onUndo} disabled={!onUndo}>
          ↩ 되돌리기{hasKeyboard && <kbd className="inline-key">←</kbd>}
        </button>
      </div>
      <div className="sh-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="sh-sub">
        남은 {session.queue.length}개 <span className="sep">|</span> {ROUND_LABEL(session.round)}
      </div>
    </div>
  );
}
