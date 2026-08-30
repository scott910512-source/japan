import { useMemo } from 'react';
import {
  IconFlame, IconChevron, IconRepeat, IconPlay, IconBook, IconGrid,
} from '../components/Icons.jsx';
import ProgressSummary from '../components/ProgressSummary.jsx';
import TodayTaskCard from '../components/TodayTaskCard.jsx';
import { todayKey } from '../lib/review.js';
import { planToday } from '../lib/daily.js';

/* 오늘 화면 — 앱에서 제일 중요한 자리.
 *
 * 앱을 켠 사람이 3초 안에 알아야 하는 건 두 가지다.
 *   오늘 얼마나 남았나 · 어디를 누르나
 *
 * 그래서 여기서는 정보를 많이 보여 주지 않는다. 위에 「얼마나 왔나 · 몇 분
 * 남았나」 한 덩이, 그다음 누를 것 셋. 갈래별 숫자를 위에도 적고 버튼에도
 * 적던 것을 없앴다 — 같은 것을 두 번 읽게 하면 3초가 30초가 된다.
 *
 * 누를 것은 셋을 넘기지 않는다. 넷째가 생기는 순간 이 화면은 「고를 것
 * 목록」이 되고, 고르는 일은 학습 탭이 할 일이다.
 *
 * 순서는 복습 → 새 단어 → 문법으로 고정한다. 이미 본 걸 안 잃는 것이 새로
 * 배우는 것보다 앞선다 — 새 단어를 스무 개 더 넣어도 어제 것이 새어 나가면
 * 제자리다. */

const HELLO = [
  '오늘도 조금씩 쌓아볼까요?',
  '가볍게 한 판 어때요?',
  '오늘 몫만 하면 돼요.',
];

export default function Today({
  pool, review, settings, stats, streak, session, resumeLabel,
  grammarLeft, grammarNext,
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
  const goals = settings.goals || {};
  const goalTotal = (goals.fresh || 0) + (goals.review || 0) + (goals.weak || 0);
  /* 남은 시간은 아직 안 한 것만 센다. 갈래 둘의 예상 시간을 그대로 더하면
     이미 끝낸 갈래 몫까지 남은 것처럼 보인다. */
  const leftMinutes = (backTotal > 0 ? back.minutes : 0) + (fresh.fresh > 0 ? fresh.minutes : 0);

  const resuming = session?.date === today && session.queue?.length > 0;

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

      <ProgressSummary done={doneToday} goal={goalTotal} minutes={leftMinutes} />

      {/* ★ 하다 만 게 있으면 그게 무조건 먼저다 ★
          다른 걸 누르면 「하던 학습을 접을까요?」가 뜨는데, 그 창을 만나기
          전에 이어하기가 먼저 눈에 들어와야 한다. */}
      {resuming && (
        <button className="rowcard resume" onClick={onResume}>
          <span className="rc-icon"><IconPlay /></span>
          <span className="rc-body">
            <b>이어하기</b>
            <span>{resumeLabel || '학습'} · {session.round}회독 · {session.queue.length}개 남음</span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}

      <div className="section-label">오늘 할 것</div>
      <div className="tdtasks">
        <TodayTaskCard
          primary
          icon={<IconRepeat />}
          title="복습하기"
          note={backTotal > 0
            ? `복습 ${back.review} · 약점 ${back.weak}`
            : '오늘 복습할 게 없어요'}
          minutes={back.minutes}
          count={backTotal}
          done={backTotal === 0}
          onClick={onStartReview}
        />
        <TodayTaskCard
          icon={<IconBook />}
          title="새 단어"
          note={fresh.fresh > 0 ? `오늘 새 단어 ${fresh.fresh}개` : '오늘 몫을 다 했어요'}
          minutes={fresh.minutes}
          count={fresh.fresh}
          done={fresh.fresh === 0}
          onClick={onStartWords}
        />
        {/* 개수만 적으면 무엇을 배우는지 모른 채로 누른다 —
            오늘 볼 꼭지 이름을 하나 보여 준다 */}
        <TodayTaskCard
          icon={<IconGrid />}
          title="오늘의 문법"
          note={grammarLeft > 0
            ? (grammarNext || `아직 안 본 것 ${grammarLeft}개`)
            : '문법을 한 바퀴 돌았어요'}
          minutes={grammarLeft > 0 ? 3 : 0}
          count={grammarLeft}
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
