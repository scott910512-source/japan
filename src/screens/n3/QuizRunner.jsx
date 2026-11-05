import { useEffect, useMemo, useRef, useState } from 'react';
import { useTimeouts } from '../../hooks/useTimeouts.js';
import { IconCheck, IconX, IconArrowLeft } from '../../components/Icons.jsx';
import { speakJapanese, stopSpeaking } from '../../lib/tts.js';
import { BLANK } from '../../data/n3/grammar.js';
import { shuffle } from '../../lib/n3.js';
import JpSpeak from './JpSpeak.jsx';
import HunterTutor from '../../components/HunterTutor.jsx';
import KeyboardHelp from '../../components/KeyboardHelp.jsx';
import { useQuizHotkeys } from '../../lib/useHotkeys.js';
import { OptWrap } from '../../components/OptionReview.jsx';
import { reviewRows, rowOf, speakText } from '../../lib/optionInfo.js';

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
  /* 화면을 나가면 걸려 있던 타이머도 같이 꺼진다 — 안 그러면 나간 뒤에
     한 판이 적히거나 한 문제가 넘어간다(hooks/useTimeouts.js) */
  const { after, cancel } = useTimeouts();
  const advanceTimer = useRef(null);
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
    else stopSpeaking(); // Do not carry a learning-card pronunciation into a reading question.
    return () => stopSpeaking();
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!total && !finished) { setFinished(true); onFinish?.({ right: 0, total: 0, results: [] }); }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps


  const choose = (opt, fromKeyboard = false) => {
    if (picked !== null) return;
    const ok = opt === q.answer;
    setPicked(opt);
    const next = [...results, { q, ok, picked: opt }];
    setResults(next);
    onAnswer?.(q, ok, opt);
    if (q.speakAfter && autoSpeak && mode !== 'exam') speakJapanese(q.speakAfter, rate);
    /* 실전은 바로 다음으로 — 설명은 끝에 */
    if (mode === 'exam' && !fromKeyboard && !keyboard) advanceTimer.current = after(() => advance(next), 250);
  };

  const advance = (list = results) => {
    cancel(advanceTimer.current);
    if (at + 1 >= total) {
      setFinished(true);
      const right = list.filter((r) => r.ok).length;
      onFinish?.({ right, total, results: list });
      return;
    }
    setAt(at + 1);
    setPicked(null);
  };

  const options = (q?.type === 'order' ? pieces : q?.options) || [];
  const { scope, keyboard } = useQuizHotkeys({
    options: !finished ? options : [],
    onChoose: (o, manual) => {
      if (picked === null) choose(o, manual);
      else if (mode !== 'exam') { const text = speakText(reviewRows(options, q.optionInfo)[options.indexOf(o)]); if (text) speakJapanese(text, rate); }
    },
    onNext: () => { if (finished) onDone?.({ right: results.filter((r) => r.ok).length, total, results }); else if (picked !== null) advance(); },
    onSpeak: () => { const text = picked !== null && mode !== 'exam' ? q?.speakAfter || q?.speak : q?.speak; if (text) speakJapanese(text, rate); },
    onQuit,
  });
  if (!q && !finished) return null;

  if (finished) {
    if (hideFinish) return null;
    const right = results.filter((r) => r.ok).length;
    const wrong = results.filter((r) => !r.ok);
    const pct = total ? Math.round((right / total) * 100) : 0;
    return (
      <div ref={scope} className="n3-finish">
        <HunterTutor guide={mode === 'exam' ? 'netero' : 'gon'} scene={mode === 'exam' ? 'exam' : 'island'} mood={pct >= 70 ? 'celebrate' : 'encourage'} title="수련 결과" line={wrong.length ? `${total}문제 중 ${right}문제를 맞혔어요. 아래에 남은 오답과 해설을 다시 확인해 봐요.` : `${right} / ${total}문제를 확인했어요. 다음 수련으로 이어가 봐요.`} compact />
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
  /* 답을 낸 뒤 보기 줄 오른쪽에 붙일 읽기 · 뜻 (N3 실전 시험·배열 문제는 안 붙인다) */
  const showInline = mode !== 'exam' && q.type !== 'order';
  const n3Rows = picked !== null && showInline
    ? reviewRows(q.options, q.optionInfo, { isCorrect: (i) => q.options[i] === q.answer, isMine: (i) => q.options[i] === picked })
    : [];

  return (
    <div ref={scope} className="n3-quiz" data-qid={q.id} data-type={q.type || 'choice'}>
      <div className="sub-header inline n3-qhead">
        {onQuit && <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 그만</button>}
        <div className="swl-bar"><i style={{ width: `${(at / total) * 100}%` }} /></div>
        <span className="swl-count">{at + 1} / {total}</span>
      </div>
      <KeyboardHelp />
      {title && <div className="n3-qtitle">{title}</div>}
      {at === 0 && <HunterTutor guide={mode === 'exam' ? 'hisoka' : 'hanzo'} scene="exam" title={mode === 'exam' ? '실전 도전' : '집중 퀴즈'} line={mode === 'exam' ? '이번에는 스스로 풀어 보자. 해설은 시험을 마친 뒤에 확인할 수 있어.' : '먼저 스스로 답을 골라 봐. 고른 뒤에 이유를 함께 살펴보자.'} compact />}

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
            <OptWrap key={`${opt}-${i}`} row={rowOf(n3Rows, q.options.indexOf(opt))} label={`${opt} ${q.optionSubs?.[i] || ''}`} show={picked !== null && showInline} rate={rate} id={`n3:${q.id}:${i}`}>
            {(aside) => (
            <button className={`qopt${cls}`} data-opt={opt} disabled={picked !== null} onClick={() => choose(opt)}>
              <span className="qo-num">{i + 1}</span>
              <span className="qo-body">
                <b>{opt}</b>
                {q.optionSubs?.[i] && <span>{q.optionSubs[i]}</span>}
              </span>
              {aside}
              {picked !== null && isAns && <span className="qo-mark ok"><IconCheck /></span>}
              {picked !== null && opt === picked && !isAns && <span className="qo-mark no"><IconX /></span>}
            </button>
            )}
            </OptWrap>
          );
        })}
      </div>

      {picked !== null && (mode !== 'exam' || keyboard) && (
        <div className={`swl-feedback n3-fb ${ok ? 'ok' : 'no'}`}>
          {mode !== 'exam' && <>
          <div className="swl-fhead">{ok ? <><IconCheck /> 정답!</> : <><IconX /> 틀렸어요</>}</div>
          <HunterTutor guide={ok ? 'gon' : 'killua'} scene={ok ? 'island' : 'arena'} mood={ok ? 'celebrate' : 'encourage'} title={ok ? '정답 확인' : '고른 답과 비교하기'} line={ok ? '맞았어! 해설까지 확인하고 다음으로 가자.' : '방금 고른 보기와 정답을 비교해 보자. 차이는 아래 해설에서 확인할 수 있어.'} compact>
          <div className="swl-fbody">
            {!ok && q.why?.[picked] && <p className="n3-why"><b>「{picked}」</b> — {q.why[picked]}</p>}
            {!ok && <p className="n3-ans">정답: <b>{q.answer}</b></p>}
            {q.expl && <p className="n3-expl">{q.expl}</p>}
            {q.speakAfter && <JpSpeak text={q.speakAfter} rate={rate} id={`answer:${q.id}`} label="정답 발음 듣기" className="n3-answer-spk" />}
          </div>
          </HunterTutor>
          </>}
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
