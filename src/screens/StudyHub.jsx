import { useMemo } from 'react';
import {
  IconBook, IconGrid, IconChat, IconMap, IconSparkle, IconRepeat, IconList, IconVideo, IconHeadphone,
  IconPerson,
} from '../components/Icons.jsx';
import { MASTER_STREAK, summarize } from '../lib/review.js';
import { filterByLevel } from './WordDeck.jsx';

/* 학습 탭 — 골라서 들어가는 길.
 *
 * 오늘의 학습이 생겼다고 이 길을 없애지 않는다. "오늘은 식당 회화만 3회독
 * 하고 싶다"는 사람이 있고, 그건 앱이 대신 정해 줄 수 있는 게 아니다.
 * 앱이 정해 주는 길(오늘)과 직접 고르는 길(여기)이 나란히 있어야 한다. */

const MENUS = [
  { id: 'basics', label: '완전기초', sub: '히라가나 · 숫자 · 인사', Icon: IconSparkle },
  { id: 'grammar', label: '기초문법', sub: '생존 패턴부터 차근차근', Icon: IconGrid },
  { id: 'words', label: '단어암기', sub: '회독으로 반복해서 외우기', Icon: IconBook, primary: true },
  { id: 'repeat', label: '회독 학습', sub: '배운 걸 등급별로 다시', Icon: IconRepeat },
  { id: 'jlpt', label: 'JLPT 단어', sub: '레벨별 · 100개 세트로', Icon: IconList },
  { id: 'sentences', label: '상황별 문장암기', sub: '이동 · 식당 · 일상', Icon: IconChat },
  { id: 'quiz', label: '단어 시험', sub: '객관식 · 주관식으로 확인', Icon: IconList },
  { id: 'conjugate', label: '동사 활용', sub: '기초 시제 · 1형 2형 3형', Icon: IconRepeat },
  { id: 'match', label: '짝 맞추기', sub: '게임처럼 · 글자와 소리로', Icon: IconGrid },
  { id: 'rpg', label: '실전 연습', sub: '편의점부터 — 상황을 통째로', Icon: IconPerson },
  { id: 'translate', label: '번역기', sub: '현지에서 바로 — 발음까지', Icon: IconMap },
];

export default function StudyHub({ words, review, settings, onOpen }) {
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const stat = useMemo(() => summarize(wordIds, review), [wordIds, review]);
  const deckSize = useMemo(
    () => filterByLevel(words, settings.levels).length,
    [words, settings.levels],
  );

  const visible = MENUS.filter((m) => settings.menus?.[m.id]);

  return (
    <>
      <div className="navtitle">
        <small>골라서 공부하기</small>
        학습
      </div>

      {/* 듣기와 영상은 단어를 외우는 일과 결이 다르다 — 보고, 듣고, 따라 말하는
          쪽이라 메뉴 바둑판에 섞지 않고 위에 따로 둔다. */}
      <div className="hubrow">
        <button className="hubcard" onClick={() => onOpen('listen')}>
          <span className="hc-icon"><IconHeadphone /></span>
          <span className="hc-body">
            <b>듣기 · 따라 말하기</b>
            <span>화면 안 보고 — 이동 중에</span>
          </span>
        </button>
        <button className="hubcard" onClick={() => onOpen('videos')}>
          <span className="hc-icon"><IconVideo /></span>
          <span className="hc-body">
            <b>영상으로 배우기</b>
            <span>유튜브 자막으로 통째로</span>
          </span>
        </button>
      </div>

      <div className="section-label">학습 메뉴</div>
      <div className="menugrid">
        {visible.map(({ id, label, sub, Icon, primary }) => (
          <button key={id} className={`menutile${primary ? ' primary' : ''}`} onClick={() => onOpen(id)}>
            <span className="mt-icon"><Icon /></span>
            <span className="mt-title">{label}</span>
            <span className="mt-sub">{id === 'words' ? `${stat.seen} / ${deckSize}` : sub}</span>
          </button>
        ))}
        {visible.length === 0 && (
          <div className="empty-state">더보기 → 설정에서 학습 메뉴를 켜 주세요</div>
        )}
      </div>

      <div className="section-label">단어 진행률</div>
      <div className="progress-grid">
        <div className="progress-cell">
          <div className="ring" style={{ '--p': stat.total ? (stat.mastered / stat.total) * 100 : 0 }} />
          <div className="val">{stat.mastered}</div>
          <div className="cap">외운 단어</div>
        </div>
        <div className="progress-cell">
          <div className="ring alt" style={{ '--p': stat.total ? (stat.seen / stat.total) * 100 : 0 }} />
          <div className="val">{stat.seen}</div>
          <div className="cap">공부한 단어</div>
        </div>
      </div>
      <p className="set-note">
        「알아요」를 {MASTER_STREAK}번 이어서 고르면 외운 것으로 봐요. 그 뒤로는 아주 가끔만 나와요.
      </p>
    </>
  );
}
