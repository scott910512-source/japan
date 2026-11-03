import { useEffect, useRef, useState } from 'react';
import BottomSheet from '../components/BottomSheet.jsx';
import HunterTutor from '../components/HunterTutor.jsx';
import { GRAMMAR_MODULES } from '../data/grammar.js';
import { FORM_LABELS } from '../lib/conjugate.js';
import { grammarQuiz, grammarAttempt, shuffleGrammar, GRAMMAR_QUIZ_SIZE } from '../lib/grammarQuiz.js';
import { IconGrid } from '../components/Icons.jsx';
import '../styles/grammar-quiz.css';

export default function Grammar({ words, progress, onProgress, onAttempt }) {
  const [openId, setOpenId] = useState(null);
  const [run, setRun] = useState(null);
  const locked = useRef(false);
  const panel = useRef(null);
  useEffect(() => {
    panel.current?.closest('.sheet')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [openId, run?.phase, run?.questions]);
  const module = GRAMMAR_MODULES.find((m) => m.id === openId);
  const question = run?.questions[run.at];
  const current = run?.results[run.at];
  const answered = Boolean(current);
  const results = run?.results || [];
  const wrong = results.filter((r) => !r.ok);
  const right = results.length - wrong.length;

  const begin = (mod, questions, review = false) => {
    setOpenId(mod.id);
    locked.current = false;
    setRun({ questions, at: 0, results: [], review, phase: 'quiz' });
  };
  const fresh = (mod) => begin(mod, grammarQuiz(words, mod, progress?.mistakes));
  const close = () => { setOpenId(null); setRun(null); };
  const pick = (chosen) => {
    if (!question || answered || locked.current || run.phase !== 'quiz') return;
    locked.current = true;
    const result = { question, chosen, ok: chosen === question.answer };
    setRun((prev) => ({ ...prev, results: [...prev.results, result] }));
    onProgress?.(openId, 1);
    onAttempt?.(grammarAttempt(module, question, chosen));
  };
  const next = () => {
    if (!answered) return;
    if (run.at + 1 === run.questions.length) setRun((prev) => ({ ...prev, phase: 'result' }));
    else {
      locked.current = false;
      setRun((prev) => ({ ...prev, at: prev.at + 1 }));
    }
  };
  const reviewWrong = () => begin(module, wrong.map(({ question: q }) => ({ ...q, options: shuffleGrammar(q.options) })), true);

  return <>
    <div className="gram-grid">
      {GRAMMAR_MODULES.map((m) => <div key={m.id} className="gram-card" onClick={() => fresh(m)}>
        <div className="gram-icon"><IconGrid /></div>
        <div className="gram-title">{m.title}</div>
        <div className="gram-sub">{m.forms.length}개 형태 · {GRAMMAR_QUIZ_SIZE}문제 한 세트</div>
      </div>)}
    </div>
    <BottomSheet open={Boolean(module)} onClose={close} label="문법 설명">
      {module && run && <div ref={panel} className="grammar-session" data-phase={run.phase} data-review={String(run.review)}>
        <div className="grammar-session-head"><h3>{module.title}</h3><button className="ghost-btn" onClick={close}>{run.phase === 'result' ? '닫기' : '그만하기'}</button></div>
        {!run.questions.length ? <p className="set-note">연습할 동사가 없어요. 단어 자료를 확인한 뒤 다시 시작해 주세요.</p> : run.phase === 'result' ? <>
          <div className="grammar-result" role="status">
            <h4>{run.review ? '오답 복습 완료' : `${run.questions.length}문제 세트 완료`}</h4>
            <strong>{right} / {results.length}</strong><p>정답 {right}개 · 오답 {wrong.length}개 · {Math.round(right / results.length * 100)}점</p>
          </div>
          <HunterTutor guide={wrong.length ? 'killua' : 'wing'} scene="arena" mood={wrong.length ? 'encourage' : 'celebrate'} title="결과 돌아보기" line={wrong.length ? `이번에 틀린 ${wrong.length}문제만 다시 풀 수 있어. 새 문제가 끝없이 이어지지는 않아.` : '이번 세트를 마쳤어! 새 세트를 고르거나 여기서 끝내면 돼.'} compact />
          {wrong.length > 0 && <div className="grammar-wrong-list"><h4>틀린 문제 {wrong.length}개</h4>{wrong.map(({ question: q, chosen }) => <div className="card" key={q.id}>
            <b><span lang="ja">{q.word.kanji || q.word.kana}</span> · {FORM_LABELS[q.formKey]}</b>
            <p>내 답: <span lang="ja">{chosen}</span><br />정답: <span lang="ja">{q.answer}</span></p>
          </div>)}</div>}
          <details className="grammar-all-answers"><summary>전체 정답·내 답 보기 ({results.length}문제)</summary>{results.map(({ question: q, chosen, ok }, i) => <p key={q.id}>
            {i + 1}. {ok ? '맞음' : '오답'} · <span lang="ja">{q.word.kanji || q.word.kana}</span> · {FORM_LABELS[q.formKey]}<br />내 답: <span lang="ja">{chosen}</span> / 정답: <span lang="ja">{q.answer}</span>
          </p>)}</details>
          <div className="grammar-result-actions">
            {wrong.length > 0 && <button className="submit-btn" onClick={reviewWrong}>틀린 문제 {wrong.length}개만 복습</button>}
            <button className="ghost-btn" onClick={() => fresh(module)}>새 10문제 시작</button>
            <button className="ghost-btn" onClick={close}>학습 종료</button>
          </div>
        </> : <>
          <div className="grammar-quiz-progress" aria-live="polite"><b>{run.review ? '오답 복습' : '문법 퀴즈'} · 현재 {run.at + 1} / {run.questions.length}문제</b><span>답 확인 {results.length} / {run.questions.length}</span></div>
          <progress className="grammar-progress" aria-label="답을 확인한 문제 수" max={run.questions.length} value={results.length} />
          <div className="sub">{run.review ? '틀린 문제만 다시 풀어요. 이 세트도 끝나면 결과를 보여드려요.' : '한 세트를 마치면 결과가 나와요. 다음 세트는 직접 선택할 때만 시작해요.'}</div>
          <HunterTutor guide="wing" scene="arena" title="활용의 원리" line="아래 규칙에서 동사의 갈래와 바뀌는 부분을 먼저 찾아보자." peer={{ guide: 'zushi', line: '같은 뜻도 정중한 말과 보통 말로 나눠서 확인할게요.' }} compact>
            <table className="ruletable"><tbody>{module.rules.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
          </HunterTutor>
          <div className="quiz-q"><span lang="ja">{question.word.kanji || question.word.kana}({question.word.kana})</span>의 {FORM_LABELS[question.formKey]}은?</div>
          <div>{question.options.map((opt) => <button key={opt} lang="ja" className={`quiz-opt${answered && opt === question.answer ? ' correct' : answered && opt === current.chosen ? ' wrong' : ''}`} disabled={answered} onClick={() => pick(opt)}>
            {opt}{answered && opt === question.answer && <span className="stamp ok" lang="ko">정답</span>}{answered && opt === current.chosen && opt !== question.answer && <span className="stamp no" lang="ko">내가 고른 답</span>}
          </button>)}</div>
          {answered && <div className={`quizverdict ${current.ok ? 'ok' : 'no'}`}>{current.ok ? '맞았어요' : <>아쉬워요 — 정답은 <b lang="ja">{question.answer}</b> 예요</>}</div>}
          {answered && <button className="swap-btn" onClick={next}>{run.at + 1 === run.questions.length ? '결과 보기' : '다음 문제 →'}</button>}
        </>}
      </div>}
    </BottomSheet>
  </>;
}
