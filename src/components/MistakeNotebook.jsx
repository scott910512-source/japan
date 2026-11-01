import { useEffect, useMemo, useState } from 'react';
import { activeMistakes, judgeMistake } from '../lib/mistakes.js';
import { markBusy } from '../lib/busy.js';
import { speakJapanese } from '../lib/tts.js';

export default function MistakeNotebook({ book = {}, onAttempt, onLearn }) {
  const rows = useMemo(() => activeMistakes(book), [book]);
  const [expanded, setExpanded] = useState(false);
  const [run, setRun] = useState(null);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    markBusy('mistake-notebook', Boolean(run));
    return () => markBusy('mistake-notebook', false);
  }, [run]);
  const cur = run?.items[run.index];
  const answer = (chosen) => {
    if (run.picked != null) return;
    const ok = judgeMistake(cur, chosen);
    onAttempt?.({ ...cur, chosen, ok });
    setRun({ ...run, picked: chosen, ok });
  };
  return <section className="mistake-notebook hunter-panel">
    <div className="hunter-section-head"><h2>다시 만날 오답 <small>{rows.length}개</small></h2><button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? '접기' : '기록 보기'}</button></div>
    <p>틀린 문제·내 답·해설을 바로 저장해요. 다른 날짜에 두 번 맞히면 복습 완료로 바뀌어요.</p>
    {run && cur ? <div className="mistake-retest">
      <div className="mistake-retest-head"><b>오답 재시험 {run.index + 1} / {run.items.length}</b><button onClick={() => setRun(null)}>그만하기</button></div>
      <p className="mistake-question" lang="ja">{cur.prompt}</p>
      {cur.speak && <button onClick={() => speakJapanese(cur.speak, .9)}>問題の音声を聞く · 문제 듣기</button>}
      {cur.options?.length > 1 ? <div className="mistake-options">{cur.options.map((option, i) => <button key={i} disabled={run.picked != null} onClick={() => answer(option)}>{option}</button>)}</div> : <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) answer(typed); }}><input aria-label="오답 재시험 답" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={run.picked != null} /><button disabled={!typed.trim() || run.picked != null}>답 확인</button></form>}
      {run.picked != null && <div className="mistake-feedback"><b>{run.ok ? '맞았어요' : '이 부분을 다시 봐요'}</b><p>내 답: {run.picked}<br />정답: {cur.correct}</p><p>{cur.explanation}</p><button onClick={() => { if (run.index + 1 === run.items.length) setRun(null); else setRun({ ...run, index: run.index + 1, picked: null }); setTyped(''); }}>{run.index + 1 === run.items.length ? '재시험 마치기' : '다음 문제'}</button></div>}
    </div> : rows.length ? <button className="submit-btn mistake-start" onClick={() => { setTyped(''); setRun({ items: rows.slice(0, 10), index: 0, picked: null }); }}>오답 {Math.min(rows.length, 10)}개 다시 시험</button> : <p className="mistake-empty">새로 틀린 문제가 여기에 쌓여요. 예전 N3 오답은 복습 탭에서도 볼 수 있어요.</p>}
    {expanded && <div className="mistake-list">{rows.slice(0, 20).map((row) => <article key={row.id}><small>{row.kind} · {row.wrong}번 틀림 · 다음 복습 {row.due}</small><b lang="ja">{row.prompt}</b><p>틀렸을 때 내 답: {row.wrongChosen ?? row.chosen}<br />정답: {row.correct}</p><p>{row.wrongExplanation || row.explanation}</p><button onClick={() => onLearn?.(row)}>관련 내용 다시 학습 ↗</button></article>)}</div>}
  </section>;
}

