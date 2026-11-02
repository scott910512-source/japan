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
        <div className="wb2-head"><span>다시 볼 오답</span><b>{t.total}<small>개</small></b></div>
        <div className="set-note">새 오답노트 {t.fresh}개 · N3 코스에만 남은 오답 {t.n3Only}개. 같은 문제는 한 번만 세요.</div>
      </div>

      <MistakeNotebook book={book} onAttempt={onAttempt} onLearn={onLearn} />

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
