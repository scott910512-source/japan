import { useCallback, useEffect, useMemo, useState } from 'react';
import { IconPlay, IconSpeaker, IconRepeat, IconArrowLeft } from '../components/Icons.jsx';
import BottomSheet from '../components/BottomSheet.jsx';
import { koreanVoiceListed, speechReady } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { todayKey } from '../lib/review.js';
import { cardsForQueue } from '../lib/cards.js';
import {
  DIRECTIONS, SCOPES, blocksIn, dirOf, normalizeBlocks, pickListen, scopeCounts, stepsOf,
} from '../lib/listen.js';
import { kijuCards } from '../lib/kiju.js';
import { tripPool } from '../lib/trip.js';
import { JLPT_LEVELS, isExampleId, jlptByLevel, poolOf } from '../lib/jlptListen.js';
import { travelListenCards } from '../lib/travelCourse.js';
import { BPMS, nextBpmLabel } from '../lib/metronome.js';
import { useListenBeat } from '../hooks/useListenBeat.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { useListenSettings } from '../hooks/useListenSettings.js';
import { useListenSession } from '../hooks/useListenSession.js';
import { useListenSpeech } from '../hooks/useListenSpeech.js';

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

/* 이 묶음으로 시험을 볼 수 있나 — 시험은 낱말을 묻는 자리라 문장만 있으면
   「출제할 단어가 없어요」로 끝나고 듣던 자리만 잃는다. 재생 중 버튼과
   끝난 뒤 버튼이 같은 규칙을 본다. */
export const quizable = (cards = []) => cards.some((c) => c?.kind !== 'sentence');

