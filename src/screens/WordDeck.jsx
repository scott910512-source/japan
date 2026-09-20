import { useMemo, useState } from 'react';
import { IconRepeat, IconSparkle } from '../components/Icons.jsx';
import Jlpt from './Jlpt.jsx';
import { planDailySession, todayKey } from '../lib/review.js';
import { normalizeGoals } from '../lib/daily.js';

import { LEVELS, filterByLevel } from '../lib/wordFilters.js';
export { LEVELS, filterByLevel } from '../lib/wordFilters.js';

/* 단어암기 — 외울 단어를 고르고 회독을 시작하는 자리.
 *
 * 「JLPT 단어」가 따로 있었다. 그런데 그건 다른 공부가 아니라 같은 단어를
 * 다른 방식으로 끊어 주는 것이었다 — 여기가 「어떻게 도는가」라면 저긴
 * 「어디까지 끊는가」다. 메뉴를 둘로 두니 「단어암기와 JLPT 단어가 거의
 * 같은 것 아니냐」는 말이 나왔고, 실제로 그랬다.
 *
 * 그래서 한 화면에 넣고 범위 고르는 방법을 둘로 뒀다.
 *   이어서 외우기 — 고른 레벨을 앱이 짜 주는 대로 이어서
 *   세트로 끊어서 — 레벨 안에서 100개씩, 어디까지 했는지 눈에 보이게 */
export default function WordDeck({ words, review, settings, onChange, onStart, onStartSet, onToast }) {
  const [how, setHow] = useState('flow');
  const levels = settings.levels?.length ? settings.levels : LEVELS;

  const pool = useMemo(() => filterByLevel(words, settings.levels), [words, settings.levels]);

  // 오늘 세션이 어떻게 짜이는지 미리 보여준다. 시작 전에 분량을 알 수 있어야 한다.
  /* 이 덱은 새로 외우는 쪽이라 「새 단어」 몫을 그대로 쓴다.
     여기만 다른 숫자를 두면 설정에서 20으로 맞춰 놔도 여기선 다르게 나온다. */
  const goals = normalizeGoals(settings.goals ?? settings.dailyGoal);
  const plan = useMemo(() => planDailySession(pool.map((w) => w.id), review, {
    goal: goals.fresh,
    today: todayKey(),
  }), [pool, review, goals.fresh]);

  const toggleLevel = (lv) => {
    const cur = settings.levels?.length ? settings.levels : [];
    const next = cur.includes(lv) ? cur.filter((x) => x !== lv) : [...cur, lv];
    onChange({ levels: next });
  };

  const byLevel = useMemo(() => {
    const counts = {};
    for (const w of words) {
      const lv = w.level || 'N5';
      counts[lv] = (counts[lv] || 0) + 1;
    }
    return counts;
  }, [words]);

  return (
    <>
      {/* 무엇을 외울지가 아니라 어떻게 끊을지를 고르는 자리다 */}
      <div className="segment wd-how" style={{ marginBottom: 16 }}>
        <button className={how === 'flow' ? 'active' : ''} onClick={() => setHow('flow')}>
          이어서 외우기
        </button>
        <button className={how === 'set' ? 'active' : ''} onClick={() => setHow('set')}>
          세트로 끊어서
        </button>
      </div>

      {how === 'set' ? (
        <Jlpt words={words} review={review} onStartSet={onStartSet} onToast={onToast} />
      ) : (
      <>
      <div className="section-label" style={{ marginTop: 0 }}>학습할 레벨</div>
      <div className="chiprow">
        {LEVELS.map((lv) => (
          <div
            key={lv}
            className={`chip${levels.includes(lv) ? ' active' : ''}`}
            onClick={() => toggleLevel(lv)}
          >
            {lv} · {byLevel[lv] || 0}개
          </div>
        ))}
      </div>
      {!settings.levels?.length && (
        <div className="set-note">레벨을 고르지 않아 전체 단어로 학습해요.</div>
      )}

      {/* ★ 홈의 「오늘 학습 19개」와 다른 숫자다 ★
          홈은 단어·문장을 오늘 계획(plan)으로 세고, 이 판은 고른 레벨의 단어만
          따로 짠다. 같은 「오늘」이라 부르면 어느 쪽이 맞는지 모르게 되니, 여기는
          「이 레벨로 짜는 판」이라 부르고 단어만이라고 적는다. */}
      <div className="section-label">이 레벨로 짜는 판 · 단어만</div>
      <div className="card">
        <div className="planrow">
          <span className="pl-icon review"><IconRepeat /></span>
          <span className="pl-body">
            <b>복습 {plan.reviewPicked}개</b>
            <span>전에 틀렸던 것 중에서 무작위로</span>
          </span>
        </div>
        <div className="planrow">
          <span className="pl-icon new"><IconSparkle /></span>
          <span className="pl-body">
            <b>신규 {plan.newPicked}개</b>
            <span>{plan.freshLeft > 0 ? `아직 안 본 단어 ${plan.freshLeft}개 남음` : '새 단어를 다 봤어요'}</span>
          </span>
        </div>
        <div className="plantotal">단어 {plan.reviewPicked + plan.newPicked}장 · 고른 레벨 {pool.length}개 중</div>
        <div className="set-note">홈의 오늘 학습(단어+문장, 계획 기준)과는 별개예요. 하루 분량은 내 학습 → 설정 → 학습 설정에서 바꿔요.</div>
      </div>

      <button className="bigstart" onClick={onStart} disabled={plan.total === 0}>
        <span className="bs-t">학습 시작</span>
        <span className="bs-s">
          {plan.total === 0
            ? '이 레벨은 다 외웠어요'
            : `복습 ${plan.reviewPicked} + 신규 ${plan.newPicked}`}
        </span>
      </button>

      {/* 분량 조절은 설정(학습 설정 → 하루 분량)에, 진행률은 내 학습에 있다.
          여기 또 두면 한 화면에 탭·칩·카드·버튼·칩·진행률이 다 있어 무엇을 고르는
          자리인지 안 보였다. 이 화면은 「어떤 단어를 시작할까」만 답한다. */}
      </>
      )}
    </>
  );
}
