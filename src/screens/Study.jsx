import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconSpeaker, IconRewind, IconCheck, IconX, IconPlus, IconArrowLeft, IconEye, IconBulb, IconTriangle,
} from '../components/Icons.jsx';
import KeyHints from '../components/KeyHints.jsx';
import { speakJapanese, speakSlow } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { useHotkeys } from '../lib/useHotkeys.js';
import {
  VERDICT, advanceSession, buildRound1, nextRoundOf, stateOf, todayKey,
} from '../lib/review.js';

const ROUND_LABEL = (round) => (round === 1 ? '1회독 (전체)' : `${round}회독 (틀린 것만 복습)`);

// 카드 앞/뒷면에 무엇을 띄울지. 회독 방향과 "히라가나를 읽을 수 있는지"에 따라 달라진다.
function facesOf(word, settings) {
  const beginner = settings.canReadKana === false;

  if (settings.direction === 'mean-kanji') {
    return {
      front: { main: word.mean, sub: null, isKo: true },
      back: { main: word.kanji, sub: word.kana },
      speak: word.kanji,
    };
  }
  if (settings.direction === 'kanji-kana') {
    return {
      front: { main: word.kanji, sub: null },
      back: { main: word.kana, sub: word.mean },
      speak: word.kanji,
    };
  }
  // 기본: 한자 → 뜻. 가나를 못 읽으면 앞면을 히라가나로 바꿔 카드가 그림이 되지 않게 한다.
  // 이때 앞면이 이미 가나이므로 읽는 법을 또 붙이지 않고, 한자는 뒷면에서 보여준다.
  if (beginner) {
    return {
      front: { main: word.kana, isKana: true },
      back: { main: word.mean, sub: word.kanji === word.kana ? null : word.kanji },
      speak: word.kanji,
    };
  }
  return {
    front: { main: word.kanji },
    back: { main: word.mean, sub: word.kana },
    speak: word.kanji,
  };
}

