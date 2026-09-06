import {
  IconFlame, IconChevron, IconRepeat, IconPlay, IconBook, IconGrid,
} from '../components/Icons.jsx';
import ProgressSummary from '../components/ProgressSummary.jsx';
import TodayTaskCard from '../components/TodayTaskCard.jsx';
import { todayKey } from '../lib/review.js';
import { estimateMinutes } from '../lib/daily.js';
import { tripLabel } from '../lib/purpose.js';

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
  plan, planNow, review, settings, streak, session, resumeLabel,
  grammarLeft, grammarNext,
  onStartWords, onStartReview, onOpenGrammar, onResume, onOpenReview, onLearnMore,
}) {
  const today = todayKey();

  /* ★ 숫자는 한 곳에서만 나온다 ★
   *
   * 예전엔 화면이 매번 다시 계산했다. 그래서 신규 20개를 다 외워도 아직 안 본
   * 다음 20개가 곧바로 자리를 채워 「새 단어 20개」가 그대로 떴고, 위쪽 완료
   * 수는 판정 횟수라 한 카드를 세 번 만나면 3이 올랐다.
   *
   * 이제 오늘의 계획(plan) 하나를 본다. 배정도 완료도 거기 적혀 있어서
   * 진행률 · 남은 시간 · 버튼의 개수가 서로 어긋날 수가 없다. */
  const lanes = planNow?.lanes || {};
  const backLane = {
    assigned: (lanes.review?.assigned || 0) + (lanes.weak?.assigned || 0),
    done: (lanes.review?.done || 0) + (lanes.weak?.done || 0),
  };
  const backLeft = Math.max(0, backLane.assigned - backLane.done);
  const freshLeft = Math.max(0, (lanes.fresh?.assigned || 0) - (lanes.fresh?.done || 0));

  const minutesOf = (bucket) => estimateMinutes(
    (plan?.assigned || []).filter((x) => !plan.done[x.id]
      && (bucket === 'back' ? x.bucket !== 'fresh' : x.bucket === 'fresh')),
  );

  const hello = HELLO[(streak.count || 0) % HELLO.length];
  const resuming = session?.date === today && session.queue?.length > 0;
  const allDone = Boolean(planNow?.finished);
  const over = planNow?.over || { review: 0, weak: 0 };
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
      {/* 출발일을 넣은 사람에게만. 「3일 이내」를 저장해 두고 한 달 뒤에도
          그렇게 띄우던 것을 실제 날짜 계산으로 바꿨다. */}
      {trip && <div className="td-trip">{trip}</div>}

      {/* 목표(설정에서 정한 양)와 배정(오늘 정말 있는 양)은 다른 숫자다.
          첫날처럼 복습이 하나도 없는 날 60을 목표로 띄우면, 있지도 않은 40개를
          못 한 것처럼 보인다. 여기 뜨는 건 배정이다. */}
      <ProgressSummary
        done={planNow?.done || 0}
        goal={planNow?.assigned || 0}
        minutes={planNow?.minutes || 0}
        goals={settings.goals}
      />

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
          note={backLane.assigned === 0
            ? '오늘 복습할 게 없어요'
            : backLeft === 0
              ? `오늘 몫 ${backLane.assigned}개를 다 했어요`
              : `복습 ${lanes.review?.assigned - lanes.review?.done || 0} · 약점 ${lanes.weak?.assigned - lanes.weak?.done || 0}`}
          minutes={minutesOf('back')}
          count={backLeft}
          done={backLeft === 0}
          onClick={onStartReview}
        />
        <TodayTaskCard
          icon={<IconBook />}
          title="새 단어"
          note={freshLeft > 0
            ? `오늘 새 단어 ${freshLeft}개 남음`
            : `오늘 몫 ${lanes.fresh?.assigned || 0}개를 다 했어요`}
          minutes={minutesOf('fresh')}
          count={freshLeft}
          done={freshLeft === 0}
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

      {/* ★ 계획을 다 하면 거기서 끝이다 ★
          더 하고 싶으면 명시적으로 늘린다. 저절로 다음 20개가 따라 나오면
          「오늘 할 것」이 끝이 없는 목록이 되고, 끝냈다는 느낌을 못 받는다. */}
      {allDone && (
        <div className="td-done">
          <b>오늘 학습 완료</b>
          <span>{planNow.assigned}개를 끝냈어요. 내일 복습으로 다시 만나요.</span>
          <button className="ghost-btn td-more" onClick={() => onLearnMore(10)}>
            10개 더 배우기
          </button>
        </div>
      )}

      {/* 오늘 큐에 다 못 담은 복습이 있으면 알려 준다 — 조용히 밀어 두지 않는다 */}
      {over.review + over.weak > 0 && (
        <button className="rowcard" onClick={onOpenReview}>
          <span className="rc-icon"><IconRepeat /></span>
          <span className="rc-body">
            <b>복습이 더 남았어요</b>
            <span>
              {over.review > 0 && `오늘 안 담은 복습 ${over.review}개`}
              {over.review > 0 && over.weak > 0 && ' · '}
              {over.weak > 0 && `약점 ${over.weak}개`}
            </span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}
    </>
  );
}
