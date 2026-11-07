import { useState } from 'react';
import { IconRepeat, IconChevron, IconChat, IconBook } from '../components/Icons.jsx';
import WrongBook from './WrongBook.jsx';
import WeakHub from './WeakHub.jsx';
import { reviewLeftOf } from '../lib/plan.js';
import { STAGES } from '../lib/rounds.js';

/* 복습 탭 — 복습으로 가는 길을 하나로.
 *
 * 여태 복습은 네 군데서 열렸다. 오늘 화면의 「복습」, 기록의 「복습으로 가기」,
 * 학습 탭의 「약점 복습」, 그리고 밀어 넣는 복습 화면. 같은 곳으로 가는 길이
 * 넷이면 어느 길이 맞는지 매번 고르게 된다. 이제 여기 하나다.
 *
 * ★ 숫자와 큐는 같은 것을 본다 ★
 * 「오늘 복습 18개」는 오늘의 계획(plan)의 복습·약점 갈래에서 남은 수이고,
 * 「복습 시작」은 바로 그 갈래로 큐를 짠다. 계획에 다 못 담은 것(밀린 복습)은
 * 따로 적는다 — 숫자는 있는데 들어가면 비어 있는 일이 없어야 한다.
 *
 * SRS 안쪽 구조(box·level·간격)는 여기서 말하지 않는다. 「오늘 복습해야 하는
 * 것」과 「틀린 것」만 있으면 쓸 수 있어야 한다. */
