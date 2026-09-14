import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconSpeaker, IconRewind, IconCheck } from '../components/Icons.jsx';
import { speakIn } from '../lib/tts.js';
import { buildExercises, starsFor } from '../lib/swissCourse.js';
import { tokensOf } from '../data/swiss.js';

/* 레슨 하나 — 문제 열 개쯤을 차례로.
 *
 * 듀오링고의 뼈대를 그대로 가져왔다.
 *   고른다 → 「확인」 → 맞았는지 띠가 뜬다 → 「계속」
 *   틀린 문제는 뒤로 다시 붙는다 — 틀린 채로 끝나지 않는다
 *   끝나면 별과 XP
 *
 * 문제 유형은 lib/swissCourse.js가 만든다. 여기는 그리고 판정만 한다.
 *   choose-ko  스위스 독일어를 듣고 보고 → 뜻을 고른다 (들어오면 읽어 준다)
 *   choose-sw  뜻을 보고 → 스위스 독일어를 고른다 (맞히면 읽어 준다)
 *   listen     소리만 듣고 → 무엇이었는지 고른다 (글자는 안 보여 준다)
 *   build      뜻을 보고 → 낱말 조각으로 문장을 만든다
 *   match      짝 맞추기 넷 — 왼쪽 스위스 독일어, 오른쪽 뜻 */

const LANG = 'de-CH';

