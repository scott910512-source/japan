import { useMemo, useState } from 'react';
import { grammarMapCells, GRAMMAR_MAP_STATES } from '../lib/grammarUse.js';
import { buildWordMap, totalCounts, MAP_STATES } from '../lib/wordmap.js';
import { todayKey } from '../lib/review.js';
import '../styles/grammar-use.css';

/* ★ 문법 지도 ★ 단어 지도(WordHeatmap)와 같은 색 단계로 문법을 한눈에.
 *   · 활용 — 「외운 단어로 문법 활용」 24개 문법을 이름 붙은 칸으로(확인한 날 수 · 약점). 누르면 그 문법 연습
 *   · N5 · N4 · N3 — 문법 카드(gp-*) 외운 정도, 작은 칸 하나씩(단어 지도와 같은 셈)
 * cardsTabs=false면 활용 칸만(문법 메뉴 「활용」 탭 머리). */
export default function GrammarMap({ gu = null, words = [], review = {}, onPick = null, cardsTabs = true }) {
  const today = todayKey();
  const cells = useMemo(() => grammarMapCells(gu, today), [gu, today]);
  const cardGroups = useMemo(
    () => (cardsTabs ? buildWordMap(words.filter((w) => w.grammar), review, null, { grammarByLevel: true }) : []),
    [cardsTabs, words, review],
  );
  const [tab, setTab] = useState('use');
  const [picked, setPicked] = useState(null);
  const tabs = [{ id: 'use', label: `활용 ${cells.length}` }, ...cardGroups.map((g) => ({ id: g.level, label: `${g.level} 카드` }))];

  const count = (id) => cells.filter((c) => c.state === id).length;
  const weak = cells.filter((c) => c.weak).length;
  const checked = cells.filter((c) => ['round2', 'round3', 'done'].includes(c.state) && !c.weak).length;
  const pick = picked && cells.find((c) => c.gid === picked);

  const group = cardGroups.find((g) => g.level === tab);
  const gCounts = group ? totalCounts([group]) : null;
  const label = Object.fromEntries(MAP_STATES.map((s) => [s.id, s.label]));
  const [cardPick, setCardPick] = useState(null);

  return (
    <div className={`card gmap${cardsTabs ? "" : " gmap-use"}`}>
      {tabs.length > 1 && (
        <div className="gmap-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" data-tab={t.id} aria-selected={tab === t.id} className={`chip${tab === t.id ? ' active' : ''}`}
              onClick={() => { setTab(t.id); setPicked(null); setCardPick(null); }}>{t.label}</button>
          ))}
        </div>
      )}

      {tab === 'use' && (
        <>
          <div className="gmap-sum">
            <b>{checked}</b> / {cells.length}개 확인 · 약점 <b>{weak}</b> · 안 봄 <b>{count('fresh')}</b>
          </div>
          <div className="gmap-legend">
            {GRAMMAR_MAP_STATES.map((s) => (
              <span key={s.id} className="wl-item"><i className={`wm-cell s-${s.id}`} />{s.label} {count(s.id)}</span>
            ))}
            <span className="wl-item"><i className="wm-cell s-weak" />약점 {weak}</span>
          </div>
          {['N5', 'N4'].map((lv) => (
            <div key={lv} className="gmap-group">
              <div className="gmap-lv">{lv === 'N5' ? '기초 (N5)' : 'N4 초반'}</div>
              <div className="gmap-grid">
                {cells.filter((c) => c.level === lv).map((c) => (
                  <button key={c.gid} type="button" data-gid={c.gid}
                    className={`gmap-cell s-${c.state}${c.weak ? ' s-weak' : ''}${picked === c.gid ? ' on' : ''}`}
                    title={`${c.title} · ${c.tag}`} aria-label={`${c.title} · ${c.tag}`}
                    onClick={() => setPicked(picked === c.gid ? null : c.gid)}>
                    <span lang="ja">{c.short}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {pick && (
            <div className="gmap-pick gmap-pick-use">
              <b className="gmap-pick-title">{pick.title}</b>
              <em className={`wm-tag s-${pick.weak ? 'weak' : pick.state}`}>{pick.tag}</em>
              {pick.due && <small>다음 확인 {pick.due <= today ? '오늘' : pick.due.slice(5).replace('-', '/')}</small>}
              {onPick && <button type="button" className="chip active gmap-go" onClick={() => onPick(pick.gid)}>이 문법 연습</button>}
            </div>
          )}
        </>
      )}

      {group && (
        <>
          <div className="gmap-sum">
            <b>{gCounts.seen}</b> / {group.cells.length}개 만남 · 익숙함 <b>{gCounts.done + gCounts.long}</b> · 약점 <b>{gCounts.weak}</b>
          </div>
          <div className="gmap-legend">
            {MAP_STATES.filter((s) => !['long', 'self'].includes(s.id) || gCounts[s.id] > 0).map((s) => (
              <span key={s.id} className="wl-item"><i className={`wm-cell s-${s.id}`} />{s.label} {gCounts[s.id]}</span>
            ))}
          </div>
          <div className="gmap-cards" onClick={(e) => {
            const id = e.target?.dataset?.id;
            if (!id) return;
            const c = group.cells.find((x) => x.id === id);
            setCardPick(cardPick?.id === id ? null : c);
          }}>
            {group.cells.map((c) => (
              <i key={c.id} data-id={c.id} className={`wm-cell s-${c.state}${c.weak ? ' s-weak' : ''}${cardPick?.id === c.id ? ' on' : ''}`}
                title={`${c.jp} · ${c.mean} · ${label[c.state]}`} />
            ))}
          </div>
          {cardPick && (
            <div className="gmap-pick">
              <b>{cardPick.jp}</b>
              <em>{cardPick.mean}</em>
              <em className={`wm-tag s-${cardPick.weak ? 'weak' : cardPick.state}`}>{label[cardPick.state]}</em>
            </div>
          )}
        </>
      )}
    </div>
  );
}
