import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconSpeaker } from '../components/Icons.jsx';
import { speakIn, speakKorean, stopSpeaking } from '../lib/tts.js';
import { SWISS_UNITS } from '../data/swiss.js';
import { listenPool } from '../lib/swissCourse.js';

/* 독일어 자동재생 — 배운 것을 소리로 흘려 듣기.
 *
 * 일본어 듣기 화면과 같은 뼈대다. 한 장을 독일어 → 뜻 → 독일어 순서로
 * 들려주고 다음 장으로 넘어간다. 마지막 한 번은 끌 수 있다.
 * 스위스 팁은 여기서 안 읽는다 — 흘려 들을 때 두 말이 섞이면 어느 게 표준인지
 * 못 가른다. 팁은 카드와 레슨에서 눌러서 듣는다.
 *
 * 기본은 「배운 것」이다. 모르는 말을 흘려보내는 건 듣기가 아니라 소음이다 —
 * 아직 끝낸 레슨이 없으면 그렇게 말해 주고, 원하면 전부를 들을 수 있다. */

const DE = 'de-DE';
const COUNTS = [10, 20, 30];
const GAPS = [1, 2, 3];

export default function SwissListen({ progress, rate, onQuit, onToast }) {
  const [scope, setScope] = useState('learned');
  const [count, setCount] = useState(20);
  const [gap, setGap] = useState(2);
  const [recap, setRecap] = useState(true);
  const [run, setRun] = useState(null);   // { cards, at }
  const [phase, setPhase] = useState('de');   // de | ko | de2
  const timer = useRef(null);
  const alive = useRef(true);

  const pool = useMemo(() => listenPool(progress, scope), [progress, scope]);

  useEffect(() => () => { alive.current = false; clearTimeout(timer.current); stopSpeaking(); }, []);

  const start = () => {
    if (!pool.length) { onToast?.('아직 들을 게 없어요 — 먼저 레슨을 하나 끝내거나 「전부」를 골라 주세요'); return; }
    const cards = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    setPhase('de');
    setRun({ cards, at: 0 });
  };
  const stop = () => { clearTimeout(timer.current); stopSpeaking(); setRun(null); };
  const card = run ? run.cards[run.at] : null;

  /* 한 장의 흐름. 말이 끝나는 시각을 알 수 없는 기기가 있어 시간으로 넘긴다. */
  useEffect(() => {
    if (!card) return undefined;
    clearTimeout(timer.current);
    const spoken = Math.min(5000, 900 + card.de.length * 110);
    const wait = gap * 1000;
    const go = (after, nextPhase) => {
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        if (nextPhase) { setPhase(nextPhase); return; }
        setPhase('de');
        setRun((r) => {
          if (!r) return r;
          if (r.at + 1 >= r.cards.length) { onToast?.('다 들었어요'); return null; }
          return { ...r, at: r.at + 1 };
        });
      }, after);
    };
    if (phase === 'de') {
      speakIn(card.de, DE, rate, { id: `lp:${card.id}` });
      go(spoken + Math.max(600, wait / 2), 'ko');
    } else if (phase === 'ko') {
      speakKorean(card.ko, 1);
      const koWait = Math.min(4000, 600 + card.ko.length * 120);
      go(koWait + Math.max(600, wait / 2), recap ? 'de2' : null);
    } else {
      speakIn(card.de, DE, rate, { id: `lp2:${card.id}` });
      go(spoken + wait, null);
    }
    return () => clearTimeout(timer.current);
  }, [card, phase, gap, rate, recap]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = (n) => {
    clearTimeout(timer.current);
    stopSpeaking();
    setPhase('de');
    setRun((r) => (r ? { ...r, at: Math.min(r.cards.length - 1, Math.max(0, r.at + n)) } : r));
  };

  if (run && card) {
    return (
      <div className="swp play">
        <div className="sub-header inline">
          <button className="sub-back" onClick={stop}><IconArrowLeft /> 그만</button>
          <div className="sub-title">{run.at + 1} / {run.cards.length}</div>
        </div>
        <div className="swp-stage" aria-live="polite">
          <div className="swp-pic" aria-hidden="true">
            {card.swatch ? <i className="sw-swatch big" style={{ background: card.swatch }} /> : (card.emoji || '🔊')}
          </div>
          <div className={`swp-ko${phase === 'de' ? ' hide' : ''}`}>{phase === 'de' ? '···' : card.ko}</div>
          <div className="swp-sw" lang="de">{card.de}</div>
          {card.han && <div className="swp-han">{card.han}</div>}
          <div className="swp-phase">
            {phase === 'de' && '듣는 중'}
            {phase === 'ko' && '뜻'}
            {phase === 'de2' && '뜻을 알고 한 번 더'}
          </div>
        </div>
        <div className="ls-controls">
          <button className="ghost-btn" onClick={() => skip(-1)} disabled={run.at === 0}>이전</button>
          <button className="ghost-btn" onClick={() => speakIn(card.de, DE, rate, { id: `again:${card.id}` })} aria-label="다시 듣기">
            <IconSpeaker /> 다시
          </button>
          <button className="ghost-btn" onClick={() => skip(1)}>다음</button>
        </div>
        <p className="set-note ls-note">손을 안 대도 넘어가요. 화면이 꺼지면 기기에 따라 멈출 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className="swp">
      <div className="sub-header inline">
        <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 코스로</button>
        <div className="sub-title">자동재생</div>
      </div>

      <div className="card swp-top">
        <button className="submit-btn swp-go" onClick={start} disabled={!pool.length}>
          <IconSpeaker /> 시작 — {Math.min(count, pool.length)}개
        </button>
        <div className="set-note" style={{ marginTop: 8 }}>
          {pool.length
            ? '독일어 → 뜻 → 독일어 순서로 들려주고 넘어가요.'
            : '아직 끝낸 레슨이 없어요. 먼저 레슨을 하나 끝내거나 아래에서 「전부」를 고르세요.'}
        </div>
      </div>

      <div className="section-label">무엇을</div>
      <div className="chiprow swp-scopes">
        {[
          { id: 'learned', label: '배운 것' },
          { id: 'weak', label: '틀렸던 것' },
          { id: 'all', label: '전부' },
          ...SWISS_UNITS.map((u) => ({ id: u.id, label: `${u.emoji} ${u.title}` })),
        ].map((s) => (
          <div key={s.id} className={`chip${scope === s.id ? ' active' : ''}`} data-scope={s.id} onClick={() => setScope(s.id)}>
            {s.label}
          </div>
        ))}
      </div>
      <div className="set-sub" style={{ marginTop: 6 }}>{pool.length}개</div>

      <div className="section-label">몇 개 · 사이 간격</div>
      <div className="card">
        <div className="pickrow-group swp-counts">
          {COUNTS.map((n) => (
            <button key={n} className={`pickrow${count === n ? ' active' : ''}`} onClick={() => setCount(n)}><b>{n}개</b></button>
          ))}
        </div>
        <div className="pickrow-group swp-gaps" style={{ marginTop: 8 }}>
          {GAPS.map((g) => (
            <button key={g} className={`pickrow${gap === g ? ' active' : ''}`} onClick={() => setGap(g)}><b>{g}초</b></button>
          ))}
        </div>
        <button className="toggle-row setrow swp-recap" onClick={() => setRecap(!recap)} aria-pressed={recap} style={{ marginTop: 8 }}>
          <span>
            <span className="set-title">끝에 한 번 더</span>
            <span className="set-sub">뜻을 듣고 나서 독일어를 한 번 더 들려줘요</span>
          </span>
          <span className={`toggle${recap ? ' on' : ''}`} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
