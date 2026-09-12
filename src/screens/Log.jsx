import { useMemo, useState } from 'react';
import { IconFlame, IconChevron } from '../components/Icons.jsx';
import { addDays, summarize, isMastered, stateOf, MASTERY_RULE } from '../lib/review.js';
import { STATS_KEEP_DAYS, STREAK_RULE } from '../lib/storage.js';
import { roundSummary } from '../lib/rounds.js';
import { useToday } from '../lib/useToday.js';

/* 기록 — 이미 쌓이고 있던 걸 이제야 보여 준다.
 *
 * 일별 집계는 진작부터 저장되고 있었는데 볼 화면이 없었다. 숫자를 잔뜩
 * 늘어놓지는 않는다. 기록을 보는 이유는 분석이 아니라 "어제도 했구나"를
 * 확인하는 것이다. */

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/* 회독 막대에 그릴 줄. 「아직」을 빼지 않는다 —
   남은 게 얼마인지가 진도의 절반이다. */
const ROUND_ROWS = [
  { id: 'round1', label: '1회독' },
  { id: 'round2', label: '2회독' },
  { id: 'round3', label: '3회독' },
  { id: 'done', label: '완료' },
  { id: 'long', label: '장기복습' },
  { id: 'fresh', label: '아직' },
];

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
  /* 자정을 넘기면 이 값이 바뀌고 화면이 다시 그려진다. 예전엔 마운트 때
     한 번 잡아 둬서, 8/31에 켜 놓고 9/1이 되면 달력이 8월에 머물렀다 —
     오늘 칸이 없고 「다음 달」 버튼도 비활성이었다. */
  const today = useToday();
  const now = useMemo(() => new Date(), [today]);
  const [shift, setShift] = useState(0); // 0이면 이번 달, -1이면 지난달

  const shown = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + shift, 1),
    [now, shift],
  );

  /* ★ 제목과 계산을 맞춘다 ★
   *
   * 「이번 주」라고 적어 두고 최근 7일(오늘부터 6일 전까지)을 셌다. 월요일
   * 아침에 지난주 것이 섞여 보이고, 일요일에는 「이번 주」가 이레치로 보였다.
   *
   * 계산을 바꾸지 않고 제목을 바꾼다. 굴러가는 7일 창은 요일이 바뀔 때마다
   * 0으로 꺼지지 않아서 학습 앱에는 오히려 이쪽이 쓸모 있다 — 고칠 것은
   * 숫자가 아니라 그 숫자를 부르는 이름이었다. */
  const RECENT_DAYS = 7;
  const recent = useMemo(() => {
    const from = addDays(today, -(RECENT_DAYS - 1));
    const days = Object.entries(stats).filter(([d]) => d >= from && d <= today);
    /* 이 창에서 기억 단계가 오른 카드. 누적 「외운 것」을 여기 두면 이번 주에
       한 것과 여태 한 것이 한 줄에 섞인다 — promotedOn이 있는 날짜만 센다. */
    let promoted = 0;
    for (const id of Object.keys(review)) {
      const st = stateOf(review, id);
      if (st.promotedOn && st.promotedOn >= from && st.promotedOn <= today) promoted += 1;
    }
    return {
      days: days.filter(([, v]) => (v.studied || 0) > 0).length,
      studied: days.reduce((s, [, v]) => s + (v.studied || 0), 0),
      promoted,
    };
  }, [stats, today, review]);

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

  /* 회독 현황은 단어만 센다. 회독 저장소에는 문장도 같이 들어 있는데,
     막대에 섞으면 「단어 몇 개 외웠나」와 눈금이 안 맞는다. */
  const rounds = useMemo(() => roundSummary(wordIds, review), [wordIds, review]);
  const roundMax = useMemo(
    () => Math.max(1, ...Object.values(rounds)),
    [rounds],
  );

  const cells = monthGrid(shown.getFullYear(), shown.getMonth());
  const monthTotal = cells.reduce((s, c) => s + (c ? (stats[c.key]?.studied || 0) : 0), 0);

  /* 이 달이 보관 범위 밖인가.
     최근 60일치만 남기니(STATS_KEEP_DAYS), 그 수만큼 차 있고 이 달 전체가
     제일 오래된 기록보다 앞서면 「안 했다」인지 「버렸다」인지 알 수 없다.
     알 수 없을 때 「기록이 없다」고 하지 않는다. */
  const beyondKeep = useMemo(() => {
    const keys = Object.keys(stats).sort();
    if (keys.length < STATS_KEEP_DAYS) return false;   // 아직 버린 적이 없다
    const last = cells.filter(Boolean).at(-1)?.key;
    return Boolean(last && last < keys[0]);
  }, [stats, cells]);

  return (
    <>
      <div className="navtitle">
        <small>얼마나 했는지</small>
        기록
      </div>

      {/* 「하루도 안 빠지고」라고 적어 두었지만 이 숫자는 하루 쉬어도 이어진다.
          규칙을 바꾸는 대신 규칙을 그대로 말한다 — 관대한 것과 거짓은 다르다. */}
      {streak.count > 0 && (
        <div className="streakline">
          <IconFlame />
          <b>{streak.count}일째</b>
          <span>{STREAK_RULE}</span>
        </div>
      )}

      {/* 최근 7일과 여태 쌓은 것을 갈라 둔다. 한 줄에 섞여 있으면
          이번 주 성과인지 누적인지 알 수 없다. */}
      <div className="section-label">최근 {RECENT_DAYS}일</div>
      <div className="logweek">
        <div className="lw-cell"><b>{recent.days}</b><span>학습한 날</span></div>
        <div className="lw-cell"><b>{recent.studied}</b><span>공부한 개수</span></div>
        <div className="lw-cell"><b>{recent.promoted}</b><span>기억 단계 오름</span></div>
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
              className={`lc-day lv${lv}${c.key === today ? ' is-today' : ''}`}
              title={n ? `${c.d}일 · ${n}개` : `${c.d}일`}
            >
              {c.d}
            </div>
          );
        })}
      </div>
      {/* ★ 「기록이 없어요」와 「기록을 안 갖고 있어요」는 다르다 ★
          일별 집계는 최근 60일만 남긴다(saveStats). 그런데 달력은 얼마든지
          과거로 갈 수 있어서, 그때 공부했어도 안 한 달처럼 보였다.
          보관 범위 밖이면 그렇게 말한다 — 없는 것과 버린 것을 구별한다. */}
      <p className="set-note">
        {beyondKeep
          ? '이 달은 보관 범위 밖이에요 — 일별 기록은 최근 60일만 남겨요. 회독 기록과 외운 개수는 그대로예요.'
          : (monthTotal > 0 ? `이 달에 ${monthTotal}개 공부했어요.` : '이 달은 아직 기록이 없어요.')}
        {!beyondKeep && ' 진한 칸일수록 많이 한 날이에요.'}
      </p>

      {/* 한 줄에 세는 범위를 맞춘다. 「한 번이라도 본 것」은 단어와 문장을 같이
          세는데 「외운 단어」는 단어만 세고 있었다 — 나란히 두면 문장을 외운 것이
          어디로 갔나 싶어진다. 셋 다 단어·문장을 같이 센다. */}
      <div className="section-label">전체</div>
      <div className="logweek">
        <div className="lw-cell"><b>{totalSeen.seen}</b><span>한 번이라도 본 것</span></div>
        <div className="lw-cell"><b>{totalSeen.done}</b><span>외운 것</span></div>
        <div className="lw-cell"><b>{stat.total - stat.seen}</b><span>아직 안 본 단어</span></div>
      </div>

      {/* ★ 회독 현황 ★
          이 앱이 하는 일은 결국 한 카드를 네 번 맞힐 때까지 간격을 벌려 가며
          다시 만나게 하는 것이다. 그 뼈대가 화면 어디에도 안 보여서, 사용자
          눈에는 메뉴 열두 개짜리 앱으로 보였다. 여기가 그걸 보여 주는 자리다.

          「완료」와 「장기복습」을 따로 세는 이유는, 완료가 「다시는 안 나옴」이
          아니기 때문이다. 그렇게 보이면 완료된 카드가 다시 나올 때 고장으로 읽힌다. */}
      <div className="section-label">회독 현황</div>
      <div className="card roundstat">
        {ROUND_ROWS.map(({ id, label }) => {
          const n = rounds[id] || 0;
          const w = roundMax ? (n / roundMax) * 100 : 0;
          return (
            <div key={id} className="rs-row">
              <span className="rs-lab">{label}</span>
              <span className="rs-bar"><i style={{ width: `${w}%` }} /></span>
              <span className="rs-val">{n}</span>
            </div>
          );
        })}
        {/* 「이어서 네 번 고르면」이라고 적어 두었더니 한자리에서 네 번 누르면
            되는 것처럼 읽혔다. 실제로는 하루에 한 칸씩, 복습일에만 오른다.
            규칙은 정책(review.js)이 한 문장으로 만들어 준다. */}
        <div className="set-note" style={{ marginTop: 8 }}>
          {MASTERY_RULE} 완료한 뒤에도 한 달 · 석 달 · 반년에 한 번씩 다시 나와요 —
          그게 장기복습이에요.
        </div>
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
