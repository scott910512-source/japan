import { useEffect, useRef, useState } from 'react';
import { IconArrowLeft } from '../../components/Icons.jsx';
import { grammarById } from '../../data/n3/grammar.js';
import { grammarQuestionsOf, verdictFor } from '../../lib/n3.js';
import QuizRunner from './QuizRunner.jsx';
import JpSpeak from './JpSpeak.jsx';
import HunterTutor from '../../components/HunterTutor.jsx';
import { conversationTutor } from '../../data/hunterTutors.js';

/* 문법 레슨 — 설명 → 예문 → 비교 → 회화 → 문제 → 복습. 순서가 고정이다.
 * 「왜 이렇게 쓰는가」를 규칙보다 먼저 읽게 하고, 문제는 끝에.
 * 복습 단계는 방금 틀린 문제와 접속·비교를 한 장으로 다시 본다. */
const STEPS = ['설명', '예문', '비교', '회화', '문제', '복습'];

/* ★ 나갔다 와도 그 단계부터 ★ (2026-11-17 QA B05) 전에는 문제를 다 풀고 「레슨 완료」 대신 「나가기」를 누르면
   단계도 판정도 사라지고, 다시 들어오면 설명부터였다. 레슨마다 마지막 단계를 기기에 적어 두고(완료하면 지운다),
   문제를 풀다 나가면 그때까지 푼 판정은 회독 기록에 넣는다(onPartial) */
const POS_KEY = 'jp_n3_lesson_pos_v1';
const readPos = (id) => { try { const v = JSON.parse(localStorage.getItem(POS_KEY) || '{}')[id]; return Number.isInteger(v) ? Math.min(4, Math.max(0, v)) : 0; } catch { return 0; } };
const writePos = (id, step) => {
  try {
    const all = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
    if (step == null) delete all[id]; else all[id] = step;
    localStorage.setItem(POS_KEY, JSON.stringify(all));
  } catch { /* 자리를 못 적어도 레슨은 된다 */ }
};

export default function GrammarLesson({ lessonId, rate, onAnswer, onFinish, onQuit, onPartial, mastery }) {
  const l = grammarById(lessonId);
  const [step, setStep] = useState(() => readPos(lessonId));
  const [result, setResult] = useState(null);
  const answered = useRef([]);
  useEffect(() => { if (step < 5) writePos(lessonId, step); }, [lessonId, step]);
  if (!l) return null;

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  /* 문제를 풀다 나가면 그때까지 푼 것을 넣고 나간다 — 레슨 완료로 치지는 않는다 */
  const quit = () => {
    if (!result && answered.current.length) onPartial?.({ results: answered.current });
    onQuit?.();
  };
  const answer = (q, ok, picked) => { answered.current = [...answered.current, { q, ok, picked }]; onAnswer?.(q, ok, picked); };

  return (
    <div className="n3-lesson n3-grammar" data-lesson={l.id} data-step={step}>
      <div className="sub-header inline">
        <button className="sub-back" onClick={quit}><IconArrowLeft /> 나가기</button>
        <div className="sub-title">{l.title}</div>
      </div>
      <div className="n3-steps" role="tablist">
        {STEPS.map((s, i) => (
          <button key={s} className={`n3-stepdot${i === step ? ' cur' : ''}${i < step ? ' past' : ''}`} onClick={() => (i <= step || result) && setStep(i)} disabled={i > step && !result}
            title={i > step && !result ? '앞 단계를 마치면 열려요' : undefined}>{i > step && !result ? `🔒 ${s}` : s}</button>
        ))}
      </div>
      {/* 잠긴 단계가 왜 안 눌리는지(QA B16) */}
      {step === 0 && !result && <p className="n3-steps-note">설명부터 차례로 열려요 · 나갔다 와도 그 단계부터 이어서 해요</p>}

      {step === 0 && (
        <div className="stack">
          <div className="card n3-gcard">
            <div className="n3-glabel">의미</div>
            <div className="n3-gmeaning">{l.meaning}</div>
            <div className="n3-glabel" style={{ marginTop: 12 }}>구조</div>
            <div className="n3-gstruct">{l.structure}</div>
          </div>
          <HunterTutor guide="wing" scene="arena" title="왜 이렇게 쓰는가" line="형태만 외우기 전에, 이 표현을 쓰는 이유부터 살펴보자." peer={{ guide: 'zushi', line: '문장에 붙는 모양과 뜻을 같이 보면 되는 거죠?' }}>
            <p className="n3-gwhy">{l.why}</p>
          </HunterTutor>
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
          <HunterTutor guide={conversationTutor(l.title + l.dialog.map((d) => d.jp).join(' '))} scene="city" title="회화에서 써 보기" line="누가 누구에게 하는 말인지 생각하면서, 두 사람의 대화를 읽어 봐요." compact />
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
        <QuizRunner onQuit={quit}
          questions={grammarQuestionsOf(l.id)}
          rate={rate}
          autoSpeak={false}
          onAnswer={answer}
          onFinish={(r) => setResult(r)}
          onDone={() => setStep(5)}
          doneLabel="복습으로"
        />
      )}

      {step === 5 && (
        <div className="stack n3-recap">
          <HunterTutor guide="gon" scene="island" mood="encourage" title="오늘 배운 것 정리" line="뜻과 문장 모양을 한 번 더 연결해 보자. 아래 정리 카드로 다시 확인해 보자!" compact />
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
          <button className="submit-btn n3-finish-btn" onClick={() => { writePos(lessonId, null); onFinish?.(result || { right: 0, total: l.quiz.length, results: [] }); }}>레슨 완료</button>
        </div>
      )}
    </div>
  );
}
