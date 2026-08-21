import { useMemo, useState } from 'react';
import { IconFlame, IconChevron } from '../components/Icons.jsx';
import { addDays, todayKey, summarize, isMastered, stateOf } from '../lib/review.js';

/* 기록 — 이미 쌓이고 있던 걸 이제야 보여 준다.
 *
 * 일별 집계는 진작부터 저장되고 있었는데 볼 화면이 없었다. 숫자를 잔뜩
 * 늘어놓지는 않는다. 기록을 보는 이유는 분석이 아니라 "어제도 했구나"를
 * 확인하는 것이다. */

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const lead = first.getDay();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ d, key });
  }
  return cells;
}

export default function Log({ words, review, stats, streak, onOpenReview }) {
  const today = todayKey();
  const now = useMemo(() => new Date(), []);
  const [shift, setShift] = useState(0); // 0이면 이번 달, -1이면 지난달

  const shown = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + shift, 1),
    [now, shift],
  );

  const week = useMemo(() => {
    const from = addDays(today, -6);
    const days = Object.entries(stats).filter(([d]) => d >= from && d <= today);
    return {
      days: days.filter(([, v]) => (v.studied || 0) > 0).length,
      studied: days.reduce((s, [, v]) => s + (v.studied || 0), 0),
    };
  }, [stats, today]);

  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const stat = useMemo(() => summarize(wordIds, review), [wordIds, review]);

  /* 회독 저장소에는 문장도 같이 들어 있다. 단어만 세면 실제로 한 것보다
     적게 나와서 "이만큼밖에 안 했나" 싶어진다. */
  const totalSeen = useMemo(() => {
    let seen = 0; let done = 0;
    for (const id of Object.keys(review)) {
      const st = stateOf(review, id);
      if (!st.lastSeen) continue;
      seen++;
      if (isMastered(st)) done++;
    }
    return { seen, done };
  }, [review]);

  const cells = monthGrid(shown.getFullYear(), shown.getMonth());
  const monthTotal = cells.reduce((s, c) => s + (c ? (stats[c.key]?.studied || 0) : 0), 0);

  return (
    <>
      <div className="navtitle">
        <small>얼마나 했는지</small>
        기록
      </div>

      {streak.count > 0 && (
        <div className="streakline">
          <IconFlame />
          <b>{streak.count}일째</b>
          <span>하루도 안 빠지고</span>
        </div>
      )}

      <div className="section-label">이번 주</div>
      <div className="logweek">
        <div className="lw-cell"><b>{week.days}</b><span>학습한 날</span></div>
        <div className="lw-cell"><b>{week.studied}</b><span>공부한 개수</span></div>
        <div className="lw-cell"><b>{totalSeen.done}</b><span>외운 것</span></div>
      </div>

      <div className="section-label">
        <button className="logmonth-nav" onClick={() => setShift((s) => s - 1)} aria-label="지난달">
          <IconChevron style={{ transform: 'rotate(180deg)' }} />
        </button>
        {shown.getFullYear()}년 {shown.getMonth() + 1}월
        <button
          className="logmonth-nav"
          onClick={() => setShift((s) => Math.min(0, s + 1))}
          disabled={shift >= 0}
          aria-label="다음 달"
        >
          <IconChevron />
        </button>
      </div>

      <div className="logcal">
        {DOW.map((d) => <div key={d} className="lc-dow">{d}</div>)}
        {cells.map((c, i) => {
          if (!c) return <div key={`x${i}`} className="lc-day empty" />;
          const n = stats[c.key]?.studied || 0;
          /* 한 날에 얼마나 했는지를 세 단계로만 나눈다. 색을 더 잘게 나눠 봐야
             무슨 뜻인지 못 읽는다. */
          const lv = n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : 3;
          return (
            <div
              key={c.key}
              className={`lc-day lv${lv}${c.key === today ? ' today' : ''}`}
              title={n ? `${c.d}일 · ${n}개` : `${c.d}일`}
            >
              {c.d}
            </div>
          );
        })}
      </div>
      <p className="set-note">
        {monthTotal > 0 ? `이 달에 ${monthTotal}개 공부했어요.` : '이 달은 아직 기록이 없어요.'}
        {' '}진한 칸일수록 많이 한 날이에요.
      </p>

      <div className="section-label">전체</div>
      <div className="logweek">
        <div className="lw-cell"><b>{totalSeen.seen}</b><span>한 번이라도 본 것</span></div>
        <div className="lw-cell"><b>{stat.mastered}</b><span>외운 단어</span></div>
        <div className="lw-cell"><b>{stat.total - stat.seen}</b><span>아직 안 본 단어</span></div>
      </div>

      <button className="rowcard" onClick={onOpenReview}>
        <span className="rc-body">
          <b>복습으로 가기</b>
          <span>오늘 볼 것과 약점을 한 곳에서</span>
        </span>
        <IconChevron className="chev" />
      </button>
    </>
  );
}
