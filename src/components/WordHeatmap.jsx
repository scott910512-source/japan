import { useMemo, useState } from 'react';
import { buildWordMap, totalCounts, MAP_STATES, FACET_VIEWS } from '../lib/wordmap.js';
import { MASTER_STREAK } from '../lib/review.js';
import { weakRank } from '../lib/weak.js';

/* 전체 단어 지도 — 모든 낱말을 작은 칸 하나씩, 기억 상태 색으로(lib/wordmap.js).
 * 레벨을 고르면 그 레벨만, 칸을 누르면 그 낱말이 아래에 뜬다. 칸이 2천 개가 넘어도 그냥 div라 가볍다. */
export default function WordHeatmap({ words = [], review = {}, ledger = null, first = null, onStudy = null }) {
  /* 칸 색 기준 — 세 칸 모두(카드 단계 = 가장 낮은 칸) · 뜻 · 읽기 · 떠올리기 */
  const [facet, setFacet] = useState(null);
  const groups = useMemo(() => buildWordMap(words, review, ledger, { first, facet }), [words, review, ledger, first, facet]);
  /* 처음엔 지금 공부 중인 레벨 하나만 — 전체(2천7백 칸)를 다 펼치면 폰에서 몇 화면을 내려야 한다.
     공부 중인 레벨 = 아직 안 본 낱말이 남은 첫 레벨(N5 → N4 → N3) */
  const [level, setLevel] = useState(() => (groups.find((g) => g.counts.fresh > 0) || groups[0])?.level || 'all');
  const [picked, setPicked] = useState(null);
  const shown = level === 'all' ? groups : groups.filter((g) => g.level === level);
  const counts = totalCounts(shown);
  const total = shown.reduce((n, g) => n + g.cells.length, 0);
  /* 만남 = 한 번이라도 본 낱말(홈 「본 단어」 · 기록 「본 단어」와 같은 셈). 시험에서만 틀린 낱말은 안 센다 */
  const touched = counts.seen;
  const label = Object.fromEntries(MAP_STATES.map((s) => [s.id, s.label]));
  /* 범례는 기록 화면 「기억 수준」과 같은 단계 · 같은 이름. 장기복습 · 이미 알아요는 있을 때만 */
  const legend = MAP_STATES.filter((s) => !['long', 'self'].includes(s.id) || counts[s.id] > 0);
  /* ★ 가장 약한 10개 ★ 지금 보는 묶음(레벨 탭)에서 약점 점수가 높은 순서(lib/weak.js weakRank — 금방 잊은 것 >
     잊은 것 > 몰라요 · 시험 오답 > 애매해요). 「이 10개 반복 학습」으로 바로 한 판 */
  const top = useMemo(() => {
    const ids = shown.flatMap((g) => g.cells.map((c) => c.id));
    const byId = new Map(shown.flatMap((g) => g.cells.map((c) => [c.id, c])));
    return weakRank(ids, review, ledger || {}).slice(0, 10).map((r) => byId.get(r.id)).filter(Boolean);
  }, [shown, review, ledger]);

  return (
    <div className="card wmap">
      <div className="wmap-tabs" role="tablist">
        {[...groups.map((g) => ({ id: g.level, label: g.level })), { id: 'all', label: '전체' }].map((t) => (
          <button key={t.id} role="tab" aria-selected={level === t.id} className={`chip${level === t.id ? ' active' : ''}`}
            onClick={() => { setLevel(t.id); setPicked(null); }}>{t.label}</button>
        ))}
      </div>
      <div className="wmap-facets segment" role="group" aria-label="칸 색 기준">
        {FACET_VIEWS.map((f) => (
          <button key={f.id || 'all'} type="button" data-facet={f.id || 'all'} className={facet === f.id ? 'active' : ''} aria-pressed={facet === f.id}
            onClick={() => { setFacet(f.id); setPicked(null); }}>{f.label}</button>
        ))}
      </div>
      {facet && <div className="set-note wmap-facet-note">{FACET_NOTE[facet]}</div>}
      <div className="wmap-sum">
        <b>{touched}</b> / {total}개 만남 · 익숙함 <b>{counts.done + counts.long}</b> · 약점 <b>{counts.weak}</b>
      </div>
      <div className="wmap-legend">
        {legend.map((s) => (
          <span key={s.id} className="wl-item"><i className={`wm-cell s-${s.id}`} />{s.label} {counts[s.id]}</span>
        ))}
        {/* 약점은 단계가 아니라 덧칠 — 약점인 칸도 위 단계 개수에 들어 있다 */}
        <span className="wl-item"><i className="wm-cell s-weak" />약점 {counts.weak}</span>
        {facet === 'read' && counts.na > 0 && <span className="wl-item"><i className="wm-cell s-na" />가나 단어(읽기 없음) {counts.na}</span>}
      </div>
      <div className={`wmap-body${picked ? ' has-pick' : ''}`}>
        <div className="wmap-groups">
        {shown.map((g) => (
          <div key={g.level} className="wmap-group">
            {level === 'all' && <div className="wmap-lv">{g.level} <small>{g.counts.seen} / {g.cells.length}</small></div>}
            {/* 칸은 단추가 아니라 작은 점이다(눌러서 보는 건 덤) — 2천 개의 단추를 만들지 않고 줄 하나가 누른 칸을 알아낸다 */}
            <div className="wmap-grid" onClick={(e) => {
              const id = e.target?.dataset?.id;
              if (!id) return;
              const c = g.cells.find((x) => x.id === id);
              setPicked(picked?.id === id ? null : c);
            }}>
              {g.cells.map((c) => (
                <i key={c.id} data-id={c.id} className={`wm-cell s-${c.state}${c.weak ? ' s-weak' : ''}${picked?.id === c.id ? ' on' : ''}`}
                  title={`${c.jp} · ${c.mean} · ${label[c.state] || '읽기 없음'}${c.weak ? ' · 약점' : ''}`} />
              ))}
            </div>
          </div>
        ))}
        </div>
        {/* ★ 누른 칸의 단어 ★ 지도 바로 옆(넓은 화면) · 바로 밑(폰)에 작게 — 단어 · 읽기 · 뜻, 세 칸은 한 줄로 */}
        <aside className={`wmap-side${picked ? ' wmap-pick' : ' empty'}`} aria-live="polite">
          {picked ? (
            <>
              <b lang="ja">{picked.jp}</b>
              {picked.kana && picked.kana !== picked.jp && <span className="ws-kana" lang="ja">{picked.kana}</span>}
              <span className="ws-mean">{picked.mean}</span>
              <span className="ws-tags">
                <em className={`wm-tag s-${picked.state}`}>{label[picked.state] || '읽기 없음'}</em>
                {picked.weak && <em className="wm-tag s-weak">약점</em>}
              </span>
              {/* 세 칸 — 단어 단계는 가장 낮은 칸이라 무엇이 외워졌는지는 여기서 본다 */}
              {picked.fx && (
                <ul className="wmap-fx">
                  {picked.fx.map((f) => (
                    <li key={f.key} data-facet={f.key} title={`${FACET_HOW[f.key]}${f.due ? ` · 다음 ${f.due}` : ''}`}
                      className={f.na ? 'na' : f.lv >= MASTER_STREAK ? 'done' : f.lv > 0 ? 'ok' : 'zero'}>
                      <i className="fx-name">{f.label}</i> <span>{facetText(f)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <small>칸을 누르면 여기에 단어가 떠요</small>
          )}
        </aside>
      </div>
      {/* ★ 세 칸이 묻는 것 ★ 지도 바로 밑에 늘 — 색 기준 단추 · 누른 단어의 「뜻 1번 · 읽기 0번」이 무슨 뜻인지 */}
      <ul className="wmap-howto">
        <li><b>뜻</b> 일본어 단어 → 한국어 뜻 <small>(소리만 듣고 뜻 맞히기도 지금은 여기서 셈)</small></li>
        <li><b>읽기</b> 한자만 보고 → 발음(가나)</li>
        <li><b>떠올리기</b> 한국어 뜻 → 일본어 단어</li>
      </ul>
      {top.length > 0 && (
        <div className="wmap-top">
          <div className="wmap-top-head">
            <b>가장 약한 단어 TOP {top.length}</b>
            {onStudy && <button type="button" className="chip active wmap-top-go" onClick={() => onStudy(top.map((c) => c.id))}>이 {top.length}개 반복 학습</button>}
          </div>
          <ol className="wmap-top-list">
            {top.map((c) => (
              <li key={c.id}>
                <button type="button" className={`wmap-top-row${picked?.id === c.id ? ' on' : ''}`} onClick={() => setPicked(picked?.id === c.id ? null : c)}>
                  <b lang="ja">{c.jp}</b>
                  {c.kana && c.kana !== c.jp && <span lang="ja">{c.kana}</span>}
                  <em>{c.mean}</em>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="set-note">왼쪽 위부터 새로 배우기가 고르는 차례(기출 먼저)예요.</div>
    </div>
  );
}

/* 세 칸이 묻는 것 — 회독 화면의 세 칸과 같은 뜻 */
const FACET_HOW = { mean: '일본어 보고 한국어 뜻', read: '한자 보고 읽는 소리', prod: '한국어 보고 일본어 떠올리기' };
const FACET_NOTE = {
  mean: '뜻 칸 기준 — 일본어를 보고 뜻을 아는지',
  read: '읽기 칸 기준 — 한자를 보고 소리(가나)를 아는지. 가나로만 쓰는 단어는 읽기 칸이 없어요',
  prod: '떠올리기 칸 기준 — 한국어를 보고 일본어가 떠오르는지',
};
function facetText(f) {
  if (f.na) return '없음(가나)';
  if (!f.seen) return '안 봄';
  /* 지도 단계 이름(확인 1단계 …)과 헷갈리지 않게 칸은 「복습일에 맞힌 횟수」로 — 4번이면 익숙함 */
  return f.lv >= MASTER_STREAK ? '익숙함' : `${f.lv}번`;
}
