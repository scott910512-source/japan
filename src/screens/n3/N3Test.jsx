import { useMemo } from 'react';
import { IconArrowLeft } from '../../components/Icons.jsx';
import { checkTest, TEST_TITLES } from '../../lib/n3.js';
import QuizRunner from './QuizRunner.jsx';

/* 확인 테스트 · N4 진단. 진단은 꼭지마다 한 문제 — 맞힌 꼭지는 계획에서 빠진다. */
export default function N3Test({ testId, n3, review, rate, onAnswer, onFinish, onQuit }) {
  const questions = useMemo(() => checkTest(testId, n3, review), [testId]); // eslint-disable-line react-hooks/exhaustive-deps
  const diag = testId === 't:ch0';
  return (
    <div className="n3-test" data-test={testId}>
      <div className="sub-header inline">
        <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 나가기</button>
        <div className="sub-title">{TEST_TITLES[testId] || testId}</div>
      </div>
      {diag && <p className="set-note" style={{ marginBottom: 10 }}>N4 열다섯 꼭지에서 한 문제씩. 맞힌 꼭지는 건너뛰고, 틀린 꼭지는 Chapter 0에서 다시 배워요.</p>}
      <QuizRunner
        questions={questions}
        rate={rate}
        autoSpeak={false}
        mode="exam"
        onAnswer={onAnswer}
        onDone={(r) => onFinish?.(r)}
        doneLabel="결과 반영"
      />
    </div>
  );
}
