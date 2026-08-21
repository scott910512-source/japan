import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconPlay, IconSpeaker, IconRepeat, IconArrowLeft } from '../components/Icons.jsx';
import { speakJapanese, stopSpeaking } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { todayKey } from '../lib/review.js';
import { buildDailyStudyQueue } from '../lib/daily.js';
import { cardsForQueue } from '../lib/cards.js';

/* 듣기 · 따라 말하기 — 화면을 못 보는 동안의 학습.
 *
 * 회독은 손이 필요하다. 카드를 뒤집고 세 버튼 중 하나를 눌러야 한다. 그런데
 * 일본어를 제일 많이 쓸 수 있는 시간은 손이 안 비는 시간이다 — 걷는 중,
 * 지하철, 설거지. 그때는 듣고 따라 하는 것밖에 못 한다.
 *
 * 그래서 여기서는 아무것도 안 눌러도 흘러간다. 자기평가도 안 받는다 —
 * 손이 없는데 판정을 시키면 그게 또 손이 필요한 일이 된다. 회독 기록은
 * 건드리지 않고, 귀에 넣는 것만 한다.
 *
 * 두 가지 방식이 있다.
 *   듣기      — 일본어 → 뜸 → 한국어 → 뜸 → 다음
 *   따라 말하기 — 일본어 → 따라 말할 시간 → 다시 한 번 → 다음 */

export const MODES = [
  { id: 'listen', label: '듣기', sub: '일본어 듣고 뜻 확인' },
  { id: 'shadow', label: '따라 말하기', sub: '듣고 따라 한 번 더' },
];

export const GAPS = [1, 2, 3, 5];