export default function Study({
  deck, review, settings, session, bookmarks,
  onReviewChange, onSessionChange, onSettingsChange, onBookmark, onClose, onToast,
}) {
  const cards = deck.cards;
  const byId = useMemo(() => new Map(cards.map((w) => [w.id, w])), [cards]);

  const [revealed, setRevealed] = useState(false);
  const [peekKana, setPeekKana] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [locked, setLocked] = useState(false);   // 카드 전환 중 연타로 오판정되는 것을 막는다
  const [finished, setFinished] = useState(null);
  const [showRules, setShowRules] = useState(!settings.seenRules);
  const history = useRef([]);

  // 세션이 없으면 새로 만든다. 이어하기는 App이 넘겨준 session을 그대로 쓴다.
  useEffect(() => {
    if (session && session.deckId === deck.id && session.date === todayKey()) return;
    const queue = buildRound1(cards.map((w) => w.id), review, {
      size: settings.dailyGoal,
      shuffle: settings.shuffle,
    });
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

  const speakCurrent = useCallback(() => {
    if (faces?.speak) speakJapanese(faces.speak, settings.speechRate);
  }, [faces, settings.speechRate]);

  // 자동 음성은 앞면이 일본어일 때만 의미가 있다(뜻→한자 방향에서는 정답을 흘리게 된다).
  useEffect(() => {
    if (!word || !settings.autoTTS) return;
    if (settings.direction === 'mean-kanji' && !revealed) return;
    speakCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, revealed]);

  useEffect(() => {
    setRevealed(false);
    setPeekKana(false);
    setShowExample(false);
  }, [currentId]);

  const dismissRules = () => {
    setShowRules(false);
    onSettingsChange({ seenRules: true });
  };

  const judge = (verdict) => {
    if (!word || locked) return;
    // 뒷면을 봐야 판정할 수 있다. 단 "이미 외웠어요"는 확인 없이 넘기는 게 목적이라 예외다.
    if (verdict !== VERDICT.MASTER && !revealed) return;
    setLocked(true);

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

  useHotkeys({
    ' ': speakCurrent,
    Space: speakCurrent,
    Enter: () => (revealed ? judge(VERDICT.KNOWN) : setRevealed(true)),
    1: () => judge(VERDICT.UNKNOWN),
    2: () => judge(VERDICT.VAGUE),
    3: () => judge(VERDICT.KNOWN),
    0: () => judge(VERDICT.MASTER),
    ArrowLeft: undo,
    Backspace: undo,
    ArrowDown: () => setRevealed(true),
    Escape: onClose,
  });

  // 훅을 모두 부른 뒤에 그린다 — 세션 준비 전에 일찍 빠져나가면 훅 순서가 어긋난다.
  if (!session || session.deckId !== deck.id) return null;

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
      />

      {showRules && (
        <button className="rulecard" onClick={dismissRules}>
          <b>회독 규칙</b>
          <span>✕ 몰라요 → 오늘 한 번 더 · △ 애매해요 → 다음 회독에 · ○ 알아요 → 이어지면 졸업</span>
          <em>탭하면 닫혀요</em>
        </button>
      )}

      <div className="studycard" onClick={() => !revealed && setRevealed(true)}>
        <div className="sc-top">
          {st.wrongCount + st.vagueCount >= 3 && <span className="sc-weak">취약</span>}
          <button
            className="sc-speak"
            onClick={(e) => { e.stopPropagation(); speakCurrent(); }}
            aria-label="발음 듣기"
          >
            <IconSpeaker />
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
            <IconEye /> 히라가나 보기
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
            {settings.showExample && word.example && (
              <div className="sc-example">
                <div className="ex-jp">{settings.canReadKana === false && word.exampleKana ? word.exampleKana : word.example}</div>
                <div className="ex-ko">{word.exampleKo}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="sc-hint">탭해서 뜻 확인하기</div>
        )}
      </div>

      {/* 뜻을 보지 않고도 확실히 아는 카드를 위한 탈출구.
          뒷면을 확인해야 판정되는 원칙은 유지하되, 이 버튼만 예외로 둔다. */}
      {!revealed && (
        <button className="skipbtn" onClick={() => judge(VERDICT.MASTER)} disabled={locked}>
          이미 외웠어요 · 바로 졸업
        </button>
      )}

      <div className="judgerow">
        <button
          className="judge unknown"
          disabled={!revealed || locked}
          onClick={() => judge(VERDICT.UNKNOWN)}
        >
          <IconX />
          <b>몰라요</b>
          <span>오늘 다시</span>
        </button>
        <button
          className="judge vague"
          disabled={!revealed || locked}
          onClick={() => judge(VERDICT.VAGUE)}
        >
          <IconTriangle />
          <b>애매해요</b>
          <span>다음 회독에</span>
        </button>
        <button
          className="judge known"
          disabled={!revealed || locked}
          onClick={() => judge(VERDICT.KNOWN)}
        >
          <IconCheck />
          <b>알아요</b>
          <span>기억했어요</span>
        </button>
      </div>

      <div className="studyfoot">
        <button onClick={() => speakSlow(faces.speak)}><IconRewind /> 천천히 듣기</button>
        <button className={bookmarked ? 'on' : ''} onClick={() => onBookmark(word.id)}>
          <IconPlus /> {bookmarked ? '단어장에 있음' : '단어장에 추가'}
        </button>
        <button
          className={showExample ? 'on' : ''}
          onClick={() => { setShowExample((v) => !v); setRevealed(true); }}
        >
          <IconBulb /> 예문 보기
        </button>
      </div>

      {showExample && word.example && !settings.showExample && (
        <div className="card sc-example" style={{ marginTop: 12 }}>
          <div className="ex-jp">{word.example}</div>
          <div className="ex-ko">{word.exampleKo}</div>
        </div>
      )}

      <KeyHints revealed={revealed} />
    </div>
  );
}

function StudyHeader({ session, deck, onClose, onUndo }) {
  const pct = session.total ? Math.min(100, Math.round((session.done / session.total) * 100)) : 0;
  return (
    <div className="studyhead">
      <div className="sh-row">
        <button className="sh-close" onClick={onClose} aria-label="학습 종료"><IconArrowLeft /></button>
        <div className="sh-title">{deck.label} {session.done} / {session.total}</div>
        <button className="sh-undo" onClick={onUndo} disabled={!onUndo}>↩ 되돌리기</button>
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
