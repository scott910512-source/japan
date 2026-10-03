import { useMemo, useState } from 'react';
import StudyMenuCard from '../components/StudyMenuCard.jsx';
import { FAV_MAX, favMenus, groupedMenus, isFav, toggleFav } from '../lib/menu.js';
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

/* stat(단어 회독 현황)은 App이 한 번 세서 내려 준다 — 내 학습과 같은 값이다 */
export default function StudyHub({ words, stat, settings, n3Summary, onOpen, onChange, onToast }) {
  const pool = useMemo(
    () => filterByLevel(words, settings.levels),
    [words, settings.levels],
  );
  const groups = useMemo(() => groupedMenus(settings.menus), [settings.menus]);

  /* ★ 바로가기 ★
     묶음은 「처음 오는 사람이 무엇이 있는지 알아보는」 차례다. 그건 그대로
     맞는데, 날마다 듣기와 기출만 쓰는 사람은 날마다 그 두 칸을 찾아 내려가야
     한다. 자주 쓴 것이 저절로 올라오게 하면 눈 감고 누르던 자리가 매번
     달라져서 더 나쁘다 — 사람이 고른 것만, 고른 차례 그대로 맨 앞에 둔다. */
  const favs = useMemo(
    () => favMenus(settings.favs, settings.menus),
    [settings.favs, settings.menus],
  );
  /* 고치는 동안에만 별을 띄운다. 평소에 칸마다 별이 붙어 있으면 누를 자리가
     둘이 되고, 작은 칸에서는 열려던 메뉴 대신 별이 눌린다. */
  const [editing, setEditing] = useState(false);

  const flipFav = (id) => {
    const next = toggleFav(settings.favs || [], id);
    if (next === (settings.favs || [])) {
      onToast?.(`바로가기는 ${FAV_MAX}개까지예요 — 하나를 먼저 빼 주세요`);
      return;
    }
    onChange?.({ favs: next });
  };

  const tap = (id) => (editing ? flipFav(id) : onOpen(id));

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
      <div className="navtitle sh-head">
        <span>
          <small>골라서 공부하기</small>
          학습
        </span>
        {/* 바로가기를 고치는 자리. 늘 보여야 처음 오는 사람도 이런 게 있는 줄 안다 */}
        <button className="ghost-btn sh-edit" onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
          {editing ? '다 됐어요' : '바로가기 고치기'}
        </button>
      </div>

      {(favs.length > 0 || editing) && (
        <div className="menugroup" data-group="fav">
          <div className="section-label mg-label">
            바로가기
            <span className="mg-sub">
              {editing
                ? `칸을 눌러 넣고 빼요 — ${favs.length} / ${FAV_MAX}개`
                : '자주 쓰는 것만 앞에'}
            </span>
          </div>
          {favs.length > 0 ? (
            <div className="menugrid mtiles mfavs">
              {favs.map((m) => (
                <StudyMenuCard
                  key={m.id}
                  item={m}
                  big={false}
                  star={editing ? true : null}
                  onClick={() => (editing ? flipFav(m.id) : onOpen(m.id))}
                />
              ))}
            </div>
          ) : (
            <p className="set-note sh-favnote">
              아래 칸을 눌러 자주 쓰는 메뉴를 여기 올려 두세요. {FAV_MAX}개까지 돼요.
            </p>
          )}
        </div>
      )}

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
                  <StudyMenuCard
                    key={m.id}
                    item={m}
                    note={noteOf(m.id)}
                    /* 고치는 중에는 큰 칸도 작은 칸으로 — 별을 달 자리가
                       같아야 어느 것이 고를 수 있는 칸인지 헷갈리지 않는다 */
                    big={editing ? false : null}
                    star={editing ? isFav(settings.favs, m.id) : null}
                    onClick={() => tap(m.id)}
                  />
                ))}
              </div>
            )}
            {small.length > 0 && (
              <div className="menugrid mtiles">
                {small.map((m) => (
                  <StudyMenuCard
                    key={m.id}
                    item={m}
                    star={editing ? isFav(settings.favs, m.id) : null}
                    onClick={() => tap(m.id)}
                  />
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
