import { useState } from 'react';
import { IconBook, IconMap } from './Icons.jsx';

// 질문은 2개뿐이다. 온보딩을 길게 만들면 시작 전에 이탈한다.
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
    id: 'trip',
    Icon: IconMap,
    title: '일본 여행까지 며칠 남았나요?',
    desc: '남은 기간에 맞춰 오늘 학습량과 우선순위를 잡아 드려요.',
    choices: [
      { value: 'd3', label: '3일 이내' },
      { value: 'd7', label: '일주일' },
      { value: 'd14', label: '2주쯤' },
      { value: 'none', label: '여행 계획은 없어요' },
    ],
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
  const [answers, setAnswers] = useState({ kana: null, trip: null });

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
    const trip = a.trip ?? 'none';
    onFinish({
      onboarded: true,
      canReadKana: a.kana ?? true,
      tripDay: trip,
      dailyGoal: DEFAULT_GOAL,
      hangulPron: a.kana === false,
      showKana: a.kana === false,
    });
  };

  return (
    <div className={`onboarding${open ? '' : ' done'}`}>
      <button className="ob-skip" onClick={() => finish({ kana: true, trip: 'none' })}>건너뛰기</button>

      <div className="ob-slides">
        {SLIDES.map((s, i) => (
          <div key={s.id} className={`ob-slide${i === step ? ' active' : ''}`}>
            <div className="ob-badge"><s.Icon /></div>
            <h2>{s.title}</h2>
            <p>{s.desc}</p>
            <div className="ob-choices">
              {s.choices.map((c) => (
                <button
                  key={String(c.value)}
                  className={`ob-choice${answers[s.id] === c.value ? ' picked' : ''}`}
                  onClick={() => choose(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ob-foot">
        <div className="ob-dots">
          {SLIDES.map((s, i) => <span key={s.id} className={i === step ? 'active' : ''} />)}
        </div>
        <button className="ob-next" onClick={next} disabled={picked === null || picked === undefined}>
          {step === SLIDES.length - 1 ? '시작하기' : '다음'}
        </button>
      </div>
    </div>
  );
}