export default function Listen({ pool, words, sentences, review, settings, onClose, onToast }) {
  const [mode, setMode] = useState('listen');
  const [gap, setGap] = useState(settings.listenGap || 2);
  const [count, setCount] = useState(20);
  const [run, setRun] = useState(null);   // { cards, at }
  const [phase, setPhase] = useState('jp'); // jp | ko | say
  const timer = useRef(null);
  const alive = useRef(true);

  const rate = settings.speechRate || 1;

  useEffect(() => () => {
    alive.current = false;
    clearTimeout(timer.current);
    stopSpeaking();
  }, []);

  /* 화면이 꺼져도 소리는 이어지는 게 이 화면의 존재 이유다. 다만 브라우저는
     화면이 잠기면 타이머를 늦추거나 멈춘다 — 어디까지 되는지는 기기마다
     다르다. 그래서 "됩니다"라고 적지 않고, 안 되면 안 된다고만 적는다. */
  const wake = useRef(null);
  useEffect(() => {
    if (!run) return undefined;
    let released = false;
    navigator.wakeLock?.request('screen').then((s) => {
      if (released) { s.release(); return; }
      wake.current = s;
    }).catch(() => { /* 못 잡아도 그냥 진행한다 */ });
    return () => {
      released = true;
      wake.current?.release().catch(() => {});
      wake.current = null;
    };
  }, [run]);

  const start = () => {
    const built = buildDailyStudyQueue(pool, review, { goal: count, today: todayKey() });
    const cards = cardsForQueue(built.queue, words, sentences);
    if (!cards.length) { onToast('들을 게 없어요'); return; }
    setRun({ cards, at: 0 });
    setPhase('jp');
  };

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    stopSpeaking();
    setRun(null);
  }, []);

  const card = run?.cards[run.at];

  /* 한 장의 흐름을 여기서 돌린다. phase가 바뀔 때마다 다음 걸음을 예약한다.
     말이 끝나는 시각을 알 수 없는 기기가 있어서, 끝났다는 신호가 아니라
     시간으로 넘긴다 — 늦게 끝나면 조금 겹치지만 멈추는 것보다 낫다. */
  useEffect(() => {
    if (!card) return undefined;
    clearTimeout(timer.current);
    const wait = gap * 1000;
    // 문장은 읽는 데 더 걸린다. 글자 수로 어림잡아 기다린다.
    const spoken = Math.min(6000, 900 + (card.kana?.length || 4) * 130);

    if (phase === 'jp') {
      speakJapanese(card.kana || card.kanji, rate);
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        setPhase(mode === 'shadow' ? 'say' : 'ko');
      }, spoken + wait);
    } else if (phase === 'say') {
      // 따라 말할 시간을 준 뒤 한 번 더 들려준다
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        speakJapanese(card.kana || card.kanji, rate);
        timer.current = setTimeout(() => alive.current && setPhase('ko'), spoken + 400);
      }, spoken + wait);
    } else {
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        setRun((r) => {
          if (!r) return r;
          if (r.at + 1 >= r.cards.length) { onToast('다 들었어요'); return null; }
          return { ...r, at: r.at + 1 };
        });
        setPhase('jp');
      }, Math.max(600, wait));
    }
    return () => clearTimeout(timer.current);
  }, [card, phase, mode, gap, rate, onToast]);

  const skip = (n) => {
    clearTimeout(timer.current);
    stopSpeaking();
    setRun((r) => {
      if (!r) return r;
      const at = Math.min(r.cards.length - 1, Math.max(0, r.at + n));
      return { ...r, at };
    });
    setPhase('jp');
  };

  const poolSize = useMemo(() => pool.length, [pool]);

  // ── 재생 중 ──
  if (run && card) {
    const showKo = phase === 'ko';
    return (
      <div className="listen play">
        <div className="sub-header inline">
          <button className="sub-back" onClick={stop}><IconArrowLeft /> 그만</button>
          <div className="sub-title">{run.at + 1} / {run.cards.length}</div>
        </div>

        <div className="ls-stage" aria-live="polite">
          <div className={`ls-jp${card.kind === 'sentence' ? ' long' : ''}`}>{card.kanji}</div>
          <div className="ls-yomi">{kanaToHangul(card.kana || card.kanji)}</div>

          {/* 뜻은 때가 되면 나온다. 미리 보이면 듣기가 아니라 읽기가 된다. */}
          <div className={`ls-ko${showKo ? ' on' : ''}`}>{showKo ? card.mean : '···'}</div>

          <div className="ls-phase">
            {phase === 'jp' && '듣는 중'}
            {phase === 'say' && '따라 말해 보세요'}
            {phase === 'ko' && '뜻'}
          </div>
        </div>

        <div className="ls-controls">
          <button className="ghost-btn" onClick={() => skip(-1)} disabled={run.at === 0}>이전</button>
          <button className="ghost-btn" onClick={() => speakJapanese(card.kana || card.kanji, rate)} aria-label="다시 듣기">
            <IconSpeaker /> 다시
          </button>
          <button className="ghost-btn" onClick={() => skip(1)}>다음</button>
        </div>
        <p className="set-note ls-note">
          손을 안 대도 넘어가요. 화면이 꺼지면 기기에 따라 멈출 수 있어요.
        </p>
      </div>
    );
  }

  // ── 시작 화면 ──
  return (
    <div className="listen">
      <p className="vd-note">
        손이 안 비는 시간에 쓰는 화면이에요. 아무것도 안 눌러도 일본어 → 뜸 → 뜻 순서로 흘러가요.
        회독 기록은 건드리지 않아요 — 귀에 넣는 것만 해요.
      </p>

      <div className="section-label" style={{ marginTop: 0 }}>방식</div>
      <div className="pickstack">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`pickrow${mode === m.id ? ' active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            <span className="pk-icon">{m.id === 'shadow' ? <IconRepeat /> : <IconSpeaker />}</span>
            <span className="pk-body"><b>{m.label}</b><span>{m.sub}</span></span>
          </button>
        ))}
      </div>

      <div className="section-label">사이 간격</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">문장 사이 <span className="set-val">{gap}초</span></div>
          <div className="grouppick">
            {GAPS.map((g) => (
              <button key={g} className={gap === g ? 'active' : ''} onClick={() => setGap(g)}>{g}초</button>
            ))}
          </div>
        </div>
      </div>

      <div className="section-label">개수</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">한 번에 <span className="set-val">{count}개</span></div>
          <div className="grouppick">
            {[10, 20, 30, 50].map((n) => (
              <button key={n} className={count === n ? 'active' : ''} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <button className="bigstart" onClick={start} disabled={poolSize === 0}>
        <span className="bs-t"><IconPlay /> 재생 시작</span>
        <span className="bs-s">오늘 볼 것 중에서 {count}개</span>
      </button>

      <p className="set-note">
        이어폰을 끼고 화면을 꺼도 이어지게 해 뒀지만, 기기와 브라우저에 따라 멈출 수 있어요.
        아이폰 사파리는 화면이 꺼지면 대개 멈춰요.
      </p>
    </div>
  );
}
