import { useMemo } from 'react';
import StudyMenuCard from '../components/StudyMenuCard.jsx';
import { summarize } from '../lib/review.js';
import { groupedMenus } from '../lib/menu.js';
import { filterByLevel } from '../lib/wordFilters.js';

/* 학습 탭 — 「무엇을」 공부할지 고르는 자리.
 *
 * 홈이 「앱이 정해 주는 공부」라면 여기는 「내가 고르는 공부」다. 오늘의 학습이
 * 생겼다고 이 길을 없애지 않는다 — "오늘은 식당 회화만 3회독 하고 싶다"는
 * 사람이 있고, 그건 앱이 대신 정해 줄 수 있는 게 아니다.
 *
 * 맨 위에 JLPT N3 코스 하나만 크게. 그 아래는 콘텐츠(단어·문법·한자·문장·듣기·
 * 영상) → 연습 → 그 밖에. 어디에 무엇이 들어가는지는 lib/menu.js가 정한다.
 *
 * 여기에는 행동(새로 배우기·복습하기)이 없다. 그건 홈과 복습 탭이 한다.
 * 진행률 숫자도 안 둔다 — 고르는 화면에 통계가 같이 있으면 고르러 왔다가
 * 통계를 읽고 나간다. 코스 카드의 한 줄만 예외다(어디까지 왔는지가 곧 다음
 * 레슨이 무엇인지라서). */

export default function StudyHub({ words, review, settings, n3Summary, onOpen }) {
  const pool = useMemo(
    () => filterByLevel(words, settings.levels),
    [words, settings.levels],
  );
  const ids = useMemo(() => pool.map((w) => w.id), [pool]);
  const stat = useMemo(() => summarize(ids, review), [ids, review]);
  const groups = useMemo(() => groupedMenus(settings.menus), [settings.menus]);

  const noteOf = (id) => {
    if (id === 'n3') {
      return n3Summary
        ? `${n3Summary.done} / ${n3Summary.total} 레슨 · 준비도 ${n3Summary.ready}%`
        : 'N4 복습부터 모의고사까지 — 오늘의 N3만 누르면 돼요';
    }
    if (id === 'words') return `${stat.seen} / ${pool.length}개 봤어요`;
    return null;
  };

  return (
    <>
      <div className="navtitle">
        <small>골라서 공부하기</small>
        학습
      </div>

      {groups.map((g) => {
        const big = g.items.filter((m) => m.big);
        const small = g.items.filter((m) => !m.big);
        return (
          <div key={g.id} className="menugroup" data-group={g.id}>
            <div className="section-label mg-label">
              {g.label}
              <span className="mg-sub">{g.sub}</span>
            </div>
            {big.length > 0 && (
              <div className="mbigs">
                {big.map((m) => (
                  <StudyMenuCard key={m.id} item={m} note={noteOf(m.id)} onClick={() => onOpen(m.id)} />
                ))}
              </div>
            )}
            {small.length > 0 && (
              <div className="menugrid mtiles">
                {small.map((m) => (
                  <StudyMenuCard key={m.id} item={m} onClick={() => onOpen(m.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div className="empty-state">내 학습 → 설정 → 학습 설정에서 학습 메뉴를 켜 주세요</div>
      )}
    </>
  );
}
