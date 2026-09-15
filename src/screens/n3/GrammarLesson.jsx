import { useState } from 'react';
import { IconArrowLeft } from '../../components/Icons.jsx';
import { grammarById } from '../../data/n3/grammar.js';
import { grammarQuestionsOf, verdictFor } from '../../lib/n3.js';
import QuizRunner from './QuizRunner.jsx';
import JpSpeak from './JpSpeak.jsx';

/* 문법 레슨 — 설명 → 예문 → 비교 → 회화 → 문제 → 복습. 순서가 고정이다.
 * 「왜 이렇게 쓰는가」를 규칙보다 먼저 읽게 하고, 문제는 끝에.
 * 복습 단계는 방금 틀린 문제와 접속·비교를 한 장으로 다시 본다. */
const STEPS = ['설명', '예문', '비교', '회화', '문제', '복습'];

export default function GrammarLesson({ lessonId, rate, onAnswer, onFinish, onQuit, mastery }) {
  const l = grammarById(lessonId);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  if (!l) return null;

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  return (
    <div className="n3-lesson n3-grammar" data-lesson={l.id} data-step={step}>
      <div className="sub-header inline">
        <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 나가기</button>
        <div className="sub-title">{l.title}</div>
      </div>
      <div className="n3-steps" role="tablist">
        {STEPS.map((s, i) => (
          <button key={s} className={`n3-stepdot${i === step ? ' cur' : ''}${i < step ? ' past' : ''}`} onClick={() => (i <= step || result) && setStep(i)} disabled={i > step && !result}>{s}</button>
        ))}
      </div>

      {step === 0 && (
        <div className="stack">
          <div className="card n3-gcard">
            <div className="n3-glabel">의미</div>
            <div className="n3-gmeaning">{l.meaning}</div>
            <div className="n3-glabel" style={{ marginTop: 12 }}>구조</div>
            <div className="n3-gstruct">{l.structure}</div>
          </div>
          <div className="card n3-gcard">
            <div className="n3-glabel">왜 이렇게 쓰는가</div>
            <p className="n3-gwhy">{l.why}</p>
          </div>
          {mastery && <div className="set-note">이 문법의 숙련도: <b>{mastery}</b> · 문제를 맞혀야 올라가요</div>}
          <button className="submit-btn" onClick={next}>예문 보기</button>
        </div>
      )}

      {step === 1 && (
        <div className="stack">
          {l.examples.map((ex, i) => (
            <div key={i} className="card n3-ex">
              <div className="n3-exjp" lang="ja">{ex.jp}</div>
              <div className="n3-exkana">{ex.kana}</div>
              <div className="n3-exko">{ex.ko}</div>
              <JpSpeak text={ex.kana} rate={rate} id={`ex:${l.id}:${i}`} />
            </div>
          ))}
          <button className="submit-btn" onClick={next}>비슷한 표현과 비교</button>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          {l.compare.map((c, i) => (
            <div key={i} className="card n3-cmp">
              <div className="n3-cmphead"><b>{c.a}</b>{c.b && <><span className="n3-vs">vs</span><b>{c.b}</b></>}</div>
              <p>{c.note}</p>
            </div>
          ))}
          <button className="submit-btn" onClick={next}>회화에서는</button>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <div className="card n3-dialog">
            {l.dialog.map((d, i) => (
              <div key={i} className={`n3-dline ${d.s === 'B' ? 'b' : 'a'}`}>
                <span className="n3-dwho">{d.s}</span>
                <span className="n3-dbody">
                  <span className="n3-djp" lang="ja">{d.jp}</span>
                  <span className="n3-dko">{d.ko}</span>
                </span>
                <JpSpeak text={d.kana} rate={rate} id={`dl:${l.id}:${i}`} />
              </div>
            ))}
          </div>
          <button className="submit-btn" onClick={next}>문제 풀기 ({l.quiz.length}문제)</button>
        </div>
      )}

      {step === 4 && (
        <QuizRunner
          questions={grammarQuestionsOf(l.id)}
          rate={rate}
          autoSpeak={false}
          onAnswer={onAnswer}
          onFinish={(r) => setResult(r)}
          onDone={() => setStep(5)}
          doneLabel="복습으로"
        />
      )}

      {step === 5 && (
        <div className="stack n3-recap">
          <div className="card n3-gcard">
            <div className="n3-glabel">한 줄 정리</div>
            <div className="n3-gmeaning">{l.meaning}</div>
            <div className="n3-gstruct" style={{ marginTop: 6 }}>{l.structure}</div>
          </div>
          {l.compare.slice(0, 1).map((c, i) => (
            <div key={i} className="card n3-cmp"><div className="n3-cmphead"><b>{c.a}</b>{c.b && <><span className="n3-vs">vs</span><b>{c.b}</b></>}</div><p>{c.note}</p></div>
          ))}
          {result && result.results.filter((r) => !r.ok).length > 0 && (
            <div className="card n3-gcard">
              <div className="n3-glabel">다시 볼 것</div>
              {result.results.filter((r) => !r.ok).map(({ q }) => (
                <p key={q.id} className="n3-recapq">{q.q.replace('【　】', `【${q.answer}】`)} — {q.expl}</p>
              ))}
            </div>
          )}
          <div className="set-note">
            {result ? `${result.right} / ${result.total} 맞혔어요 · 판정: ${({ known: '알아요', vague: '애매해요', unknown: '몰라요' })[verdictFor(result.right, result.total)]} — 복습일이 정해졌어요` : ''}
          </div>
          <button className="submit-btn n3-finish-btn" onClick={() => onFinish?.(result || { right: 0, total: l.quiz.length, results: [] })}>레슨 완료</button>
        </div>
      )}
    </div>
  );
}
