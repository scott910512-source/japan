import { useMemo } from 'react';
import {
  IconBook, IconGrid, IconChat, IconMap, IconSparkle, IconRepeat, IconList, IconVideo, IconHeadphone,
  IconPerson, IconPencil,
} from '../components/Icons.jsx';
import { MASTER_STREAK, summarize } from '../lib/review.js';
import { groupedMenus } from '../lib/menu.js';
import { filterByLevel } from './WordDeck.jsx';

/* 학습 탭 — 골라서 들어가는 길.
 *
 * 오늘의 학습이 생겼다고 이 길을 없애지 않는다. "오늘은 식당 회화만 3회독
 * 하고 싶다"는 사람이 있고, 그건 앱이 대신 정해 줄 수 있는 게 아니다.
 * 앱이 정해 주는 길(오늘)과 직접 고르는 길(여기)이 나란히 있어야 한다.
 *
 * 칸은 세 묶음으로 갈라 둔다 — 학습 · 퀴즈 · 기타. 열두 칸을 한 바둑판에
 * 늘어놓으니 무엇이 배우는 것이고 무엇이 확인하는 것인지 눈으로 안 갈렸다.
 * 어디에 무엇을 넣을지는 lib/menu.js가 정한다. */

const ICONS = {
  sparkle: IconSparkle,
  book: IconBook,
  grid: IconGrid,
  chat: IconChat,
  repeat: IconRepeat,
  list: IconList,
  pencil: IconPencil,
  person: IconPerson,
  map: IconMap,
};

export default function StudyHub({ words, review, settings, onOpen }) {
  const wordIds = useMemo(() => words.map((w) => w.id), [words]);
  const stat = useMemo(() => summarize(wordIds, review), [wordIds, review]);
  const deckSize = useMemo(
    () => filterByLevel(words, settings.levels).length,
    [words, settings.levels],
  );

  const groups = useMemo(() => groupedMenus(settings.menus), [settings.menus]);

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
            <span>유튜브 · 넷플릭스 자막</span>
          </span>
        </button>
      </div>

      {/* 묶음마다 왜 여기 있는지 한 줄로 적는다. 이름만 적으면 「학습」과
          「퀴즈」의 경계가 사람마다 다르게 읽힌다. */}
      {groups.map((g) => (
        <div key={g.id} className="menugroup">
          <div className="section-label mg-label">
            {g.label}
            <span className="mg-sub">{g.sub}</span>
          </div>
          <div className="menugrid">
            {g.items.map(({ id, label, sub, icon, primary }) => {
              const Icon = ICONS[icon] || IconGrid;
              return (
                <button
                  key={id}
                  className={`menutile${primary ? ' primary' : ''}`}
                  onClick={() => onOpen(id)}
                >
                  <span className="mt-icon"><Icon /></span>
                  <span className="mt-title">{label}</span>
                  <span className="mt-sub">{id === 'words' ? `${stat.seen} / ${deckSize}` : sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <div className="empty-state">더보기 → 설정에서 학습 메뉴를 켜 주세요</div>
      )}

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
