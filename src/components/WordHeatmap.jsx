import { useMemo, useState } from 'react';
import { buildWordMap, totalCounts, MAP_STATES } from '../lib/wordmap.js';

/* 전체 단어 지도 — 모든 낱말을 작은 칸 하나씩, 기억 상태 색으로(lib/wordmap.js).
 * 레벨을 고르면 그 레벨만, 칸을 누르면 그 낱말이 아래에 뜬다. 칸이 2천 개가 넘어도 그냥 div라 가볍다. */
export default function WordHeatmap({ words = [], review = {}, ledger = null, first = null }) {
  const groups = useMemo(() => buildWordMap(words, review, ledger, { first }), [words, review, ledger, first]);
  const [level, setLevel] = useState('all');
  const [picked, setPicked] = useState(null);
  const shown = level === 'all' ? groups : groups.filter((g) => g.level === level);
  const counts = totalCounts(shown);
  const total = shown.reduce((n, g) => n + g.cells.length, 0);
  const touched = total - counts.new;
  const label = Object.fromEntries(MAP_STATES.map((s) => [s.id, s.label]));

  return (
    <div className="card wmap">
      <div className="wmap-tabs" role="tablist">
        {[{ id: 'all', label: '전체' }, ...groups.map((g) => ({ id: g.level, label: g.level }))].map((t) => (
          <button key={t.id} role="tab" aria-selected={level === t.id} className={`chip${level === t.id ? ' active' : ''}`}
            onClick={() => { setLevel(t.id); setPicked(null); }}>{t.label}</button>
        ))}
      </div>
      <div className="wmap-sum">
        <b>{touched}</b> / {total}개 만남 · 외움 <b>{counts.master}</b> · 약점 <b>{counts.weak}</b>
      </div>
      <div className="wmap-legend">
        {MAP_STATES.map((s) => (
          <span key={s.id} className="wl-item"><i className={`wm-cell s-${s.id}`} />{s.label} {counts[s.id]}</span>
        ))}
      </div>
      {shown.map((g) => (
        <div key={g.level} className="wmap-group">
          {level === 'all' && <div className="wmap-lv">{g.level} <small>{g.cells.length - g.counts.new} / {g.cells.length}</small></div>}
          {/* 칸은 단추가 아니라 작은 점이다(눌러서 보는 건 덤) — 2천 개의 단추를 만들지 않고 줄 하나가 누른 칸을 알아낸다 */}
          <div className="wmap-grid" onClick={(e) => {
            const id = e.target?.dataset?.id;
            if (!id) return;
            const c = g.cells.find((x) => x.id === id);
            setPicked(picked?.id === id ? null : c);
          }}>
            {g.cells.map((c) => (
              <i key={c.id} data-id={c.id} className={`wm-cell s-${c.state}${picked?.id === c.id ? ' on' : ''}`}
                title={`${c.jp} · ${c.mean} · ${label[c.state]}`} />
            ))}
          </div>
        </div>
      ))}
      {picked ? (
        <div className="wmap-pick">
          <b lang="ja">{picked.jp}</b>
          {picked.kana && picked.kana !== picked.jp && <span lang="ja">{picked.kana}</span>}
          <span>{picked.mean}</span>
          <em className={`wm-tag s-${picked.state}`}>{label[picked.state]}</em>
        </div>
      ) : (
        <div className="set-note">칸을 누르면 그 단어가 보여요. 왼쪽 위부터 새로 배우기가 고르는 차례(기출 먼저)예요.</div>
      )}
    </div>
  );
}
