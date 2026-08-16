import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconSpeaker, IconRewind, IconCheck, IconX, IconPlus, IconArrowLeft, IconEye, IconBulb, IconTriangle,
} from '../components/Icons.jsx';
import MicButton from '../components/MicButton.jsx';
import MemoBox from '../components/MemoBox.jsx';
import { readingText, speakJapanese, speakSlow } from '../lib/tts.js';
import { releaseMic } from '../lib/stt.js';
import { kanaToHangul } from '../lib/hangul.js';
import { useHotkeys, useHasKeyboard } from '../lib/useHotkeys.js';
import {
  VERDICT, advanceSession, buildDailySession, buildRound1, nextRoundOf, stateOf, todayKey,
} from '../lib/review.js';

const ROUND_LABEL = (round) => (round === 1 ? '1회독 (전체)' : `${round}회독 (틀린 것만 복습)`);

/* 읽어 줄 때는 한자가 아니라 가나를 보낸다.
 * 한자 한 글자만 던지면 음성 엔진이 음독을 고르기 쉽다 — 「海」를 うみ가 아니라
 * 海鮮처럼 カイ로 읽어 버린다. 가나는 읽는 법 그 자체라 헷갈릴 여지가 없고,
 * 어차피 우리가 외우게 하려는 것도 그 소리다. */
function readingOf(word) {
  return word.kana || word.kanji;
}

// 카드 앞/뒷면에 무엇을 띄울지. 회독 방향과 "히라가나를 읽을 수 있는지"에 따라 달라진다.
function facesOf(word, settings) {
  const beginner = settings.canReadKana === false;

  if (settings.direction === 'mean-kanji') {
    return {
      front: { main: word.mean, sub: null, isKo: true },
      back: { main: word.kanji, sub: word.kana },
      speak: readingOf(word),
    };
  }
  if (settings.direction === 'kanji-kana') {
    return {
      front: { main: word.kanji, sub: null },
      back: { main: word.kana, sub: word.mean },
      speak: readingOf(word),
    };
  }
  // 기본: 한자 → 뜻. 가나를 못 읽으면 앞면을 히라가나로 바꿔 카드가 그림이 되지 않게 한다.
  // 이때 앞면이 이미 가나이므로 읽는 법을 또 붙이지 않고, 한자는 뒷면에서 보여준다.
  if (beginner) {
    return {
      front: { main: word.kana, isKana: true },
      back: { main: word.mean, sub: word.kanji === word.kana ? null : word.kanji },
      speak: readingOf(word),
    };
  }
  return {
    front: { main: word.kanji },
    back: { main: word.mean, sub: word.kana },
    speak: readingOf(word),
  };
}

/* 판정 음성이 끝나기를 기다리는 시간. 단어 한 개 길이면 충분하다. */
const JUDGE_SPEAK_GAP = 950;

