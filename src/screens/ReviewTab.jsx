import { useMemo } from 'react';
import { IconRepeat, IconChevron, IconFlame, IconBook } from '../components/Icons.jsx';
import {
  DAILY_REVIEW_CAP, dueCards, stateOf, summarize, todayKey, weakCards, isMastered,
} from '../lib/review.js';

export default function ReviewTab({ words, review, streak, stats, onStartDeck, onOpenWeak }) {
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const today = todayKey();

  const due = useMemo(() => dueCards(wordIds, review, today), [wordIds, review, today]);
  const weak = useMemo(() => weakCards(wordIds, review), [wordIds, review]);
  const stat = useMemo(() => summarize(wordIds, review), [wordIds, review]);

  // 상한을 넘겨 오늘 큐에 못 들어간 카드가 몇 장인지 — 조용히 잘라내지 않고 알린다.
  const overflow = useMemo(() => {
    const all = wordIds.filter((id) => {
      const st = stateOf(review, id);
      return st.lastSeen && !isMastered(st);
    });
    const total = all.filter((id) => {
      const st = stateOf(review, id);
      const d = st.lastSeen;
      return d && d <= today;
    }).length;
    return Math.max(0, Math.min(total, all.length) - DAILY_REVIEW_CAP);
  }, [wordIds, review, today]);

  const byId = useMemo(() => new Map(words.map((w) => [w.id, w])), [words]);
  const weekTotal = useMemo(() => {
    return Object.entries(stats)
      .filter(([d]) => d > addDaysStr(today, -7))
      .reduce((sum, [, v]) => sum + (v.studied || 0), 0);
  }, [stats, today]);

  return (
    <>
      <div className="navtitle">
        <small>회독 현황</small>
        복습
      </div>

      {due.length > 0 ? (
        <button
          className="bigstart"
          onClick={() => onStartDeck({ id: 'due', label: '오늘 복습', cards: due.map((id) => byId.get(id)).filter(Boolean) })}
        >
          <span className="bs-t">복습 시작</span>
          <span className="bs-s">오늘 복습할 단어 {due.length}장</span>
        </button>
      ) : (
        <div className="card empty-state" style={{ padding: '28px 20px' }}>
          오늘 복습할 단어가 없어요.<br />새 단어를 학습하면 내일부터 여기에 쌓여요.
        </div>
      )}

      {overflow > 0 && (
        <div className="notice">
          복습이 밀려서 오늘은 {DAILY_REVIEW_CAP}장까지만 담았어요. {overflow}장은 내일로 넘어가요.
        </div>
      )}

      <div className="section-label">내 취약 단어</div>
      <button className="menucard" onClick={onOpenWeak} disabled={weak.length === 0}>
        <span className="mc-icon"><IconRepeat /></span>
        <span className="mc-body">
          <span className="mc-title">취약 단어 {weak.length}개</span>
          <span className="mc-sub">
            {weak.length ? '몰라요·애매해요가 3번 이상 쌓인 단어들' : '아직 없어요. 잘하고 있어요'}
          </span>
        </span>
        <IconChevron className="chev" />
      </button>

      <div className="section-label">기록</div>
      <div className="stack">
        <div className="card statrow">
          <IconFlame />
          <div>
            <div className="sr-val">{streak.count}일 연속</div>
            <div className="sr-lab">하루 한 장이라도 하면 이어져요</div>
          </div>
        </div>
        <div className="card statrow">
          <IconBook />
          <div>
            <div className="sr-val">이번 주 {weekTotal}장</div>
            <div className="sr-lab">오늘 {stats[today]?.studied || 0}장</div>
          </div>
        </div>
      </div>

      <div className="section-label">단어 회독 현황</div>
      <div className="card">
        <div className="bar-line">
          <span>졸업 {stat.mastered}</span>
          <span>학습 중 {stat.learning}</span>
          <span>미학습 {stat.fresh}</span>
        </div>
        <div className="stackbar">
          <i className="b-done" style={{ flex: stat.mastered || 0 }} />
          <i className="b-doing" style={{ flex: stat.learning || 0 }} />
          <i className="b-todo" style={{ flex: stat.fresh || 0 }} />
        </div>
      </div>
    </>
  );
}

function addDaysStr(dayKey, n) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
