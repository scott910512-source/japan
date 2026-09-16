import { IconRepeat, IconChevron, IconFlame, IconX, IconGrid, IconChat, IconBook } from '../components/Icons.jsx';

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
  planNow, sentenceDue, weakWords, wrongCount, weakGrammar,
  onStartReview, onStartBacklog, onOpenSentences, onOpenWrong, onOpenWeakWords, onOpenWeakGrammar, onOpenRepeat,
}) {
  const lanes = planNow?.lanes || {};
  const assigned = (lanes.review?.assigned || 0) + (lanes.weak?.assigned || 0);
  const done = (lanes.review?.done || 0) + (lanes.weak?.done || 0);
  const left = Math.max(0, assigned - done);
  const over = planNow?.over || {};
  const backlog = (over.review || 0) + (over.weak || 0);

  return (
    <>
      <div className="navtitle">
        <small>잊기 전에 다시</small>
        복습
      </div>

      {/* 맨 위 — 오늘 복습해야 하는 것 */}
      <div className="card rv-top" data-left={left} data-backlog={backlog}>
        {left > 0 && (
          <>
            <div className="rv-head">
              <span className="rv-lab">오늘 복습</span>
              <b className="rv-num">{left}<small>개</small></b>
            </div>
            <div className="rv-sub">복습일이 된 것 {(lanes.review?.assigned || 0) - (lanes.review?.done || 0)} · 약점 {(lanes.weak?.assigned || 0) - (lanes.weak?.done || 0)}{done > 0 ? ` · 오늘 ${done}개 했어요` : ''}</div>
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

      <div className="section-label">더 보기</div>
      <div className="card rv-list">
        <button className="listrow rv-row" data-row="wrong" onClick={onOpenWrong}>
          <span className="rv-ic"><IconX /></span>
          <span className="rv-body"><b>틀린 문제</b><span>N3 코스 오답노트 · 두 번 맞히면 빠져요</span></span>
          <span className="rv-cnt">{wrongCount}</span>
          <IconChevron className="chev" />
        </button>
        <button className="listrow rv-row" data-row="weak-words" onClick={onOpenWeakWords} disabled={weakWords === 0}>
          <span className="rv-ic"><IconFlame /></span>
          <span className="rv-body"><b>취약 단어</b><span>{weakWords ? '몰라요·애매해요가 3번 이상 쌓인 단어' : '아직 없어요 — 잘하고 있어요'}</span></span>
          <span className="rv-cnt">{weakWords}</span>
          <IconChevron className="chev" />
        </button>
        <button className="listrow rv-row" data-row="weak-grammar" onClick={onOpenWeakGrammar}>
          <span className="rv-ic"><IconGrid /></span>
          <span className="rv-body"><b>취약 문법</b><span>{weakGrammar ? '두 번 넘게 틀린 문법 꼭지' : 'N3 문제를 풀면 여기 모여요'}</span></span>
          <span className="rv-cnt">{weakGrammar}</span>
          <IconChevron className="chev" />
        </button>
        <button className="listrow rv-row" data-row="sentences" onClick={onOpenSentences}>
          <span className="rv-ic"><IconChat /></span>
          <span className="rv-body"><b>문장 복습</b><span>{sentenceDue ? '복습일이 된 상황별 문장' : '오늘 복습할 문장이 없어요'}</span></span>
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
    </>
  );
}
