import { useMemo, useState } from 'react';
import { KIJU_GROUP, KIJU_SOURCE, kijuByYear, kijuCards, kijuGroupAt, kijuStat } from '../lib/kiju.js';
import { isDoneEnough, isSessionClear, stateOf } from '../lib/review.js';

/* 기출 단어 — 열여섯 해 동안 실제로 나온 낱말부터.
 *
 * ★ 이 화면이 답하는 질문은 하나다 ★
 *
 * 「시험까지 시간이 얼마 없는데 무엇부터 외우나」. 단어장 3,000개에는 그 답이
 * 없다. 기출에는 있다 — 2010년부터 2025년까지 한자읽기에 나온 205개, 그중
 * 두 번 이상 나온 36개가 제일 앞이다.
 *
 * 카드는 단어장 것을 그대로 쓴다. 여기서 시작한 판도 홈의 오늘 학습과 같은
 * 회독 기록에 쌓인다 — 기출만 따로 세는 진도를 만들면 「어제 외운 것」이
 * 어느 쪽에 있는지부터 헷갈린다.
 *
 * 분량은 설정의 「새 단어」 몫을 그대로 쓴다(daily). 한 번에 205장을 열면
 * 아무도 안 끝낸다. 눌러서 한 판, 또 눌러서 다음 판이다. */
export default function KijuDeck({ words, review, onStart }) {
  const [tab, setTab] = useState('order');   // order(출제 순) | year(연도별)

  const cards = useMemo(() => kijuCards(words), [words]);
  const top = useMemo(() => cards.filter((c) => c.kiju.count > 1), [cards]);
  const stat = useMemo(
    () => kijuStat(cards, (id) => stateOf(review, id), isDoneEnough),
    [cards, review],
  );
  const years = useMemo(() => kijuByYear(), []);

  /* ★ 서른 개씩 묶어서, 쌓아 가며 ★
     「뗐다」는 알아요로 한 번 정리한 것(isSessionClear). 졸업(isDoneEnough)은
     복습일에 네 번 맞혀야 해서 며칠이 걸리는데, 그걸 묶음 기준으로 쓰면
     1묶음에서 일주일을 머문다. 기준을 새로 만들지 않고 회독 쪽에 이미 있는
     둘 중 낮은 쪽을 고른 것이다. */
  const group = useMemo(
    () => kijuGroupAt(cards, (id) => isSessionClear(stateOf(review, id))),
    [cards, review],
  );

  /* 회독 상태를 한 글자로. 목록이 205줄이라 여기서 색만 바뀌어야 훑어진다. */
  const markOf = (id) => {
    const st = stateOf(review, id);
    if (!st?.lastSeen) return '';
    if (isDoneEnough(st)) return 'done';
    if ((st.wrongCount || 0) + (st.vagueCount || 0) >= 3) return 'weak';
    return 'seen';
  };

  return (
    <>
      <div className="card kj-head">
        <div className="kj-lead">
          {KIJU_SOURCE.from}~{KIJU_SOURCE.to}년 {KIJU_SOURCE.section}에 나온 {stat.total}개.
          두 번 이상 나온 {top.length}개가 맨 앞이에요.
        </div>
        <div className="kj-bar">
          <i className="kb-done" style={{ width: `${Math.round((stat.done / stat.total) * 100)}%` }} />
          <i className="kb-seen" style={{ width: `${Math.round(((stat.seen - stat.done) / stat.total) * 100)}%` }} />
        </div>
        <div className="kj-nums">
          <span><b>{stat.done}</b> 외웠어요</span>
          <span><b>{stat.seen - stat.done}</b> 보는 중</span>
          <span><b>{stat.left}</b> 아직</span>
        </div>
      </div>

      {/* ★ 이번 묶음 ★
          열 때마다 다른 낱말이 나오면 한 덩어리를 못 외운다. 서른 개를 다 뗄
          때까지 같은 서른 개가 나오고, 다 떼면 다음 묶음이 앞엣것을 달고
          열린다 — 앞엣것을 빼면 사흘 뒤에 잊었는지 확인할 길이 없어진다. */}
      <div className="card kj-group">
        <div className="kg-head">
          <b>{group.index + 1}묶음</b>
          <span className="kg-range">1 ~ {group.to}번째 · {group.list.length}장</span>
        </div>
        <div className="kg-note">
          {group.left > 0
            ? `이번에 더해진 ${group.fresh.length}개 중 ${group.left}개가 아직이에요. 다 떼면 다음 ${KIJU_GROUP}개가 붙어요.`
            : (group.index + 1 < group.groups
              ? '이번 묶음을 다 뗐어요 — 시작하면 다음 묶음이 붙어요'
              : '마지막 묶음까지 다 뗐어요')}
        </div>
        <div className="kg-dots">
          {Array.from({ length: group.groups }, (_, i) => (
            <i key={i} className={`kg-dot${i < group.index ? ' done' : ''}${i === group.index ? ' now' : ''}`} />
          ))}
        </div>
      </div>

      <button className="bigstart" onClick={() => onStart(group.list, `기출 1~${group.to}`, `kiju:g${group.index + 1}`)}>
        <span className="bs-t">{group.index + 1}묶음 회독하기</span>
        <span className="bs-s">
          1~{group.to}번째 {group.list.length}장 — 앞 묶음까지 같이 돌아요
        </span>
      </button>

      {/* 두 번 이상 나온 것만 따로 여는 길. 연휴처럼 시간이 잘린 때는 이쪽이 먼저다 */}
      <button
        className="ghost-btn kj-top"
        onClick={() => onStart(top, '기출 · 두 번 이상', 'kiju:top')}
      >
        두 번 이상 나온 {top.length}개만 돌기
      </button>

      {/* 묶음을 안 따지고 전체를 도는 길. 시험이 코앞일 때 쓴다 */}
      <button
        className="ghost-btn kj-all"
        onClick={() => onStart(cards, '기출 전체', 'kiju')}
      >
        {cards.length}개 전체 돌기
      </button>

      <div className="segment kj-tabs">
        <button className={tab === 'order' ? 'active' : ''} onClick={() => setTab('order')}>출제 순</button>
        <button className={tab === 'year' ? 'active' : ''} onClick={() => setTab('year')}>연도별</button>
      </div>

      {tab === 'order' ? (
        <div className="kj-list">
          {cards.map((c) => (
            <div key={c.id} className={`kj-row${c.kiju.count > 1 ? ' hot' : ''}`} data-mark={markOf(c.id)}>
              <span className="kj-w">
                {c.kanji}
                <small>{c.kana}</small>
              </span>
              <span className="kj-ko">{c.mean.replace(/;/g, ', ')}</span>
              <span className="kj-y">
                {c.kiju.count > 1 && <b>{c.kiju.count}회</b>}
                {c.kiju.years.join(' · ')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="kj-years">
          {years.map((y) => (
            <div key={y.year} className="kj-year">
              <div className="section-label">
                {y.year}
                <span className="mg-sub">{y.items.length}개{y.year === 2020 ? ' · 7월 시험 취소로 1회만' : ''}</span>
              </div>
              <div className="kj-chips">
                {y.items.map((e) => (
                  <span key={e.w} className="kj-chip">{e.w}<small>{e.k}</small></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="set-note kj-note">
        묶음은 「알아요」로 한 번 뗀 것을 셉니다. 회독 기록은 홈·복습과 한 벌이라
        여기서 뗀 것은 복습일이 되면 다시 나와요. 홈의 「새로 배우기」도 이 목록을
        먼저 꺼냅니다.
      </div>
    </>
  );
}