export default function Listen({
  pool, words, sentences, review, settings, onSettingsChange, onClose, onToast,
  onActivity, onWeakness, onQuiz, ledger = null, initialMode = 'listen',
}) {
  const [mode, setMode] = useState(initialMode);

  /* ★ 설정은 표 하나로 ★
   *
   * 열두 개가 각자 `settings.listenLoop !== false` 꼴로 적혀 있었다. 읽는
   * 규칙이 셋이라(기본 켬 · 기본 끔 · 숫자) 새 칸을 더할 때마다 어느 쪽인지
   * 다시 생각해야 했고, 한 번 틀리면 기본값이 뒤집힌다. 바뀔 때마다 화면과
   * 기기 두 곳에 써야 하는 것도 칸마다 되풀이였다 — 한쪽을 빼먹으면 켠 것이
   * 다음에 들어올 때 꺼져 있었다.
   *
   * 무엇이 어느 키에 어떤 기본값으로 붙는지는 lib/listenSettings.js의 표에
   * 있고, 저장 키는 그대로다(바꾸면 쓰던 사람이 고른 것이 전부 날아간다). */
  const ls = useListenSettings({ settings, onSettingsChange });
  const {
    direction, scope, jlptLevel, order, count, gap,
    sayKo, sayAnswer, recap, showYomi, skipDone, loop, reshuffle,
  } = ls.values;
  const picked = ls.blocks;
  const dropped = ls.dropped;

  /* ★ 듣는 판 ★
     어디까지 들었나 · 멈춰 있나 · 무엇을 뺐나, 그리고 「들었다」를 기록에
     적는 일까지 hooks/useListenSession.js가 쥔다. 무엇을 들을지 뽑는 것은
     여기가 한다 — 단어 자료를 아는 쪽이 정해야 하는 일이다. */
  /* 예문 카드(ex:…)는 단어장에 없는 카드라 약점 장부에 적지 않는다 — 적으면
     아무도 안 읽는 id가 장부에 쌓이고 기기 사이로 번진다. 회화 문장은 그대로.
     useCallback — 그릴 때마다 새 함수면 세션 쪽 효과가 장마다 수십 번 돈다. */
  const noteWeakness = useCallback((notes) => {
    const keep = (notes || []).filter((n) => !isExampleId(n?.id));
    if (keep.length) onWeakness?.(keep);
  }, [onWeakness]);

  const session = useListenSession({
    onToast,
    onActivity,
    /* 예문 카드(ex:…)는 단어장에 없는 카드라 약점 장부에 적지 않는다 — 적으면
       아무도 안 읽는 id가 장부에 쌓이고 기기 사이로 번진다. 회화 문장은 그대로. */
    onWeakness: noteWeakness,
    onDrop: (id) => ls.saveDropped(new Set(dropped).add(id)),
  });
  const { run, card, step, nudge, paused, lastSet } = session;

  /* ★ 달리기 박자 ★
     달릴 때 귀는 두 가지를 받는다 — 외우려는 일본어와 발을 맞출 박자다.
     둘을 다른 앱으로 틀면 한쪽이 다른 쪽을 끊는다(iOS가 특히 그렇다).
     bpm이 null이면 꺼짐. 켜면 160·170·180 중 하나다(달리기 피치).
     언제 울릴지·언제 끊을지는 hooks/useListenBeat.js가 정한다 — 이 화면은
     「판이 도는가 · 멈췄는가」만 넘기고 WebAudio는 모른다. */
  const beat = useListenBeat({
    running: Boolean(run), paused, settings, onSettingsChange,
  });
  const bpm = beat.bpm;
  /* 화면이 꺼져도 소리는 이어지는 게 이 화면의 존재 이유다. 걸쇠를 못 잡는
     기기(아이폰 사파리)에서도 듣기는 그대로 돈다 — hooks/useWakeLock.js. */
  useWakeLock(Boolean(run));
  const dropSave = ls.saveDropped;

  /* 한국어 음성이 목록에 잡혔는가. 「안 잡혔으니 못 읽는다」로는 쓰지 않는다 —
     목록이 비었는데 소리는 나는 기기가 있어서, 그걸로 껐다가 「한국어가 안
     나온다」는 말을 들었다. 안내 문구를 고르는 데만 쓴다. */
  const [koListed, setKoListed] = useState(() => koreanVoiceListed());
  const [ask, setAsk] = useState(false);   // 시작 전에 한 번 확인

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

  /* 여행 후보도 화면이 만들어 넘긴다 — lib/listen.js는 단어 자료를 모른 채로 둔다.
     여기도 레벨로 안 거른다. 両替·免税·乗り換え는 급수로 고를 낱말이 아니고,
     거르면 공항에서 필요한 말이 빠진다.
     낱말과 짧은 문장이 같이 돈다 — 여행은 낱말만으로 안 되고, 空港을 알아도
     「JRの乗り場はどこですか」가 안 나오면 못 움직인다. 문장 id는 자료가 직접
     내놓는다(lib/trip.js). */
  const tripList = useMemo(() => tripPool(words || []), [words]);

  /* ★ JLPT 문장 — 고른 급수의 문장만 ★
     「오늘 볼 것」은 급수가 섞여 와서, 눈으로 N3을 보는 사람도 귀로는 몇몇
     낱말밖에 못 잡았다. 급수를 골라 그 급수의 문장만 돈다 — 단어장 예문이
     먼저, 상황별 회화가 뒤(lib/jlptListen.js). 예문은 단어장에 카드로 없어서
     여기서 만든 카드를 큐를 푸는 쪽(cardsForQueue)에도 같이 넘긴다. */
  /* 세 급수를 한 번에 만든다 — 고른 급수의 목록과 급수 칸의 숫자가 같은
     표에서 나오게. 따로 재면 예문 2,700개를 네 번 재고, 숫자와 목록이
     어긋날 틈이 생긴다. 저장된 급수가 표에 없으면(N2 같은 낯선 값) N5로. */
  const jlptAll = useMemo(() => jlptByLevel(words || [], sentences || []), [words, sentences]);
  /* 저장된 급수는 읽을 때 이미 표로 걸러진다(listenSettings) — 여기서는 그대로 쓴다 */
  const level = jlptLevel;
  const jlptCards = jlptAll[level] || [];
  const jlptList = useMemo(() => poolOf(jlptCards), [jlptCards]);
  /* 여행 일본어 코스 — 직원 말과 내 말 160줄, 공항부터 곤란할 때까지 차례대로.
     단어장에 없는 카드라 예문처럼 큐를 푸는 쪽에도 같이 넘긴다. */
  const tourCards = useMemo(() => travelListenCards(), []);
  const tourList = useMemo(() => poolOf(tourCards), [tourCards]);

  const levelCounts = useMemo(
    () => Object.fromEntries(JLPT_LEVELS.map((l) => [l, jlptAll[l].length])),
    [jlptAll],
  );

  /* 회독 큐를 빌려 쓰지 않는다. 판정을 안 하는 화면이라 「복습으로 열고
     약점을 흩는다」는 순서를 지킬 이유가 없고, 그 큐에 얽히면 범위가 오늘
     몫으로 좁혀져서 늘 같은 것만 들린다. */
  const start = () => {
    const queue = pickListen(pool, review, {
      scope, count, today: todayKey(), kiju: kijuPool, trip: tripList, jlpt: jlptList, tour: tourList,
      order, blocks: selectedBlocks, skipDone, ledger,
    });
    const cards = cardsForQueue(queue, words, sentences, [...jlptCards, ...tourCards]).filter((c) => !dropped.has(c.id));
    if (!cards.length) { onToast('이 범위에는 들을 게 없어요'); return; }
    session.begin(cards);
  };

  const stop = session.stop;

  const dropCurrent = session.dropCurrent;

  /* ★ 이 장은 어느 방향인가 ★
     「랜덤」을 고르면 장마다 달라진다. 그릴 때마다 뽑으면 한 장이 흘러가는
     동안에도 방향이 바뀌니, 판의 씨앗과 자리·바퀴로 정한다(lib/listen.js).
     판이 없는 설정 화면에서는 고른 값을 그대로 쓴다. */
  const cardDir = run ? dirOf(direction, run) : (direction === 'mix' ? 'jp-ko' : direction);

  /* 한 장의 걸음표. 방향에 따라 순서가 통째로 뒤집힌다. */
  const steps = useMemo(
    () => stepsOf(cardDir, { shadow: mode === 'shadow', recap }),
    [cardDir, mode, recap],
  );
  const phase = steps[Math.min(step, steps.length - 1)] || 'jp';
  const last = step >= steps.length - 1;

  /* 답을 소리로 낼지. 방향마다 「답」이 다른 쪽이라 켜고 끄는 칸도 따로다.
       일본어 → 뜻  이면 답은 한국어 뜻   (sayKo)
       뜻 → 일본어  이면 답은 일본어      (sayAnswer) */
  const answerAloud = cardDir === 'ko-jp' ? sayAnswer : sayKo;

  /* ★ 한 장이 흘러가는 동안 무슨 소리가 나는가 ★
     걸음마다 무엇을 읽어 주고 얼마를 기다릴지는 hooks/useListenSpeech.js가
     쥔다. 안의 타이밍은 하나하나 겪고 고친 값이라(답은 두 번, 최소 1.6초,
     클라우드 음성 지연) 자리만 옮기고 한 글자도 안 바꿨다. */
  useListenSpeech({
    card, phase, last, nudge, cardDir, paused,
    gap, rate, sayKo, sayAnswer, loop, reshuffle,
    timer: session.timer,
    alive: session.alive,
    onNextStep: session.nextStep,
    onAdvance: session.advance,
  });

  const skip = session.skip;

  const poolSize = useMemo(() => pool.length, [pool]);
  const counts = useMemo(
    () => scopeCounts(pool, review, { today: todayKey(), kiju: kijuPool, trip: tripList, jlpt: jlptList, tour: tourList, skipDone, ledger }),
    [pool, review, kijuPool, skipDone, ledger, tripList, jlptList, tourList],
  );
  /* 고른 범위에 구간이 몇 개인가. 개수를 바꾸면 구간 수도 따라 바뀐다. */
  const blockCount = useMemo(
    () => blocksIn(pool, review, {
      scope, count, today: todayKey(), kiju: kijuPool, trip: tripList, jlpt: jlptList, tour: tourList, skipDone, ledger,
    }),
    [pool, review, scope, count, kijuPool, tripList, jlptList, tourList, skipDone, ledger],
  );
  /* 개수나 범위를 바꾸면 구간 수가 줄어든다. 저장된 번호를 그대로 쓰면
     「12 / 11구간」이 뜬다 — 고르는 쪽에서 미리 당겨 둔다(뽑는 쪽도 막지만,
     화면에 거짓말이 뜨는 것은 그것대로 문제다). */
  /* 범위 밖 번호는 버린다. 하나도 안 남으면 첫 구간 — 빈손이면 「들을 게
     없어요」가 뜨는데, 설정이 낡아서 그렇게 되는 건 사고다. */
  const selectedBlocks = useMemo(() => {
    const ok = normalizeBlocks(picked, blockCount);
    return ok.length ? ok : [0];
  }, [picked, blockCount]);

  const pickBlockAt = (i) => {
    /* 마지막 하나는 못 끈다. 전부 끄면 들을 게 없어진다 — 그건 고르는 게
       아니라 꺼 버리는 것이고, 끄는 자리는 「순서」 쪽에 따로 있다. */
    const next = selectedBlocks.includes(i)
      ? (selectedBlocks.length > 1 ? selectedBlocks.filter((x) => x !== i) : selectedBlocks)
      : [...selectedBlocks, i].sort((x, y) => x - y);
    ls.saveBlocks(next);
  };

  // ── 재생 중 ──
  if (run && card) {
    /* 무엇을 가릴지가 방향의 전부다.
       일본어 → 뜻 : 일본어는 늘 보이고, 뜻은 때가 되어야 나온다
       뜻 → 일본어 : 뜻은 늘 보이고, 일본어는 내가 말한 뒤에 나온다 */
    const back = cardDir === 'ko-jp';
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
        {/* 문장만 도는 판(JLPT 문장)에는 안 띄운다 — 시험은 낱말을 묻는
            자리라, 문장 스무 장을 넘기면 「출제할 단어가 없어요」로 끝나고
            듣던 자리만 잃는다. */}
        {run.lap > 0 && onQuiz && quizable(run.cards) && (
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
          {/* ★ 히라가나와 한글 발음을 같이 ★
              한글 발음만 두면 「코큐우」를 보고 こきゅう를 못 쓴다. 시험이 묻는
              것은 가나 표기라, 소리를 한글로만 익히면 답안지에서 막힌다.
              둘을 같이 두면 소리(한글)와 표기(가나)가 한자리에서 붙는다. */}
          <div className="ls-yomi">
            {showJp && (showYomi || showKo) && (
              <>
                <span className="ly-kana">{card.kana || card.kanji}</span>
                <span className="ly-han">{kanaToHangul(card.kana || card.kanji)}</span>
              </>
            )}
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
            onClick={() => { beat.arm(); session.togglePause(); }}
            aria-pressed={paused}
          >
            {paused ? '이어서' : '잠깐 멈춤'}
          </button>
          <button className="ghost-btn" onClick={() => skip(1)}>다음</button>
        </div>

        {/* ★ 달리면서 누르는 자리 ★
            달리는 중에는 화면을 못 본다. 그래서 고르는 칸을 여럿 두지 않고
            한 자리를 눌러 돌린다 — 160 → 170 → 180 → 끄기 → 160.
            넓게 잡아 둬서 안 보고 눌러도 맞는다. */}
        <button
          className={`ghost-btn ls-beat${bpm != null ? ' on' : ''}`}
          onClick={beat.cycle}
          aria-pressed={bpm != null}
        >
          {/* ★ 달리면서 한눈에 ★
              여태 「달리기 박자 170」이라고만 적혀 있었다. 숨이 차서 눈이
              흔들리는 상태로 보면 글자 넷이 다 비슷하게 생겼다 — 켜져 있는지
              아닌지가 바로 안 읽힌다. 달리는 사람 그림과 단위를 붙이면 「지금
              박자가 돌고 있다」가 글자를 읽기 전에 보인다.
              보조 설명은 한 줄로 짧게 둔다. 길면 달리면서 안 읽는다. */}
          {bpm != null ? (
            <>
              <b className="lb-now">🏃 {bpm} BPM</b>
              <small className="lb-hint">누르면 {nextBpmLabel(bpm)}</small>
            </>
          ) : (
            <>
              <b className="lb-now">달리기 박자 — 꺼짐</b>
              <small className="lb-hint">누르면 160</small>
            </>
          )}
        </button>

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
          <span>
            {SCOPES.find((s) => s.id === scope)?.label}
            {scope === 'jlpt' && ` ${level}`}
            {' · '}{count}개 · {gap}초 간격
          </span>
        </div>
        <button className="ls-go" onClick={() => setAsk(true)} disabled={poolSize === 0}>
          <IconPlay /> 시작
        </button>
      </div>

      <p className="vd-note">
        손이 안 비는 시간에 쓰는 화면이에요. 아무것도 안 눌러도 저절로 흘러가요.
        회독 기록은 건드리지 않아요 — 귀에 넣는 것만 해요.
      </p>

      {/* ★ 설정을 한 화면에 ★
       *
       * 여태 옵션 하나가 한 줄을 통째로 먹었다. 방향 둘, 범위 다섯, 방식 둘,
       * 토글 다섯 — 한 줄씩 세로로 쌓이니 설정을 한 번 보려면 네 번 넘겨야
       * 했다. 그런데 여기는 「고르고 바로 시작」하는 화면이다. 고르는 데 드는
       * 품이 듣는 시간보다 길면 안 쓰게 된다.
       *
       * 기능은 그대로 두고 줄만 접는다. 짧은 것(방향·방식·순서)은 한 줄에
       * 나란히, 범위는 칩으로, 토글은 두 개씩. 설명은 고른 것만 밑에 한 줄로
       * 나온다 — 다섯 개 설명을 늘 펼쳐 둘 이유가 없다. */}

      {/* ★ 방향 ★
          듣고 알아듣는 것과, 듣고 말해 보는 것은 다른 연습이다. 여행에서
          막히는 쪽은 뒤엣것인데 여태 앞엣것만 있었다.
          「랜덤」은 둘을 섞는다 — 방향이 고정이면 다음 장이 어느 쪽으로 올지
          알고 듣게 되고, 그러면 한쪽으로만 익는다. */}
      <div className="section-label" style={{ marginTop: 0 }}>방향</div>
      <div className="ls-pills ls-dirs">
        {DIRECTIONS.map((d) => (
          <button
            key={d.id}
            className={`ls-pill ls-dir${direction === d.id ? ' active' : ''}`}
            data-dir={d.id}
            onClick={() => ls.set('direction', d.id)}
          >
            {d.id === 'ko-jp' ? '뜻 → 일본어' : d.id === 'mix' ? '랜덤' : '일본어 → 뜻'}
          </button>
        ))}
      </div>
      <p className="set-note ls-dirnote">
        {DIRECTIONS.find((d) => d.id === direction)?.sub}
      </p>
      {direction !== 'jp-ko' && !koListed && (
        <p className="set-note">
          이 기기의 음성 목록에 한국어가 안 잡혔어요. 그래도 소리는 날 수 있으니 한 번
          들어 보세요 — 정말 안 나면 기기 설정에서 한국어 음성을 받으면 돼요.
        </p>
      )}

      {/* ★ 범위 ★
          여태 오늘의 학습 큐를 빌려 써서, 배운 게 500개인데 늘 같은 스무 개만
          들렸다. 무엇을 들을지는 여기서 고른다.
          다섯 줄을 칩으로 접었다. 설명은 고른 것만 밑에 뜬다 — 다섯 개 설명이
          늘 펼쳐져 있어 봐야 고르고 나면 넷은 안 읽는다. */}
      <div className="section-label">무엇을 들을까</div>
      <div className="ls-pills ls-scopes">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            className={`ls-pill ls-scope${scope === s.id ? ' active' : ''}`}
            data-scope={s.id}
            disabled={counts[s.id] === 0}
            onClick={() => ls.set('scope', s.id)}
          >
            {s.label}
            <span className="pk-count">{counts[s.id]}개</span>
          </button>
        ))}
      </div>
      <p className="set-note ls-scopenote">
        {SCOPES.find((s) => s.id === scope)?.sub}
      </p>

      {/* ★ 급수 ★
          JLPT 문장을 골랐을 때만 나온다. 귀는 눈보다 늦어서 기본은 N5다 —
          N3을 읽는 사람도 귀로는 N5부터 쌓아야 들린다. 급수를 바꾸면 목록이
          통째로 바뀌니 구간 번호도 처음으로 돌린다. 아니면 N5의 12구간이
          N3의 12구간을 가리키게 된다. */}
      {scope === 'jlpt' && (
        <>
          <div className="ls-pills ls-levels" role="group" aria-label="급수">
            {JLPT_LEVELS.map((l) => (
              <button
                key={l}
                className={`ls-pill ls-level${level === l ? ' active' : ''}`}
                data-level={l}
                disabled={!levelCounts[l]}
                /* 같은 급수를 눌러도 한 번 적는다 — 저장된 값이 표에 없는 것(N2)이면
                   읽을 때 N5로 보이지만 기기에는 N2가 남아 다른 기기로 번진다.
                   구간은 급수가 정말 바뀔 때만 처음으로. */
                onClick={() => { ls.set('jlptLevel', l); if (l !== jlptLevel) ls.saveBlocks([0]); }}
              >
                {l}
                {/* 「문장」을 붙이면 1708이 두 줄로 꺾인다 — 단위는 밑 설명이 말한다 */}
                <span className="pk-count">{levelCounts[l]}개</span>
              </button>
            ))}
          </div>
          <p className="set-note ls-levelnote">
            낱말은 안 나와요. 단어장 예문이 먼저, 상황별 회화가 뒤에 돌아요.
          </p>
        </>
      )}

      {/* 「따라 말하기」는 들려준 걸 따라 하는 거라 뒤집은 판에는 없다.
          거기서는 안 들려준 걸 내가 먼저 말하니까 — 그 자체가 말하기 연습이다.
          랜덤은 일본어 → 뜻 장이 섞여 있어서 여기서도 고를 수 있다. */}
      {direction !== 'ko-jp' && (
        <>
          <div className="section-label">방식</div>
          <div className="ls-pills ls-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`ls-pill ls-mode${mode === m.id ? ' active' : ''}`}
                data-mode={m.id}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="set-note ls-modenote">{MODES.find((m) => m.id === mode)?.sub}</p>
        </>
      )}

      {/* 개수와 간격은 둘 다 「숫자 하나 고르기」다. 한 카드에 나란히 둔다 —
          따로 두면 제목 두 줄과 카드 두 개가 더 붙는다. */}
      <div className="section-label">얼마나 · 얼마 간격으로</div>
      <div className="card ls-nums">
        <div className="setrow col">
          <div className="set-title">한 번에 <span className="set-val">{count}개</span></div>
          <div className="grouppick">
            {COUNTS.map((n) => (
              <button key={n} className={count === n ? 'active' : ''} onClick={() => ls.set('count', n)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="setrow col">
          <div className="set-title">문장 사이 <span className="set-val">{gap}초</span></div>
          <div className="grouppick">
            {GAPS.map((g) => (
              <button key={g} className={gap === g ? 'active' : ''} onClick={() => ls.set('gap', g)}>{g}초</button>
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
          onClick={() => ls.set('order', 'block')}
        >
          구간별
        </button>
        <button
          className={order === 'shuffle' ? 'active' : ''}
          data-order="shuffle"
          onClick={() => ls.set('order', 'shuffle')}
        >
          섞어서
        </button>
      </div>

      <div className="card ls-block">
        {order === 'block' ? (
          <div className="setrow col ls-blockrow">
            {/* ★ 구간을 여러 개 고를 수 있다 ★
                한 구간은 스무 개다. 그게 한 덩어리를 귀에 붙이기 좋은 크기인데,
                어떤 날은 그 묶음 셋을 한 번에 돌고 싶다 — 시험이 가깝거나,
                이미 뗀 구간을 같이 섞어 다시 다지고 싶을 때다.
                그렇다고 「전체」로 가면 안 된다. 그건 구간을 안 쓰는 것이고,
                들을 때마다 딴 것이 나오는 자리로 돌아간다. 고른 것만 이어
                붙이면 덩어리는 그대로 두고 길이만 늘릴 수 있다. */}
            <div className="set-title">
              <span className="set-val">{selectedBlocks.map((i) => i + 1).join(' · ')}</span>
              {' / '}{blockCount}구간
              <small className="ls-range">
                {' · '}
                {selectedBlocks.length === 1
                  ? `${selectedBlocks[0] * count + 1}~${Math.min((selectedBlocks[0] + 1) * count, counts[scope] || 0)}번째`
                  : `${selectedBlocks.reduce((n, i) => n + Math.max(0, Math.min((i + 1) * count, counts[scope] || 0) - i * count), 0)}개`}
              </small>
            </div>
            <div className="ls-blockpick" role="group" aria-label="구간 고르기">
              {Array.from({ length: blockCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`ls-blk${selectedBlocks.includes(i) ? ' active' : ''}`}
                  data-block={i + 1}
                  aria-pressed={selectedBlocks.includes(i)}
                  aria-label={`${i + 1}구간 · ${i * count + 1}~${Math.min((i + 1) * count, counts[scope] || 0)}번째`}
                  onClick={() => pickBlockAt(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="ls-blocknav">
              <button
                className="ghost-btn ls-prev"
                disabled={selectedBlocks.length === 1 && selectedBlocks[0] === 0}
                onClick={() => {
                  const b = Math.max(0, selectedBlocks[0] - 1);
                  ls.saveBlocks([b]);
                }}
              >
                <IconArrowLeft /> 앞 구간
              </button>
              <button
                className="ghost-btn ls-next"
                disabled={selectedBlocks.length === 1 && selectedBlocks[selectedBlocks.length - 1] >= blockCount - 1}
                onClick={() => {
                  const b = Math.min(blockCount - 1, selectedBlocks[selectedBlocks.length - 1] + 1);
                  ls.saveBlocks([b]);
                }}
              >
                다음 구간
              </button>
            </div>
            <div className="set-sub">
              번호를 눌러 여러 구간을 같이 들을 수 있어요. 고른 차례가 아니라 번호
              차례로 이어서 돌아요.
            </div>
          </div>
        ) : (
          <div className="setrow col">
            <div className="set-sub">들을 때마다 이 범위에서 새로 뽑아요.</div>
          </div>
        )}
      </div>

      {/* ★ 켜고 끄는 것들 ★
          여섯 개가 한 줄씩 쌓여 있었다. 전부 「켜거나 끄거나」라 설명 두 줄을
          늘 펼쳐 둘 필요가 없다 — 지금 어느 쪽인지만 짧게 적고 두 개씩 둔다.
          기능은 하나도 안 뺐다. */}
      <div className="section-label">켜고 끄기</div>
      <div className="ls-opts">
        {/* 답을 소리로 낼지. 방향마다 「답」이 다른 쪽이라 칸도 따로다.
            뒤집어서 말하는 연습을 할 때 일본어를 읽어 주면, 떠올리기 전에 답이
            먼저 들려서 말하기가 아니라 따라 하기가 된다 — 그래서 끌 수 있다.
            꺼도 화면에는 뜬다. 맞았는지 확인할 길까지 막을 이유는 없다.
            랜덤은 두 방향이 다 나오니 둘 다 보여 준다. */}
        {direction !== 'jp-ko' && (
          <button
            className="toggle-pill ls-sayans"
            onClick={() => ls.flip('sayAnswer')}
            aria-pressed={sayAnswer}
          >
            <span className="tp-text">
              <b>답도 소리로</b>
              <span>{sayAnswer ? '말한 뒤 일본어를 들려줘요' : '일본어 답은 화면으로만'}</span>
            </span>
            <span className={`toggle${sayAnswer ? ' on' : ''}`} aria-hidden="true" />
          </button>
        )}
        {direction !== 'ko-jp' && (
          <button
            className="toggle-pill ls-sayko"
            onClick={() => ls.flip('sayKo')}
            aria-pressed={sayKo}
          >
            <span className="tp-text">
              <b>뜻도 소리로</b>
              <span>{sayKo ? '한국어로 읽어 줘요' : '뜻은 화면으로만'}</span>
            </span>
            <span className={`toggle${sayKo ? ' on' : ''}`} aria-hidden="true" />
          </button>
        )}

        {/* ★ 뜻을 알고 한 번 더 ★
            처음 듣는 일본어는 그냥 소리다. 뜻을 알고 다시 들으면 그제야 소리와
            뜻이 붙는다 — 같은 문장을 두 번 듣는 게 아니라 모르고 한 번, 알고
            한 번 듣는 것이다. 뒤집은 판은 원래 일본어로 끝나서 안 보여 준다. */}
        {direction !== 'ko-jp' && (
          <button
            className="toggle-pill ls-recap"
            onClick={() => ls.flip('recap')}
            aria-pressed={recap}
          >
            <span className="tp-text">
              <b>끝에 한 번 더</b>
              <span>{recap ? '일본어 → 뜻 → 일본어' : '뜻까지 듣고 끝'}</span>
            </span>
            <span className={`toggle${recap ? ' on' : ''}`} aria-hidden="true" />
          </button>
        )}

        {/* 읽는 법을 띄울지. 켜면 가나와 한글 발음이 낱말 밑에 뜬다. */}
        <button
          className="toggle-pill ls-yomitoggle"
          onClick={() => ls.flip('showYomi')}
          aria-pressed={showYomi}
        >
          <span className="tp-text">
            <b>읽는 법 보기</b>
            <span>{showYomi ? '가나·한글 발음이 떠요' : '소리만 — 안 보여 줘요'}</span>
          </span>
          <span className={`toggle${showYomi ? ' on' : ''}`} aria-hidden="true" />
        </button>

        {/* 다 외운 것을 뺀다. 205개 중 150개를 외운 사람에게 그 150개를 계속
            들려주면 남은 55개를 만나는 데 세 배가 걸린다. */}
        <button
          className="toggle-pill ls-skipdone"
          onClick={() => ls.flip('skipDone')}
          aria-pressed={skipDone}
        >
          <span className="tp-text">
            <b>외운 건 빼기</b>
            <span>{skipDone ? '졸업한 낱말은 안 나와요' : '외운 것도 같이 들려줘요'}</span>
          </span>
          <span className={`toggle${skipDone ? ' on' : ''}`} aria-hidden="true" />
        </button>

        {/* 정지할 때까지 한 세트를 돈다 — 소리를 외우는 일은 같은 것을
            여러 번 마주쳐야 되는 일이다. */}
        <button
          className="toggle-pill ls-loop"
          onClick={() => ls.flip('loop')}
          aria-pressed={loop}
        >
          <span className="tp-text">
            <b>끝까지 반복</b>
            <span>{loop ? '다 돌면 그 자리에서 다시' : '한 바퀴만 돌고 멈춰요'}</span>
          </span>
          <span className={`toggle${loop ? ' on' : ''}`} aria-hidden="true" />
        </button>

        {/* ★ 바퀴마다 순서를 섞는다 ★
            세트는 그대로 두고 순서만 바꾼다. 세 바퀴째부터는 다음에 뭐가 올지
            먼저 떠오르는데, 그건 낱말을 외운 게 아니라 차례를 외운 것이다 —
            시험장에는 그 차례가 없다. 섞으면 매번 맨손으로 떠올려야 한다. */}
        {loop && (
          <button
            className="toggle-pill ls-reshuffle"
            onClick={() => ls.flip('reshuffle')}
            aria-pressed={reshuffle}
          >
            <span className="tp-text">
              <b>순서 섞기</b>
              <span>{reshuffle ? '바퀴마다 다른 차례로' : '늘 같은 차례로'}</span>
            </span>
            <span className={`toggle${reshuffle ? ' on' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ★ 달리기 박자 ★
          달릴 때 귀는 두 가지를 받는다 — 외우려는 일본어와 발을 맞출 박자다.
          둘을 다른 앱으로 틀면 한쪽이 다른 쪽을 끊는다.
          160·170·180은 달리기 피치(분당 걸음 수)다. 170~180은 발이 땅에 닿는
          시간을 줄여 주고, 160은 몸을 푸는 쪽이다. 1씩 고르게 하면 달리면서
          못 맞추니 세 칸만 둔다. */}
      <div className="section-label">달리기 박자</div>
      <div className="card ls-beatcard">
        <button
          className={`toggle-pill ls-beattoggle${bpm != null ? ' on' : ''}`}
          onClick={beat.toggle}
          aria-pressed={bpm != null}
        >
          <span className="tp-text">
            <b>박자 같이 듣기</b>
            <span>{bpm != null ? `${bpm} 걸음 / 분` : '소리만 — 박자 없음'}</span>
          </span>
          <span className={`toggle${bpm != null ? ' on' : ''}`} aria-hidden="true" />
        </button>
        {bpm != null && (
          <div className="setrow col">
            <div className="set-title">분당 걸음 <span className="set-val">{bpm}</span></div>
            <div className="grouppick ls-bpms">
              {BPMS.map((n) => (
                <button key={n} className={bpm === n ? 'active' : ''} data-bpm={n}
                  onClick={() => beat.pick(n)}>{n}</button>
              ))}
            </div>
            <div className="set-sub">
              재생 중에도 화면 가운데 버튼을 눌러 160 → 170 → 180 → 끄기로 돌릴 수 있어요.
              말소리를 안 덮게 작게 나와요.
            </div>
          </div>
        )}
      </div>

      {/* ★ 한국어 음성이 목록에 없을 때 ★
          목록이 비었다고 토글을 잠그지는 않는다 — 안드로이드 크롬·웹뷰는
          목록이 []인데도 소리가 멀쩡히 난다. 다만 「켰는데 안 들린다」는
          말을 들을 수 있으니, 그럴 땐 여기 한 줄로 알려 준다.
          칸이 짧아져서 설명을 못 담은 몫을 여기서 받는다. */}
      {sayKo && !koListed && direction !== 'ko-jp' && (
        <p className="set-note ls-konote">
          이 기기의 음성 목록에 한국어가 안 잡혔어요. 그래도 소리는 날 수 있으니 한 번
          들어 보세요 — 정말 안 나면 기기 설정에서 한국어 음성을 받으면 돼요.
        </p>
      )}

      {/* 뺀 낱말을 몇 개인지 보여 주고 되돌리는 길. 안 두면 왜 안 나오는지
          모르는 낱말이 쌓인다 — 그건 목록이 줄어드는 것보다 나쁘다. */}
      {dropped.size > 0 && (
        <div className="card ls-droprow">
          <div className="setrow col">
            <div className="set-title">
              뺀 낱말 <span className="set-val">{dropped.size}개</span>
            </div>
            <div className="set-sub">「다 외웠어요」로 뺀 것이에요. 다시 넣으면 그날부터 또 나와요.</div>
            <button
              className="ghost-btn ls-dropreset"
              onClick={() => { dropSave(new Set()); onToast('뺀 낱말을 모두 다시 넣었어요'); }}
            >
              {dropped.size}개 다시 넣기
            </button>
          </div>
        </div>
      )}

      {/* 방금 들은 세트로 바로 시험. 듣기는 판정을 안 하니, 귀에 붙었는지는
          물어봐야 안다. */}
      {/* 문장만 들은 판(JLPT 문장)은 시험으로 못 넘긴다 — 시험은 낱말을 묻는다 */}
      {lastSet?.length > 0 && onQuiz && quizable(lastSet) && (
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
              <b>{direction === 'mix' ? '랜덤' : direction === 'ko-jp' ? '뜻→일' : '일→뜻'}</b>
              <span>{mode === 'shadow' && direction !== 'ko-jp' ? '따라 말하기' : '방향'}</span>
            </div>
          </div>
          <p className="set-note">
            {direction === 'mix'
              ? '장마다 방향이 바뀌어요 — 어느 쪽이 올지 모르니 매번 떠올려야 해요.'
              : direction === 'ko-jp'
                ? (sayAnswer
                  ? '뜻을 들려주고, 말해 본 다음에 일본어를 들려줘요.'
                  : '뜻을 들려주고 답은 화면에만 띄워요.')
                : (sayKo
                  ? '일본어 → 뜸 → 뜻까지 소리로 나와요.'
                  : '일본어만 소리로 나와요. 뜻은 화면에 뜹니다.')}
            {' '}이어폰을 꽂았는지 한 번 보세요.
          </p>
          {/* ★ 박자는 여기서 깨운다 ★ 설정에 켜진 채로 시작하면 박자는 효과에서
              켜지는데 그건 제스처 밖이라 iOS가 소리를 안 낸다. 이 버튼이 제스처다. */}
          <button className="submit-btn" onClick={() => { beat.arm(); setAsk(false); start(); }}>
            <IconPlay /> 재생 시작
          </button>
          <button className="ghost-btn" onClick={() => setAsk(false)}>아니요</button>
        </div>
      </BottomSheet>
    </div>
  );
}
