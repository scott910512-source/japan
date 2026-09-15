import { useState } from 'react';
import { IconArrowLeft } from '../../components/Icons.jsx';
import { readingById, READING_QUESTIONS } from '../../data/n3/reading.js';
import { grammarById } from '../../data/n3/grammar.js';
import QuizRunner from './QuizRunner.jsx';
import JpSpeak from './JpSpeak.jsx';

/* 독해 — 학습 모드는 지문 → 문장 구조 → 핵심 문법 → 핵심 어휘 → 문제.
 * 실전 모드는 문제부터(해설 없이) 풀고, 끝나고 나서 분석을 볼 수 있다. */
const STEPS = ['지문', '구조', '문법', '어휘', '문제'];

export function PassageText({ p, rate, showKo }) {
  return (
    <div className="card n3-ptext">
      {p.kind && <div className="n3-pkind">{p.kind}</div>}
      {p.text.map((s, i) => (
        <div key={i} className="n3-psent">
          <span className="n3-pjp" lang="ja">{s.jp}</span>
          {showKo && <span className="n3-pko">{s.ko}</span>}
          <JpSpeak text={s.kana} rate={rate} id={`ps:${p.id}:${i}`} className="n3-spk-sm" />
        </div>
      ))}
    </div>
  );
}

export function PassageAnalysis({ p, onOpenGrammar }) {
  return (
    <>
      <div className="section-label">문장 구조</div>
      <div className="stack">
        {p.analysis.map((a, i) => (
          <div key={i} className="card n3-ana"><b lang="ja">{a.jp}</b><span>{a.note}</span></div>
        ))}
      </div>
      <div className="section-label">핵심 문법</div>
      <div className="stack">
        {p.grammar.map((g, i) => {
          const l = g.ref ? grammarById(g.ref) : null;
          return (
            <button key={i} className="card n3-ana n3-glink" onClick={() => l && onOpenGrammar?.(g.ref)} disabled={!l}>
              <b lang="ja">{g.form}</b><span>{g.note}{l ? ` · 레슨 「${l.title}」 →` : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="section-label">핵심 어휘</div>
      <div className="card n3-vlist">
        {p.vocab.map((v, i) => <div key={i} className="n3-vrow"><b lang="ja">{v.jp}</b><span>{v.kana}</span><em>{v.ko}</em></div>)}
      </div>
    </>
  );
}

export default function ReadingLesson({ passageId, mode = 'study', rate, onAnswer, onFinish, onQuit, onOpenGrammar, exam = false }) {
  const p = readingById(passageId);
  const [step, setStep] = useState(mode === 'study' ? 0 : 4);
  const [showKo, setShowKo] = useState(false);
  const [done, setDone] = useState(null);
  if (!p) return null;
  const questions = READING_QUESTIONS.filter((q) => q.ref === p.id).map((q) => ({ ...q, type: 'choice' }));

  return (
    <div className="n3-lesson n3-reading" data-passage={p.id} data-step={step}>
      <div className="sub-header inline">
        <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 나가기</button>
        <div className="sub-title">L{p.level} · {p.title}</div>
      </div>
      {mode === 'study' && !done && (
        <div className="n3-steps">
          {STEPS.map((s, i) => <button key={s} className={`n3-stepdot${i === step ? ' cur' : ''}${i < step ? ' past' : ''}`} disabled={i > step} onClick={() => i <= step && setStep(i)}>{s}</button>)}
        </div>
      )}

      {step === 0 && (
        <>
          <PassageText p={p} rate={rate} showKo={showKo} />
          <div className="btnrow" style={{ marginTop: 10 }}>
            <button className="ghost-btn n3-toggleko" onClick={() => setShowKo(!showKo)}>{showKo ? '뜻 숨기기' : '뜻 보기'}</button>
            <button className="submit-btn" onClick={() => setStep(1)}>문장 구조 보기</button>
          </div>
          <p className="set-note">먼저 뜻 없이 읽어 보세요. 막히는 문장만 🔊로 듣고, 뜻은 마지막에.</p>
        </>
      )}
      {step >= 1 && step <= 3 && (
        <>
          {step === 1 && (<><div className="section-label">문장 구조</div><div className="stack">{p.analysis.map((a, i) => <div key={i} className="card n3-ana"><b lang="ja">{a.jp}</b><span>{a.note}</span></div>)}</div></>)}
          {step === 2 && (<><div className="section-label">핵심 문법</div><div className="stack">{p.grammar.map((g, i) => { const l = g.ref ? grammarById(g.ref) : null; return <button key={i} className="card n3-ana n3-glink" onClick={() => l && onOpenGrammar?.(g.ref)} disabled={!l}><b lang="ja">{g.form}</b><span>{g.note}{l ? ` · 레슨 「${l.title}」 →` : ''}</span></button>; })}</div></>)}
          {step === 3 && (<><div className="section-label">핵심 어휘</div><div className="card n3-vlist">{p.vocab.map((v, i) => <div key={i} className="n3-vrow"><b lang="ja">{v.jp}</b><span>{v.kana}</span><em>{v.ko}</em></div>)}</div></>)}
          <button className="submit-btn" style={{ marginTop: 12 }} onClick={() => setStep(step + 1)}>{step === 3 ? `문제 풀기 (${questions.length})` : '다음'}</button>
        </>
      )}
      {step === 4 && !done && (
        <>
          <PassageText p={p} rate={rate} showKo={false} />
          <QuizRunner
            questions={questions}
            rate={rate}
            autoSpeak={false}
            mode={exam ? 'exam' : 'study'}
            onAnswer={onAnswer}
            onFinish={(r) => { if (exam) { onFinish?.(r); } }}
            onDone={(r) => { if (mode === 'study') { onFinish?.(r); } else setDone(r); }}
            doneLabel={mode === 'study' ? '완료' : '해설 보기'}
            hideFinish={exam}
          />
        </>
      )}
      {done && (
        <>
          <div className="card n3-score"><b>{done.right} / {done.total}</b><span>실전 모드 — 이제 분석을 보세요</span></div>
          <PassageText p={p} rate={rate} showKo />
          <PassageAnalysis p={p} onOpenGrammar={onOpenGrammar} />
          <button className="submit-btn" style={{ marginTop: 12 }} onClick={() => onFinish?.(done)}>완료</button>
        </>
      )}
    </div>
  );
}
