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
  onStartAll, onStartWords, onStartReview, onOpenGrammar, onResume, onOpenReview, onLearnMore,
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
  const freshLane = {
    assigned: lanes.fresh?.assigned || 0,
    done: lanes.fresh?.done || 0,
  };
  const freshLeft = Math.max(0, freshLane.assigned - freshLane.done);

  /* 「새로 배우기」에 무엇이 몇 개인지. 단어만 있는 줄에 「단어 12 · 문장 0」을
     적으면 없는 것을 셈하는 셈이라, 있는 것만 적는다. */
  const freshMix = (() => {
    const left = (plan?.assigned || []).filter((x) => x.bucket === 'fresh' && !plan.done[x.id]);
    const w = left.filter((x) => x.kind !== 'sentence').length;
    const s = left.length - w;
    if (w && s) return `단어 ${w} · 문장 ${s}`;
    if (s) return `문장 ${s}개`;
    return `단어 ${w}개`;
  })();

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
          전에 이어하기가 먼저 눈에 들어와야 한다. 그래서 이어하기를 따로
          한 줄 두지 않고, 아래 주요 버튼 자체가 이어하기가 된다. */}

      {/* ★ 누를 것은 하나 ★
       *
       * 「복습하기 · 새 단어 · 오늘의 문법」 셋을 나란히 놓았더니, 처음 쓰는
       * 사람이 무엇부터 해야 하는지 고민했다. 셋은 고를 것이 셋이라는 뜻이고,
       * 고르는 일은 학습 탭이 할 일이다.
       *
       * 그래서 큰 버튼 하나만 둔다. 하던 게 있으면 이어하기, 없으면 오늘 학습
       * 시작이다. 갈래를 안 주니 배정된 것을 순서대로 다 돈다 — 복습이 없는
       * 날은 저절로 새로 배우기부터 시작한다. */}
      {!allDone && (
        <button className="bigcta" onClick={resuming ? onResume : onStartAll}>
          <span className="bc-icon"><IconPlay /></span>
          <span className="bc-body">
            <b>{resuming ? '이어하기' : (backLeft === 0 ? '새로 배우기' : '오늘 학습 시작')}</b>
            <span>
              {resuming
                ? `${resumeLabel || '학습'} · ${session.round}회독 · ${session.queue.length}개 남음`
                : `${planNow?.left || 0}개 · 약 ${planNow?.minutes || 0}분`}
            </span>
          </span>
          <IconChevron className="chev" />
        </button>
      )}

      {/* 배정 내역. 무엇이 몇 개 담겼는지 확인하는 자리이고, 갈래만 따로
          하고 싶으면 눌러서 할 수도 있다 — 주요 버튼보다 작게 둔다. */}
      {(backLane.assigned > 0 || freshLane.assigned > 0) && (
        <>
          <div className="section-label">오늘 배정</div>
          <div className="tdtasks">
            {backLane.assigned > 0 && (
              <TodayTaskCard
                icon={<IconRepeat />}
                title="복습"
                note={backLeft === 0
                  ? `오늘 몫 ${backLane.assigned}개를 다 했어요`
                  : `복습 ${(lanes.review?.assigned || 0) - (lanes.review?.done || 0)} · 약점 ${(lanes.weak?.assigned || 0) - (lanes.weak?.done || 0)}`}
                minutes={minutesOf('back')}
                count={backLeft}
                done={backLeft === 0}
                onClick={onStartReview}
              />
            )}
            {/* ★ 「새 단어」라고 불렀지만 문장도 같이 배정된다 ★
                단어 버튼을 눌렀는데 문장이 나오면 범위를 오해한다.
                이름을 바꾸고 무엇이 몇 개인지 적는다. */}
            {freshLane.assigned > 0 && (
              <TodayTaskCard
                icon={<IconBook />}
                title="새로 배우기"
                note={freshLeft === 0
                  ? `오늘 몫 ${freshLane.assigned}개를 다 했어요`
                  : freshMix}
                minutes={minutesOf('fresh')}
                count={freshLeft}
                done={freshLeft === 0}
                onClick={onStartWords}
              />
            )}
          </div>
        </>
      )}

      {/* ★ 문법은 선택이다 ★
       *
       * 오늘 완료는 카드 계획으로 세는데 문법은 그 밖에 있었다. 그래서 문법이
       * 남아도 「오늘 학습 완료」가 떴다 — 완료가 무엇의 완료인지 알 수 없었다.
       * 계획에 넣는 대신 선택이라고 적는다. 문법은 꼭지 단위라 하루 몫으로
       * 쪼개 세기 어렵고, 안 해도 회독은 굴러간다. */}
      <div className="section-label">곁들여서 · 선택</div>
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

      {/* ★ 계획을 다 하면 거기서 끝이다 ★
          더 하고 싶으면 명시적으로 늘린다. 저절로 다음 20개가 따라 나오면
          「오늘 할 것」이 끝이 없는 목록이 되고, 끝냈다는 느낌을 못 받는다.

          성공과 미완료를 같은 크기로 외치지 않는다. 끝냈다는 것이 먼저고,
          더 할 수 있다는 것은 그 아래 한 줄이다. */}
      {allDone && (
        <div className="td-done">
          <b>오늘 학습 완료</b>
          <span>
            오늘 정한 {planNow.assigned}개를 마쳤어요. 내일 복습으로 다시 만나요.
            {grammarLeft > 0 && ' 문법은 선택이라 안 해도 괜찮아요.'}
          </span>
          <button className="ghost-btn td-more" onClick={() => onLearnMore(10)}>
            10개 더 배우기
          </button>
        </div>
      )}

      {/* 오늘 큐에 다 못 담은 복습이 있으면 알려 준다 — 조용히 밀어 두지 않는다.
          다 한 뒤라면 「추가로」라고 말한다. 끝냈는데 아직 남았다고만 하면
          끝낸 것이 안 끝난 것처럼 읽힌다. */}
      {over.review + over.weak > 0 && (
        <button className="rowcard" onClick={onOpenReview}>
          <span className="rc-icon"><IconRepeat /></span>
          <span className="rc-body">
            <b>{allDone ? '더 복습할 수도 있어요' : '복습이 더 남았어요'}</b>
            <span>
              {over.review > 0 && `${allDone ? '추가 복습' : '오늘 안 담은 복습'} ${over.review}개`}
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
