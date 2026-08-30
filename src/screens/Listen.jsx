import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconPlay, IconSpeaker, IconRepeat, IconArrowLeft } from '../components/Icons.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { koreanVoiceReady, speakJapanese, speakKorean, stopSpeaking } from '../lib/tts.js';
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

export default function Listen({ pool, words, sentences, review, settings, onSettingsChange, onClose, onToast }) {
  const [mode, setMode] = useState('listen');
  const [gap, setGap] = useState(settings.listenGap || 2);
  const [count, setCount] = useState(20);
  const [run, setRun] = useState(null);   // { cards, at }
  const [phase, setPhase] = useState('jp'); // jp | ko | say
  /* 뜻도 소리로 낼지. 화면을 못 보는 동안 쓰라고 만든 자리인데 뜻이 눈으로만
     나오면 절반이 안 들린다. 기본은 켬 — 끄고 싶은 사람은 여기서 끈다. */
  const [sayKo, setSayKo] = useState(settings.listenSayKo !== false);
  const [koReady, setKoReady] = useState(() => koreanVoiceReady());
  const [ask, setAsk] = useState(false);   // 시작 전에 한 번 확인
  const timer = useRef(null);
  const alive = useRef(true);

  const rate = settings.speechRate || 1;

  /* 음성 목록은 늦게 채워진다. 처음 물었을 때 없다고 화면에 적어 두면
     실제로는 있는데 없다고 뜬 채로 남는다. */
  useEffect(() => {
    if (koReady || typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    const check = () => setKoReady(koreanVoiceReady());
    const t = setInterval(check, 700);
    window.speechSynthesis.addEventListener?.('voiceschanged', check);
    return () => {
      clearInterval(t);
      window.speechSynthesis.removeEventListener?.('voiceschanged', check);
    };
  }, [koReady]);

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
    /* 목표가 갈래별로 갈리면서 이 자리가 옛 이름(goal)을 그대로 부르고 있었다.
       그러면 여기서 고른 개수가 아무 일도 안 하고 기본값 60개가 나온다.
       듣기는 「20개만 듣고 자자」가 되는 자리라 개수가 안 먹으면 못 쓴다. */
    const per = Math.max(1, Math.round(count / 3));
    const built = buildDailyStudyQueue(pool, review, {
      goals: { fresh: per, review: per, weak: count - per * 2 },
      today: todayKey(),
    });
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
      /* 뜻도 읽어 준다. 안 읽으면 화면을 못 보는 사람에게는 일본어 뒤에
         침묵만 남는다 — 이 화면이 있는 이유가 그건데. */
      const koText = String(card.mean || '').split(';')[0].trim();
      let koWait = 0;
      if (sayKo && koText) {
        speakKorean(koText, rate);
        koWait = Math.min(4000, 600 + koText.length * 120);
      }
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        setRun((r) => {
          if (!r) return r;
          if (r.at + 1 >= r.cards.length) { onToast('다 들었어요'); return null; }
          return { ...r, at: r.at + 1 };
        });
        setPhase('jp');
      }, koWait + Math.max(600, wait));
    }
    return () => clearTimeout(timer.current);
  }, [card, phase, mode, gap, rate, sayKo, onToast]);

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
      {/* 시작 버튼을 맨 위에 작게 둔다.
          아래에 커다랗게 두었더니 화면 하나를 통째로 먹어서, 간격이나 개수를
          바꾸려면 스크롤을 해야 했다. 설정이 세 덩이인 화면에서 그건 매번 드는
          비용이다. 대신 누르는 순간 바로 소리가 나면 놀라니, 무엇으로 시작할지
          한 번 보여 주고 확인을 받는다 — 이어폰을 안 꽂았을 수도 있다. */}
      <div className="ls-top">
        <div className="ls-topbody">
          <b>{MODES.find((m) => m.id === mode)?.label}</b>
          <span>{count}개 · {gap}초 간격</span>
        </div>
        <button className="ls-go" onClick={() => setAsk(true)} disabled={poolSize === 0}>
          <IconPlay /> 시작
        </button>
      </div>

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

      {/* 화면을 못 보는 동안 쓰는 자리라, 뜻도 소리로 나와야 절반이 안 새어 나간다.
          일본어는 클라우드 음성이 있으면 그걸 쓰지만 뜻은 기기 음성으로만 낸다 —
          뜻은 발음 품질이 중요하지 않고, 클라우드 몫은 일본어에 써야 한다. */}
      <div className="section-label">뜻 읽어 주기</div>
      <div className="card">
        <button
          className="toggle-row setrow"
          onClick={() => { setSayKo(!sayKo); onSettingsChange?.({ listenSayKo: !sayKo }); }}
          aria-pressed={sayKo}
          disabled={!koReady}
        >
          <span>
            <span className="set-title">한국어 뜻도 소리로</span>
            <span className="set-sub">
              {koReady
                ? '일본어 다음에 뜻을 읽어 줘요 — 화면을 안 봐도 됩니다'
                : '이 기기에 한국어 음성이 없어요. 뜻은 화면으로만 보여요'}
            </span>
          </span>
          <span className={`toggle${sayKo && koReady ? ' on' : ''}`} aria-hidden="true" />
        </button>
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

      <p className="set-note">
        이어폰을 끼고 화면을 꺼도 이어지게 해 뒀지만, 기기와 브라우저에 따라 멈출 수 있어요.
        아이폰 사파리는 화면이 꺼지면 대개 멈춰요.
      </p>

      {/* 무엇으로 시작하는지 한 번 보여 주고 확인을 받는다 */}
      <BottomSheet open={ask} onClose={() => setAsk(false)}>
        <div className="ls-ask">
          <h3>이렇게 시작할까요?</h3>
          <div className="td-mix">
            <div className="td-cell"><b>{count}</b><span>개</span></div>
            <div className="td-cell"><b>{gap}</b><span>초 간격</span></div>
            <div className="td-cell">
              <b>{mode === 'shadow' ? '따라' : '듣기'}</b>
              <span>{mode === 'shadow' ? '말하기' : '만'}</span>
            </div>
          </div>
          <p className="set-note">
            {sayKo && koReady
              ? '일본어 → 뜸 → 뜻까지 소리로 나와요.'
              : '일본어만 소리로 나와요. 뜻은 화면에 뜹니다.'}
            {' '}이어폰을 꽂았는지 한 번 보세요.
          </p>
          <button className="submit-btn" onClick={() => { setAsk(false); start(); }}>
            <IconPlay /> 재생 시작
          </button>
          <button className="ghost-btn" onClick={() => setAsk(false)}>아니요</button>
        </div>
      </BottomSheet>
    </div>
  );
}
