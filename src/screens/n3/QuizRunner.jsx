import { useEffect, useMemo, useState } from 'react';
import { IconCheck, IconX, IconArrowLeft } from '../../components/Icons.jsx';
import { speakJapanese, stopSpeaking } from '../../lib/tts.js';
import { BLANK } from '../../data/n3/grammar.js';
import { shuffle } from '../../lib/n3.js';
import JpSpeak from './JpSpeak.jsx';

/* 문제 풀기 — 코스의 모든 문제가 이 하나를 지난다.
 *
 *   choice   보기 셋 중 하나. q에 【　】가 있으면 빈칸으로 그린다
 *   order    배열(★). 조각을 바른 순서로 놓았을 때 ★ 자리에 오는 것을 고른다
 *   passage  글의 문법 — 지문을 위에 두고 【n】에 들어갈 것을 고른다
 *
 * 틀리면 정답만 보여 주지 않는다 — 고른 보기가 왜 안 되는지(why)를 한국어로,
 * 그리고 정답 설명(expl)을 같이 보여 준다. 실전(exam) 모드는 설명을 미루고
 * 끝에 한꺼번에 보여 준다 — 시험처럼 먼저 푼다. */
export default function QuizRunner({
  questions, title, mode = 'study', rate = 0.9, autoSpeak = true,
  onAnswer, onFinish, onDone, onQuit, doneLabel = '완료', finishExtra = null, hideFinish = false, lastLabel = '결과 보기',
}) {
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(null);
  const [results, setResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const q = questions[at];
  const total = questions.length;

  /* 배열 문제는 조각을 섞어 보여 준다 — 문제마다 한 번만 */
  const pieces = useMemo(() => (q?.type === 'order' ? shuffle(q.pieces) : null), [q]);

  useEffect(() => {
    if (!q) return undefined;
    if (autoSpeak && q.speak) speakJapanese(q.speak, rate);
    return () => stopSpeaking();
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!total && !finished) { setFinished(true); onFinish?.({ right: 0, total: 0, results: [] }); }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q && !finished) return null;

  const choose = (opt) => {
    if (picked !== null) return;
    const ok = opt === q.answer;
    setPicked(opt);
    const next = [...results, { q, ok, picked: opt }];
    setResults(next);
    onAnswer?.(q, ok, opt);
    if (ok && q.speakAfter && autoSpeak) speakJapanese(q.speakAfter, rate);
    /* 실전은 바로 다음으로 — 설명은 끝에 */
    if (mode === 'exam') setTimeout(() => advance(next), 250);
  };

  const advance = (list = results) => {
    if (at + 1 >= total) {
      setFinished(true);
      const right = list.filter((r) => r.ok).length;
      onFinish?.({ right, total, results: list });
      return;
    }
    setAt(at + 1);
    setPicked(null);
  };

  if (finished) {
    if (hideFinish) return null;
    const right = results.filter((r) => r.ok).length;
    const wrong = results.filter((r) => !r.ok);
    const pct = total ? Math.round((right / total) * 100) : 0;
    return (
      <div className="n3-finish">
        <div className="card n3-score" data-right={right} data-total={total}>
          <b>{right} / {total}</b>
          <span>{pct >= 90 ? '훌륭해요' : pct >= 70 ? '잘했어요' : pct >= 50 ? '조금 더' : '다시 한번'} · 정답률 {pct}%</span>
        </div>
        {finishExtra}
        {wrong.length > 0 && (
          <>
            <div className="section-label">틀린 문제 — 왜 틀렸나</div>
            <div className="stack">
              {wrong.map(({ q: wq, picked: wp }, i) => (
                <div key={`${wq.id}-${i}`} className="card n3-wrongcard">
                  <div className="n3-wq"><QText q={wq} /></div>
                  <div className="n3-wrow no"><IconX /> 내 답: {wp}{wq.why?.[wp] ? ` — ${wq.why[wp]}` : ''}</div>
                  <div className="n3-wrow ok"><IconCheck /> 정답: {wq.answer}{wq.expl ? ` — ${wq.expl}` : ''}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <button className="submit-btn n3-done" onClick={() => onDone?.({ right, total, results })} style={{ marginTop: 14 }}>{doneLabel}</button>
      </div>
    );
  }

  const ok = picked !== null && picked === q.answer;
  const options = q.type === 'order' ? pieces : q.options;

  return (
    <div className="n3-quiz" data-qid={q.id} data-type={q.type || 'choice'}>
      <div className="sub-header inline n3-qhead">
        {onQuit && <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 그만</button>}
        <div className="swl-bar"><i style={{ width: `${(at / total) * 100}%` }} /></div>
        <span className="swl-count">{at + 1} / {total}</span>
      </div>
      {title && <div className="n3-qtitle">{title}</div>}

      {q.passage && (
        <div className="card n3-passage">
          {q.passage.split(/(【\d】)/).map((part, i) => (/^【\d】$/.test(part)
            ? <b key={i} className={`n3-blank${part === `【${(q.q.match(/【(\d)】/) || [])[1]}】` ? ' cur' : ''}`}>{part}</b>
            : <span key={i}>{part}</span>))}
        </div>
      )}

      <div className="card n3-prompt">
        {q.type === 'order' ? (
          <div className="n3-order">
            <span>{q.before}</span>
            {q.pieces.map((_, i) => <span key={i} className={`n3-slot${i === q.star ? ' star' : ''}`}>{i === q.star ? '★' : '＿'}</span>)}
            <span>{q.after}</span>
            <div className="n3-hint">조각을 바른 순서로 놓았을 때 ★에 오는 것은?</div>
          </div>
        ) : (
          <>
            <div className="n3-q"><QText q={q} /></div>
            {q.sub && <div className="n3-qsub">{q.sub}</div>}
            {q.ko && <div className="n3-qko">{q.ko}</div>}
            {q.speak && <JpSpeak text={q.speak} rate={rate} id={`q:${q.id}`} className="n3-qspk" />}
          </>
        )}
      </div>

      <div className="qoptions n3-opts">
        {options.map((opt, i) => {
          const isAns = opt === q.answer;
          const cls = picked === null ? '' : (isAns ? ' correct' : (opt === picked ? ' wrong' : ' dim'));
          return (
            <button key={`${opt}-${i}`} className={`qopt${cls}`} data-opt={opt} disabled={picked !== null} onClick={() => choose(opt)}>
              <span className="qo-num">{i + 1}</span>
              <span className="qo-body">
                <b>{opt}</b>
                {q.optionSubs?.[i] && <span>{q.optionSubs[i]}</span>}
              </span>
              {picked !== null && isAns && <span className="qo-mark ok"><IconCheck /></span>}
              {picked !== null && opt === picked && !isAns && <span className="qo-mark no"><IconX /></span>}
            </button>
          );
        })}
      </div>

      {picked !== null && mode !== 'exam' && (
        <div className={`swl-feedback n3-fb ${ok ? 'ok' : 'no'}`}>
          <div className="swl-fhead">{ok ? <><IconCheck /> 정답!</> : <><IconX /> 틀렸어요</>}</div>
          <div className="swl-fbody">
            {!ok && q.why?.[picked] && <p className="n3-why"><b>「{picked}」</b> — {q.why[picked]}</p>}
            {!ok && <p className="n3-ans">정답: <b>{q.answer}</b></p>}
            {q.expl && <p className="n3-expl">{q.expl}</p>}
          </div>
          <button className="submit-btn n3-next" onClick={() => advance()} style={{ marginTop: 10 }}>
            {at + 1 >= total ? lastLabel : '다음'}
          </button>
        </div>
      )}
    </div>
  );
}

/* 【　】 빈칸을 눈에 띄게 */
export function QText({ q }) {
  const text = q.q || '';
  if (!text.includes(BLANK)) return <>{text}</>;
  const parts = text.split(BLANK);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>{p}{i < parts.length - 1 && <span className="av-blank n3-blank">　</span>}</span>
      ))}
    </>
  );
}
