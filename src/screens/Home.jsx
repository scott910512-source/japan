import { useMemo } from 'react';
import {
  IconFlame, IconChevron, IconBook, IconGrid, IconChat, IconMap, IconSparkle, IconRepeat,
} from '../components/Icons.jsx';
import { summarize, todayKey } from '../lib/review.js';

const MENUS = [
  { id: 'basics', label: '완전기초', sub: '히라가나 · 숫자 · 인사', Icon: IconSparkle },
  { id: 'grammar', label: '기초문법', sub: '생존 패턴부터 차근차근', Icon: IconGrid },
  { id: 'words', label: '단어암기', sub: '회독으로 반복해서 외우기', Icon: IconBook, primary: true },
  { id: 'sentences', label: '상황별 문장암기', sub: '이동 · 식당 · 일상', Icon: IconChat },
  { id: 'rpg', label: '실전연습 (여행연습)', sub: '역할극으로 실전처럼', Icon: IconMap },
];

const TRIP_LABEL = { d3: '여행까지 3일', d7: '여행까지 일주일', d14: '여행까지 2주' };

export default function Home({
  words, review, streak, settings, stats, dueCount, session, onOpen, onStartStudy,
}) {
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const stat = useMemo(() => summarize(wordIds, review), [wordIds, review]);
  const today = stats[todayKey()] || { studied: 0 };

  const visible = MENUS.filter((m) => settings.menus?.[m.id]);
  const resumable = session && session.date === todayKey() && session.queue?.length > 0;

  return (
    <>
      <div className="navtitle">
        <small>JS일본어{settings.tripDay && TRIP_LABEL[settings.tripDay] ? ` · ${TRIP_LABEL[settings.tripDay]}` : ''}</small>
        오늘도 한 걸음
      </div>

      <div className="streak">
        <IconFlame />
        <div>
          <div className="num">{streak.count}일째</div>
          <div className="cap">오늘 {today.studied}장 학습 · 외운 단어 {stat.mastered}개</div>
        </div>
      </div>

      <button className="bigstart" onClick={onStartStudy}>
        <span className="bs-t">{resumable ? '이어서 학습하기' : '오늘 학습 시작'}</span>
        <span className="bs-s">
          {resumable
            ? `${session.round}회독 · 남은 ${session.queue.length}장`
            : `단어암기 · 오늘 ${settings.dailyGoal}장`}
        </span>
      </button>

      {dueCount > 0 && (
        <button className="duebar" onClick={() => onOpen('review')}>
          <IconRepeat />
          <span>오늘 복습할 단어 <b>{dueCount}개</b></span>
          <IconChevron className="chev" />
        </button>
      )}

      <div className="section-label">학습 메뉴</div>
      <div className="stack">
        {visible.map(({ id, label, sub, Icon, primary }) => (
          <button key={id} className={`menucard${primary ? ' primary' : ''}`} onClick={() => onOpen(id)}>
            <span className="mc-icon"><Icon /></span>
            <span className="mc-body">
              <span className="mc-title">{label}</span>
              <span className="mc-sub">
                {id === 'words' ? `${stat.mastered} / ${stat.total} 외움` : sub}
              </span>
            </span>
            <IconChevron className="chev" />
          </button>
        ))}
        {visible.length === 0 && (
          <div className="empty-state">설정에서 학습 메뉴를 켜 주세요</div>
        )}
      </div>

      <div className="section-label">단어 진행률</div>
      <div className="progress-grid">
        <div className="progress-cell">
          <div className="ring" style={{ '--p': stat.total ? (stat.mastered / stat.total) * 100 : 0 }} />
          <div className="val">{stat.mastered}</div>
          <div className="lab">졸업</div>
        </div>
        <div className="progress-cell">
          <div className="val">{stat.learning}</div>
          <div className="lab">학습 중</div>
        </div>
        <div className="progress-cell">
          <div className="val">{stat.fresh}</div>
          <div className="lab">아직 안 봄</div>
        </div>
      </div>
    </>
  );
}
