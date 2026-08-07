import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconSpeaker, IconChevron, IconArrowLeft, IconCheck, IconX, IconTriangle, IconRewind, IconEye,
} from '../components/Icons.jsx';
import KeyHints from '../components/KeyHints.jsx';
import MicButton from '../components/MicButton.jsx';
import { speakJapanese, speakSlow } from '../lib/tts.js';
import { kanaToHangul } from '../lib/hangul.js';
import { useHotkeys } from '../lib/useHotkeys.js';
import BuildQuiz from '../components/BuildQuiz.jsx';
import { ALL_SITUATIONS as SITUATIONS } from '../data/allSituations.js';
import { chunksOf, hasChunks } from '../data/allChunks.js';
import {
  VERDICT, advanceSession, buildRound1, dueCards, isMastered, nextRoundOf, stateOf, todayKey,
} from '../lib/review.js';

const MODES = [
  { id: 'ko-jp', label: '한국어 → 일본어', desc: '보고 일본어로 말해보기' },
  { id: 'build', label: '문장 만들기', desc: '단어를 순서대로 눌러 조립하기' },
  { id: 'jp-ko', label: '일본어 → 뜻', desc: '읽고 뜻 떠올리기' },
  { id: 'listen', label: '듣기', desc: '음성만 듣고 뜻 맞히기' },
  { id: 'blank', label: '빈칸 채우기', desc: '조사 · 어미를 채워보기' },
];

const STAR_LABEL = { 3: '꼭 필요', 2: '권장', 1: '여유되면' };