export default function ReviewHub({
  planNow, sentenceDue, weakWords = 0, weakGrammar = 0, wrongCount = 0, initialSection = 'today', wrongProps = {}, weakProps = {},
  onStartReview, onStartBacklog, onOpenSentences, onOpenRepeat,
}) {
  /* ★ 복습은 한 화면, 세 칸 ★ 오늘 복습 · 오답 다시 풀기 · 약점 집중. 홈의 오답 지름길도, 복습&내기록의 오답·약점 줄도 이 화면의 칸을 연다.
     칸마다 단위를 따로 적는다(오답은 문제, 단어·문법은 개) — 서로 다른 단위를 합치지 않는다. */
  const [section, setSection] = useState(initialSection);
  const SECTIONS = [
    { id: 'today', title: '오늘 복습', count: `${reviewLeftOf(planNow).left}개` },
    { id: 'wrong', title: '오답 다시 풀기', count: `${wrongCount}문제` },
    { id: 'weak', title: '약점 집중', count: `단어 ${weakWords} · 문법 ${weakGrammar}` },
  ];
  const moveTab = (e, i) => {
    const n = e.key === 'ArrowRight' ? (i + 1) % 3 : e.key === 'ArrowLeft' ? (i + 2) % 3 : null;
    if (n == null) return;
    e.preventDefault(); setSection(SECTIONS[n].id); document.getElementById(`rv-tab-${SECTIONS[n].id}`)?.focus();
  };
  /* 홈·배지와 같은 함수 — 여기서 따로 세지 않는다 */
  const { left, assigned, done, backlog, review: reviewLeft, weak: weakLeft } = reviewLeftOf(planNow);

  return (
    <>
      <div className="navtitle">
        <small>잊기 전에 다시</small>
        복습
      </div>
      <div className="rv-tabs" role="tablist" aria-label="복습 세 칸">
        {SECTIONS.map((x, i) => (
          <button key={x.id} id={`rv-tab-${x.id}`} role="tab" aria-selected={section === x.id} aria-controls={`rv-panel-${x.id}`} tabIndex={section === x.id ? 0 : -1}
            onClick={() => setSection(x.id)} onKeyDown={(e) => moveTab(e, i)} data-section={x.id}>
            <b>{x.title}</b><small>{x.count}</small>
          </button>
        ))}
      </div>

      {section === 'wrong' && <div id="rv-panel-wrong" role="tabpanel" aria-labelledby="rv-tab-wrong"><WrongBook {...wrongProps} /></div>}
      {section === 'weak' && <div id="rv-panel-weak" role="tabpanel" aria-labelledby="rv-tab-weak"><WeakHub {...weakProps} /></div>}
      {section === 'today' && <div id="rv-panel-today" role="tabpanel" aria-labelledby="rv-tab-today">

      {/* 맨 위 — 오늘 복습해야 하는 것 */}
      <div className="card rv-top" data-left={left} data-backlog={backlog}>
        {left > 0 && (
          <>
            <div className="rv-head">
              <span className="rv-lab">오늘 복습</span>
              <b className="rv-num">{left}<small>개</small></b>
            </div>
            <div className="rv-sub">복습일이 된 것 {reviewLeft} · 약점 {weakLeft}{done > 0 ? ` · 오늘 ${done}개 했어요` : ''}</div>
            <button className="submit-btn rv-start" onClick={onStartReview}>복습 시작</button>
          </>
        )}
        {left === 0 && assigned > 0 && (
          <>
            <div className="rv-head">
              <span className="rv-lab">오늘 복습</span>
              <b className="rv-num rv-ok">다 했어요</b>
            </div>
            <div className="rv-sub">오늘 몫 {assigned}개를 마쳤어요.{backlog > 0 ? ` 오늘 안 담은 복습이 ${backlog}개 더 있어요.` : ' 내일 복습으로 다시 만나요.'}</div>
            {backlog > 0 && <button className="ghost-btn rv-more" onClick={onStartBacklog}>밀린 복습 {backlog}개 더 하기</button>}
          </>
        )}
        {left === 0 && assigned === 0 && (
          <>
            <div className="rv-head">
              <span className="rv-lab">오늘 복습</span>
              <b className="rv-num rv-ok">{backlog > 0 ? `${backlog}개` : '없음'}</b>
            </div>
            <div className="rv-sub">
              {backlog > 0
                ? '오늘 계획에 안 담긴 복습이 있어요.'
                : '오늘 복습할 게 없어요. 새로 배우면 내일부터 여기에 쌓여요.'}
            </div>
            {backlog > 0 && <button className="submit-btn rv-start" onClick={onStartBacklog}>복습 시작</button>}
          </>
        )}
      </div>

      <div className="section-label">이어서 복습</div>
      <div className="card rv-list">
        <button className="listrow rv-row" data-row="sentences" onClick={onOpenSentences} disabled={sentenceDue === 0}>
          <span className="rv-ic"><IconChat /></span>
          <span className="rv-body"><b>문장 복습</b><span>{sentenceDue ? '복습일이 된 상황별 문장' : '아직 없어요 — 문장을 배우면 복습일에 여기 떠요'}</span></span>
          <span className="rv-cnt">{sentenceDue}</span>
          <IconChevron className="chev" />
        </button>
        <button className="listrow rv-row" data-row="repeat" onClick={onOpenRepeat}>
          <span className="rv-ic"><IconBook /></span>
          <span className="rv-body"><b>전체 복습</b><span>배운 것을 기억 단계별로 다시 — 회독 학습</span></span>
          <IconChevron className="chev" />
        </button>
      </div>
      <p className="set-note">
        <IconRepeat style={{ width: 12, height: 12, verticalAlign: '-2px' }} /> 복습 간격은 앱이 정해요 — 맞힐수록 1 · 3 · 7 · 30 · 90일로 벌어져요.
      </p>

      {/* 기억 단계 안내 — 이름은 rounds.js의 STAGES 하나만 본다(내 학습의 막대와 같은 말).
          단계별 개수는 내 학습에 있다. 여기는 「무슨 뜻인가」만 말한다. */}
      <details className="card rv-stages">
        <summary>기억 단계는 이렇게 올라가요</summary>
        <ol className="rv-stagelist">
          {STAGES.filter((s) => s.id !== 'self').map((s) => (
            <li key={s.id}><b>{s.label}</b><span>{s.sub}</span></li>
          ))}
        </ol>
        <p className="set-note">틀리면 확인 단계가 처음으로 돌아가요. 단계별 개수는 복습&내기록의 기억 수준에서 봐요.</p>
      </details>
      </div>}
    </>
  );
}
