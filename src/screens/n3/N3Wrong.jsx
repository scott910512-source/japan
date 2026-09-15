import { useMemo, useState } from 'react';
import { IconArrowLeft, IconChevron } from '../../components/Icons.jsx';
import { wrongNotes, weakPatterns, questionById, refTitle, WRONG_CATS } from '../../lib/n3.js';
import { QText } from './QuizRunner.jsx';

/* 오답노트 — 틀린 문제는 자동으로 여기 온다. 두 번 이어 맞히면 빠진다.
   위에는 「최근 약점」 — 반복해서 틀리는 유형(레슨·단어·한자)을 보여 준다. */
export default function N3Wrong({ n3, onWeak, onOpenRef, onBack }) {
  const notes = useMemo(() => wrongNotes(n3), [n3]);
  const patterns = useMemo(() => weakPatterns(n3, 6), [n3]);
  const [cat, setCat] = useState('all');
  const list = cat === 'all' ? notes.list : (notes.byCat[cat] || []);

  return (
    <div className="n3-wrong">
      <div className="sub-header inline">
        <button className="sub-back" onClick={onBack}><IconArrowLeft /> 코스로</button>
        <div className="sub-title">오답노트</div>
      </div>

      <div className="section-label">최근 약점</div>
      {patterns.length === 0 ? (
        <div className="card set-note">아직 반복해서 틀린 유형이 없어요. 같은 문법·단어를 두 번 넘게 틀리면 여기 떠요.</div>
      ) : (
        <div className="card n3-patterns">
          {patterns.map((p) => (
            <button key={p.ref} className="n3-pattern" data-ref={p.ref} onClick={() => onOpenRef?.(p.ref)}>
              <b>{p.title}</b><span>오답 {p.w} · 정답률 {100 - p.rate}%</span><IconChevron className="chev" />
            </button>
          ))}
          <button className="submit-btn n3-weakgo" onClick={onWeak} style={{ marginTop: 8 }}>약점만 공부하기</button>
        </div>
      )}

      <div className="section-label">틀린 문제 {notes.list.length}</div>
      <div className="chiprow n3-cats">
        <button className={`chip${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}>전체 {notes.list.length}</button>
        {WRONG_CATS.map((c) => (
          <button key={c.id} className={`chip${cat === c.id ? ' active' : ''}`} data-cat={c.id} onClick={() => setCat(c.id)}>{c.label} {notes.byCat[c.id]?.length || 0}</button>
        ))}
      </div>
      {list.length === 0 && <div className="empty-state">여기 아무것도 없으면 좋은 거예요.</div>}
      <div className="stack">
        {list.map((w) => {
          const q = questionById(w.qid);
          if (!q) return null;
          return (
            <div key={w.qid} className="card n3-wrongcard" data-qid={w.qid}>
              <div className="n3-wq">{q.type === 'order' ? `${q.before} ★ ${q.after}` : <QText q={q} />}</div>
              <div className="n3-wmeta">
                <span>{WRONG_CATS.find((c) => c.id === w.cat)?.label || w.cat} · {w.c}번 틀림{w.ok ? ` · 최근 ${w.ok}번 맞힘` : ''}</span>
                {q.ref && <button className="n3-reflink" onClick={() => onOpenRef?.(q.ref)}>{refTitle(q.ref)} →</button>}
              </div>
              <div className="n3-wrow ok">정답: {q.answer}{q.expl ? ` — ${q.expl}` : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
