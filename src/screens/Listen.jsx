import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconPlay, IconSpeaker, IconRepeat, IconArrowLeft } from '../components/Icons.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { koreanVoiceListed, speechReady, speakJapanese, speakKorean, stopSpeaking } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { todayKey } from '../lib/review.js';
import { cardsForQueue } from '../lib/cards.js';
import { DIRECTIONS, SCOPES, blocksIn, nextAt, pickListen, scopeCounts, stepsOf } from '../lib/listen.js';
import { kijuCards } from '../lib/kiju.js';
import { markBusy } from '../lib/busy.js';

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

/* 한 번에 몇 장.
 *
 * ★ 100까지 연다 ★
 *
 * 50이 위 끝이었다. 「자기 전에 스무 개」를 기준으로 잡은 숫자인데, 기출
 * 205개처럼 한 덩어리를 정해 놓고 도는 쓰임이 생기면서 모자랐다 — 50으로
 * 끊으면 같은 범위를 네 번 나눠 돌아야 하고, 그때마다 어디까지 들었는지는
 * 아무도 안 적어 준다(듣기는 판정을 안 하니 진도가 없다).
 *
 * 100이면 기출 절반이 한 번에 돈다. 한 장에 10초 남짓이니 20분쯤이다 —
 * 출퇴근 한 편 길이라 여기서 끊는다. 더 늘리면 「틀어 놓고 안 듣는」 길이가
 * 되고, 그건 들은 것으로 세면 안 되는 시간이다. */
export const COUNTS = [10, 20, 30, 50, 100];

