import { useMemo, useState } from 'react';
import StudyMenuCard from '../components/StudyMenuCard.jsx';
import { IconChevron } from '../components/Icons.jsx';
import { FAV_MAX, favMenus, groupedMenus, isFav, starterMenu, toggleFav } from '../lib/menu.js';
import '../styles/study-hub.css';

const HINTS = {
  n3: '어휘·문법·한자를 함께', kiju: 'JLPT에 자주 나온 단어', words: '레벨별 단어를 반복 학습',
  grammar: '기초·일상·문형', kanji: '모양·구성·연상', sentences: '상황별 표현을 외워서 말하기',
  listen: '자동 듣기·따라 말하기', travel: '공항·식당·호텔', videos: '유튜브·자막 학습',
  basics: '히라가나부터 차근차근', swiss: '기초·여행 표현',
};
const LABELS = { n3: 'N3 코스', kiju: 'JLPT 기출 단어', words: '단어 암기', sentences: '회화 문장' };
const displayMenu = (menu) => ({ ...menu, label: LABELS[menu.id] || menu.label });

/* 바로가기의 저장 순서와 메뉴 id를 유지하고, 전체 목록은 즐겨찾기와 관계없이 고정한다. */
export default function StudyHub({ settings, onOpen, onChange, onToast }) {
  const savedFavs = Array.isArray(settings.favs) ? settings.favs : [];
  const favs = useMemo(() => favMenus(settings.favs, settings.menus).map(displayMenu), [settings.favs, settings.menus]);
  const starter = useMemo(() => starterMenu(settings), [settings]);
  const groups = useMemo(() => groupedMenus(settings.menus), [settings.menus]);
  const catalog = groups.filter((g) => g.id !== 'more').flatMap((g) => g.items).map(displayMenu);
  const extras = (groups.find((g) => g.id === 'more')?.items || []).filter((m) => m.id !== starter?.id).map(displayMenu);
  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const flipFav = (id) => {
    const next = toggleFav(savedFavs, id);
    if (next === savedFavs) { onToast?.(`바로가기는 ${FAV_MAX}개까지예요 — 하나를 먼저 빼 주세요`); return; }
    onChange?.({ favs: next });
  };
  const moveFav = (id, direction) => {
    const target = favs[favs.findIndex((m) => m.id === id) + direction];
    if (!target) return;
    // 설정에서 잠시 꺼 둔 바로가기는 지우거나 다시 정렬하지 않는다.
    const next = [...savedFavs], a = next.indexOf(id), b = next.indexOf(target.id);
    [next[a], next[b]] = [next[b], next[a]];
    onChange?.({ favs: next });
  };
  const tap = (id) => (editing ? flipFav(id) : onOpen(id));
  const card = (m) => <StudyMenuCard key={m.id} item={m} note={HINTS[m.id]} layout="row" pinned={isFav(savedFavs, m.id)}
    star={editing ? isFav(savedFavs, m.id) : null} onClick={() => tap(m.id)} />;

  return <div className="study-hub">
    <div className="navtitle sh-head"><span><small>나의 수련실</small>학습</span><span className="sh-mark" aria-hidden="true">H×H</span></div>
    {editing && <div className="sh-editbar" role="region" aria-label="바로가기 편집">
      <span><b>바로가기 편집 중</b><small role="status">{favs.length} / {FAV_MAX}개 선택</small></span>
      <button className="sh-edit" type="button" onClick={() => setEditing(false)} aria-pressed="true">완료</button>
    </div>}
    {starter && <section className="menugroup sh-starter" data-group="start" aria-labelledby="sh-start-title">
      <div className="section-label mg-label" id="sh-start-title">처음이라면<span className="mg-sub">히라가나부터 차근차근</span></div>
      <div className="menugrid mtiles">{card(starter)}</div>
    </section>}

    <section className="menugroup sh-favorites" data-group="fav" aria-labelledby="sh-fav-title">
      <div className="sh-section-head">
        <div className="section-label mg-label" id="sh-fav-title">내 바로가기<span className="mg-sub">{editing ? `${favs.length} / ${FAV_MAX}개` : '자주 쓰는 학습'}</span></div>
        {!editing && <button className="sh-edit" type="button" onClick={() => setEditing(true)} aria-pressed="false">편집</button>}
      </div>
      {favs.length ? <div className="menugrid mtiles mfavs">
        {favs.map((m, index) => <div className="sh-favorite-item" key={m.id}>
          <StudyMenuCard item={m} layout="shortcut" star={editing ? true : null} onClick={() => tap(m.id)} />
          {editing && <div className="sh-order" role="group" aria-label={`${m.label} 순서 변경`}>
            <span className="sh-order-position" aria-label={`${favs.length}개 중 ${index + 1}번째`}>{index + 1} / {favs.length}</span>
            <button type="button" onClick={() => moveFav(m.id, -1)} disabled={index === 0} aria-label={`${m.label} 순서를 앞으로`}><IconChevron className="sh-order-prev" /></button>
            <button type="button" onClick={() => moveFav(m.id, 1)} disabled={index === favs.length - 1} aria-label={`${m.label} 순서를 뒤로`}><IconChevron /></button>
          </div>}
        </div>)}
      </div> : <button className="sh-fav-empty" type="button" onClick={() => setEditing(true)}>
        <b>자주 쓰는 학습을 담아보세요</b><span>편집에서 최대 {FAV_MAX}개를 고를 수 있어요 <IconChevron /></span>
      </button>}
      {editing && <p className="sh-edit-note">메뉴를 눌러 추가·삭제하고, 좌우 화살표로 순서를 바꿔요.</p>}
    </section>

    {catalog.length > 0 && <section className="menugroup sh-catalog" data-group="catalog" aria-labelledby="sh-catalog-title">
      <div className="sh-section-head"><div className="section-label mg-label" id="sh-catalog-title">전체 학습</div><span className="sh-count">{catalog.length}개 과정</span></div>
      <div className="menugrid mtiles">{catalog.map(card)}</div>
      <p className="sh-quiz-note">퀴즈·오답 복습은 <b>복습&amp;내기록</b>에서 할 수 있어요.</p>
    </section>}
    {extras.length > 0 && <details className="menugroup sh-more" data-group="more" open={editing || moreOpen}
      onToggle={(e) => { if (!editing) setMoreOpen(e.currentTarget.open); }}>
      <summary onClick={(e) => { if (editing) e.preventDefault(); }}>
        <span><b className="mg-label">추가 자료</b><span className="mg-sub">{extras.map((m) => m.label).join(' · ')}</span></span><IconChevron className="sh-more-chevron" />
      </summary>
      <div className="menugrid mtiles">{extras.map(card)}</div>
    </details>}
    {!catalog.length && !extras.length && !starter && <div className="empty-state">설정 → 학습 설정에서 학습 메뉴를 켜 주세요</div>}
  </div>;
}
