import { useState } from 'react';
import { IconBook, IconMap, IconGrid } from './Icons.jsx';
import { PURPOSES } from '../lib/purpose.js';

// 질문은 셋뿐이다. 온보딩을 길게 만들면 시작 전에 이탈한다.
const SLIDES = [
  {
    id: 'kana',
    Icon: IconBook,
    title: '히라가나를 읽을 수 있나요?',
    desc: '못 읽어도 괜찮아요. 카드 앞면을 히라가나와 한글 발음으로 바꿔 드릴게요.',
    choices: [
      { value: true, label: '읽을 수 있어요' },
      { value: false, label: '아직 못 읽어요' },
    ],
  },
  {
    id: 'purpose',
    Icon: IconGrid,
    title: '무엇을 하려고 배우시나요?',
    /* ★ 하는 만큼만 말한다 ★
       예전 문구는 「남은 기간에 맞춰 학습량과 우선순위를 잡아 드려요」였는데
       아무것도 안 했다. 이제 정말로 차례를 바꾸고, 바꾸는 만큼만 적는다. */
    desc: '무엇을 먼저 배정할지가 달라져요. 나중에 설정에서 바꿔도 기록은 그대로예요.',
    choices: PURPOSES.map((p) => ({ value: p.id, label: p.label, sub: p.sub })),
  },
  {
    id: 'trip',
    Icon: IconMap,
    title: '일본에 언제 가세요?',
    /* 「3일 이내」는 고른 날의 이야기라 사흘이 지나면 거짓말이 된다.
       실제 날짜를 받거나, 아예 안 받는다. */
    desc: '날짜를 넣으면 홈에 「여행까지 N일」로 세어 드려요. 안 넣어도 학습에는 지장 없어요.',
    date: true,
  },
];

/* 여행이 언제인지로 하루 분량을 바꾸지 않는다.
 *
 * 예전엔 「3일 이내」를 고르면 15장으로 줄었다. 급한 사람에게 더 적게 시키는
 * 셈이라 거꾸로였다. 원래 기획에서 D-day가 하려던 일은 분량을 줄이는 게
 * 아니라 무엇부터 볼지를 바꾸는 것(생존 문장 먼저)이었는데, 그건 안 만들어졌고
 * 답이 갈 곳을 잃어 가장 가까운 숫자에 붙어 있었다. 그 연결을 끊는다.
 *
 * 답 자체는 계속 받는다 — 홈에 「여행까지 3일」로 뜨는 데 쓴다. */
const DEFAULT_GOAL = 20;

export default function Onboarding({ open, onFinish }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ kana: null, purpose: null, trip: null });

  const slide = SLIDES[step];
  const picked = answers[slide.id];

  const choose = (value) => setAnswers((a) => ({ ...a, [slide.id]: value }));

  const next = () => {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
      return;
    }
    finish(answers);
  };

  const finish = (a) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(a.trip || '') ? a.trip : null;
    onFinish({
      onboarded: true,
      canReadKana: a.kana ?? true,
      purpose: a.purpose ?? 'talk',
      /* 실제 날짜만 저장한다. 「3일 이내」 같은 선택을 날짜인 척 넣지 않는다 */
      tripDate: date,
      goals: { fresh: DEFAULT_GOAL, review: DEFAULT_GOAL, weak: DEFAULT_GOAL },
      hangulPron: a.kana === false,
      showKana: a.kana === false,
    });
  };

  return (
    <div className={`onboarding${open ? '' : ' done'}`}>
      <button className="ob-skip" onClick={() => finish({ kana: true, purpose: 'talk', trip: null })}>건너뛰기</button>

      <div className="ob-slides">
        {SLIDES.map((s, i) => (
          <div key={s.id} className={`ob-slide${i === step ? ' active' : ''}`}>
            <div className="ob-badge"><s.Icon /></div>
            <h2>{s.title}</h2>
            <p>{s.desc}</p>
            {s.date ? (
              /* 날짜는 고르는 게 아니라 적는 것이다 — 「3일 이내」로 받아 두면
                 사흘 뒤에 거짓말이 된다. 안 정했으면 안 정했다고 넘어간다. */
              <div className="ob-choices">
                <input
                  className="ob-date"
                  type="date"
                  value={answers.trip || ''}
                  onChange={(e) => choose(e.target.value || null)}
                  aria-label="여행 출발일"
                />
                <button
                  className={`ob-choice${answers.trip === null ? ' picked' : ''}`}
                  onClick={() => choose(null)}
                >아직 안 정했어요</button>
              </div>
            ) : (
              <div className="ob-choices">
                {s.choices.map((c) => (
                  <button
                    key={String(c.value)}
                    className={`ob-choice${answers[s.id] === c.value ? ' picked' : ''}`}
                    onClick={() => choose(c.value)}
                  >
                    {c.label}
                    {c.sub && <span className="ob-sub">{c.sub}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ob-foot">
        <div className="ob-dots">
          {SLIDES.map((s, i) => <span key={s.id} className={i === step ? 'active' : ''} />)}
        </div>
        {/* 날짜 화면은 「안 정했어요」도 답이라 비어 있어도 넘어갈 수 있다 */}
        <button className="ob-next" onClick={next} disabled={!slide.date && (picked === null || picked === undefined)}>
          {step === SLIDES.length - 1 ? '시작하기' : '다음'}
        </button>
      </div>
    </div>
  );
}
