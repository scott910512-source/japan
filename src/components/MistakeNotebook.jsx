import { useEffect, useMemo, useState } from 'react';
import { activeMistakes, judgeMistake } from '../lib/mistakes.js';
import { markBusy } from '../lib/busy.js';
import { speakJapanese } from '../lib/tts.js';
import { mistakeStatus } from '../lib/retestlink.js';
import HunterTutor from './HunterTutor.jsx';

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
    /* retest — 다시 풀기 한 번이 틀린 문제 · 약점 · N3 오답에 한 번씩만 닿는다(lib/retestlink.js). retestKey는 같은 응시를 두 번 적지 않게 한다 */
    onAttempt?.({ ...cur, chosen, ok, retest: true, retestKey: `${run.stamp}:${run.index}:${cur.id}` });
    setRun({ ...run, picked: chosen, ok });
  };
  return <section className="mistake-notebook hunter-panel">
    <div className="hunter-section-head"><h2>다시 만날 오답 <small>{rows.length}문제</small></h2><button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? '접기' : '기록 보기'}</button></div>
    <p>틀린 문제·내 답·해설을 바로 저장해요. 서로 다른 두 날에 맞히면 오답 해결, 그 뒤 7일 뒤에 한 번 더 확인해요. 같은 날 여러 번 맞혀도 한 번이에요.</p>
    {run && cur ? <div className="mistake-retest">
      <div className="mistake-retest-head"><b>오답 재시험 {run.index + 1} / {run.items.length}</b><button onClick={() => setRun(null)}>그만하기</button></div>
      {/* ★ 푸는 동안에도 곤이 곁에서 말해 준다 ★ 답을 내기 전엔 지난번에 뭘 골랐는지를 짚어 주고(정답은 안 말한다), 낸 뒤에는 아래 해설 */}
      {run.picked == null && (
        <HunterTutor
          guide="gon"
          scene="arena"
          mood="encourage"
          title="재시험 도우미"
          line={(cur.wrongChosen ?? cur.chosen) ? `지난번엔 「${cur.wrongChosen ?? cur.chosen}」을 골랐었어. 이번엔 어디가 달랐는지 떠올려 보자!` : '틀렸던 문제야. 천천히 떠올려 보고 골라 보자!'}
          compact
        />
      )}
      <p className="mistake-question" lang="ja">{cur.prompt}</p>
      {cur.speak && <button onClick={() => speakJapanese(cur.speak, .9)}>問題の音声を聞く · 문제 듣기</button>}
      {cur.options?.length > 1 ? <div className="mistake-options">{cur.options.map((option, i) => <button key={i} disabled={run.picked != null} onClick={() => answer(option)}>{option}</button>)}</div> : <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) answer(typed); }}><input aria-label="오답 재시험 답" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={run.picked != null} /><button disabled={!typed.trim() || run.picked != null}>답 확인</button></form>}
      {run.picked != null && <div className="mistake-feedback"><b>{run.ok ? '맞았어요' : '이 부분을 다시 봐요'}</b><HunterTutor guide={run.ok ? 'gon' : 'killua'} scene="arena" mood={run.ok ? 'celebrate' : 'encourage'} title="재시험 해설" line={run.ok ? '맞았어! 이번 답과 해설을 함께 기억해 두자.' : '방금 고른 답과 정답이 어디서 달라지는지 확인해 보자.'} compact><p>내 답: {run.picked}<br />정답: {cur.correct}</p><p>{cur.explanation}</p></HunterTutor><button onClick={() => { if (run.index + 1 === run.items.length) setRun(null); else setRun({ ...run, index: run.index + 1, picked: null }); setTyped(''); }}>{run.index + 1 === run.items.length ? '재시험 마치기' : '다음 문제'}</button></div>}
    </div> : rows.length ? <button className="submit-btn mistake-start" onClick={() => { setTyped(''); setRun({ items: rows.slice(0, 10), index: 0, picked: null, stamp: Date.now() }); }}>오답 {Math.min(rows.length, 10)}문제 다시 풀기</button> : <p className="mistake-empty">새로 틀린 문제가 여기에 쌓여요. 예전 N3 오답은 오답노트의 N3 코스 칸에서 볼 수 있어요.</p>}
    {expanded && <div className="mistake-list">{rows.slice(0, 20).map((row) => <article key={row.id}><small>{row.kind} · {row.wrong}번 틀림 · {mistakeStatus(row)?.label}</small><b lang="ja">{row.prompt}</b><p>틀렸을 때 내 답: {row.wrongChosen ?? row.chosen}<br />정답: {row.correct}</p><p>{row.wrongExplanation || row.explanation}</p><button onClick={() => onLearn?.(row)}>관련 내용 다시 학습 ↗</button></article>)}</div>}
  </section>;
}

