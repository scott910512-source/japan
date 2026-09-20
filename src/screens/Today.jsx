import {
  IconFlame, IconChevron, IconRepeat, IconPlay, IconBook, IconGrid, IconChart, IconCheck,
} from '../components/Icons.jsx';
import { todayKey } from '../lib/review.js';
import { tripLabel } from '../lib/purpose.js';
import { reviewLeftOf } from '../lib/plan.js';

/* 홈 — 앱에서 제일 중요한 자리.
 *
 * 대시보드가 아니다. 「오늘 공부를 시작하는 화면」이다. 앱을 켠 사람이 3초 안에
 * 알아야 하는 건 두 가지다 — 얼마나 남았나 · 어디를 누르나.
 *
 * 정보의 차례를 지킨다.
 *   1 오늘 학습 시작 (큰 버튼 하나. 하던 게 있으면 이어하기)
 *   2 오늘 복습
 *   3 이어서 공부하기 (N3 코스)
 *   4 오늘 진행 상태 (짧은 목록)
 *   5 N3 진도 (머리 밑 한 줄)
 * 그 밖의 통계는 내 학습 탭에 있다. 여기 두면 고르러 왔다가 읽고 나간다.
 *
 * ★ 숫자는 한 곳에서만 나온다 ★ 배정·완료·남은 시간은 오늘의 계획(plan) 하나를
 * 본다. 화면이 따로 세면 「새 단어 2개」인데 들어가면 「볼 게 없어요」가 된다. */

const HELLO = [
  '오늘도 조금씩 쌓아볼까요?',
  '가볍게 한 판 어때요?',
  '오늘 몫만 하면 돼요.',
];

