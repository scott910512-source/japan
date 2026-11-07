import { useMemo } from 'react';
import MistakeNotebook from '../components/MistakeNotebook.jsx';
import HunterTutor from '../components/HunterTutor.jsx';
import { IconChevron } from '../components/Icons.jsx';
import { wrongTotals } from '../lib/wrongbook.js';

/* 오답노트 — 틀린 문제를 보는 곳은 여기 하나다.
 *
 * 복습&내기록의 「오답노트」, 복습 화면의 「오답노트」 줄이 모두 이 화면을 연다.
 * 맨 위에 합계를 말하고, 아래에 새 오답노트(다시 시험·기록)와 N3 코스에만 남은 오답을 놓는다.
 * 저장소는 둘 다 그대로다 — 화면만 합쳤다. */
export default function WrongBook({ book, n3WrongCount, onAttempt, onLearn, onOpenN3Wrong }) {
  const t = useMemo(() => wrongTotals(book, n3WrongCount), [book, n3WrongCount]);
  return (
    <>
      <HunterTutor guide="killua" scene="arena" mood="encourage" title="오답부터 다시 수련" line={t.total ? `다시 볼 문제 ${t.total}개가 있어. 기록과 해설을 보고 헷갈린 부분부터 확인해 보자.` : '아직 남아 있는 오답이 없어. 문제를 풀다 헷갈린 부분이 생기면 여기서 다시 확인하자.'} compact />
      <div className="card wb2-sum" data-total={t.total}>
        <div className="wb2-head"><span>다시 볼 오답</span><b>{t.total}<small>문제</small></b></div>
        <div className="set-note">새 오답노트 {t.fresh}문제 · N3 코스에만 남은 오답 {t.n3Only}문제. 같은 문제는 한 번만 세요.</div>
      </div>

      <MistakeNotebook book={book} onAttempt={onAttempt} onLearn={onLearn} />

      <p className="set-note wb2-link">다시 풀어서 맞히면 그 낱말의 약점 점수도 1 줄고, 또 틀리면 같이 올라요. 한 번 맞혔다고 약점이 한꺼번에 사라지지는 않아요.</p>
      <details className="card wb2-rules">
        <summary>해결·사라지는 기준이 왜 달라요?</summary>
        <ul className="wb2-rulelist">
          <li><b>새 오답노트</b> 서로 다른 두 날에 맞히면 해결, 7일 뒤 기억 확인이 잡혀요. 같은 날 여러 번 맞혀도 한 번이에요.</li>
          <li><b>N3 코스 오답</b> 문제를 두 번 이어 맞히면 빠져요. 틀리면 연속 기록이 처음으로 돌아가요.</li>
          <li><b>약점 장부</b> 맞히면 점수가 1 줄고, 틀림 신호가 기준 아래로 내려가야 약점에서 빠져요.</li>
          <li><b>복습 기록</b> 복습일에 맞혀야 기억 단계가 하루 한 칸씩 올라요. 이 간격은 오답 풀이와 상관없이 그대로예요.</li>
        </ul>
      </details>

      <div className="section-label">N3 코스 오답노트</div>
      <button className="listrow wb2-n3" onClick={onOpenN3Wrong} disabled={t.n3All === 0}>
        <span className="rv-body">
          <b>N3 오답노트 {t.n3All}개</b>
          <span>{t.n3All ? '문법 · 어휘 · 독해 오답을 갈래별로 보고 약점만 공부해요. 두 번 맞히면 빠져요' : '아직 없어요. N3 문제를 풀다 틀리면 여기 모여요'}</span>
        </span>
        <IconChevron className="chev" />
      </button>
    </>
  );
}
