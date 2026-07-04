import { useState } from 'react';

const TOTAL = 4;

export default function Onboarding({ open, onFinish }) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState('basic');
  const [goal, setGoal] = useState(10);
  const [notify, setNotify] = useState(true);

  const next = () => {
    if (step < TOTAL - 1) setStep(step + 1);
    else onFinish({ onboarded: true, level, dailyGoal: goal, notifications: notify });
  };
  const skip = () => onFinish({ onboarded: true, level, dailyGoal: goal, notifications: notify });

  return (
    <div className={`onboarding${open ? '' : ' done'}`}>
      <button className="ob-skip" onClick={skip}>건너뛰기</button>
      <div className="ob-slides">
        <div className={`ob-slide${step === 0 ? ' active' : ''}`}>
          <div className="ob-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 8h16M6 8l1-3h10l1 3M6 8v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
          </div>
          <h2>단어부터 문장까지,<br />하나의 흐름으로</h2>
          <p>외운 단어를 그대로 기초 문형에 끼워 넣어, 실제로 쓰는 문장까지 이어서 배워요.</p>
        </div>

        <div className={`ob-slide${step === 1 ? ' active' : ''}`}>
          <div className="ob-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 19V7a2 2 0 0 1 2-2h5v14H6a2 2 0 0 0-2 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M20 19V7a2 2 0 0 0-2-2h-5v14h5a2 2 0 0 1 2 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
          </div>
          <h2>가나를 읽을 수 있나요?</h2>
          <p>수준에 맞춰 첫 화면 구성을 달리 보여드려요. 나중에 설정에서 바꿀 수 있어요.</p>
          <div className="ob-choices">
            {[
              { v: 'beginner', label: '처음이에요' },
              { v: 'basic', label: '기본은 읽어요' },
              { v: 'grammar', label: '문법도 알아요' },
            ].map((o) => (
              <button key={o.v} className={`ob-choice${level === o.v ? ' picked' : ''}`} onClick={() => setLevel(o.v)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`ob-slide${step === 2 ? ' active' : ''}`}>
          <div className="ob-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 8l7-5 7 5M5 8v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
          </div>
          <h2>하루 목표를 정해보세요</h2>
          <p>부담 없는 목표가 오래갑니다. 언제든 다시 바꿀 수 있어요.</p>
          <div className="ob-choices">
            {[5, 10, 20].map((g) => (
              <button key={g} className={`ob-choice${goal === g ? ' picked' : ''}`} onClick={() => setGoal(g)}>
                {g}개
              </button>
            ))}
          </div>
        </div>

        <div className={`ob-slide${step === 3 ? ' active' : ''}`}>
          <div className="ob-badge">
            <svg viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9.5 20a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
          </div>
          <h2>학습을 놓치지 않도록</h2>
          <p>매일 같은 시간에 짧은 리마인더를 보내드릴게요.</p>
          <div className="ob-choices">
            <button className={`ob-choice${notify ? ' picked' : ''}`} onClick={() => setNotify(true)}>알림 받기</button>
            <button className={`ob-choice${!notify ? ' picked' : ''}`} onClick={() => setNotify(false)}>나중에 할게요</button>
          </div>
        </div>
      </div>

      <div className="ob-foot">
        <div className="ob-dots">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span key={i} className={i === step ? 'active' : ''} />
          ))}
        </div>
        <button className="ob-next" onClick={next}>{step === TOTAL - 1 ? '학습 시작하기' : '다음'}</button>
      </div>
    </div>
  );
}
