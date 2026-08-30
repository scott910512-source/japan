import { useMemo, useState } from 'react';
import { IconBook, IconRepeat, IconSparkle } from '../components/Icons.jsx';
import Jlpt from './Jlpt.jsx';
import {
  GOAL_CHOICES, MASTER_STREAK, planDailySession, summarize, todayKey,
} from '../lib/review.js';
import { normalizeGoals } from '../lib/daily.js';

export const LEVELS = ['N5', 'N4', 'N3'];

// 레벨 필터. 고른 게 없으면 전체를 쓴다 — 빈 덱으로 들어가는 일이 없게.
export function filterByLevel(words, levels) {
  if (!levels?.length) return words;
  const set = new Set(levels);
  return words.filter((w) => set.has(w.level) || (!w.level && set.has('N5')));
}

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
  const stat = useMemo(() => summarize(pool.map((w) => w.id), review), [pool, review]);

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

      <div className="section-label">오늘 학습</div>
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
        <div className="plantotal">오늘 {plan.reviewPicked + plan.newPicked}장</div>
      </div>

      <button className="bigstart" onClick={onStart} disabled={plan.total === 0}>
        <span className="bs-t">학습 시작</span>
        <span className="bs-s">
          {plan.total === 0
            ? '이 레벨은 다 외웠어요'
            : `복습 ${plan.reviewPicked} + 신규 ${plan.newPicked}`}
        </span>
      </button>

      {/* 예전엔 신규와 복습을 따로 정하게 해 두고, 설정에는 또 다른 "오늘 학습량"이
          있었다. 둘이 서로 몰라서 20장으로 맞춰 놔도 65장이 나왔다. 하나로 합친다. */}
      <div className="section-label">분량 조절</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">하루 새 단어 <span className="set-val">{goals.fresh}장</span></div>
          <div className="grouppick">
            {GOAL_CHOICES.map((n) => (
              <button key={n} className={goals.fresh === n ? 'active' : ''}
                onClick={() => onChange({ goals: { ...goals, fresh: n } })}>{n}</button>
            ))}
          </div>
        </div>
        <div className="set-note">
          이 안에서 새 단어 4 : 복습 1로 나눠 담아요. 한쪽이 모자라면 다른 쪽으로 채웁니다.
        </div>
      </div>

      <div className="section-label">진행률</div>
      <div className="progress-grid">
        <div className="progress-cell">
          <div className="ring" style={{ '--p': stat.total ? (stat.mastered / stat.total) * 100 : 0 }} />
          <div className="val">{stat.mastered}</div>
          <div className="lab">졸업</div>
        </div>
        <div className="progress-cell"><div className="val">{stat.learning}</div><div className="lab">학습 중</div></div>
        <div className="progress-cell"><div className="val">{stat.fresh}</div><div className="lab">아직 안 봄</div></div>
      </div>
      <div className="set-note">
        졸업은 「알아요」가 {MASTER_STREAK}회독 연속 이어져야 붙어요 — 오늘 다 맞혀도 바로 오르진 않아요.
        졸업 뒤에는 한 달·석 달·반년에 한 번씩만 다시 나옵니다.
      </div>

      <div className="statrow card" style={{ marginTop: 12 }}>
        <IconBook />
        <div>
          <div className="sr-val">{pool.length}개</div>
          <div className="sr-lab">지금 고른 레벨의 전체 단어</div>
        </div>
      </div>
      </>
      )}
    </>
  );
}
