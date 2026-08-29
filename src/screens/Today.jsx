import { useMemo } from 'react';
import {
  IconFlame, IconChevron, IconRepeat, IconPlay, IconBook, IconGrid,
} from '../components/Icons.jsx';
import { todayKey } from '../lib/review.js';
import { planToday } from '../lib/daily.js';

/* 오늘 화면.
 *
 * 앱을 켠 사람이 3초 안에 알아야 하는 건 두 가지다.
 *   오늘 얼마나 남았나 · 어디를 누르나
 *
 * 그래서 할 일을 셋으로만 둔다 — 단어 외우기 · 복습하기 · 문법 배우기.
 * 예전에는 「오늘의 학습 시작」 버튼 하나였다. 그러면 복습만 하고 싶은 날에도
 * 신규가 섞여 나왔고, 그게 싫으면 학습 탭에 들어가 메뉴를 골라야 했다.
 * 셋으로 갈라 두면 오늘 화면 안에서 끝난다.
 *
 * 메뉴 바둑판은 여기 두지 않는다. 고르는 일은 학습 탭이 한다 — 오늘 화면이
 * 「고를 것 목록」이 되는 순간 3초가 30초가 된다. */

const HELLO = [
  '오늘도 조금씩 쌓아볼까요?',
  '가볍게 한 판 어때요?',
  '오늘 몫만 하면 돼요.',
];

/* 할 일 한 줄. 셋 다 같은 모양이라 눈이 한 번에 훑는다 —
   모양이 제각각이면 매번 다시 읽게 된다. */
function Task({ icon, title, sub, count, unit, done, onClick, primary }) {
  return (
    <button className={`tdtask${done ? ' done' : ''}${primary ? ' primary' : ''}`} onClick={onClick}>
      <span className="tt-icon">{icon}</span>
      <span className="tt-body">
        <b>{title}</b>
        <span>{sub}</span>
      </span>
      {done
        ? <span className="tt-done">다 했어요</span>
        : <span className="tt-count"><b>{count}</b>{unit}</span>}
      <IconChevron className="chev" />
    </button>
  );
}

export default function Today({
  pool, review, settings, stats, streak, session, resumeLabel, grammarLeft,
  onStartWords, onStartReview, onOpenGrammar, onResume, onOpenReview,
}) {
  const today = todayKey();
  const doneToday = stats[today]?.studied || 0;

  /* 갈래마다 따로 센다. 「복습하기」 줄에 신규 개수가 섞여 뜨면 눌러 보고
     나서야 뭐가 나오는지 알게 된다. */
  const fresh = useMemo(
    () => planToday(pool, review, { goals: settings.goals, lanes: ['fresh'], today }),
    [pool, review, settings.goals, today],
  );
  const back = useMemo(
    () => planToday(pool, review, { goals: settings.goals, lanes: ['review', 'weak'], today }),
    [pool, review, settings.goals, today],
  );

  const hello = HELLO[(streak.count || 0) % HELLO.length];
  const backTotal = back.review + back.weak;
  const goalTotal = (settings.goals?.fresh || 0) + (settings.goals?.review || 0) + (settings.goals?.weak || 0);
  const pct = goalTotal ? Math.min(100, (doneToday / goalTotal) * 100) : 0;

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

      {/* 오늘 얼마나 했는지 — 숫자 한 줄이면 된다 */}
      <div className="today">
        <div className="td-head">
          <span className="td-label">오늘 한 것</span>
          <span className="td-count"><b>{doneToday}</b> / {goalTotal}</span>
        </div>
        <div className="td-bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="td-mix">
          <div className="td-cell">
            <b>{fresh.fresh}</b>
            <span>새 단어</span>
          </div>
          <div className="td-cell">
            <b>{back.review}</b>
            <span>복습</span>
          </div>
          <div className="td-cell">
            <b>{back.weak}</b>
            <span>약점</span>
          </div>
        </div>
      </div>

      {/* 하다 만 게 있으면 그게 먼저다 */}
      {session?.date === today && session.queue?.length > 0 && (
        <button className="rowcard" onClick={onResume}>
          <span className="rc-icon"><IconPlay /></span>
          <span className="rc-body">
            <b>이어하기</b>
            <span>{resumeLabel || '학습'} · {session.round}회독 · 남은 {session.queue.length}개</span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}

      <div className="section-label">오늘 할 것</div>
      <div className="tdtasks">
        <Task
          primary
          icon={<IconBook />}
          title="단어 외우기"
          sub={fresh.fresh > 0 ? `새 단어 ${fresh.fresh}개 · 약 ${fresh.minutes}분` : '오늘 몫을 다 했어요'}
          count={fresh.fresh}
          unit="개"
          done={fresh.fresh === 0}
          onClick={onStartWords}
        />
        <Task
          icon={<IconRepeat />}
          title="복습하기"
          sub={backTotal > 0
            ? `복습 ${back.review} · 약점 ${back.weak} · 약 ${back.minutes}분`
            : '오늘 복습할 게 없어요'}
          count={backTotal}
          unit="개"
          done={backTotal === 0}
          onClick={onStartReview}
        />
        <Task
          icon={<IconGrid />}
          title="문법 배우기"
          sub={grammarLeft > 0 ? `아직 안 본 것 ${grammarLeft}개 · 짧은 테스트까지` : '문법을 한 바퀴 돌았어요'}
          count={grammarLeft}
          unit="개"
          done={grammarLeft === 0}
          onClick={onOpenGrammar}
        />
      </div>

      {/* 오늘 큐에 다 못 담은 복습이 있으면 알려 준다 — 조용히 밀어 두지 않는다 */}
      {back.left.review + back.left.weak > 0 && (
        <button className="rowcard" onClick={onOpenReview}>
          <span className="rc-icon"><IconRepeat /></span>
          <span className="rc-body">
            <b>복습이 더 남았어요</b>
            <span>
              {back.left.review > 0 && `오늘 안 담은 복습 ${back.left.review}개`}
              {back.left.review > 0 && back.left.weak > 0 && ' · '}
              {back.left.weak > 0 && `약점 ${back.left.weak}개`}
            </span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}
    </>
  );
}
