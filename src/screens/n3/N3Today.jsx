import { IconArrowLeft, IconCheck, IconChevron } from '../../components/Icons.jsx';
import { STEP_LABEL, STEP_MINUTES, lessonTitle, dayStatus } from '../../lib/n3.js';

/* 오늘의 N3 — 앱이 짠 다섯 단계를 차례로. 「뭘 공부하지」를 안 정하게 하려고
   만든 자리라 여기서는 순서만 보여 주고, 큰 버튼 하나가 다음 단계를 연다. */
export default function N3Today({ day, today, onRun, onBack, onRebuild }) {
  const steps = day?.steps || [];
  const st = dayStatus(day);
  const note = (s) => {
    if (s.kind === 'vocab') return `${lessonTitle(s.lesson)} · 새 단어 ${s.ids.length}개`;
    if (s.kind === 'kanji') return `${lessonTitle(s.lesson)} · 새 한자 ${s.ids.length}자`;
    if (s.kind === 'review') return `복습일이 된 것 ${s.ids.length}개`;
    return lessonTitle(s.lesson);
  };
  return (
    <div className="n3-today">
      <div className="sub-header inline">
        <button className="sub-back" onClick={onBack}><IconArrowLeft /> 코스로</button>
        <div className="sub-title">오늘의 N3 · {today || ''}</div>
      </div>

      {steps.length === 0 && (
        <div className="empty-state">
          오늘 할 게 없어요 — 코스를 다 돌았거나 복습할 게 없는 날이에요.
          <div style={{ marginTop: 10 }}><button className="ghost-btn" onClick={onRebuild}>다시 짜기</button></div>
        </div>
      )}

      {st.finished && (
        <div className="td-done n3-daydone">
          <b>오늘의 N3 완료</b>
          <span>{steps.length}단계를 다 했어요. 내일은 오늘 틀린 것과 복습일이 된 것이 먼저 나와요.</span>
        </div>
      )}

      {!st.finished && steps.length > 0 && (
        <button className="bigcta n3-runnext" onClick={() => onRun(st.next)}>
          <span className="bc-body">
            <b>{st.done === 0 ? '시작' : '이어서'} — {STEP_LABEL[steps[st.next].kind]}</b>
            <span>{note(steps[st.next])} · 남은 {st.left}단계 약 {st.minutes}분</span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}

      <div className="section-label">오늘 순서</div>
      <div className="tdtasks n3-stepslist">
        {steps.map((s, i) => (
          <button key={i} className={`tdtask n3-steprow${s.done ? ' done' : ''}${i === st.next ? ' primary' : ''}`} data-step={s.kind} data-done={s.done ? '1' : '0'} onClick={() => onRun(i)}>
            <span className="tt-icon">{s.done ? <IconCheck /> : <span className="n3-stepno">{i + 1}</span>}</span>
            <span className="tt-body"><b>{STEP_LABEL[s.kind]}</b><span className="tt-note">{note(s)}</span></span>
            {s.done ? <span className="tt-done">다 했어요</span> : <span className="tt-count"><b>{STEP_MINUTES[s.kind]}</b>분</span>}
            <IconChevron className="chev" />
          </button>
        ))}
      </div>
      <p className="set-note">한 번에 새 문법은 하나만 나와요. 다 하면 「10개 더」 대신 전체 과정에서 골라서 더 할 수 있어요.</p>
    </div>
  );
}
