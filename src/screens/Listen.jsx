import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconPlay, IconSpeaker, IconRepeat, IconArrowLeft } from '../components/Icons.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { koreanVoiceReady, speakJapanese, speakKorean, stopSpeaking } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { todayKey } from '../lib/review.js';
import { cardsForQueue } from '../lib/cards.js';
import { DIRECTIONS, SCOPES, pickListen, scopeCounts, stepsOf } from '../lib/listen.js';

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
 * 방향이 둘이다. 이게 이 화면의 뼈대다.
 *   일본어 → 뜻  듣고 뜻을 떠올린다. 알아듣는 연습
 *   뜻 → 일본어  뜻을 듣고 내가 일본어로 말해 본다. 말하는 연습
 *
 * 여행에서 막히는 쪽은 뒤엣것인데 여태 앞엣것만 있었다. 알아듣기는 되는데
 * 입이 안 떨어지는 건 연습을 한쪽만 해서다.
 *
 * 한 장의 걸음은 stepsOf가 정한다. 걸음마다 무엇을 소리로 낼지, 무엇을
 * 화면에서 가릴지가 방향에 따라 통째로 뒤집힌다. */

export const MODES = [
  { id: 'listen', label: '듣기', sub: '일본어 듣고 뜻 확인' },
  { id: 'shadow', label: '따라 말하기', sub: '듣고 따라 한 번 더' },
];

export const GAPS = [1, 2, 3, 5];

