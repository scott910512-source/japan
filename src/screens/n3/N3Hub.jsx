import { IconPlay, IconChevron, IconFlame, IconList, IconRepeat, IconPencil, IconChart } from '../../components/Icons.jsx';
import { TRACKS, TRACK_LABEL } from '../../lib/n3.js';

/* 메인 — 현재 진행 상황이 먼저, 누를 것은 다섯 개만.
 *   오늘의 N3 시작 · (이어하기) · 전체 과정 · 복습 · 실전 테스트
 * 약점만 공부하기 · 오답노트는 아래 작게. 커리큘럼은 전체 과정 화면에서.
 *
 * 갈래 막대는 한 벌만 그린다. 진도 카드에 다섯 줄, 준비도 카드에 또 다섯 줄이
 * 있었다 — 같은 이름(어휘·한자·문법·독해·청해)의 0% 막대가 열 줄이라 통계가
 * 버튼보다 커졌다. 한 줄에 진도(위)·준비도(아래) 두 값을 같이 그리고, 시작 전
 * (전부 0%)에는 막대 대신 한 줄 안내만 둔다. */
function DualBar({ label, progress, ready }) {
  return (
    <div className="n3-bar dual">
      <span className="n3-barlabel">{label}</span>
      <span className="n3-bartracks">
        <span className="n3-bartrack"><i style={{ width: `${progress}%` }} /></span>
        <span className="n3-bartrack ready"><i style={{ width: `${ready}%` }} /></span>
      </span>
      <b className="n3-barpct">{progress}%<small>준비 {ready}%</small></b>
    </div>
  );
}

export default function N3Hub({
  progress, readiness, today, week, streak, day, dueCount, weakCount,
  onStartToday, onCurriculum, onReview, onExam, onWeak, onWrong,
}) {
  const steps = day?.steps || [];
  const done = steps.filter((s) => s.done).length;
  const started = steps.length > 0 && done > 0;
  const finished = steps.length > 0 && done >= steps.length;
  /* 진도도 준비도도 0이면 막대가 열 줄 있어 봐야 전부 빈 줄이다 */
  const begun = progress.pct > 0 || readiness.total > 0 || TRACKS.some((t) => progress[t].pct > 0 || readiness[t] > 0);

  return (
    <div className="n3-hub">
      {/* 위 헤더가 「한 권으로 끝내는 N3」라 여기서는 코스 이름만 크게 */}
      <div className="n3-head">
        <b>JLPT N3 MASTER</b>
      </div>

      <div className="card n3-sum" data-progress={progress.pct} data-readiness={readiness.total} data-begun={begun ? '1' : '0'}>
        <div className="n3-sumtop">
          <div className="n3-big"><b>{progress.pct}%</b><span>전체 진도</span></div>
          <div className="n3-big ready"><b>{readiness.total}%</b><span>예상 N3 준비도</span></div>
        </div>
        {begun ? (
          <div className="n3-bars">
            {TRACKS.map((t) => <DualBar key={t} label={TRACK_LABEL[t]} progress={progress[t].pct} ready={readiness[t]} />)}
            <div className="n3-barkey">위 막대는 진도(어디까지 했나), 아래는 준비도(얼마나 맞히나)</div>
          </div>
        ) : (
          <div className="n3-notyet">아직 시작 전이에요 — 오늘의 N3부터 해요. 열었다고 오르지 않고, 문제를 맞혀야 진도와 준비도가 올라요.</div>
        )}
        <div className="n3-cells">
          <div className="n3-cell"><b>{today.answered}</b><span>오늘 푼 문제</span></div>
          <div className="n3-cell"><b><IconFlame />{streak?.count || 0}</b><span>연속 학습일</span></div>
          <div className="n3-cell"><b>{week.answered}</b><span>이번 주 · {week.days}일</span></div>
        </div>
        {begun && <div className="set-note">진도율은 「어디까지 했나」, 준비도는 「얼마나 맞히나」예요. 복습일에 다시 맞혀야 MASTER가 돼요.</div>}
      </div>

      <button className="bigcta n3-cta" onClick={onStartToday} data-state={finished ? 'done' : started ? 'resume' : 'start'}>
        <span className="bc-icon"><IconPlay /></span>
        <span className="bc-body">
          <b>{finished ? '오늘의 N3 완료 · 다시 보기' : started ? '이어하기' : '오늘의 N3 시작'}</b>
          <span>{steps.length ? `${steps.length}단계 중 ${done}단계 완료` : '어휘 → 한자 → 문법 → 독해/청해 → 복습 · 약 25분'}</span>
        </span>
        <IconChevron className="chev" />
      </button>

      <div className="n3-grid">
        <button className="menutile mtile n3-tile" onClick={onCurriculum}><span className="mt-ic"><IconList /></span><span className="mt-title">전체 과정</span></button>
        <button className="menutile mtile n3-tile" onClick={onReview}><span className="mt-ic"><IconRepeat /></span><span className="mt-title">복습{dueCount ? ` ${dueCount}` : ''}</span></button>
        <button className="menutile mtile n3-tile" onClick={onExam}><span className="mt-ic"><IconPencil /></span><span className="mt-title">실전 테스트</span></button>
      </div>

      {/* 복습 탭에도 「틀린 문제」·「취약 문법」이 있다. 여기 둘은 코스 맥락 —
          이 코스 안에서 틀린 것만, 코스의 꼭지로 바로 이어진다 — 이라 남긴다.
          복습 탭의 것도 결국 같은 화면(오답노트·약점 판)을 연다. 화면은 하나다. */}
      <div className="n3-small">
        <button className="rowcard n3-weakbtn" onClick={onWeak}>
          <span className="rc-icon"><IconChart /></span>
          <span className="rc-body"><b>약점만 공부하기</b><span>{weakCount ? `반복해서 틀리는 유형 ${weakCount}개` : '아직 틀린 게 없어요 — 문제를 풀면 여기 쌓여요'}</span></span>
          <IconChevron className="chev" />
        </button>
        <button className="rowcard n3-wrongbtn" onClick={onWrong}>
          <span className="rc-icon"><IconList /></span>
          <span className="rc-body"><b>오답노트</b><span>어휘 · 한자 · 문법 · 조사 · 독해 · 청해</span></span>
          <IconChevron className="chev" />
        </button>
      </div>
    </div>
  );
}