export default function Listen({
  pool, words, sentences, review, settings, onSettingsChange, onClose, onToast,
  onActivity, onQuiz, initialMode = 'listen',
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
  /* 구간별로 끊어 듣기. 섞어 뽑으면 들을 때마다 딴 것이 나와서 한 덩어리를
     귀에 붙일 수가 없다 — 매번 처음 듣는 낱말이 섞인다. */
  const [order, setOrder] = useState(settings.listenOrder || 'block');
  const [block, setBlock] = useState(settings.listenBlock || 0);
  /* 정지할 때까지 한 세트를 돈다. 소리를 외우는 일은 같은 것을 여러 번
     마주쳐야 되는 일이라, 한 바퀴 돌고 끝나면 남는 게 없다. */
  const [loop, setLoop] = useState(settings.listenLoop !== false);
  const [run, setRun] = useState(null);   // { cards, at, lap }
  /* 방금 들은 세트. 다 듣고 나서 「그대로 시험」으로 넘어가는 자리다 —
     귀로 들은 것과 답할 수 있는 것은 다르고, 그 차이는 물어봐야 안다. */
  const [lastSet, setLastSet] = useState(null);
  /* 다 외운 것을 뺄지. 기본은 안 빼는 쪽이다 — 눈으로 아는 낱말이 귀로는
     낯선 일이 흔하고, 듣기는 그 낯섦을 없애는 자리라서. */
  const [skipDone, setSkipDone] = useState(settings.listenSkipDone === true);
  /* 일시중지. 「그만」은 판을 접지만 이건 자리를 지킨다 — 말 한마디 하려고
     끊었다가 처음부터 다시 듣는 건 이 화면을 쓰는 이유를 없앤다. */
  const [paused, setPaused] = useState(false);
  /* 읽는 법을 화면에 띄울지.
     기본은 안 띄운다 — 듣고 떠올리는 자리인데 읽는 법이 같이 떠 있으면
     소리를 듣는 게 아니라 글자를 읽게 된다. 답을 보면서 푸는 시험과 같다.
     확인하고 싶을 때만 켠다. */
  const [showYomi, setShowYomi] = useState(settings.listenShowYomi === true);
  /* 이번 듣기에서 뺀 낱말.
     회독 기록은 안 건드린다 — 듣고 흘려보낸 것과 떠올려서 맞힌 것은 다른
     일이라, 듣기 화면에서 「외웠다」를 적으면 복습 간격이 귀로 흔들린다.
     그래서 이 화면이 열려 있는 동안만 기억한다. 나갔다 오면 다시 들어온다 —
     「잠시」가 그 뜻이다. 아주 빼고 싶으면 설정의 「다 외운 단어는 빼기」가
     회독 기록을 보고 골라 준다. */
  const [dropped, setDropped] = useState(() => new Set());

  /* ★ 들은 것도 기록에 남는다 ★
   *
   * 듣기는 회독 진도를 올리지 않는다. 들으면서 흘려보낸 것과 떠올려서 맞힌
   * 것은 다른 일이라 그 판단은 그대로 둔다. 그런데 아무 데도 안 남으니
   * 한 시간 듣고도 기록이 그대로였다 — 노력한 내역은 보여야 한다.
   *
   * 장이 넘어갈 때마다 한 문장으로 센다. 넘어가는 곳(setRun 갱신 안)에서
   * 부르면 갱신 함수 안에서 부모 상태를 건드리게 되니, 바뀐 뒤에 여기서 센다.
   *
   * ★ run 선언보다 아래에 있어야 한다 ★
   * 처음엔 이 블록을 위쪽에 뒀는데, 의존성 배열의 run이 그릴 때 평가되면서
   * 선언 전 접근(TDZ)이 됐다 — 듣기 화면이 그려질 때마다 죽었고 듣기·디자인
   * 검사가 통째로 멈췄다. 효과 본문은 나중에 돌지만 배열은 지금 읽힌다. */
  const countedAt = useRef(-1);
  useEffect(() => {
    if (!run) { countedAt.current = -1; return; }
    if (run.at > countedAt.current) {
      countedAt.current = run.at;
      onActivity?.({ listened: 1 });
    }
  }, [run, onActivity]);

  /* 뜻도 소리로 낼지. 화면을 못 보는 동안 쓰라고 만든 자리인데 뜻이 눈으로만
     나오면 절반이 안 들린다. 기본은 켬 — 끄고 싶은 사람은 여기서 끈다. */
  const [sayKo, setSayKo] = useState(settings.listenSayKo !== false);
  /* 뜻까지 듣고 나서 일본어를 한 번 더 들려줄지. 처음 듣는 일본어는 그냥
     소리인데, 뜻을 알고 다시 들으면 소리와 뜻이 붙는다. 기본은 끔 — 한 장에
     드는 시간이 늘어나니 원하는 사람만 켠다. */
  const [recap, setRecap] = useState(settings.listenRecap === true);
  /* 한국어 음성이 목록에 잡혔는가. 「안 잡혔으니 못 읽는다」로는 쓰지 않는다 —
     목록이 비었는데 소리는 나는 기기가 있어서, 그걸로 껐다가 「한국어가 안
     나온다」는 말을 들었다. 안내 문구를 고르는 데만 쓴다. */
  const [koListed, setKoListed] = useState(() => koreanVoiceListed());
  const [ask, setAsk] = useState(false);   // 시작 전에 한 번 확인
  const timer = useRef(null);
  const alive = useRef(true);

  const rate = settings.speechRate || 1;

  /* 음성 목록은 늦게 채워진다. 처음 물었을 때 없다고 화면에 적어 두면
     실제로는 있는데 없다고 뜬 채로 남는다. */
  useEffect(() => {
    if (koListed || !speechReady()) return undefined;
    const check = () => setKoListed(koreanVoiceListed());
    const t = setInterval(check, 700);
    window.speechSynthesis.addEventListener?.('voiceschanged', check);
    return () => {
      clearInterval(t);
      window.speechSynthesis.removeEventListener?.('voiceschanged', check);
    };
  }, [koListed]);

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

  /* 기출 후보는 화면이 만들어 넘긴다 — lib/listen.js는 단어 자료를 모른 채로 둔다.
     레벨로 거르지 않는다. 기출은 시험에 나온 것이라 「내가 고른 레벨」과 상관이
     없고, 거르면 기출 화면의 205개와 듣기의 개수가 어긋난다.

     ★ 쓰는 자리보다 위에 둔다 ★ 아래 counts의 의존성 배열은 그릴 때 읽히는데,
     선언이 그 밑에 있으면 선언 전 접근(TDZ)이 되어 듣기 화면이 통째로 죽는다 —
     이 파일에서 run으로 한 번 겪은 일이다. */
  const kijuPool = useMemo(
    () => kijuCards(words || []).map((w) => ({ id: w.id, kind: 'word' })),
    [words],
  );

  /* 회독 큐를 빌려 쓰지 않는다. 판정을 안 하는 화면이라 「복습으로 열고
     약점을 흩는다」는 순서를 지킬 이유가 없고, 그 큐에 얽히면 범위가 오늘
     몫으로 좁혀져서 늘 같은 것만 들린다. */
  const start = () => {
    const queue = pickListen(pool, review, {
      scope, count, today: todayKey(), kiju: kijuPool, order, block, skipDone,
    });
    const cards = cardsForQueue(queue, words, sentences).filter((c) => !dropped.has(c.id));
    if (!cards.length) { onToast('이 범위에는 들을 게 없어요'); return; }
    setRun({ cards, at: 0, lap: 0 });
    setLastSet(cards);
    setStep(0);
    setPaused(false);
  };

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    stopSpeaking();
    setRun(null);
    setPaused(false);
  }, []);

  const card = run?.cards[run.at];

  /* ★ 듣는 중에는 새 버전으로 안 갈아끼운다 ★
     어디까지 들었는지는 화면 안에만 있어서, 배포가 올라온 뒤 앱을 다시 앞으로
     꺼내는 순간 판이 통째로 사라졌다. 판을 닫으면 표시를 내린다. */
  useEffect(() => {
    markBusy('listen', Boolean(run));
    return () => markBusy('listen', false);
  }, [run]);

  /* 「다 외웠어요」 — 이번 판에서 이 낱말을 뺀다.
     빼고 나면 그 자리에 다음 낱말이 온다. 자리(at)는 그대로 두는 게 맞다 —
     한 칸 물러나면 방금 들은 것을 다시 듣게 된다. */
  const dropCurrent = () => {
    if (!run || !card) return;
    const id = card.id;
    setDropped((prev) => new Set(prev).add(id));
    setStep(0);
    setRun((r) => {
      if (!r) return r;
      const cards = r.cards.filter((c) => c.id !== id);
      if (!cards.length) { onToast('다 뺐어요 — 이 구간은 끝'); return null; }
      return { ...r, cards, at: Math.min(r.at, cards.length - 1) };
    });
    setNudge((v) => v + 1);
    onToast(`${card.kanji} 빼요 — 이번 듣기에서만`);
  };

  /* 한 장의 걸음표. 방향에 따라 순서가 통째로 뒤집힌다. */
  const steps = useMemo(
    () => stepsOf(direction, { shadow: mode === 'shadow', recap }),
    [direction, mode, recap],
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
    /* 멈춰 둔 동안에는 다음을 예약하지 않는다. 풀면 이 효과가 다시 돌면서
       그 걸음부터 이어진다 — 끊긴 자리를 한 번 더 들려주는 셈이라,
       무슨 말을 듣다 말았는지 떠올릴 틈이 된다. */
    if (paused) { stopSpeaking(); return undefined; }
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
          const next = nextAt(r, loop);
          if (!next) { onToast('다 들었어요 — 시험으로 확인해 볼까요'); return null; }
          // 한 바퀴를 넘겼으면 알린다. 화면을 안 보고 있어도 어디쯤인지는 알아야 한다
          if (next.lap > r.lap) onToast(`${next.lap}바퀴 돌았어요`);
          return { ...r, ...next };
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
    } else if (phase === 'jp2') {
      /* ★ 뜻까지 듣고 나서 한 번 더 ★
         처음 듣는 일본어는 그냥 소리다. 뜻을 알고 다시 들으면 소리와 뜻이
         붙는다. 마지막 걸음이라 이게 끝나면 다음 장으로 넘어간다. */
      speakJapanese(say, rate);
      go(spoken + wait);
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
  }, [card, phase, last, nudge, direction, gap, rate, sayKo, sayAnswer, loop, paused, onToast]);

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
  const counts = useMemo(
    () => scopeCounts(pool, review, todayKey(), kijuPool, skipDone),
    [pool, review, kijuPool, skipDone],
  );
  /* 고른 범위에 구간이 몇 개인가. 개수를 바꾸면 구간 수도 따라 바뀐다. */
  const blocks = useMemo(
    () => blocksIn(pool, review, { scope, count, today: todayKey(), kiju: kijuPool, skipDone }),
    [pool, review, scope, count, kijuPool, skipDone],
  );
  /* 개수나 범위를 바꾸면 구간 수가 줄어든다. 저장된 번호를 그대로 쓰면
     「12 / 11구간」이 뜬다 — 고르는 쪽에서 미리 당겨 둔다(뽑는 쪽도 막지만,
     화면에 거짓말이 뜨는 것은 그것대로 문제다). */
  const at = Math.min(block, blocks - 1);

  // ── 재생 중 ──
  if (run && card) {
    /* 무엇을 가릴지가 방향의 전부다.
       일본어 → 뜻 : 일본어는 늘 보이고, 뜻은 때가 되어야 나온다
       뜻 → 일본어 : 뜻은 늘 보이고, 일본어는 내가 말한 뒤에 나온다 */
    const back = direction === 'ko-jp';
    const showJp = !back || phase === 'jp';
    /* 뜻은 한 번 나오면 그 장이 끝날 때까지 남는다. 마지막에 일본어를 한 번 더
       들려주는 동안 뜻이 사라지면, 소리와 뜻을 붙이라고 만든 걸음에서 정작
       뜻이 화면에 없다. */
    const showKo = back || phase === 'ko' || phase === 'jp2';
    return (
      <div className={`listen play${back ? ' back' : ''}`}>
        <div className="sub-header inline">
          <button className="sub-back" onClick={stop}><IconArrowLeft /> 그만</button>
          <div className="sub-title">
            {run.at + 1} / {run.cards.length}
            {/* 몇 장 남았는지보다 몇 번 마주쳤는지가 귀에 붙는 정도를 말해 준다 */}
            {run.lap > 0 && <small className="ls-lap">{run.lap + 1}바퀴째</small>}
          </div>
        </div>

        {/* ★ 한 바퀴 돌았으면 시험으로 ★
            귀로 들은 것과 답할 수 있는 것은 다르고, 그 차이는 물어봐야 안다.
            듣는 동안에는 안 띄운다 — 한 바퀴도 안 돌고 시험을 보면 그냥 모른다. */}
        {run.lap > 0 && onQuiz && (
          <button
            className="ghost-btn ls-quiz"
            onClick={() => { stop(); onQuiz(run.cards); }}
          >
            이 구간으로 시험 보기
          </button>
        )}

        <div className="ls-stage" aria-live="polite">
          {showKo && <div className="ls-ko on ls-prompt">{card.mean}</div>}

          <div className={`ls-jp${card.kind === 'sentence' ? ' long' : ''}`}>
            {showJp ? card.kanji : '···'}
          </div>
          {/* ★ 읽는 법은 답이 나올 때 같이 나온다 ★
              듣고 떠올리는 동안에는 안 띄운다 — 같이 띄우면 듣는 게 아니라
              읽는 것이 된다. 그런데 뜻까지 나온 뒤에는 숨길 이유가 없다.
              그때가 「맞았나」를 확인하는 자리인데 읽는 법이 없으면 반만
              확인된다 — 呼吸이 「코큐우」인지 「코큐」인지가 안 풀린다.
              설정(showYomi)은 「처음부터 보여 달라」는 뜻으로 남는다. */}
          <div className="ls-yomi">
            {showJp && (showYomi || showKo) ? kanaToHangul(card.kana || card.kanji) : ''}
          </div>

          {/* 뜻은 때가 되면 나온다. 미리 보이면 듣기가 아니라 읽기가 된다. */}
          {!showKo && <div className="ls-ko">···</div>}

          <div className="ls-phase">
            {paused && '멈춰 있어요 — 「이어서」를 누르면 이 자리부터 다시 들려줘요'}
            {!paused && phase === 'jp' && (back ? '이게 답이에요 — 두 번 들려줘요' : '듣는 중')}
            {!paused && phase === 'say' && (back ? '일본어로 말해 보세요' : '따라 말해 보세요')}
            {!paused && phase === 'ko' && (back ? '무슨 말일까요' : '뜻')}
            {!paused && phase === 'jp2' && '뜻을 알고 한 번 더'}
          </div>
        </div>

        <div className="ls-controls">
          <button className="ghost-btn" onClick={() => skip(-1)} disabled={run.at === 0}>이전</button>
          {/* ★ 잠깐 멈춤 ★ 「그만」은 판을 접지만 이건 자리를 지킨다.
              말 한마디 하려고 끊었다가 처음부터 다시 듣는 건 이 화면을 쓰는
              이유를 없앤다. */}
          <button
            className={`ghost-btn ls-pause${paused ? ' on' : ''}`}
            onClick={() => setPaused((v) => !v)}
            aria-pressed={paused}
          >
            {paused ? '이어서' : '잠깐 멈춤'}
          </button>
          <button className="ghost-btn" onClick={() => skip(1)}>다음</button>
        </div>

        {/* ★ 익은 것은 이번 판에서 뺀다 ★
            한 구간을 몇 바퀴 돌다 보면 먼저 익는 낱말이 생긴다. 그것까지
            계속 들으면 남은 것을 만나는 틈이 그만큼 줄어든다. 회독 기록은
            안 건드리고 이번 듣기에서만 뺀다 — 나갔다 오면 다시 들어온다. */}
        <button className="ghost-btn ls-know" onClick={dropCurrent}>
          다 외웠어요 — 이번 듣기에서 빼기
        </button>
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
      {direction === 'ko-jp' && !koListed && (
        <p className="set-note">
          이 기기의 음성 목록에 한국어가 안 잡혔어요. 그래도 소리는 날 수 있으니 한 번
          들어 보세요 — 정말 안 나면 기기 설정에서 한국어 음성을 받으면 돼요.
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
                : (koListed
                  ? '일본어 다음에 뜻을 읽어 줘요 — 화면을 안 봐도 됩니다'
                  : '일본어 다음에 뜻을 읽어 줘요. 이 기기는 음성 목록에 한국어가 안 잡혔는데, 그래도 나는 기기가 있어요')}
            </span>
          </span>
          <span className={`toggle${answerAloud ? ' on' : ''}`} aria-hidden="true" />
        </button>

        {/* ★ 뜻을 알고 한 번 더 ★
            처음 듣는 일본어는 그냥 소리다. 뜻을 알고 다시 들으면 그제야 소리와
            뜻이 붙는다 — 같은 문장을 두 번 듣는 게 아니라 모르고 한 번, 알고
            한 번 듣는 것이다. 한 장에 드는 시간이 늘어나니 고르게 둔다.
            뒤집은 판은 원래 일본어로 끝나서 여기서는 안 보여 준다. */}
        {direction !== 'ko-jp' && (
          <button
            className="toggle-row setrow ls-recap"
            onClick={() => { setRecap(!recap); onSettingsChange?.({ listenRecap: !recap }); }}
            aria-pressed={recap}
          >
            <span>
              <span className="set-title">끝에 일본어 한 번 더</span>
              <span className="set-sub">
                {recap
                  ? '일본어 → 뜻 → 일본어 순서로 들려주고 넘어가요'
                  : '뜻까지 듣고 나서 일본어를 한 번 더 들려줘요'}
              </span>
            </span>
            <span className={`toggle${recap ? ' on' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="section-label">개수</div>
      <div className="card">
        <div className="setrow col">
          <div className="set-title">한 번에 <span className="set-val">{count}개</span></div>
          <div className="grouppick">
            {COUNTS.map((n) => (
              <button key={n} className={count === n ? 'active' : ''} onClick={() => { setCount(n); onSettingsChange?.({ listenCount: n }); }}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ★ 순서 ★
          섞어 뽑으면 들을 때마다 딴 것이 나온다. 「이 스무 개를 귀에 붙이겠다」가
          안 되고, 한 바퀴를 돌아도 매번 처음 듣는 낱말이 섞여서 남는 게 없다.
          구간은 몇 번째부터 몇 번째까지다 — 그 자리를 앱이 안 흔든다. */}
      <div className="section-label">순서</div>
      <div className="segment ls-order">
        <button
          className={order === 'block' ? 'active' : ''}
          data-order="block"
          onClick={() => { setOrder('block'); onSettingsChange?.({ listenOrder: 'block' }); }}
        >
          구간별
        </button>
        <button
          className={order === 'shuffle' ? 'active' : ''}
          data-order="shuffle"
          onClick={() => { setOrder('shuffle'); onSettingsChange?.({ listenOrder: 'shuffle' }); }}
        >
          섞어서
        </button>
      </div>

      <div className="card">
        {order === 'block' ? (
          <div className="setrow col ls-blockrow">
            <div className="set-title">
              <span className="set-val">{at + 1}</span> / {blocks}구간
              <small className="ls-range"> · {at * count + 1}~{Math.min((at + 1) * count, counts[scope] || 0)}번째</small>
            </div>
            <div className="ls-blocknav">
              <button
                className="ghost-btn ls-prev"
                disabled={at === 0}
                onClick={() => { const b = Math.max(0, at - 1); setBlock(b); onSettingsChange?.({ listenBlock: b }); }}
              >
                <IconArrowLeft /> 앞 구간
              </button>
              <button
                className="ghost-btn ls-next"
                disabled={at >= blocks - 1}
                onClick={() => { const b = Math.min(blocks - 1, at + 1); setBlock(b); onSettingsChange?.({ listenBlock: b }); }}
              >
                다음 구간
              </button>
            </div>
          </div>
        ) : (
          <div className="setrow col">
            <div className="set-sub">들을 때마다 이 범위에서 새로 뽑아요.</div>
          </div>
        )}

        {/* 정지할 때까지 한 세트를 돈다 — 소리를 외우는 일은 같은 것을
            여러 번 마주쳐야 되는 일이다. */}
        {/* 읽는 법을 띄울지. 켜면 한글 발음이 낱말 밑에 뜬다. */}
        <button
          className="toggle-row setrow ls-yomitoggle"
          onClick={() => { setShowYomi(!showYomi); onSettingsChange?.({ listenShowYomi: !showYomi }); }}
          aria-pressed={showYomi}
        >
          <span>
            <span className="set-title">읽는 법도 화면에</span>
            <span className="set-sub">
              {showYomi
                ? '낱말 밑에 한글 발음이 떠요'
                : '소리만 나와요 — 읽는 법이 같이 뜨면 듣는 게 아니라 읽게 돼요'}
            </span>
          </span>
          <span className={`toggle${showYomi ? ' on' : ''}`} aria-hidden="true" />
        </button>

        {/* 다 외운 것을 뺀다. 205개 중 150개를 외운 사람에게 그 150개를 계속
            들려주면 남은 55개를 만나는 데 세 배가 걸린다. */}
        <button
          className="toggle-row setrow ls-skipdone"
          onClick={() => { setSkipDone(!skipDone); onSettingsChange?.({ listenSkipDone: !skipDone }); }}
          aria-pressed={skipDone}
        >
          <span>
            <span className="set-title">다 외운 단어는 빼기</span>
            <span className="set-sub">
              {skipDone
                ? '회독에서 졸업한 낱말은 안 들려줘요'
                : '외운 것도 같이 들려줘요 — 눈으로 아는 낱말이 귀로는 낯설 수 있어요'}
            </span>
          </span>
          <span className={`toggle${skipDone ? ' on' : ''}`} aria-hidden="true" />
        </button>

        <button
          className="toggle-row setrow ls-loop"
          onClick={() => { setLoop(!loop); onSettingsChange?.({ listenLoop: !loop }); }}
          aria-pressed={loop}
        >
          <span>
            <span className="set-title">정지할 때까지 반복</span>
            <span className="set-sub">
              {loop
                ? '한 바퀴를 다 돌면 그 자리에서 다시 시작해요'
                : '한 바퀴만 돌고 멈춰요'}
            </span>
          </span>
          <span className={`toggle${loop ? ' on' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {/* 방금 들은 세트로 바로 시험. 듣기는 판정을 안 하니, 귀에 붙었는지는
          물어봐야 안다. */}
      {lastSet?.length > 0 && onQuiz && (
        <button className="ghost-btn ls-quizlast" onClick={() => onQuiz(lastSet)}>
          방금 들은 {lastSet.length}개로 시험 보기
        </button>
      )}

      <p className="set-note">
        이어폰을 끼고 화면을 꺼도 이어지게 해 뒀지만, 기기와 브라우저에 따라 멈출 수 있어요.
        아이폰 사파리는 화면이 꺼지면 대개 멈춰요.
      </p>

      {/* 무엇으로 시작하는지 한 번 보여 주고 확인을 받는다 */}
      <BottomSheet open={ask} onClose={() => setAsk(false)} label="재생 시작">
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
              : (sayKo
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