export default function SwissLesson({ lessonId, rate, onDone, onQuit }) {
  const [queue, setQueue] = useState(() => buildExercises(lessonId));
  const total = useMemo(() => queue.length, []);   // 처음 개수 — 진행 막대는 이걸로 잰다
  const [at, setAt] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const wrongIds = useRef(new Set());
  const [pick, setPick] = useState(null);      // 고른 보기 id (choose·listen)
  const [built, setBuilt] = useState([]);      // 고른 조각 id 순서 (build)
  const [checked, setChecked] = useState(null); // null | 'ok' | 'no'
  const [finished, setFinished] = useState(false);

  const ex = queue[at];
  const done = at >= queue.length;

  /* 들어오면 읽어 준다 — 듣는 문제는 그게 문제 자체다 */
  useEffect(() => {
    if (!ex) return;
    if (ex.type === 'choose-ko' || ex.type === 'listen') speakIn(ex.item.sw, LANG, rate);
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (done && !finished) setFinished(true); }, [done, finished]);

  if (finished) {
    const stars = starsFor(mistakes, total);
    return (
      <SwissFinish
        stars={stars}
        mistakes={mistakes}
        total={total}
        onAgain={() => {
          setQueue(buildExercises(lessonId)); setAt(0); setMistakes(0); wrongIds.current = new Set();
          setPick(null); setBuilt([]); setChecked(null); setFinished(false);
        }}
        onDone={() => { onDone({ mistakes, total, wrongIds: [...wrongIds.current] }); onQuit(); }}
      />
    );
  }
  if (!ex) return null;

  const speak = (slow = false) => speakIn(ex.item?.sw || '', LANG, slow ? 0.6 : rate);

  /* 맞았나. 유형마다 보는 것이 다르다 */
  const judge = () => {
    if (ex.type === 'build') {
      const made = built.map((id) => ex.tokens.find((t) => t.id === id)?.text).join(' ');
      return made === ex.answer.join(' ');
    }
    return pick === ex.answerId;
  };

  const check = () => {
    if (checked) return;
    const good = judge();
    setChecked(good ? 'ok' : 'no');
    if (good) {
      if (ex.type !== 'choose-ko' && ex.type !== 'listen') speak();   // 이미 들은 건 또 안 읽는다
    } else {
      setMistakes((n) => n + 1);
      if (ex.item) wrongIds.current.add(ex.item.id);
      // 틀린 문제는 뒤에 다시 붙는다 — 한 번 더 만나야 남는다
      setQueue((q) => [...q, ex]);
      speak();
    }
  };

  const next = () => { setPick(null); setBuilt([]); setChecked(null); setAt((n) => n + 1); };

  const canCheck = ex.type === 'build' ? built.length > 0 : Boolean(pick);
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
          onWrong={(id) => { setMistakes((n) => n + 1); wrongIds.current.add(id); }}
          onDone={next}
        />
      ) : (
        <>
          <div className="swl-ask">
            {ex.type === 'choose-ko' && '무슨 뜻일까요?'}
            {ex.type === 'choose-sw' && '스위스 독일어로 뭐라고 할까요?'}
            {ex.type === 'listen' && '무슨 말을 들었나요?'}
            {ex.type === 'build' && '낱말을 눌러 문장을 만들어요'}
          </div>

          <div className="card swl-prompt" data-item={ex.item.id} data-type={ex.type}>
            {ex.type === 'listen' ? (
              <button className="swl-bigspk" onClick={() => speak()} aria-label="다시 듣기">
                <IconSpeaker />
              </button>
            ) : (
              <>
                {ex.type === 'choose-ko' && (
                  <button className="swl-spk" onClick={() => speak()} aria-label="다시 듣기"><IconSpeaker /></button>
                )}
                <b className="swl-ptext">{ex.type === 'choose-ko' ? ex.item.sw : ex.item.ko}</b>
                {ex.type === 'choose-ko' && <span className="swl-phan">{ex.item.han}</span>}
              </>
            )}
            {(ex.type === 'listen' || ex.type === 'choose-ko') && (
              <button className="ghost-btn swl-slow" onClick={() => speak(true)}><IconRewind /> 천천히</button>
            )}
          </div>

          {ex.type === 'build' ? (
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
                      <b>{ex.type === 'choose-ko' ? opt.ko : opt.sw}</b>
                      {ex.type !== 'choose-ko' && <span>{opt.han}</span>}
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
              <div className="swl-fbody">
                <b>{ex.item.sw}</b> <span>{ex.item.han}</span> — {ex.item.ko}
                {ex.item.hd !== ex.item.sw && <em> · 표준 독일어 {ex.item.hd}</em>}
              </div>
              <div className="btnrow" style={{ marginTop: 10 }}>
                <button className="ghost-btn" onClick={() => speak()}><IconSpeaker /> 듣기</button>
                <button className="submit-btn swl-next" onClick={next}>계속</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* 짝 맞추기 넷. 왼쪽을 누르고 오른쪽을 누른다. 틀리면 빨갛게 깜빡이고
   틀린 것으로 센다. 넷 다 맞으면 잠깐 있다 넘어간다. */
function SwissMatch({ pairs, rate, onWrong, onDone }) {
  const [left] = useState(() => pairs);
  const [right] = useState(() => [...pairs].sort(() => Math.random() - 0.5));
  const [sel, setSel] = useState(null);
  const [okIds, setOkIds] = useState([]);
  const [shake, setShake] = useState(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (okIds.length === pairs.length && !doneRef.current) {
      doneRef.current = true;
      const t = setTimeout(onDone, 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [okIds, pairs.length, onDone]);

  const tapLeft = (id) => {
    if (okIds.includes(id)) return;
    setSel(id);
    const it = pairs.find((p) => p.id === id);
    if (it) speakIn(it.sw, 'de-CH', rate);
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
              <b>{p.sw}</b><span>{p.han}</span>
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

function SwissFinish({ stars, mistakes, total, onAgain, onDone }) {
  return (
    <div className="swl-finish">
      <div className="navtitle"><small>레슨 끝</small>{stars === 3 ? '완벽해요!' : (stars === 2 ? '잘했어요' : '끝까지 했어요')}</div>
      <div className="card swl-stars" data-stars={stars}>
        <div className="swl-starrow" aria-label={`별 ${stars}개`}>
          {[1, 2, 3].map((n) => <span key={n} className={n <= stars ? 'on' : ''}>★</span>)}
        </div>
        <span>{total}문제 중 {mistakes === 0 ? '하나도 안 틀렸어요' : `${mistakes}번 틀렸어요 — 틀린 건 다시 나왔어요`}</span>
      </div>
      <div className="btnrow" style={{ marginTop: 14 }}>
        <button className="ghost-btn" onClick={onAgain}>한 번 더</button>
        <button className="submit-btn swl-done" onClick={onDone}>완료</button>
      </div>
    </div>
  );
}

export { tokensOf };
