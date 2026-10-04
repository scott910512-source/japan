import { IconRepeat, IconChevron, IconFlame, IconX, IconGrid, IconChat, IconBook } from '../components/Icons.jsx';
import { reviewLeftOf } from '../lib/plan.js';

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
  planNow, sentenceDue, weakWords, wrongCount, weakGrammar, weakBook = null, weakRows = [],
  onStartReview, onStartBacklog, onOpenSentences, onOpenWrong, onOpenWeakWords, onOpenWeakGrammar, onOpenRepeat,
}) {
  /* 홈·배지와 같은 함수 — 여기서 따로 세지 않는다 */
  const { left, assigned, done, backlog, review: reviewLeft, weak: weakLeft } = reviewLeftOf(planNow);

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

      {/* ★ 약점 장부 ★
          「약점 12개」만 보여 주면 무엇을 할지가 안 정해진다. 시험에서 틀리는
          낱말과 쉰 번 들었는데 안 붙는 낱말은 다음에 할 일이 다르다.
          그리고 「금방 잊는지」는 횟수로는 안 나온다 — 어제 외운 게 오늘
          무너진 낱말이 제일 위험한데, 틀린 횟수는 한 번일 수 있다.
          세는 자리는 lib/weak.js 한 군데다. */}
      {weakRows.length > 0 && (
        <>
          <div className="section-label">약점 장부</div>
          <div className="card wb-card">
            <div className="wb-sum">
              {[
                weakBook?.quizWrong ? `시험 오답 ${weakBook.quizWrong}번` : null,
                weakBook?.forgot ? `외웠다가 다시 틀림 ${weakBook.forgot}번` : null,
                weakBook?.fast ? `금방 잊는 낱말 ${weakBook.fast}개` : null,
                weakBook?.stuck ? `듣다 안 뗀 낱말 ${weakBook.stuck}개` : null,
              ].filter(Boolean).join(' · ') || '회독에서 틀린 것만 모여 있어요'}
            </div>
            <div className="wb-list">
              {weakRows.map((w) => (
                <div key={w.id} className="wb-row" data-weak={w.id}>
                  <span className="wb-w">
                    <b>{w.kanji}</b>
                    <small>{w.kana}{w.mean ? ` · ${w.mean}` : ''}</small>
                  </span>
                  <span className="wb-why">
                    {w.speed && <i className="wb-fast">{w.speed}</i>}
                    {/* 까닭 하나는 한 덩어리다 — 「애매해요 1 / 번」처럼 숫자와
                        단위 사이에서 줄이 꺾이면 읽다가 멈춘다 */}
                    <span>
                      {w.reasons.map((r, i) => (
                        <span key={r} className="wb-reason">{i > 0 && ' · '}{r}</span>
                      ))}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <button className="ghost-btn wb-start" onClick={onOpenWeakWords}>
              {weakWords > weakRows.length
                ? `약한 것부터 ${weakWords}개 외우기`
                : `${weakWords}개 외우기`}
            </button>
            <p className="set-note wb-note">
              시험·듣기는 복습 간격을 안 바꿔요. 맞고 틀린 것만 여기 쌓여서,
              오늘 학습의 약점 갈래와 「약점」 범위가 이 순서를 봐요.
            </p>
          </div>
        </>
      )}

      <div className="section-label">더 보기</div>
      <div className="card rv-list">
        {/* 0이면 누를 것이 없다 — 취약 단어처럼 흐리게, 설명은 「아직 없어요」로 */}
        <button className="listrow rv-row" data-row="wrong" onClick={onOpenWrong} disabled={wrongCount === 0}>
          <span className="rv-ic"><IconX /></span>
          <span className="rv-body"><b>틀린 문제</b><span>{wrongCount ? 'N3 코스 오답노트 · 두 번 맞히면 빠져요' : '아직 없어요 — N3 문제를 풀면 여기 모여요'}</span></span>
          <span className="rv-cnt">{wrongCount}</span>
          <IconChevron className="chev" />
        </button>
        <button className="listrow rv-row" data-row="weak-words" onClick={onOpenWeakWords} disabled={weakWords === 0}>
          <span className="rv-ic"><IconFlame /></span>
          <span className="rv-body"><b>취약 단어</b><span>{weakWords ? '회독·시험에서 틀린 것이 쌓인 단어 — 약한 것부터' : '아직 없어요 — 잘하고 있어요'}</span></span>
          <span className="rv-cnt">{weakWords}</span>
          <IconChevron className="chev" />
        </button>
        <button className="listrow rv-row" data-row="weak-grammar" onClick={onOpenWeakGrammar} disabled={weakGrammar === 0}>
          <span className="rv-ic"><IconGrid /></span>
          <span className="rv-body"><b>취약 문법</b><span>{weakGrammar ? '두 번 넘게 틀린 문법 꼭지' : '아직 없어요 — 같은 꼭지를 두 번 넘게 틀리면 여기 모여요'}</span></span>
          <span className="rv-cnt">{weakGrammar}</span>
          <IconChevron className="chev" />
        </button>
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
    </>
  );
}
