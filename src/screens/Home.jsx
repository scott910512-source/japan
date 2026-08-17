import { useMemo } from 'react';
import {
  IconFlame, IconChevron, IconBook, IconGrid, IconChat, IconMap, IconSparkle, IconRepeat, IconList,
} from '../components/Icons.jsx';
import { MASTER_STREAK, planDailySession, summarize, todayKey } from '../lib/review.js';
import { filterByLevel } from './WordDeck.jsx';

const MENUS = [
  { id: 'basics', label: '완전기초', sub: '히라가나 · 숫자 · 인사', Icon: IconSparkle },
  { id: 'grammar', label: '기초문법', sub: '생존 패턴부터 차근차근', Icon: IconGrid },
  { id: 'words', label: '단어암기', sub: '회독으로 반복해서 외우기', Icon: IconBook, primary: true },
  { id: 'jlpt', label: 'JLPT 단어', sub: '레벨별 · 100개 세트로', Icon: IconList },
  { id: 'sentences', label: '상황별 문장암기', sub: '이동 · 식당 · 일상', Icon: IconChat },
  { id: 'quiz', label: '단어 시험', sub: '객관식 · 주관식으로 확인', Icon: IconList },
  { id: 'translate', label: '번역기', sub: '현지에서 바로 — 발음까지', Icon: IconMap },
];

const TRIP_LABEL = { d3: '여행까지 3일', d7: '여행까지 일주일', d14: '여행까지 2주' };

export default function Home({
  words, review, streak, settings, stats, dueCount, session, onOpen, onStartStudy,
}) {
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  // 세션은 고른 레벨 안에서만 짜인다. 여기서도 같은 범위로 세야 숫자가 맞는다.
  const deckIds = useMemo(
    () => filterByLevel(words, settings.levels).map((w) => w.id),
    [words, settings.levels],
  );
  const stat = useMemo(() => summarize(wordIds, review), [wordIds, review]);
  /* 버튼에 진짜 장수를 적는다. 예전엔 설정값(오늘 학습량)을 적어 놓고 실제로는
     65장이 나왔다 — 눌러 보기 전엔 알 수가 없었다. */
  const plan = useMemo(
    () => planDailySession(deckIds, review, { goal: settings.dailyGoal }),
    [deckIds, review, settings.dailyGoal],
  );
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
          <div className="cap">오늘 {today.studied}장 학습 · 공부한 단어 {stat.seen}개</div>
        </div>
      </div>

      <button className="bigstart" onClick={onStartStudy}>
        <span className="bs-t">{resumable ? '이어서 학습하기' : '오늘 학습 시작'}</span>
        <span className="bs-s">
          {resumable
            ? `${session.round}회독 · 남은 ${session.queue.length}장`
            : `단어암기 · 새 단어 ${plan.newPicked}장 + 복습 ${plan.reviewPicked}장`}
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
                {id === 'words' ? `${stat.seen} / ${stat.total} 공부함` : sub}
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
      {/* 1일차에 졸업이 0인 건 정상인데, 설명이 없으면 고장 난 것처럼 보인다 */}
      <div className="set-note">
        졸업은 「알아요」가 {MASTER_STREAK}회독 연속 이어져야 붙어요.
        복습 간격이 1일 → 3일 → 7일이라 빨라도 2주쯤 걸려요.
        졸업한 뒤에도 한 달·석 달·반년에 한 번씩만 다시 나와요 — 안 잊으려면 그게 필요해요.
      </div>
    </>
  );
}