export default function Listen({
  pool, words, sentences, review, settings, onSettingsChange, onClose, onToast,
  initialMode = 'listen',
}) {
  const [mode, setMode] = useState(initialMode);
  /* 어느 쪽을 먼저 들려줄까. 「뜻 → 일본어」가 있어야 입이 열린다 —
     듣고 알아듣는 것과 듣고 말해 보는 것은 다른 연습이다. */
  const [direction, setDirection] = useState(settings.listenDir || 'jp-ko');
  const [scope, setScope] = useState(settings.listenScope || 'today');
  /* 뜻을 듣고 말해 보는 판에서 답을 안 읽어 줄 수 있어야 한다. 읽어 주면
     떠올리기 전에 답이 들려서, 말하는 연습이 아니라 따라 하기가 된다. */
  const [sayAnswer, setSayAnswer] = useState(settings.listenSayAnswer !== false);
  const [step, setStep] = useState(0);
  /* 손으로 건너뛴 횟수. 마지막 장에서 「다음」을 누르면 장도 걸음도 그대로라
     흐름이 다시 안 걸리고 조용히 멈춘다 — 이 숫자를 올려서 다시 걸어 준다. */
  const [nudge, setNudge] = useState(0);
  const [gap, setGap] = useState(settings.listenGap || 2);
  const [count, setCount] = useState(settings.listenCount || 20);
  const [run, setRun] = useState(null);   // { cards, at }

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

  /* 회독 큐를 빌려 쓰지 않는다. 판정을 안 하는 화면이라 「복습으로 열고
     약점을 흩는다」는 순서를 지킬 이유가 없고, 그 큐에 얽히면 범위가 오늘
     몫으로 좁혀져서 늘 같은 것만 들린다. */
  const start = () => {
    const queue = pickListen(pool, review, { scope, count, today: todayKey() });
    const cards = cardsForQueue(queue, words, sentences);
    if (!cards.length) { onToast('이 범위에는 들을 게 없어요'); return; }
    setRun({ cards, at: 0 });
    setStep(0);
  };

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    stopSpeaking();
    setRun(null);
  }, []);

  const card = run?.cards[run.at];

  /* 한 장의 걸음표. 방향에 따라 순서가 통째로 뒤집힌다. */
  const steps = useMemo(
    () => stepsOf(direction, { shadow: mode === 'shadow' }),
    [direction, mode],
  );
  const phase = steps[Math.min(step, steps.length - 1)] || 'jp';
  const last = step >= steps.length - 1;

  /* 답을 소리로 낼지. 방향마다 「답」이 다른 쪽이라 켜고 끄는 칸도 따로다.
       일본어 → 뜻  이면 답은 한국어 뜻   (sayKo)
       뜻 → 일본어  이면 답은 일본어      (sayAnswer) */
  const answerAloud = direction === 'ko-jp' ? sayAnswer : sayKo;

  /* 한 장의 흐름을 여기서 돌린다. 걸음이 바뀔 때마다 다음 걸음을 예약한다.
     말이 끝나는 시각을 알 수 없는 기기가 있어서, 끝났다는 신호가 아니라
     시간으로 넘긴다 — 늦게 끝나면 조금 겹치지만 멈추는 것보다 낫다. */
  useEffect(() => {
    if (!card) return undefined;
    clearTimeout(timer.current);
    const wait = gap * 1000;
    // 문장은 읽는 데 더 걸린다. 글자 수로 어림잡아 기다린다.
    const spoken = Math.min(6000, 900 + (card.kana?.length || 4) * 130);
    const koText = String(card.mean || '').split(';')[0].trim();
    const say = card.kana || card.kanji;

    /* 다음 걸음으로. 마지막 걸음이면 다음 장으로 넘어간다. */
    const go = (after) => {
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        if (!last) { setStep((s) => s + 1); return; }
        setStep(0);
        setRun((r) => {
          if (!r) return r;
          if (r.at + 1 >= r.cards.length) { onToast('다 들었어요'); return null; }
          return { ...r, at: r.at + 1 };
        });
      }, after);
    };

    if (phase === 'jp') {
      /* 「뜻 → 일본어」에서 이 걸음은 답이다. 안 읽어 주기로 했으면 소리 없이
         화면에만 띄운다 — 눈으로 확인할 길까지 막을 이유는 없다. */
      const mute = direction === 'ko-jp' && !sayAnswer;
      if (mute) { go(300 + wait); return () => clearTimeout(timer.current); }

      speakJapanese(say, rate);
      if (direction !== 'ko-jp') { go(spoken + wait); return () => clearTimeout(timer.current); }

      /* ★ 답은 두 번 읽어 준다 ★
         뒤집은 판에서 답은 긴 침묵 뒤에 딱 한 번 스치듯 지나갔다. 「나무」를
         듣고 3초를 말해 본 다음 「き」가 0.3초 나오고 끝이니, 안 읽어 준 것과
         구별이 안 됐다. 한 번은 확인하려고, 한 번은 내가 말한 것과 견주려고
         듣는다 — 「따라 말하기」가 반대 방향에서 하는 것과 같은 이치다.

         그리고 최소 시간을 둔다. 클라우드 음성은 「부르고 → 받고 → 튼다」라
         짧은 낱말은 어림잡은 시간보다 응답이 늦게 올 수 있는데, 그 사이에
         다음 장이 시작되면 그 소리는 취소된다 — 안 읽어 준 것처럼 보인다. */
      const heard = Math.max(1600, spoken);
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        speakJapanese(say, rate);
        go(heard + wait);
      }, heard + 400);
    } else if (phase === 'say') {
      if (direction === 'ko-jp') {
        // 입으로 말해 볼 시간. 여기서는 아무 소리도 안 낸다 — 내가 말할 차례다
        go(spoken + wait);
      } else {
        // 따라 말할 시간을 준 뒤 한 번 더 들려준다
        timer.current = setTimeout(() => {
          if (!alive.current) return;
          speakJapanese(say, rate);
          go(spoken + 400);
        }, spoken + wait);
      }
    } else {
      /* 뜻을 읽어 준다.
         「뜻 → 일본어」에서는 이게 문제다 — 안 읽으면 물어보는 게 없다.
         「일본어 → 뜻」에서는 답이라, 끄고 싶으면 끌 수 있다. */
      const speak = direction === 'ko-jp' || sayKo;
      let koWait = 0;
      if (speak && koText) {
        speakKorean(koText, rate);
        koWait = Math.min(4000, 600 + koText.length * 120);
      }
      go(koWait + Math.max(600, wait));
    }
    return () => clearTimeout(timer.current);
  }, [card, phase, last, nudge, direction, gap, rate, sayKo, sayAnswer, onToast]);

  const skip = (n) => {
    clearTimeout(timer.current);
    stopSpeaking();
    setRun((r) => {
      if (!r) return r;
      const at = Math.min(r.cards.length - 1, Math.max(0, r.at + n));
      return { ...r, at };
    });
    setStep(0);
    setNudge((v) => v + 1);
  };

  const poolSize = useMemo(() => pool.length, [pool]);
  const counts = useMemo(() => scopeCounts(pool, review, todayKey()), [pool, review]);

  // ── 재생 중 ──
  if (run && card) {
    /* 무엇을 가릴지가 방향의 전부다.
       일본어 → 뜻 : 일본어는 늘 보이고, 뜻은 때가 되어야 나온다
       뜻 → 일본어 : 뜻은 늘 보이고, 일본어는 내가 말한 뒤에 나온다 */
    const back = direction === 'ko-jp';
    const showJp = !back || phase === 'jp';
    const showKo = back || phase === 'ko';
    return (
      <div className={`listen play${back ? ' back' : ''}`}>
        <div className="sub-header inline">
          <button className="sub-back" onClick={stop}><IconArrowLeft /> 그만</button>
          <div className="sub-title">{run.at + 1} / {run.cards.length}</div>
        </div>

        <div className="ls-stage" aria-live="polite">
          {showKo && <div className="ls-ko on ls-prompt">{card.mean}</div>}

          <div className={`ls-jp${card.kind === 'sentence' ? ' long' : ''}`}>
            {showJp ? card.kanji : '···'}
          </div>
          <div className="ls-yomi">{showJp ? kanaToHangul(card.kana || card.kanji) : ''}</div>

          {/* 뜻은 때가 되면 나온다. 미리 보이면 듣기가 아니라 읽기가 된다. */}
          {!showKo && <div className="ls-ko">···</div>}

          <div className="ls-phase">
            {phase === 'jp' && (back ? '이게 답이에요 — 두 번 들려줘요' : '듣는 중')}
            {phase === 'say' && (back ? '일본어로 말해 보세요' : '따라 말해 보세요')}
            {phase === 'ko' && (back ? '무슨 말일까요' : '뜻')}
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
          <b>{DIRECTIONS.find((d) => d.id === direction)?.label}</b>
          <span>{count}개 · {gap}초 간격</span>
        </div>
        <button className="ls-go" onClick={() => setAsk(true)} disabled={poolSize === 0}>
          <IconPlay /> 시작
        </button>
      </div>

      <p className="vd-note">
        손이 안 비는 시간에 쓰는 화면이에요. 아무것도 안 눌러도 저절로 흘러가요.
        회독 기록은 건드리지 않아요 — 귀에 넣는 것만 해요.
      </p>

      {/* ★ 방향 ★
          듣고 알아듣는 것과, 듣고 말해 보는 것은 다른 연습이다. 여행에서
          막히는 쪽은 뒤엣것인데 여태 앞엣것만 있었다. */}
      <div className="section-label" style={{ marginTop: 0 }}>방향</div>
      <div className="pickstack">
        {DIRECTIONS.map((d) => (
          <button
            key={d.id}
            className={`pickrow ls-dir${direction === d.id ? ' active' : ''}`}
            data-dir={d.id}
            onClick={() => { setDirection(d.id); onSettingsChange?.({ listenDir: d.id }); }}
          >
            <span className="pk-icon">{d.id === 'ko-jp' ? <IconRepeat /> : <IconSpeaker />}</span>
            <span className="pk-body"><b>{d.label}</b><span>{d.sub}</span></span>
          </button>
        ))}
      </div>
      {direction === 'ko-jp' && !koReady && (
        <p className="set-note">
          이 기기에 한국어 음성이 없어요. 뜻은 화면으로만 보여요 — 소리로 물어보려면
          기기 설정에서 한국어 음성을 받아야 해요.
        </p>
      )}

      {/* ★ 범위 ★
          여태 오늘의 학습 큐를 빌려 써서, 배운 게 500개인데 늘 같은 스무 개만
          들렸다. 무엇을 들을지는 여기서 고른다. */}
      <div className="section-label">무엇을 들을까</div>
      <div className="pickstack">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            className={`pickrow ls-scope${scope === s.id ? ' active' : ''}`}
            data-scope={s.id}
            disabled={counts[s.id] === 0}
            onClick={() => { setScope(s.id); onSettingsChange?.({ listenScope: s.id }); }}
          >
            <span className="pk-body"><b>{s.label}</b><span>{s.sub}</span></span>
            <span className="pk-count">{counts[s.id]}개</span>
          </button>
        ))}
      </div>

      {/* 「따라 말하기」는 들려준 걸 따라 하는 거라 뒤집은 판에는 없다.
          거기서는 안 들려준 걸 내가 먼저 말하니까 — 그 자체가 말하기 연습이다. */}
      {direction === 'jp-ko' && (
        <>
          <div className="section-label">방식</div>
          <div className="pickstack">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`pickrow ls-mode${mode === m.id ? ' active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <span className="pk-icon">{m.id === 'shadow' ? <IconRepeat /> : <IconSpeaker />}</span>
                <span className="pk-body"><b>{m.label}</b><span>{m.sub}</span></span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-label">사이 간격</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">문장 사이 <span className="set-val">{gap}초</span></div>
          <div className="grouppick">
            {GAPS.map((g) => (
              <button key={g} className={gap === g ? 'active' : ''} onClick={() => { setGap(g); onSettingsChange?.({ listenGap: g }); }}>{g}초</button>
            ))}
          </div>
        </div>
      </div>

      {/* 답을 소리로 낼지.
          방향마다 「답」이 다른 쪽이라 켜고 끄는 칸도 따로다. 뒤집어서 말하는
          연습을 할 때 일본어를 읽어 주면, 떠올리기 전에 답이 먼저 들려서
          말하기가 아니라 따라 하기가 된다 — 그래서 끌 수 있어야 한다.
          꺼도 화면에는 뜬다. 맞았는지 확인할 길까지 막을 이유는 없다. */}
      <div className="section-label">답도 소리로</div>
      <div className="card">
        <button
          className="toggle-row setrow ls-sayans"
          onClick={() => {
            if (direction === 'ko-jp') {
              setSayAnswer(!sayAnswer); onSettingsChange?.({ listenSayAnswer: !sayAnswer });
            } else {
              setSayKo(!sayKo); onSettingsChange?.({ listenSayKo: !sayKo });
            }
          }}
          aria-pressed={answerAloud}
          disabled={direction === 'jp-ko' && !koReady}
        >
          <span>
            <span className="set-title">
              {direction === 'ko-jp' ? '일본어 답도 소리로' : '한국어 뜻도 소리로'}
            </span>
            <span className="set-sub">
              {direction === 'ko-jp'
                ? (sayAnswer
                  ? '말해 본 다음에 정답을 들려줘요'
                  : '소리는 안 나와요 — 답은 화면으로 확인해요')
                : (koReady
                  ? '일본어 다음에 뜻을 읽어 줘요 — 화면을 안 봐도 됩니다'
                  : '이 기기에 한국어 음성이 없어요. 뜻은 화면으로만 보여요')}
            </span>
          </span>
          <span className={`toggle${answerAloud && (direction === 'ko-jp' || koReady) ? ' on' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <div className="section-label">개수</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">한 번에 <span className="set-val">{count}개</span></div>
          <div className="grouppick">
            {[10, 20, 30, 50].map((n) => (
              <button key={n} className={count === n ? 'active' : ''} onClick={() => { setCount(n); onSettingsChange?.({ listenCount: n }); }}>{n}</button>
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
            <div className="td-cell">
              <b>{Math.min(count, counts[scope] || 0)}</b>
              <span>{SCOPES.find((s) => s.id === scope)?.label}</span>
            </div>
            <div className="td-cell"><b>{gap}</b><span>초 간격</span></div>
            <div className="td-cell">
              <b>{direction === 'ko-jp' ? '뜻→일' : '일→뜻'}</b>
              <span>{mode === 'shadow' && direction === 'jp-ko' ? '따라 말하기' : '방향'}</span>
            </div>
          </div>
          <p className="set-note">
            {direction === 'ko-jp'
              ? (sayAnswer
                ? '뜻을 들려주고, 말해 본 다음에 일본어를 들려줘요.'
                : '뜻을 들려주고 답은 화면에만 띄워요.')
              : (sayKo && koReady
                ? '일본어 → 뜸 → 뜻까지 소리로 나와요.'
                : '일본어만 소리로 나와요. 뜻은 화면에 뜹니다.')}
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