export default function Situations({ review, settings, onReviewChange, onToast }) {
  const [situationId, setSituationId] = useState(SITUATIONS[0]?.id);
  const [onlyStar, setOnlyStar] = useState(false);
  const [part, setPart] = useState(null);   // 선택한 파트
  const [mode, setMode] = useState(null);   // 고른 학습 모드 → 있으면 회독 시작
  const [showCard, setShowCard] = useState(null); // 보여주기 카드로 띄운 문장

  const situation = SITUATIONS.find((s) => s.id === situationId);

  // 복습 덱은 이미 추려진 목록이므로 별표 필터를 다시 걸지 않는다.
  const itemsOf = useCallback(
    (p) => (onlyStar && p.id !== 'due' ? p.items.filter((i) => i.star === 3) : p.items),
    [onlyStar],
  );

  const allItems = useMemo(
    () => SITUATIONS.flatMap((s) => s.parts.flatMap((p) => p.items)),
    [],
  );
  const dueItems = useMemo(() => {
    const ids = new Set(dueCards(allItems.map((i) => i.id), review, todayKey()));
    // 「タクシーを呼んでいただけますか」처럼 여러 상황에 같은 문장이 들어 있다.
    // 파트별 학습에서는 각 맥락에서 한 번씩 나오는 게 맞지만,
    // 복습 큐는 전 상황을 훑으므로 같은 문장이 연달아 나오면 오류로 보인다.
    const seen = new Set();
    return allItems.filter((i) => {
      if (!ids.has(i.id) || seen.has(i.jp)) return false;
      seen.add(i.jp);
      return true;
    });
  }, [allItems, review]);

  // 보여주기 카드는 화면을 덮는 오버레이다. 갈아끼우면 학습 화면이 언마운트되면서
  // 진행 중이던 회독이 처음부터 다시 시작된다.
  const overlay = showCard
    ? <ShowCard item={showCard} settings={settings} onClose={() => setShowCard(null)} />
    : null;

  if (part && mode) {
    return (
      <>
      <SentencePlayer
        part={part}
        items={mode === 'build' ? itemsOf(part).filter((i) => hasChunks(i.id)) : itemsOf(part)}
        mode={mode}
        review={review}
        settings={settings}
        onReviewChange={onReviewChange}
        onToast={onToast}
        onShowCard={setShowCard}
        onExit={() => setMode(null)}
      />
      {overlay}
      </>
    );
  }

  if (part) {
    return (
      <>
        {overlay}
        <div className="sub-header" style={{ margin: '-16px -18px 14px' }}>
          <button className="sub-back" onClick={() => setPart(null)}><IconArrowLeft /> 뒤로</button>
          <div className="sub-title">{part.label}</div>
        </div>
        <p className="lead">{itemsOf(part).length}문장 · 어떻게 연습할까요?</p>
        <div className="stack">
          {MODES.map((m) => {
            // 조립 퀴즈는 조각이 3개 이상인 문장만 낼 수 있다
            const usable = m.id === 'build'
              ? itemsOf(part).filter((i) => hasChunks(i.id)).length
              : itemsOf(part).length;
            return (
              <button
                key={m.id}
                className="menucard"
                disabled={usable === 0}
                onClick={() => setMode(m.id)}
              >
                <span className="mc-body">
                  <span className="mc-title">{m.label}</span>
                  <span className="mc-sub">
                    {usable === 0 ? '이 파트에는 낼 문장이 없어요'
                      : m.id === 'build' ? `${m.desc} · ${usable}문장` : m.desc}
                  </span>
                </span>
                <IconChevron className="chev" />
              </button>
            );
          })}
        </div>

        <div className="section-label">문장 훑어보기</div>
        <div className="stack">
          {itemsOf(part).map((item) => (
            <div key={item.id} className="card sentrow">
              <div className="sr-main">
                <div className="sr-jp">
                  {item.star === 3 && <span className="star">★</span>}
                  {item.jp}
                </div>
                <div className="sr-ko">{item.ko}</div>
              </div>
              <button className="iconbtn" onClick={() => speakJapanese(item.jp, settings.speechRate)} aria-label="듣기">
                <IconSpeaker />
              </button>
              <button className="iconbtn" onClick={() => setShowCard(item)} aria-label="크게 보여주기">
                <IconEye />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {overlay}
      {dueItems.length > 0 && (
        <button
          className="duebar"
          onClick={() => { setPart({ id: 'due', label: '문장 복습', items: dueItems }); setMode(null); }}
        >
          <IconRewind />
          <span>오늘 복습할 문장 <b>{dueItems.length}개</b></span>
          <IconChevron className="chev" />
        </button>
      )}

      <div className="chiprow">
        {SITUATIONS.map((s) => (
          <div key={s.id} className={`chip${situationId === s.id ? ' active' : ''}`} onClick={() => setSituationId(s.id)}>
            {s.label}
          </div>
        ))}
      </div>

      <button className={`starfilter${onlyStar ? ' on' : ''}`} onClick={() => setOnlyStar((v) => !v)}>
        ★ 꼭 필요한 문장만 보기
      </button>

      <div className="stack" style={{ marginTop: 12 }}>
        {situation?.parts.map((p, i) => {
          const items = itemsOf(p);
          const done = items.filter((it) => isMastered(stateOf(review, it.id))).length;
          return (
            <button
              key={p.id}
              className="menucard"
              disabled={items.length === 0}
              onClick={() => { setPart(p); setMode(null); }}
            >
              <span className="mc-icon partno">{i + 1}</span>
              <span className="mc-body">
                <span className="mc-title">{p.label}</span>
                <span className="mc-sub">
                  {items.length === 0 ? '꼭 필요한 문장이 없어요' : `${done} / ${items.length} 외움`}
                </span>
              </span>
              <IconChevron className="chev" />
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── 회독 엔진을 그대로 쓰는 문장 플레이어 ── */

function facesOf(item, mode, settings) {
  const beginner = settings.canReadKana === false;
  const jp = beginner ? item.kana : item.jp;

  if (mode === 'ko-jp') {
    return { front: item.ko, frontKo: true, back: jp, backSub: beginner ? null : item.kana };
  }
  if (mode === 'listen') {
    return { front: null, back: jp, backSub: item.ko };
  }
  if (mode === 'blank') {
    let masked = jp;
    for (const b of item.blanks || []) masked = masked.replace(b, '◯'.repeat(b.length));
    return { front: masked, back: jp, backSub: item.ko };
  }
  return { front: jp, back: item.ko, backSub: beginner ? null : item.kana };
}

function SentencePlayer({ part, items, mode, review, settings, onReviewChange, onToast, onShowCard, onExit }) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [session, setSession] = useState(() => {
    const queue = buildRound1(items.map((i) => i.id), review, { size: 0, shuffle: settings.shuffle });
    return { round: 1, queue, roundIds: queue, reinserted: [], done: 0, total: queue.length };
  });
  const [revealed, setRevealed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [finished, setFinished] = useState(null);
  const history = useRef([]);

  const currentId = session.queue[0];
  const item = currentId ? byId.get(currentId) : null;
  const faces = item ? facesOf(item, mode, settings) : null;
  const speakText = item ? item.jp : '';

  // 듣기 모드는 앞면에 글자가 없으므로 반드시 소리를 내야 한다.
  useEffect(() => {
    if (!item) return;
    if (mode === 'listen' || settings.autoTTS) {
      if (mode === 'ko-jp' && !revealed) return; // 정답을 미리 흘리지 않는다
      speakJapanese(speakText, settings.speechRate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, revealed]);

  useEffect(() => setRevealed(false), [currentId]);

  const judge = (verdict) => {
    if (!item || locked) return;
    if (verdict !== VERDICT.MASTER && !revealed) return;
    setLocked(true);
    history.current.push({ id: item.id, prevReview: review[item.id], prevSession: session });

    const result = advanceSession(session, review, item.id, verdict, todayKey());
    onReviewChange(result.progress, verdict);

    const next = nextRoundOf(result.session, result.progress);
    if (next.kind === 'continue') setSession(result.session);
    else if (next.kind === 'next') {
      setSession(next.session);
      onToast(`${next.session.round}회독 시작 — 남은 ${next.session.queue.length}개`);
    } else {
      setFinished({ done: result.session.done, carried: next.carried || 0 });
    }
    if (verdict === VERDICT.MASTER) onToast('졸업 처리했어요 — 복습에도 안 나와요');
    setTimeout(() => setLocked(false), 220);
  };

  const undo = () => {
    const last = history.current.pop();
    if (!last) return;
    const nextReview = { ...review };
    if (last.prevReview) nextReview[last.id] = last.prevReview;
    else delete nextReview[last.id];
    onReviewChange(nextReview, null);
    setSession(last.prevSession);
    setFinished(null);
    onToast('직전 판정을 되돌렸어요');
  };

  useHotkeys({
    ' ': () => speakJapanese(speakText, settings.speechRate),
    Space: () => speakJapanese(speakText, settings.speechRate),
    Enter: () => (revealed ? judge(VERDICT.KNOWN) : setRevealed(true)),
    1: () => judge(VERDICT.UNKNOWN),
    2: () => judge(VERDICT.VAGUE),
    3: () => judge(VERDICT.KNOWN),
    0: () => judge(VERDICT.MASTER),
    ArrowLeft: undo,
    Backspace: undo,
    ArrowDown: () => setRevealed(true),
    Escape: onExit,
  });

  if (finished) {
    return (
      <div className="finish">
        <div className="fin-badge">🎉</div>
        <h2>{part.label} 완주!</h2>
        <p className="fin-lines">
          <span>{finished.done}문장 학습</span>
          {finished.carried > 0 && <span>남은 {finished.carried}개는 내일 복습해요</span>}
        </p>
        <button className="submit-btn" onClick={onExit}>돌아가기</button>
      </div>
    );
  }

  if (!item) return <div className="empty-state">문장이 없어요</div>;

  const hangul = settings.hangulPron ? kanaToHangul(item.kana) : null;

  return (
    <div className="study">
      <div className="studyhead">
        <div className="sh-row">
          <button className="sh-close" onClick={onExit} aria-label="나가기"><IconArrowLeft /></button>
          <div className="sh-title">{part.label} {session.done} / {session.total}</div>
          <button className="sh-undo" onClick={undo} disabled={!history.current.length}>↩ 되돌리기</button>
        </div>
        <div className="sh-bar">
          <i style={{ width: `${session.total ? (session.done / session.total) * 100 : 0}%` }} />
        </div>
        <div className="sh-sub">
          남은 {session.queue.length}개 <span className="sep">|</span> {session.round}회독
        </div>
      </div>

      <div
        className={`studycard${mode === 'build' ? ' plain' : ''}`}
        onClick={() => mode !== 'build' && !revealed && setRevealed(true)}
      >
        <div className="sc-top">
          {item.star === 3 && <span className="sc-weak" style={{ color: 'var(--kon)', background: 'var(--kon-soft)' }}>꼭 필요</span>}
          <button className="sc-speak" onClick={(e) => { e.stopPropagation(); speakJapanese(speakText, settings.speechRate); }} aria-label="듣기">
            <IconSpeaker />
          </button>
        </div>

        {mode === 'build' ? (
          <BuildQuiz
            item={item}
            chunks={chunksOf(item.id)}
            settings={settings}
            onSolved={() => setRevealed(true)}
          />
        ) : faces.front === null ? (
          <button className="listenbig" onClick={(e) => { e.stopPropagation(); speakJapanese(speakText, settings.speechRate); }}>
            <IconSpeaker />
          </button>
        ) : (
          <div className={`sent-front${faces.frontKo ? ' ko' : ''}`}>{faces.front}</div>
        )}

        {revealed && mode !== 'build' ? (
          <div className="sc-back">
            <div className="sent-answer">{faces.back}</div>
            {faces.backSub && <div className="sc-kana">{faces.backSub}</div>}
            {hangul && <div className="sc-kana"><span className="sc-hangul">{hangul}</span></div>}
            {item.reply && (
              <div className="replybox">
                <div className="rb-label">상대는 이렇게 답해요</div>
                <div className="rb-jp">{settings.canReadKana === false ? item.reply.kana : item.reply.jp}</div>
                <div className="rb-ko">{item.reply.ko}</div>
                <button className="rb-play" onClick={(e) => { e.stopPropagation(); speakJapanese(item.reply.jp, settings.speechRate); }}>
                  <IconSpeaker /> 답변 듣기
                </button>
              </div>
            )}
          </div>
        ) : mode !== 'build' ? (
          <div className="sc-hint">
            {mode === 'ko-jp' ? '일본어로 말해본 뒤 탭하세요' : '탭해서 정답 확인하기'}
          </div>
        ) : null}
      </div>

      {/* 한→일 모드는 입으로 말하는 게 목적이라 마이크를 앞면에 둔다.
          말한 결과가 정답에 가까우면 뒷면을 열어 바로 확인하게 한다. */}
      {mode === 'ko-jp' && !revealed && (
        <div onClick={(e) => e.stopPropagation()}>
          <MicButton
            expected={[item.jp, item.kana]}
            hints={[item.jp, item.kana]}
            onToast={onToast}
            onResult={(scored) => { if (scored.verdict !== 'none') setRevealed(true); }}
          />
        </div>
      )}

      {!revealed && (
        <button className="skipbtn" onClick={() => judge(VERDICT.MASTER)} disabled={locked}>
          이미 외웠어요 · 바로 졸업
        </button>
      )}

      <div className="judgerow">
        <button className="judge unknown" disabled={!revealed || locked} onClick={() => judge(VERDICT.UNKNOWN)}>
          <IconX /><b>몰라요</b><span>오늘 다시</span>
        </button>
        <button className="judge vague" disabled={!revealed || locked} onClick={() => judge(VERDICT.VAGUE)}>
          <IconTriangle /><b>애매해요</b><span>다음 회독에</span>
        </button>
        <button className="judge known" disabled={!revealed || locked} onClick={() => judge(VERDICT.KNOWN)}>
          <IconCheck /><b>알아요</b><span>기억했어요</span>
        </button>
      </div>

      <div className="studyfoot">
        <button onClick={() => speakSlow(speakText)}><IconRewind /> 천천히 듣기</button>
        <button onClick={() => onShowCard(item)}><IconEye /> 보여주기 카드</button>
      </div>

      <KeyHints revealed={revealed} />
    </div>
  );
}

/* ── 보여주기 카드 ──
 * 말이 안 나올 때 점원에게 화면을 그대로 보여주는 용도. 글씨를 최대한 키운다. */
function ShowCard({ item, settings, onClose }) {
  return (
    <div className="showcard" onClick={onClose}>
      <div className="show-jp">{item.jp}</div>
      <div className="show-ko">{item.ko}</div>
      <button
        className="ghost-btn"
        onClick={(e) => { e.stopPropagation(); speakJapanese(item.jp, settings.speechRate); }}
      >
        <IconSpeaker /> 소리로 들려주기
      </button>
      <div className="show-hint">화면을 탭하면 닫혀요</div>
    </div>
  );
}
