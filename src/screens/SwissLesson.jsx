import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconRewind, IconCheck } from '../components/Icons.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { speakIn } from '../lib/tts.js';
import { buildExercises, judgeGerman, starsFor } from '../lib/swissCourse.js';

/* 레슨 하나 — 문제 열 개쯤을 차례로.
 *
 * 듀오링고의 뼈대를 그대로 가져왔다.
 *   고른다 → 「확인」 → 맞았는지 띠가 뜬다 → 「계속」
 *   틀린 문제는 뒤로 다시 붙는다 — 틀린 채로 끝나지 않는다
 *   끝나면 별과 XP
 *
 * 문제 유형은 lib/swissCourse.js가 만든다. 여기는 그리고 판정만 한다.
 *   choose-ko  독일어를 듣고 보고 → 뜻을 고른다 (들어오면 읽어 준다)
 *   choose-sw  뜻을 보고 → 독일어를 고른다 (맞히면 읽어 준다)
 *   listen     소리만 듣고 → 무엇이었는지 고른다 (글자는 안 보여 준다)
 *   build      뜻을 보고 → 낱말 조각으로 문장을 만든다
 *   match      짝 맞추기 넷 — 왼쪽 독일어, 오른쪽 뜻
 *   write      뜻을 보고 → 독일어를 직접 쓴다 (보기가 없다. 복습에서 굳은 낱말에 나온다)
 *   dictate    소리만 듣고 → 들은 대로 쓴다
 *
 * 복습(mode='review')도 같은 화면이다. 문제 목록만 다르다 — 복습일이 된 낱말을 굳은 정도에 맞는
 * 유형으로 낸 것(lib/swissCourse.js buildReview). 문제마다 낱말의 「첫 대답」을 모아 끝나면 넘긴다 —
 * 부른 쪽이 그걸 기억(복습 일정)에 적는다.
 *
 * 소리는 늘 독일어(de)만 넘긴다. 뜻·도움말이 같이 읽히면 안 된다. */

const DE = 'de-DE';
const CH = 'de-CH';

/* ä ö ü ß — 자판에 없는 사람을 위한 입력 도우미. 안 눌러도 ae·ue로 써도 맞다(채점이 같은 글자로 본다). */
const SPECIALS = ['ä', 'ö', 'ü', 'ß'];

