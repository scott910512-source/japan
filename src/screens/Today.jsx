import { useMemo } from 'react';
import { IconFlame, IconChevron, IconRepeat, IconPlay } from '../components/Icons.jsx';
import { todayKey } from '../lib/review.js';
import { planToday } from '../lib/daily.js';

/* 오늘 화면.
 *
 * 앱을 켠 사람이 3초 안에 알아야 하는 건 세 가지뿐이다.
 *   오늘 몇 개인가 · 얼마나 걸리는가 · 어디를 누르는가
 * 그래서 이 화면에는 그 셋만 크게 둔다. 메뉴는 학습 탭에 있다. */

const HELLO = [
  '오늘도 조금씩 쌓아볼까요?',
  '가볍게 한 판 어때요?',
  '오늘 몫만 하면 돼요.',
];

export default function Today({
  pool, review, settings, stats, streak, session, resumeLabel,
  onStart, onResume, onOpenReview,
}) {
  const goal = settings.dailyGoal || 20;
  const today = todayKey();
  const doneToday = stats[today]?.studied || 0;

  const plan = useMemo(
    () => planToday(pool, review, { goal, today }),
    [pool, review, goal, today],
  );

  /* 오늘 목표를 이미 채웠는지. 채웠다고 더 못 하게 막지는 않는다 —
     더 하고 싶은 사람을 막는 건 이 앱이 할 일이 아니다. */
  const met = doneToday >= goal;
  const pct = Math.min(100, goal ? (doneToday / goal) * 100 : 0);
  const hello = HELLO[(streak.count || 0) % HELLO.length];

  const nothing = plan.total === 0;

  return (
    <>
      <div className="navtitle">
        <small>JS일본어</small>
        {hello}
      </div>

      {streak.count > 0 && (
        <div className="streakline">
          <IconFlame />
          <b>{streak.count}일째</b>
          <span>이어서 하고 있어요</span>
        </div>
      )}

      <div className="today">
        <div className="td-head">
          <span className="td-label">오늘의 학습</span>
          <span className="td-count"><b>{doneToday}</b> / {goal}</span>
        </div>
        <div className="td-bar"><i style={{ width: `${pct}%` }} /></div>

        {nothing ? (
          /* 다 봤을 때 화면이 비면 고장 난 것처럼 보인다 */
          <p className="td-empty">
            {met
              ? '오늘 몫을 다 했어요. 더 하고 싶으면 학습 탭에서 골라서 하면 돼요.'
              : '지금 볼 게 없어요. 설정에서 학습할 레벨을 넓히거나, 학습 탭에서 골라 보세요.'}
          </p>
        ) : (
          <>
            {/* 이 세 숫자는 오늘 담은 것의 구성이지 내가 가진 양이 아니다.
                예전엔 여기 「약점」과 여덟 픽셀 아래 「약점 N개」가 같은 낱말로
                다른 수를 말했다 — 그러면 둘 다 못 믿는다. */}
            <div className="td-mixcap">오늘 담은 {plan.total}개</div>
            <div className="td-mix">
              <div className="td-cell">
                <b>{plan.review}</b>
                <span>복습</span>
              </div>
              <div className="td-cell">
                <b>{plan.weak}</b>
                <span>약점</span>
              </div>
              <div className="td-cell">
                <b>{plan.fresh}</b>
                <span>신규</span>
              </div>
            </div>
            <div className="td-time">
              {plan.words > 0 && plan.sentences > 0
                ? `단어 ${plan.words} · 문장 ${plan.sentences} · 약 ${plan.minutes}분`
                : `${plan.total}개 · 약 ${plan.minutes}분`}
            </div>
            <button className="bigstart td-go" onClick={onStart}>
              <span className="bs-t"><IconPlay /> {met ? '한 판 더 하기' : '오늘의 학습 시작'}</span>
              <span className="bs-s">{plan.total}개 · 약 {plan.minutes}분</span>
            </button>
          </>
        )}
      </div>

      {/* 하다 만 게 있으면 그게 먼저다 */}
      {session?.date === today && session.queue?.length > 0 && (
        <button className="rowcard" onClick={onResume}>
          <span className="rc-body">
            <b>이어하기</b>
            <span>{resumeLabel || '학습'} · {session.round}회독 · 남은 {session.queue.length}개</span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}

      {/* 오늘 큐에 다 못 담은 복습이 있으면 알려 준다 — 조용히 밀어 두지 않는다 */}
      {plan.left.review + plan.left.weak > 0 && (
        <button className="rowcard" onClick={onOpenReview}>
          <span className="rc-icon"><IconRepeat /></span>
          <span className="rc-body">
            <b>복습이 더 남았어요</b>
            <span>
              {plan.left.review > 0 && `오늘 안 담은 복습 ${plan.left.review}개`}
              {plan.left.review > 0 && plan.left.weak > 0 && ' · '}
              {plan.left.weak > 0 && `약점 ${plan.left.weak}개`}
            </span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}
    </>
  );
}
