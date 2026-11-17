import { IconArrowLeft } from '../../components/Icons.jsx';
import SoundToggle from '../../components/SoundToggle.jsx';

/* 회독 화면의 머리 — 닫기 · 몇 장째 · 되돌리기 · 진행 막대 · 남은 수와 회독.
   Study.jsx(700줄)에서 떼어 냈다. 동작은 그대로다. */
const ROUND_LABEL = (round) => (round === 1 ? '1회독 (전체)' : `${round}회독 (틀린 것만 복습)`);

export default function StudyHeader({ session, deck, onClose, onUndo, hasKeyboard, sound = true, onSound, onToast }) {
  /* ★ 숫자는 이번 회독 안에서 센다 ★ (2026-11-17 QA B06) 전에는 판정한 횟수 전체(done)를 고른 장수(total)로 나눠서,
     몰라요 카드가 2회독에 다시 나오면 「오늘 학습 21 / 20」처럼 넘쳤다. 이번 회독의 장수 중 몇 장째인가로 보여 주고,
     2회독부터는 회독 이름이 「틀린 것만 복습」이라고 같이 말한다 */
  const roundTotal = session.round > 1 && Array.isArray(session.roundIds) ? session.roundIds.length : (session.total || 0);
  const roundDone = Math.max(0, Math.min(roundTotal, roundTotal - session.queue.length));
  const pct = roundTotal ? Math.min(100, Math.round((roundDone / roundTotal) * 100)) : 0;
  return (
    <div className="studyhead">
      <div className="sh-row">
        <button className="sh-close" onClick={onClose} aria-label="학습 종료"><IconArrowLeft /></button>
        <div className="sh-title">{deck.label} {roundDone} / {roundTotal}</div>
        <button className="sh-undo" onClick={onUndo} disabled={!onUndo}>
          ↩ 되돌리기{hasKeyboard && <kbd className="inline-key">←</kbd>}
        </button>
      </div>
      <div className="sh-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="sh-sub">
        <span className="sh-left">남은 {session.queue.length}개 <span className="sep">|</span> {ROUND_LABEL(session.round)}</span>
        {/* 소리를 낼 수 없는 자리에서는 눈으로만 — 듣기 단추를 눌러야만 소리가 난다 */}
        {onSound && <SoundToggle on={sound} onChange={onSound} onToast={onToast} />}
      </div>
    </div>
  );
}
