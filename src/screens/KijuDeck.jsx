import { useMemo, useState } from 'react';
import { KIJU_SOURCE, kijuByYear, kijuCards, kijuStat } from '../lib/kiju.js';
import { isDoneEnough, stateOf } from '../lib/review.js';

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

      <button className="bigstart" onClick={() => onStart(cards, '기출 단어', 'kiju')}>
        <span className="bs-t">기출 순서대로 시작</span>
        <span className="bs-s">
          {stat.left > 0 ? `많이 나온 것부터 — 아직 ${stat.left}개 남음` : '다 봤어요 — 복습으로 이어져요'}
        </span>
      </button>

      {/* 두 번 이상 나온 것만 따로 여는 길. 연휴처럼 시간이 잘린 때는 이쪽이 먼저다 */}
      <button
        className="ghost-btn kj-top"
        onClick={() => onStart(top, '기출 · 두 번 이상', 'kiju:top')}
      >
        두 번 이상 나온 {top.length}개만 돌기
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
        홈의 「새로 배우기」도 이 목록을 먼저 꺼내요. 기출을 다 보면 나머지 단어로 이어집니다.
      </div>
    </>
  );
}
