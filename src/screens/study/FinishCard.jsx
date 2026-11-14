import HunterTutor from '../../components/HunterTutor.jsx';

/* 완주 화면에서 가장 큰 단추가 하는 일 — Enter도 같은 일을 한다(Study.jsx의 단축키가 이것을 부른다).
   다음 단계가 있으면 그리로, 없으면 「10개 더」(끝까지 마쳤을 때만), 그것도 없으면 오늘 화면으로 */
export function finishPrimary({ finished, deck, onNext, flowNext, onMore, onHome, onClose }) {
  const next = flowNext !== undefined ? flowNext : deck?.next;
  if (onNext && next) return onNext;
  if (onMore && finished?.reason === 'clear') return onMore;
  return onHome || onClose;
}

/* 완주 카드 — 몇 장 끝냈나 · 판정 셋 · 다음으로.
   Study.jsx에서 떼어 냈다. 동작은 그대로다. */
export default function FinishCard({ finished, deck, settings, onClose, onHome, onNext, onUndo, flowNext, onMore: onMoreAll, hasKeyboard = false }) {
  /* 「10개 더」는 끝까지 마쳤을 때만 — 오늘은 여기까지 하고 나온 자리에서는 안 낸다 */
  const onMore = finished.reason === 'clear' ? onMoreAll : null;
  /* 하루 흐름이 다음 단계를 정해 주면(flowNext) 그걸 쓴다. null이면 이을 게 없다는 말이고,
     안 넘겼으면(undefined) 예전처럼 덱이 정한 다음을 쓴다. */
  const next = flowNext !== undefined ? flowNext : deck.next;
  const t = finished.tally || {};
  const known = (t.known || 0) + (t.master || 0);
  return (
    <div className="study">
      <div className="finish">
        <div className="fin-badge">🎉</div>
        <h2>{finished.reason === 'clear' ? '오늘 회독 완주!' : '오늘은 여기까지'}</h2>
        <HunterTutor guide={settings.hunterGuide || 'gon'} scene="island" mood={finished.reason === 'clear' ? 'celebrate' : 'encourage'} title="함께한 수련 기록" line={`${finished.cleared} / ${finished.total}장을 마쳤어요. 아래 판정과 다음 학습을 확인해 봐요.`} compact />

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
        {onNext && next ? (
          <>
            <button className="submit-btn fin-next" onClick={onNext}>
              다음: {next.label}{hasKeyboard && <kbd className="inline-key">Enter</kbd>}
            </button>
            {onMore && <button className="ghost-btn fin-more" onClick={onMore}>10개 더 배우기</button>}
            <button className="ghost-btn" onClick={onHome || onClose}>오늘로</button>
          </>
        ) : (
          <>
            {onMore && <button className="submit-btn fin-more" onClick={onMore}>10개 더 배우기{hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>}
            <button className={onMore ? 'ghost-btn' : 'submit-btn fin-home'} onClick={onHome || onClose}>오늘로{!onMore && hasKeyboard && <kbd className="inline-key">Enter</kbd>}</button>
          </>
        )}
        {onUndo && (
          <button className="ghost-btn fin-undo" onClick={onUndo}>↩ 마지막 판정 되돌리기{hasKeyboard && <kbd className="inline-key">←</kbd>}</button>
        )}
      </div>
    </div>
  );
}