export default function Today({
  plan, planNow, settings, streak, session, resumeLabel,
  grammarLeft, grammarNext, onOpenN3, n3,
  onStartAll, onStartWords, onStartReview, onOpenGrammar, onResume, onOpenReview, onLearnMore,
}) {
  const today = todayKey();

  /* N3 코스 — 요약(코스가 열릴 때 적어 둔 것)과 오늘 몫 */
  const summary = n3?.summary || null;
  const n3Steps = n3?.days?.[today]?.steps || [];
  const n3Left = n3Steps.filter((s) => !s.done).length;
  const n3Note = summary
    ? `${summary.done} / ${summary.total} 레슨${n3Steps.length ? ` · 오늘 ${n3Left === 0 ? '다 했어요' : `${n3Left}단계 남음`}` : ''}`
    : '어휘 → 한자 → 문법 → 독해/청해 → 복습 · 약 25분';

  const lanes = planNow?.lanes || {};
  /* 복습 수는 복습 탭·배지와 같은 함수에서 — 여기서 따로 세지 않는다 */
  const back = reviewLeftOf(planNow);
  const backLane = { assigned: back.assigned, done: back.done };
  const backLeft = back.left;
  const freshLane = { assigned: lanes.fresh?.assigned || 0, done: lanes.fresh?.done || 0 };
  const freshLeft = Math.max(0, freshLane.assigned - freshLane.done);

  /* 「새로 배우기」에 무엇이 몇 개인지. 있는 것만 적는다. */
  const freshMix = (() => {
    const left = (plan?.assigned || []).filter((x) => x.bucket === 'fresh' && !plan.done[x.id]);
    const w = left.filter((x) => x.kind !== 'sentence').length;
    const s = left.length - w;
    if (w && s) return `단어 ${w} · 문장 ${s}`;
    if (s) return `문장 ${s}개`;
    return `단어 ${w}개`;
  })();

  const hello = HELLO[(streak.count || 0) % HELLO.length];
  const resuming = session?.date === today && session.queue?.length > 0;
  const allDone = Boolean(planNow?.finished);
  const backlog = back.backlog;
  const trip = tripLabel(settings, today);

  return (
    <>
      {/* 머리는 한 줄로. 여기에 장식을 얹으면 정작 눌러야 할 것이 아래로 밀린다 */}
      <div className="tdhead">
        <div className="th-body">
          <small>JS일본어</small>
          <b>{hello}</b>
        </div>
        {streak.count > 0 && (
          <span className="th-streak"><IconFlame />{streak.count}일</span>
        )}
      </div>
      {trip && <div className="td-trip">{trip}</div>}

      {/* N3가 이 앱의 목표다 — 머리 밑에 한 줄. 열어 봤다고 오르지 않는다.
          준비도는 실제로 맞힌 결과에서만 나온다(코스가 적어 둔 요약). */}
      {/* 보기만 한다 — 코스로 들어가는 길은 아래 「이어서 공부하기」와 학습 탭,
          둘이면 된다. 입구가 넷이면 어느 것이 맞는 길인지 매번 고르게 된다. */}
      {onOpenN3 && (
        <div className="hm-goal" data-ready={summary ? summary.ready : ''}>
          <span className="hg-lab">JLPT N3</span>
          <span className="hg-bar"><i style={{ width: `${summary ? summary.ready : 0}%` }} /></span>
          <b className="hg-pct">{summary ? `${summary.ready}%` : '시작 전'}</b>
        </div>
      )}

      {/* ★ 누를 것은 하나 ★ 하던 게 있으면 이어하기, 없으면 오늘 학습 시작.
          갈래를 안 주니 배정된 것을 순서대로 다 돈다 — 복습이 없는 날은 저절로
          새로 배우기부터 시작한다. */}
      {!allDone && (
        <button className="bigcta" onClick={resuming ? onResume : onStartAll}>
          <span className="bc-icon"><IconPlay /></span>
          <span className="bc-body">
            <b>{resuming ? '이어하기' : '오늘 학습 시작'}</b>
            <span>
              {resuming
                ? `${resumeLabel || '학습'} · ${session.round}회독 · ${session.queue.length}개 남음`
                : (planNow?.assigned > 0
                  ? `약 ${planNow?.minutes || 0}분 · ${planNow?.left || 0}개`
                  : '오늘 배정된 게 없어요 — 학습 탭에서 골라 보세요')}
            </span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}

      {/* ★ 계획을 다 하면 거기서 끝이다 ★ 더 하고 싶으면 명시적으로 늘린다. */}
      {allDone && (
        <div className="td-done">
          <b>오늘 학습 완료</b>
          <span>오늘 정한 {planNow.assigned}개를 마쳤어요. 내일 복습으로 다시 만나요.</span>
          <button className="ghost-btn td-more" onClick={() => onLearnMore(10)}>
            10개 더 배우기
          </button>
        </div>
      )}

      {/* 이어서 공부하기 — 하던 코스로 바로. N3 코스 전용이다.
          「오늘 복습」 카드도 여기 있었는데 바로 아래 「오늘」 목록의 복습 줄과
          같은 숫자·같은 글자였다 — 같은 것을 두 번 읽게 하면 3초가 30초가 된다.
          복습은 「오늘」 목록에서만 보여 준다. */}
      {onOpenN3 && (
        <>
          <div className="section-label">이어서 공부하기</div>
          <div className="tdtasks hm-cont">
            <button className="tdtask hm-n3" onClick={onOpenN3}>
              <span className="tt-icon"><IconChart /></span>
              <span className="tt-body">
                <b>한 권으로 끝내는 N3</b>
                <span className="tt-note">{n3Note}</span>
              </span>
              <span className="tt-go">{summary ? '계속하기' : '시작'}</span>
              <IconChevron className="chev" />
            </button>
          </div>
        </>
      )}

      {/* 오늘 — 무엇이 몇 개인지 짧게. 항목마다 큰 카드를 만들지 않는다 */}
      {(freshLane.assigned > 0 || backLane.assigned > 0 || n3Steps.length > 0 || grammarLeft >= 0) && (
        <>
          <div className="section-label">오늘</div>
          <div className="tdlist">
            {/* 순서는 복습 → 새로 배우기. 이미 본 걸 안 잃는 것이 새로 배우는 것보다
                앞선다 — 큰 버튼이 짜는 큐도 이 순서다. */}
            {backLane.assigned > 0 && (
              <button className={`tdtask slim${backLeft === 0 ? ' done' : ''}`} onClick={onStartReview}>
                <span className="tt-icon"><IconRepeat /></span>
                <span className="tt-body"><b>복습</b><span className="tt-note">{backLeft === 0 ? `${backLane.assigned}개 다 했어요` : `복습 ${(lanes.review?.assigned || 0) - (lanes.review?.done || 0)} · 약점 ${(lanes.weak?.assigned || 0) - (lanes.weak?.done || 0)}`}</span></span>
                {backLeft === 0 ? <span className="tt-done"><IconCheck /></span> : <span className="tt-count"><b>{backLeft}</b>개</span>}
              </button>
            )}
            {/* 오늘 큐에 다 못 담은 복습 — 조용히 밀어 두지 않는다. 오늘 몫을 다 한
                뒤에만 한 줄로. 숫자는 복습 탭 안에서 다시 말한다. */}
            {backLeft === 0 && backlog > 0 && (
              <button className="tdtask slim hm-backlog" onClick={onOpenReview}>
                <span className="tt-icon"><IconRepeat /></span>
                <span className="tt-body"><b>{backLane.assigned > 0 ? '더 복습할 수도 있어요' : '밀린 복습'}</b><span className="tt-note">오늘 안 담은 복습 {backlog}개 · 복습 탭에서</span></span>
                <IconChevron className="chev" />
              </button>
            )}
            {freshLane.assigned > 0 && (
              <button className={`tdtask slim${freshLeft === 0 ? ' done' : ''}`} onClick={onStartWords}>
                <span className="tt-icon"><IconBook /></span>
                <span className="tt-body"><b>새로 배우기</b><span className="tt-note">{freshLeft === 0 ? `${freshLane.assigned}개 다 했어요` : freshMix}</span></span>
                {freshLeft === 0 ? <span className="tt-done"><IconCheck /></span> : <span className="tt-count"><b>{freshLeft}</b>개</span>}
              </button>
            )}
            {n3Steps.length > 0 && onOpenN3 && (
              <button className={`tdtask slim${n3Left === 0 ? ' done' : ''}`} onClick={onOpenN3}>
                <span className="tt-icon"><IconChart /></span>
                <span className="tt-body"><b>오늘의 N3</b><span className="tt-note">{n3Left === 0 ? `${n3Steps.length}단계 다 했어요` : n3Steps.map((s) => s.kind).join(' → ').replace(/vocab/g, '어휘').replace(/kanji/g, '한자').replace(/grammar/g, '문법').replace(/reading/g, '독해').replace(/listening/g, '청해').replace(/review/g, '복습')}</span></span>
                {n3Left === 0 ? <span className="tt-done"><IconCheck /></span> : <span className="tt-count"><b>{n3Left}</b>단계</span>}
              </button>
            )}
            {/* 문법은 선택이다 — 안 해도 오늘 완료는 완료다 */}
            <button className={`tdtask slim${grammarLeft === 0 ? ' done' : ''}`} onClick={onOpenGrammar}>
              <span className="tt-icon"><IconGrid /></span>
              <span className="tt-body"><b>오늘의 문법</b><span className="tt-note">{grammarLeft > 0 ? (grammarNext || `아직 안 본 것 ${grammarLeft}개`) : '한 바퀴 돌았어요'} · 선택</span></span>
              {grammarLeft === 0 ? <span className="tt-done"><IconCheck /></span> : <span className="tt-count"><b>{grammarLeft}</b>개</span>}
            </button>
          </div>
        </>
      )}
    </>
  );
}