export default function Study({
  deck, review, settings, session, bookmarks, memos, onSaveMemo,
  onReviewChange, onSessionChange, onSettingsChange, onBookmark, onClose, onToast,
}) {
  const cards = deck.cards;
  const byId = useMemo(() => new Map(cards.map((w) => [w.id, w])), [cards]);

  /* "뒤집었다"를 boolean으로 들고 있으면 카드가 바뀐 뒤에도 한 박자 동안 true로 남는다.
   * 그 틈에 자동 음성이 돌아 아직 뒤집지도 않은 다음 카드의 정답을 읽어 버렸다.
   * 그래서 "어느 카드의 몇 번째 방문을 뒤집었는지"를 들고, revealed는 거기서 끌어낸다.
   * 카드가 바뀌는 즉시 같은 렌더에서 false가 되므로 틈이 없다. */
  const [revealedFor, setRevealedFor] = useState(null);
  const [peekKana, setPeekKana] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [locked, setLocked] = useState(false);   // 카드 전환 중 연타로 오판정되는 것을 막는다
  const [finished, setFinished] = useState(null);
  const history = useRef([]);
  const micTrigger = useRef(null);   // M키로 단어 마이크를 켜고 끈다
  const hasKeyboard = useHasKeyboard();

  // 학습을 끝내면 마이크를 실제로 놓아 준다 — 안 그러면 녹음 표시등이 계속 켜져 있다
  useEffect(() => releaseMic, []);

  // 세션이 없으면 새로 만든다. 이어하기는 App이 넘겨준 session을 그대로 쓴다.
  useEffect(() => {
    if (session && session.deckId === deck.id && session.date === todayKey()) return;

    // 오늘 학습 덱만 "복습 섞기 + 신규"로 짠다.
    // 복습 덱·취약 덱은 이미 추려진 목록이라 그대로 다 돈다.
    const ids = cards.map((w) => w.id);
    const queue = deck.daily
      ? buildDailySession(ids, review, {
        newCount: settings.newPerDay,
        reviewCount: settings.reviewMix,
        shuffle: settings.shuffle,
      }).queue
      : buildRound1(ids, review, { size: 0, shuffle: settings.shuffle });

    onSessionChange({
      deckId: deck.id,
      round: 1,
      queue,
      roundIds: queue,
      reinserted: [],
      done: 0,
      total: queue.length,
      date: todayKey(),
    });
    history.current = [];
    // deck이 바뀔 때만 새 세션을 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id]);

  const currentId = session?.queue?.[0];
  const word = currentId ? byId.get(currentId) : null;
  const faces = word ? facesOf(word, settings) : null;

  // 같은 카드가 몰라요로 다시 나오면 done이 달라져 새 방문으로 친다
  const visitKey = `${currentId}:${session?.done ?? 0}`;
  const revealed = revealedFor === visitKey;
  const reveal = () => setRevealedFor(visitKey);

  const speakCurrent = useCallback(() => {
    if (faces?.speak) speakJapanese(faces.speak, settings.speechRate);
  }, [faces, settings.speechRate]);

  /* 자동 음성은 앞면이 일본어일 때만 의미가 있다(뜻→한자 방향에서는 정답을 흘리게 된다).
   *
   * revealed가 의존성에 들어 있어야 "뜻→한자"에서 뒤집은 뒤에 읽어 줄 수 있는데,
   * 그대로 두면 카드를 뒤집었다가 판정할 때 두 번 읽는다 — 다음 카드로 넘어가며
   * currentId가 바뀌어 한 번, 곧이어 revealed가 false로 돌아가며 또 한 번.
   * 그래서 "이번에 넘긴 카드"마다 한 번만 읽도록 표시를 남긴다.
   * done을 함께 쓰는 이유는 몰라요로 같은 카드가 다시 나왔을 때는 또 읽어야 하기 때문이다. */
  const spokenFor = useRef(null);
  // 판정할 때 읽어 준 시각. 다음 카드의 자동 음성이 그 소리를 끊지 않게 잠깐 양보시킨다.
  const judgeSpokeAt = useRef(0);
  useEffect(() => {
    if (!word || !settings.autoTTS) return;
    if (settings.direction === 'mean-kanji' && !revealed) return;
    if (spokenFor.current === visitKey) return;   // 한 방문에 한 번만
    spokenFor.current = visitKey;

    // 방금 판정 음성이 나갔다면 그게 끝날 때까지 기다렸다가 읽는다.
    // 카드가 또 넘어가면 정리 함수가 예약을 지워서 뒤늦게 울리는 일이 없다.
    const wait = JUDGE_SPEAK_GAP - (Date.now() - judgeSpokeAt.current);
    if (wait > 0) {
      const timer = setTimeout(speakCurrent, wait);
      return () => clearTimeout(timer);
    }
    speakCurrent();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitKey, revealed]);

  useEffect(() => {
    setPeekKana(false);
    setShowExample(false);
  }, [currentId]);

  const judge = (verdict) => {
    if (!word || locked) return;
    // 판정은 언제든 누를 수 있다. 아는 단어를 확인시키려고 한 번 더 두드리게 하면
    // 아는 것만 많은 회독에서 그 두드림이 전부 마찰이 된다. 내 기록은 내가 정한다.
    setLocked(true);

    // 답을 고른 순간의 발음 확인. 아는 줄 알았는데 소리가 다른 경우를 여기서 잡는다.
    if (settings.speakOnJudge) {
      speakCurrent();
      judgeSpokeAt.current = Date.now();
    }

    history.current.push({
      cardId: word.id,
      prevReview: review[word.id],
      prevSession: session,
    });

    const result = advanceSession(session, review, word.id, verdict, todayKey());
    onReviewChange(result.progress, verdict);

    const next = nextRoundOf(result.session, result.progress);
    if (next.kind === 'continue') {
      onSessionChange(result.session);
    } else if (next.kind === 'next') {
      onSessionChange(next.session);
      onToast(`${next.session.round}회독 시작 — 남은 ${next.session.queue.length}개`);
    } else {
      onSessionChange(null);
      setFinished({
        done: result.session.done,
        reason: next.reason,
        carried: next.carried || 0,
      });
    }

    if (verdict === VERDICT.MASTER) onToast('졸업 처리했어요 — 복습에도 안 나와요');
    setTimeout(() => setLocked(false), 220);
  };

  const undo = () => {
    const last = history.current.pop();
    if (!last) return;
    const nextReview = { ...review };
    if (last.prevReview) nextReview[last.cardId] = last.prevReview;
    else delete nextReview[last.cardId];
    onReviewChange(nextReview, null);
    onSessionChange(last.prevSession);
    setFinished(null);
    onToast('직전 판정을 되돌렸어요');
  };

  // 판정만 키에 걸어 두면 카드마다 손이 마우스로 돌아간다.
  // 아래쪽 보조 동작까지 다 걸어야 키보드만으로 한 바퀴가 돈다.
  useHotkeys({
    ' ': speakCurrent,
    Space: speakCurrent,
    Enter: () => (revealed ? judge(VERDICT.KNOWN) : reveal()),
    1: () => judge(VERDICT.UNKNOWN),
    2: () => judge(VERDICT.VAGUE),
    3: () => judge(VERDICT.KNOWN),
    0: () => judge(VERDICT.MASTER),
    ArrowLeft: undo,
    Backspace: undo,
    ArrowDown: reveal,
    s: () => faces && speakSlow(faces.speak),
    S: () => faces && speakSlow(faces.speak),
    b: () => word && onBookmark(word.id),
    B: () => word && onBookmark(word.id),
    e: () => { setShowExample((v) => !v); reveal(); },
    E: () => { setShowExample((v) => !v); reveal(); },
    k: () => setPeekKana(true),
    K: () => setPeekKana(true),
    m: () => micTrigger.current?.(),
    M: () => micTrigger.current?.(),
    Escape: onClose,
  });

  /* 완주 화면이 세션 검사보다 먼저다.
   * 마지막 장을 판정하면 session을 null로 지우는데, 그 검사를 먼저 하면
   * 완주 화면에 닿기도 전에 null을 반환해서 화면이 통째로 비어 버린다. */
  if (finished) {
    return (
      <FinishCard
        finished={finished}
        deck={deck}
        settings={settings}
        onClose={onClose}
        onUndo={history.current.length ? undo : null}
      />
    );
  }

  // 훅을 모두 부른 뒤에 그린다 — 세션 준비 전에 일찍 빠져나가면 훅 순서가 어긋난다.
  if (!session || session.deckId !== deck.id) return null;

  if (!word) {
    return (
      <div className="study">
        <StudyHeader session={session} deck={deck} onClose={onClose} onUndo={null} />
        <div className="empty-state">학습할 카드가 없어요</div>
      </div>
    );
  }

  const bookmarked = bookmarks.includes(word.id);
  const st = stateOf(review, word.id);
  const hangul = settings.hangulPron ? kanaToHangul(word.kana) : null;

  return (
    <div className="study">
      <StudyHeader
        session={session}
        deck={deck}
        onClose={onClose}
        onUndo={history.current.length ? undo : null}
        hasKeyboard={hasKeyboard}
      />

      <div className="studycard" onClick={() => !revealed && reveal()}>
        <div className="sc-top">
          {st.wrongCount + st.vagueCount >= 3 && <span className="sc-weak">취약</span>}
          <button
            className="sc-speak"
            onClick={(e) => { e.stopPropagation(); speakCurrent(); }}
            aria-label="발음 듣기"
          >
            <IconSpeaker />
            {hasKeyboard && <kbd className="corner-key">Space</kbd>}
          </button>
        </div>

        <div className={`sc-main${faces.front.isKo ? ' ko' : ''}`}>{faces.front.main}</div>

        {/* 앞면에서 읽는 법만 살짝 확인 — 뜻을 보기 전 단계.
            앞면이 이미 가나면 확인할 게 없으므로 한글 발음만 붙인다. */}
        {!revealed && faces.front.isKana && hangul && (
          <div className="sc-kana"><span className="sc-hangul">{hangul}</span></div>
        )}
        {!revealed && !faces.front.isKana && settings.direction !== 'mean-kanji' && !settings.showKana && !peekKana && (
          <button className="sc-peek" onClick={(e) => { e.stopPropagation(); setPeekKana(true); }}>
            <IconEye /> 히라가나 보기{hasKeyboard && <kbd className="inline-key">K</kbd>}
          </button>
        )}
        {!revealed && !faces.front.isKana && (peekKana || settings.showKana) && (
          <div className="sc-kana">
            {word.kana}
            {hangul && <span className="sc-hangul"> · {hangul}</span>}
          </div>
        )}

        {revealed ? (
          <div className="sc-back">
            <div className="sc-answer">{faces.back.main}</div>
            {faces.back.sub && (
              <div className="sc-kana">
                {faces.back.sub}
                {hangul && <span className="sc-hangul"> · {hangul}</span>}
              </div>
            )}
            <MemoBox
              memo={memos?.[word.id]}
              placeholder={`예) ${word.kana} → 소리로 외우는 나만의 방법`}
              onSave={(text) => onSaveMemo(word.id, text)}
              onDelete={() => onSaveMemo(word.id, '')}
            />
            {settings.showExample && word.example && (
              <div className="sc-example">
                <div className="ex-jp">{settings.canReadKana === false && word.exampleKana ? word.exampleKana : word.example}</div>
                <div className="ex-ko">{word.exampleKo}</div>
                {/* 예문은 단어보다 길어서 발음 흐름을 익히기 좋다. 따로 들을 수 있게 둔다. */}
                <button
                  className="ex-play"
                  onClick={(e) => { e.stopPropagation(); speakJapanese(readingText(word.exampleKana, word.example), settings.speechRate); }}
                  aria-label="예문 듣기"
                >
                  <IconSpeaker />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="sc-hint">
            탭해서 뜻 확인하기{hasKeyboard && <kbd className="inline-key">Enter</kbd>}
          </div>
        )}
      </div>

      {/* 읽는 법이 입에서 나오는지 확인한다. 뜻→한자 방향은 정답을 소리로 흘리게 되므로 뺀다.
          무엇을 말해야 하는지 버튼에 그대로 적는다 — "읽어보기"만 있으면 단어인지 예문인지 모른다.
          짧은 단어는 인식이 잘 빗나가서, 예문으로도 해볼 수 있게 따로 둔다. */}
      {revealed && settings.direction !== 'mean-kanji' && (
        <>
          <MicButton
            label={`「${word.kana}」 말해보기`}
            target={`${word.kanji} (${word.kana})`}
            expected={[word.kanji, word.kana]}
            hints={[word.kanji, word.kana, word.example].filter(Boolean)}
            onToast={onToast}
            autoStart={settings.autoMic}
            triggerRef={micTrigger}
            hasKeyboard={hasKeyboard}
            hotkey="M"
          />
          {word.example && (
            <MicButton
              label="예문으로 말해보기"
              target={word.example}
              expected={[word.example, word.exampleKana].filter(Boolean)}
              hints={[word.example, word.exampleKana].filter(Boolean)}
              onToast={onToast}
            />
          )}
        </>
      )}

      <div className="judgerow">
        <button className="judge unknown" disabled={locked} onClick={() => judge(VERDICT.UNKNOWN)}>
          {hasKeyboard && <kbd className="judge-key">1</kbd>}
          <IconX />
          <b>몰라요</b>
          <span>오늘 다시</span>
        </button>
        <button className="judge vague" disabled={locked} onClick={() => judge(VERDICT.VAGUE)}>
          {hasKeyboard && <kbd className="judge-key">2</kbd>}
          <IconTriangle />
          <b>애매해요</b>
          <span>다음 회독에</span>
        </button>
        <button className="judge known" disabled={locked} onClick={() => judge(VERDICT.KNOWN)}>
          {hasKeyboard && <kbd className="judge-key">3</kbd>}
          <IconCheck />
          <b>알아요</b>
          <span>기억했어요</span>
        </button>
      </div>

      <div className="studyfoot">
        <button onClick={() => speakSlow(faces.speak)}>
          <IconRewind /> 천천히 듣기{hasKeyboard && <kbd className="inline-key">S</kbd>}
        </button>
        <button className={bookmarked ? 'on' : ''} onClick={() => onBookmark(word.id)}>
          <IconPlus /> {bookmarked ? '단어장에 있음' : '단어장에 추가'}
          {hasKeyboard && <kbd className="inline-key">B</kbd>}
        </button>
        <button
          className={showExample ? 'on' : ''}
          onClick={() => { setShowExample((v) => !v); reveal(); }}
        >
          <IconBulb /> 예문 보기{hasKeyboard && <kbd className="inline-key">E</kbd>}
        </button>
      </div>

      {showExample && word.example && !settings.showExample && (
        <div className="card sc-example" style={{ marginTop: 12 }}>
          <div className="ex-jp">{word.example}</div>
          <div className="ex-ko">{word.exampleKo}</div>
          <button
            className="ex-play"
            onClick={() => speakJapanese(readingText(word.exampleKana, word.example), settings.speechRate)}
            aria-label="예문 듣기"
          >
            <IconSpeaker />
          </button>
        </div>
      )}
    </div>
  );
}

function StudyHeader({ session, deck, onClose, onUndo, hasKeyboard }) {
  const pct = session.total ? Math.min(100, Math.round((session.done / session.total) * 100)) : 0;
  return (
    <div className="studyhead">
      <div className="sh-row">
        <button className="sh-close" onClick={onClose} aria-label="학습 종료"><IconArrowLeft /></button>
        <div className="sh-title">{deck.label} {session.done} / {session.total}</div>
        <button className="sh-undo" onClick={onUndo} disabled={!onUndo}>
          ↩ 되돌리기{hasKeyboard && <kbd className="inline-key">←</kbd>}
        </button>
      </div>
      <div className="sh-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="sh-sub">
        남은 {session.queue.length}개 <span className="sep">|</span> {ROUND_LABEL(session.round)}
      </div>
    </div>
  );
}

function FinishCard({ finished, deck, settings, onClose, onUndo }) {
  const goal = settings.dailyGoal;
  return (
    <div className="study">
      <div className="finish">
        <div className="fin-badge">🎉</div>
        <h2>{finished.reason === 'clear' ? '오늘 회독 완주!' : '오늘은 여기까지'}</h2>
        <p className="fin-lines">
          <span>{deck.label} · {finished.done}장 학습</span>
          {finished.carried > 0 && <span>남은 {finished.carried}개는 내일 복습 큐로 넘겼어요</span>}
          <span>오늘 목표 {goal}장</span>
        </p>
        <button className="submit-btn" onClick={onClose}>홈으로</button>
        {onUndo && (
          <button className="ghost-btn" onClick={onUndo}>↩ 마지막 판정 되돌리기</button>
        )}
      </div>
    </div>
  );
}