export default function SwissLesson({
  lessonId, exercises = null, mode = 'lesson', rate, onDone, onQuit, onMore,
}) {
  const [queue, setQueue] = useState(() => exercises || buildExercises(lessonId));
  const total = useMemo(() => queue.length, []);   // 처음 개수 — 진행 막대는 이걸로 잰다
  const [at, setAt] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const wrongIds = useRef(new Set());
  const [pick, setPick] = useState(null);      // 고른 보기 id (choose·listen)
  const [built, setBuilt] = useState([]);      // 고른 조각 id 순서 (build)
  const [checked, setChecked] = useState(null); // null | 'ok' | 'no'
  const [finished, setFinished] = useState(false);
  const [typed, setTyped] = useState('');       // 직접 쓴 답 (write·dictate)
  const [note, setNote] = useState('');          // 「거의 맞았어요」 같은 한 줄
  /* 낱말마다 첫 대답만 — 틀린 문제가 뒤에 다시 붙어도 두 번째 대답은 안 센다 */
  const firstRes = useRef({});
  const noteFirst = (id, ok) => { if (id && !(id in firstRes.current)) firstRes.current[id] = ok; };
  const typing = (t) => t === 'write' || t === 'dictate';

  const ex = queue[at];
  const done = at >= queue.length;

  /* 들어오면 읽어 준다 — 듣는 문제는 그게 문제 자체다 */
  useEffect(() => {
    if (!ex) return;
    if (ex.type === 'choose-ko' || ex.type === 'listen' || ex.type === 'dictate') speakIn(ex.item.de, DE, rate, { id: `q:${at}` });
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (done && !finished) setFinished(true); }, [done, finished]);

  if (finished) {
    const stars = starsFor(mistakes, total);
    return (
      <SwissFinish
        stars={stars}
        mistakes={mistakes}
        total={total}
        mode={mode}
        onAgain={() => {
          /* 레슨은 같은 레슨을 한 번 더. 복습은 다음 묶음 — 같은 낱말을 바로 또 묻는 건 복습이 아니다 */
          if (mode === 'review') { onDone({ mistakes, total, wrongIds: [...wrongIds.current], results: { ...firstRes.current }, mode }); onMore?.(); return; }
          setQueue(buildExercises(lessonId)); setAt(0); setMistakes(0); wrongIds.current = new Set(); firstRes.current = {};
          setPick(null); setBuilt([]); setChecked(null); setTyped(''); setNote(''); setFinished(false);
        }}
        onDone={() => { onDone({ mistakes, total, wrongIds: [...wrongIds.current], results: { ...firstRes.current }, mode }); onQuit(); }}
      />
    );
  }
  if (!ex) return null;

  /* 맞았나. 유형마다 보는 것이 다르다 */
  const judge = () => {
    if (ex.type === 'build') {
      const made = built.map((id) => ex.tokens.find((t) => t.id === id)?.text).join(' ');
      return made === ex.answer.join(' ');
    }
    if (typing(ex.type)) return judgeGerman(ex.item, typed).verdict !== 'wrong';
    return pick === ex.answerId;
  };

  const check = () => {
    if (checked) return;
    const good = judge();
    setChecked(good ? 'ok' : 'no');
    if (ex.item) noteFirst(ex.item.id, good);
    if (typing(ex.type) && good) {
      const j = judgeGerman(ex.item, typed);
      if (j.article) setNote('거의 맞았어요 — 관사까지 함께 외워요');
      else if (j.verdict === 'close') setNote('거의 맞았어요 — 철자를 확인해요');
    }
    if (good) {
      if (ex.type !== 'choose-ko' && ex.type !== 'listen') speakIn(ex.item.de, DE, rate, { id: `fb:${at}` });
    } else {
      setMistakes((n) => n + 1);
      if (ex.item) wrongIds.current.add(ex.item.id);
      // 틀린 문제는 뒤에 다시 붙는다 — 한 번 더 만나야 남는다
      setQueue((q) => [...q, ex]);
      speakIn(ex.item.de, DE, rate, { id: `fb:${at}` });
    }
  };

  const next = () => { setPick(null); setBuilt([]); setChecked(null); setTyped(''); setNote(''); setAt((n) => n + 1); };

  const canCheck = ex.type === 'build' ? built.length > 0 : (typing(ex.type) ? Boolean(typed.trim()) : Boolean(pick));
  const pct = Math.min(100, Math.round((Math.min(at, total) / total) * 100));

  return (
    <>
      <div className="sub-header inline swl-head">
        <button className="sub-back" onClick={onQuit} aria-label="레슨 그만두기"><IconArrowLeft /></button>
        <div className="swl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="swl-count">{Math.min(at + 1, queue.length)} / {queue.length}</div>
      </div>

      {ex.type === 'match' ? (
        <SwissMatch
          key={at}
          pairs={ex.pairs}
          rate={rate}
          onWrong={(id) => { setMistakes((n) => n + 1); wrongIds.current.add(id); noteFirst(id, false); }}
          onDone={() => { ex.pairs.forEach((p) => noteFirst(p.id, true)); next(); }}
        />
      ) : (
        <>
          <div className="swl-ask">
            {ex.type === 'choose-ko' && '무슨 뜻일까요?'}
            {ex.type === 'choose-sw' && '독일어로 뭐라고 할까요?'}
            {ex.type === 'listen' && '무슨 말을 들었나요?'}
            {ex.type === 'build' && '낱말을 눌러 문장을 만들어요'}
            {ex.type === 'write' && '독일어로 써 보세요'}
            {ex.type === 'dictate' && '들은 대로 써 보세요'}
          </div>

          <div className="card swl-prompt" data-item={ex.item.id} data-type={ex.type}>
            {ex.type === 'listen' || ex.type === 'dictate' ? (
              <SpeakButton text={ex.item.de} lang={DE} rate={rate} id={`q:${at}`} className="swl-bigspk" label="다시 듣기" />
            ) : (
              <>
                <b className="swl-ptext" lang={ex.type === 'choose-ko' ? 'de' : undefined}>
                  {ex.type === 'choose-ko' ? ex.item.de : ex.item.ko}
                </b>
                {/* 뜻을 보여 주는 문제에는 그림·색이 있으면 같이 — 소리를 먼저 들려 주는 문제에는 안 보인다(정답이 드러난다) */}
                {(ex.type === 'choose-sw' || ex.type === 'write') && (ex.item.emoji || ex.item.swatch) && (
                  <span className="sw-pic swl-pic" aria-hidden="true">
                    {ex.item.swatch ? <i className="sw-swatch big" style={{ background: ex.item.swatch }} /> : ex.item.emoji}
                  </span>
                )}
                {ex.type === 'choose-ko' && (
                  <div className="swl-prow">
                    {ex.item.han && <span className="swl-phan">{ex.item.han}</span>}
                    <SpeakButton text={ex.item.de} lang={DE} rate={rate} id={`q:${at}`} label="다시 듣기" />
                  </div>
                )}
              </>
            )}
            {(ex.type === 'listen' || ex.type === 'choose-ko' || ex.type === 'dictate') && (
              <button className="ghost-btn swl-slow" onClick={() => speakIn(ex.item.de, DE, 0.6, { id: `slow:${at}` })}>
                <IconRewind /> 천천히
              </button>
            )}
          </div>

          {typing(ex.type) ? (
            <div className="swl-typing">
              <input
                className="search-input swl-input"
                lang="de"
                value={typed}
                disabled={Boolean(checked)}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (checked) next(); else if (canCheck) check(); } }}
                placeholder={ex.type === 'write' ? '독일어로 (ä ö ü ß는 ae oe ue ss로 써도 돼요)' : '들은 대로'}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              />
              {!checked && (
                <div className="swl-specials" role="group" aria-label="독일어 글자">
                  {SPECIALS.map((ch) => (
                    <button key={ch} type="button" className="swl-sp" onClick={() => setTyped((t) => `${t}${ch}`)}>{ch}</button>
                  ))}
                </div>
              )}
            </div>
          ) : ex.type === 'build' ? (
            <>
              <div className="swl-built" aria-live="polite">
                {built.length === 0 && <span className="swl-hint">여기에 문장이 만들어져요</span>}
                {built.map((id) => {
                  const t = ex.tokens.find((x) => x.id === id);
                  return (
                    <button key={id} className="swl-tok on" disabled={Boolean(checked)}
                      onClick={() => setBuilt((b) => b.filter((x) => x !== id))}>{t?.text}</button>
                  );
                })}
              </div>
              <div className="swl-bank">
                {ex.tokens.map((t) => (
                  <button
                    key={t.id}
                    className={`swl-tok${built.includes(t.id) ? ' used' : ''}`}
                    disabled={built.includes(t.id) || Boolean(checked)}
                    onClick={() => setBuilt((b) => [...b, t.id])}
                  >{t.text}</button>
                ))}
              </div>
            </>
          ) : (
            <div className="qoptions swl-opts">
              {ex.options.map((opt, i) => {
                const isAns = opt.id === ex.answerId;
                const cls = checked
                  ? (isAns ? ' correct' : (pick === opt.id ? ' wrong' : ' dim'))
                  : (pick === opt.id ? ' picked' : '');
                return (
                  <button
                    key={opt.id}
                    className={`qopt${cls}`}
                    data-id={opt.id}
                    disabled={Boolean(checked)}
                    onClick={() => setPick(opt.id)}
                  >
                    <span className="qo-num">{i + 1}</span>
                    <span className="qo-body">
                      <b lang={ex.type === 'choose-ko' ? undefined : 'de'}>{ex.type === 'choose-ko' ? opt.ko : opt.de}</b>
                      {ex.type !== 'choose-ko' && opt.han && <span>{opt.han}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!checked ? (
            <div className="btnrow" style={{ marginTop: 14 }}>
              <button className="submit-btn swl-check" disabled={!canCheck} onClick={check}>확인</button>
            </div>
          ) : (
            <div className={`swl-feedback ${checked}`}>
              <div className="swl-fhead">
                {checked === 'ok' ? <><IconCheck /> 맞았어요</> : '아쉬워요'}
              </div>
              {note && <div className="swl-note">{note}</div>}
              <div className="swl-fbody">
                <div className="swl-fko">{ex.item.ko}</div>
                <div className="swl-fde">
                  <b lang="de">{ex.item.de}</b>
                  {ex.item.han && <span>{ex.item.han}</span>}
                  <SpeakButton text={ex.item.de} lang={DE} rate={rate} id={`fb:${at}`} />
                </div>
                {ex.item.ch && (
                  <div className="sw-tip">
                    <span className="sw-tipflag" aria-hidden="true">🇨🇭</span>
                    <span className="sw-tipbody">
                      <span className="sw-tiplabel">스위스에서는:</span>
                      <b lang="de-CH">{ex.item.ch.text}</b>
                      {ex.item.ch.note && <span className="sw-tipnote">{ex.item.ch.note}</span>}
                    </span>
                    <SpeakButton text={ex.item.ch.text} lang={CH} rate={rate} id={`fbch:${at}`} label="스위스 표현 듣기" />
                  </div>
                )}
              </div>
              <div className="btnrow" style={{ marginTop: 10 }}>
                <button className="submit-btn swl-next" onClick={next}>계속</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* 짝 맞추기 넷. 왼쪽(독일어)을 누르면 읽어 주고, 오른쪽(뜻)을 누른다.
   틀리면 빨갛게 깜빡이고 틀린 것으로 센다. 넷 다 맞으면 잠깐 있다 넘어간다. */
function SwissMatch({ pairs, rate, onWrong, onDone }) {
  const [left] = useState(() => pairs);
  const [right] = useState(() => [...pairs].sort(() => Math.random() - 0.5));
  const [sel, setSel] = useState(null);
  const [okIds, setOkIds] = useState([]);
  const [shake, setShake] = useState(null);
  const doneRef = useRef(false);
  const timerRef = useRef(null);
  /* ★ onDone은 부모가 다시 그려질 때마다 새 함수다 ★
     예전에는 이 함수를 effect 의존성에 두었다. 넷을 다 맞힌 0.7초 안에 부모가 한 번이라도 다시 그려지면
     (읽어 주던 소리가 끝나 상태가 바뀌는 것만으로도) 정리 함수가 타이머를 지우고, 다음 effect는
     doneRef가 이미 true라서 타이머를 다시 안 건다 — 그러면 다 맞췄는데 영영 안 넘어간다.
     그래서 최신 onDone은 ref로 읽고, 타이머는 화면이 닫힐 때만 지운다. */
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (okIds.length === pairs.length && !doneRef.current) {
      doneRef.current = true;
      timerRef.current = setTimeout(() => onDoneRef.current(), 700);
    }
  }, [okIds, pairs.length]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const tapLeft = (id) => {
    if (okIds.includes(id)) return;
    setSel(id);
    const it = pairs.find((p) => p.id === id);
    if (it) speakIn(it.de, DE, rate, { id: `m:${id}` });
  };
  const tapRight = (id) => {
    if (!sel || okIds.includes(id)) return;
    if (id === sel) { setOkIds((k) => [...k, id]); setSel(null); return; }
    onWrong(sel);
    setShake(id);
    setTimeout(() => setShake(null), 400);
    setSel(null);
  };

  return (
    <>
      <div className="swl-ask">짝을 맞춰요 — 왼쪽을 누르고 오른쪽을 눌러요</div>
      <div className="swl-match">
        <div className="swl-mcol">
          {left.map((p) => (
            <button
              key={p.id}
              className={`swl-mbtn swl-mleft${sel === p.id ? ' sel' : ''}${okIds.includes(p.id) ? ' ok' : ''}`}
              data-id={p.id}
              disabled={okIds.includes(p.id)}
              onClick={() => tapLeft(p.id)}
            >
              <b lang="de">{p.de}</b>{p.han && <span>{p.han}</span>}
            </button>
          ))}
        </div>
        <div className="swl-mcol">
          {right.map((p) => (
            <button
              key={p.id}
              className={`swl-mbtn swl-mright${okIds.includes(p.id) ? ' ok' : ''}${shake === p.id ? ' shake' : ''}`}
              data-id={p.id}
              disabled={okIds.includes(p.id)}
              onClick={() => tapRight(p.id)}
            >
              <b>{p.ko}</b>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function SwissFinish({ stars, mistakes, total, mode, onAgain, onDone }) {
  const review = mode === 'review';
  return (
    <div className="swl-finish">
      <div className="navtitle"><small>{review ? '복습 끝' : '레슨 끝'}</small>{stars === 3 ? '완벽해요!' : (stars === 2 ? '잘했어요' : '끝까지 했어요')}</div>
      <div className="card swl-stars" data-stars={stars}>
        <div className="swl-starrow" aria-label={`별 ${stars}개`}>
          {[1, 2, 3].map((n) => <span key={n} className={n <= stars ? 'on' : ''}>★</span>)}
        </div>
        <span>{total}문제 중 {mistakes === 0 ? '하나도 안 틀렸어요' : `${mistakes}번 틀렸어요 — 틀린 건 다시 나왔어요`}</span>
      </div>
      <div className="btnrow" style={{ marginTop: 14 }}>
        <button className="ghost-btn swl-again" onClick={onAgain}>{review ? '더 복습하기' : '한 번 더'}</button>
        <button className="submit-btn swl-done" onClick={onDone}>완료</button>
      </div>
    </div>
  );
}
