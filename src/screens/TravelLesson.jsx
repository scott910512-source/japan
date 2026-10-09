import { useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconRewind, IconCheck } from '../components/Icons.jsx';
import SpeakButton from '../components/SpeakButton.jsx';
import { readingText, speakIn } from '../lib/tts.js';
import { buildExercises, starsFor } from '../lib/travelCourse.js';

/* 여행 일본어 레슨 하나 — 문제 열 개 안팎을 차례로.
 *
 * 독일어 레슨(SwissLesson)의 뼈대를 그대로 썼다 — 고른다 → 「확인」 → 띠 →
 * 「계속」, 틀린 문제는 뒤에 다시 붙고, 끝나면 별과 XP. 다른 것은 문제의 결이다.
 *
 *   hear  직원이 하는 말을 소리로만 듣고 뜻을 고른다 — 글자는 띄우지 않는다.
 *         현지에서 글자는 없다. 이게 이 코스가 있는 이유다
 *   read  같은 것을 글자와 소리로 — 처음 만나는 줄은 이쪽이 먼저 오기도 한다
 *   say   내가 할 말 — 뜻을 보고 일본어를 고른다. 맞히면 읽어 준다
 *
 * 소리는 늘 읽기(kana)로 낸다 — 한자 읽기를 기기에 맡기면 「〇〇」 같은 자리에서
 * 엉뚱한 소리가 난다. */

const JA = 'ja-JP';
const say = (it) => readingText(it.kana, it.jp);

export default function TravelLesson({ lessonId, rate, onDone, onQuit }) {
  const [queue, setQueue] = useState(() => buildExercises(lessonId));
  const total = useMemo(() => queue.length, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [at, setAt] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const wrongIds = useRef(new Set());
  const [pick, setPick] = useState(null);
  const [checked, setChecked] = useState(null);   // null | 'ok' | 'no'
  const [finished, setFinished] = useState(false);

  const ex = queue[at];
  const done = at >= queue.length;

  /* 듣는 문제는 들어오면 읽어 준다 — 그게 문제 자체다 */
  useEffect(() => {
    if (!ex) return;
    if (ex.type === 'hear' || ex.type === 'read') speakIn(say(ex.item), JA, rate, { id: `q:${at}` });
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (done && !finished) setFinished(true); }, [done, finished]);

  if (finished) {
    const stars = starsFor(mistakes, total);
    return (
      <div className="swl-finish">
        <div className="navtitle"><small>레슨 끝</small>{stars === 3 ? '다 알아들었어요!' : (stars === 2 ? '잘했어요' : '끝까지 했어요')}</div>
        <div className="card swl-stars" data-stars={stars}>
          <div className="swl-starrow" aria-label={`별 ${stars}개`}>
            {[1, 2, 3].map((n) => <span key={n} className={n <= stars ? 'on' : ''}>★</span>)}
          </div>
          <span>{total}문제 중 {mistakes === 0 ? '하나도 안 틀렸어요' : `${mistakes}번 틀렸어요 — 틀린 건 다시 나왔어요`}</span>
        </div>
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button className="ghost-btn" onClick={() => {
            setQueue(buildExercises(lessonId)); setAt(0); setMistakes(0); wrongIds.current = new Set();
            setPick(null); setChecked(null); setFinished(false);
          }}>한 번 더</button>
          <button className="submit-btn swl-done" onClick={() => { onDone({ mistakes, total, wrongIds: [...wrongIds.current] }); onQuit(); }}>완료</button>
        </div>
      </div>
    );
  }
  if (!ex) return null;

  const check = () => {
    if (checked) return;
    const good = pick === ex.answerId;
    setChecked(good ? 'ok' : 'no');
    if (good) {
      if (ex.type === 'say') speakIn(say(ex.item), JA, rate, { id: `fb:${at}` });
    } else {
      setMistakes((n) => n + 1);
      wrongIds.current.add(ex.item.id);
      setQueue((q) => [...q, ex]);   // 틀린 문제는 뒤에 다시 — 한 번 더 만나야 남는다
      speakIn(say(ex.item), JA, rate, { id: `fb:${at}` });
    }
  };
  const next = () => { setPick(null); setChecked(null); setAt((n) => n + 1); };
  const pct = Math.min(100, Math.round((Math.min(at, total) / total) * 100));
  const staff = ex.item.who === 'staff';

  return (
    <>
      <div className="sub-header inline swl-head">
        <button className="sub-back" onClick={onQuit} aria-label="레슨 그만두기"><IconArrowLeft /></button>
        <div className="swl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="swl-count">{Math.min(at + 1, queue.length)} / {queue.length}</div>
      </div>

      <div className="swl-ask">
        <span className={`tr-who ${ex.item.who}`}>{staff ? '직원' : '나'}</span>
        {ex.type === 'hear' && ' 뭐라고 했을까요? — 소리만 듣고'}
        {ex.type === 'read' && ' 뭐라고 했을까요?'}
        {ex.type === 'say' && ' 일본어로 뭐라고 할까요?'}
      </div>

      <div className="card swl-prompt" data-item={ex.item.id} data-type={ex.type}>
        {ex.type === 'hear' ? (
          <SpeakButton text={say(ex.item)} lang={JA} rate={rate} id={`q:${at}`} className="swl-bigspk" label="다시 듣기" />
        ) : (
          <>
            <b className="swl-ptext" lang={ex.type === 'read' ? 'ja' : undefined}>
              {ex.type === 'read' ? ex.item.jp : ex.item.ko}
            </b>
            {ex.type === 'read' && (
              <div className="swl-prow">
                <span className="swl-phan">{ex.item.kana}</span>
                <SpeakButton text={say(ex.item)} lang={JA} rate={rate} id={`q:${at}`} label="다시 듣기" />
              </div>
            )}
          </>
        )}
        {ex.type !== 'say' && (
          <button className="ghost-btn swl-slow" onClick={() => speakIn(say(ex.item), JA, 0.65, { id: `slow:${at}` })}>
            <IconRewind /> 천천히
          </button>
        )}
      </div>

      <div className="qoptions swl-opts">
        {ex.options.map((opt, i) => {
          const isAns = opt.id === ex.answerId;
          const cls = checked
            ? (isAns ? ' correct' : (pick === opt.id ? ' wrong' : ' dim'))
            : (pick === opt.id ? ' picked' : '');
          return (
            <button key={opt.id} className={`qopt${cls}`} data-id={opt.id} disabled={Boolean(checked)} onClick={() => setPick(opt.id)}>
              <span className="qo-num">{i + 1}</span>
              <span className="qo-body">
                <b lang={ex.type === 'say' ? 'ja' : undefined}>{ex.type === 'say' ? opt.jp : opt.ko}</b>
                {ex.type === 'say' && <span>{opt.kana}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {!checked ? (
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button className="submit-btn swl-check" disabled={!pick} onClick={check}>확인</button>
        </div>
      ) : (
        <div className={`swl-feedback ${checked}`}>
          <div className="swl-fhead">{checked === 'ok' ? <><IconCheck /> 맞았어요</> : '아쉬워요'}</div>
          <div className="swl-fbody">
            <div className="swl-fko">{ex.item.ko}</div>
            <div className="swl-fde">
              <b lang="ja">{ex.item.jp}</b>
              <span>{ex.item.kana}</span>
              <SpeakButton text={say(ex.item)} lang={JA} rate={rate} id={`fb:${at}`} />
            </div>
            {ex.item.note && <em className="tr-note">{ex.item.note}</em>}
          </div>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <button className="submit-btn swl-next" onClick={next}>계속</button>
          </div>
        </div>
      )}
    </>
  );
}
