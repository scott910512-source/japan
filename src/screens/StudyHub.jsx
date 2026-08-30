import { useMemo } from 'react';
import StudyMenuCard from '../components/StudyMenuCard.jsx';
import { summarize, weakCards } from '../lib/review.js';
import { roundSummary } from '../lib/rounds.js';
import { groupedMenus } from '../lib/menu.js';
import { filterByLevel } from './WordDeck.jsx';

/* 학습 탭 — 직접 골라서 하는 공부.
 *
 * 오늘 화면이 「앱이 정해 주는 공부」라면 여기는 「내가 고르는 공부」다.
 * 오늘의 학습이 생겼다고 이 길을 없애지 않는다 — "오늘은 식당 회화만 3회독
 * 하고 싶다"는 사람이 있고, 그건 앱이 대신 정해 줄 수 있는 게 아니다.
 *
 * 칸은 세 묶음으로 갈라 둔다. 기준은 「지금 이 카드가 나에게 어떤 상태인가」다.
 *   배우기 — 아직 모른다
 *   연습하기 — 알기는 아는데 손에 안 붙는다
 *   반복하기 — 넣어 뒀는데 샌다
 * 이 순서가 곧 한 카드가 지나가는 길이다. 어디에 무엇이 들어가는지는
 * lib/menu.js가 정한다.
 *
 * 진행률 숫자는 여기 두지 않는다. 기록 탭으로 옮겼다 — 고르는 화면에 통계가
 * 같이 있으면 고르러 왔다가 통계를 읽고 나간다. */

export default function StudyHub({ words, review, settings, onOpen }) {
  const pool = useMemo(
    () => filterByLevel(words, settings.levels),
    [words, settings.levels],
  );
  const ids = useMemo(() => pool.map((w) => w.id), [pool]);
  const stat = useMemo(() => summarize(ids, review), [ids, review]);
  const weak = useMemo(() => weakCards(ids, review).length, [ids, review]);
  const rounds = useMemo(() => roundSummary(ids, review), [ids, review]);
  const groups = useMemo(() => groupedMenus(settings.menus), [settings.menus]);

  /* 큰 칸에는 「지금 내 상태」를 적는다. 「회독으로 반복해서 외우기」는
     설명이지 정보가 아니다 — 두 번째부터는 아무도 안 읽는다. */
  const noteOf = (id) => {
    if (id === 'words') return `${stat.seen} / ${pool.length}개 봤어요`;
    if (id === 'repeat') {
      const doing = rounds.round1 + rounds.round2 + rounds.round3;
      return doing > 0 ? `보고 있는 것 ${doing}개 · 완료 ${rounds.done + rounds.long}개` : '아직 배운 게 없어요';
    }
    if (id === 'weak') return weak > 0 ? `세 번 넘게 틀린 것 ${weak}개` : '아직 없어요. 잘하고 있어요';
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
          <div key={g.id} className="menugroup">
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
        <div className="empty-state">더보기 → 설정에서 학습 메뉴를 켜 주세요</div>
      )}

      <p className="set-note">
        얼마나 했는지는 기록 탭에서 볼 수 있어요.
      </p>
    </>
  );
}
