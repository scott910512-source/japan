import { useMemo, useState } from 'react';
import { IconArrowLeft, IconCheck, IconX } from '../../components/Icons.jsx';
import { mockExam } from '../../lib/n3.js';
import { EXAM_SECTIONS } from '../../data/n3/exam.js';
import QuizRunner, { QText } from './QuizRunner.jsx';
import ReadingLesson from './ReadingLesson.jsx';
import ListeningLesson from './ListeningLesson.jsx';

/* N3 모의고사 — 문자·어휘 → 문법 → 독해 → 청해. 해설은 끝에 한꺼번에.
   결과는 영역별 정답률로 남고, 문제별 정답률도 쌓인다. */
export default function N3Exam({ rate, onAnswer, onFinish, onQuit }) {
  const exam = useMemo(() => mockExam(), []);
  const [sec, setSec] = useState(0);          // 0 moji · 1 bunpo · 2 reading · 3 listening · 4 done
  const [sub, setSub] = useState(0);          // 독해·청해 안의 몇 번째
  const [scores, setScores] = useState({ moji: { right: 0, total: 0, wrong: [] }, bunpo: { right: 0, total: 0, wrong: [] }, dokkai: { right: 0, total: 0, wrong: [] }, chokai: { right: 0, total: 0, wrong: [] } });

  const add = (key, r) => setScores((s) => ({ ...s, [key]: { right: s[key].right + r.right, total: s[key].total + r.total, wrong: [...s[key].wrong, ...r.results.filter((x) => !x.ok)] } }));

  const finishAll = () => {
    const total = Object.values(scores).reduce((a, s) => a + s.total, 0);
    const right = Object.values(scores).reduce((a, s) => a + s.right, 0);
    onFinish?.({ at: Date.now(), right, total, sections: Object.fromEntries(Object.entries(scores).map(([k, s]) => [k, { right: s.right, total: s.total }])) });
  };

  const head = (title) => (
    <div className="sub-header inline">
      <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 그만</button>
      <div className="sub-title">모의고사 · {title}</div>
    </div>
  );

  if (sec === 0) {
    return (
      <div className="n3-exam" data-sec="moji">
        {head(EXAM_SECTIONS[0].title)}
        <QuizRunner key="moji" questions={exam.moji} rate={rate} autoSpeak={false} mode="exam" hideFinish onAnswer={onAnswer} onFinish={(r) => { add('moji', r); setSec(1); }} />
      </div>
    );
  }
  if (sec === 1) {
    return (
      <div className="n3-exam" data-sec="bunpo">
        {head(EXAM_SECTIONS[1].title)}
        <QuizRunner key="bunpo" questions={exam.bunpo} rate={rate} autoSpeak={false} mode="exam" hideFinish onAnswer={onAnswer} onFinish={(r) => { add('bunpo', r); setSec(2); setSub(0); }} />
      </div>
    );
  }
  if (sec === 2) {
    const p = exam.reading[sub];
    return (
      <div className="n3-exam" data-sec="dokkai">
        <ReadingLesson key={p.id} passageId={p.id} mode="exam" exam rate={rate} onAnswer={onAnswer}
          onFinish={(r) => { add('dokkai', r); if (sub + 1 < exam.reading.length) setSub(sub + 1); else { setSec(3); setSub(0); } }}
          onQuit={onQuit} />
      </div>
    );
  }
  if (sec === 3) {
    const it = exam.listening[sub];
    return (
      <div className="n3-exam" data-sec="chokai">
        <ListeningLesson key={it.id} itemId={it.id} exam rate={rate} onAnswer={onAnswer}
          onFinish={(r) => { add('chokai', r); if (sub + 1 < exam.listening.length) setSub(sub + 1); else setSec(4); }}
          onQuit={onQuit} />
      </div>
    );
  }

  const total = Object.values(scores).reduce((a, s) => a + s.total, 0);
  const right = Object.values(scores).reduce((a, s) => a + s.right, 0);
  const pct = total ? Math.round((right / total) * 100) : 0;
  const keys = ['moji', 'bunpo', 'dokkai', 'chokai'];
  return (
    <div className="n3-exam n3-examresult" data-sec="done" data-pct={pct}>
      {head('결과')}
      <div className="card n3-score"><b>{pct}%</b><span>{right} / {total} · {pct >= 70 ? '합격권이에요' : pct >= 50 ? '조금만 더' : '기초부터 다시'}</span></div>
      <div className="card n3-ready">
        {keys.map((k, i) => {
          const s = scores[k];
          const p = s.total ? Math.round((s.right / s.total) * 100) : 0;
          return (
            <div key={k} className="n3-bar"><span className="n3-barlabel">{EXAM_SECTIONS[i].title}</span><span className="n3-bartrack"><i style={{ width: `${p}%` }} /></span><b className="n3-barpct">{s.right}/{s.total}</b></div>
          );
        })}
      </div>
      {keys.some((k) => scores[k].wrong.length) && (
        <>
          <div className="section-label">틀린 문제 해설</div>
          <div className="stack">
            {keys.flatMap((k) => scores[k].wrong).map(({ q, picked }, i) => (
              <div key={`${q.id}-${i}`} className="card n3-wrongcard">
                <div className="n3-wq">{q.type === 'order' ? `${q.before} ★ ${q.after}` : <QText q={q} />}</div>
                <div className="n3-wrow no"><IconX /> 내 답: {picked}{q.why?.[picked] ? ` — ${q.why[picked]}` : ''}</div>
                <div className="n3-wrow ok"><IconCheck /> 정답: {q.answer}{q.expl ? ` — ${q.expl}` : ''}</div>
              </div>
            ))}
          </div>
        </>
      )}
      <button className="submit-btn n3-done" style={{ marginTop: 14 }} onClick={finishAll}>결과 저장</button>
    </div>
  );
}
