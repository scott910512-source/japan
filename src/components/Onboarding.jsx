import { useState } from 'react';
import { IconBook, IconMap, IconGrid, IconCheck } from './Icons.jsx';
import { PURPOSES } from '../lib/purpose.js';
import { DAY_PRESETS, spreadGoal } from '../lib/daily.js';

/* 첫 설정.
 *
 * 길게 만들면 시작 전에 이탈한다. 그래서 묻는 것을 적게 두되, 순서와 저장
 * 방식에서 두 가지를 고친다.
 *
 * ★ 1. 여행 목적이 아닌 사람에게 출발일을 묻지 않는다 ★
 *
 * 예전엔 셋째 장이 늘 「일본에 언제 가세요?」였다. 시험 준비하는 사람에게도
 * 물었고, 그 답은 어디에도 안 쓰였다. 쓸 데 없는 질문은 묻지 않는다.
 *
 * ★ 2. 안 물어본 것을 저장하지 않는다 ★
 *
 * 예전 finish는 답을 안 받은 칸까지 기본값으로 채워 저장했다. 특히 goals를
 * 늘 20·20·20(하루 예순 장)으로 덮어써서, 설정에서 학습량을 맞춰 둔 사람이
 * 온보딩을 다시 지나가면 그 값이 사라졌다. 「건너뛰기」는 더 나빴다 — 아무
 * 답도 안 했는데 목적·가나·분량을 전부 기본값으로 적어 버렸다.
 *
 * 이제 답한 것만 저장한다. 건너뛰면 「봤다」는 표시 하나만 남는다. */

const HOW_STEPS = [
  { n: '1', text: '앞면을 보고 뜻을 떠올려요' },
  { n: '2', text: '「답 보기」로 정답을 확인해요' },
  { n: '3', text: '떠올렸는지 스스로 골라요 — 그걸로 다음에 볼 날이 정해져요' },
];

const SLIDES = [
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
    id: 'amount',
    Icon: IconCheck,
    title: '하루에 얼마나 하실래요?',
    /* 총량으로 묻는다. 갈래별로 물으면 셋을 각각 정하게 되고, 그 합이 하루치가
       된다는 걸 모른 채로 예순 장을 고르게 된다. */
    desc: '고른 양을 복습과 새로 배우기로 나눠 배정해요. 나중에 바꿀 수 있어요.',
    choices: DAY_PRESETS.map((p) => ({
      value: p.total, label: `${p.label} ${p.total}개`, sub: p.note,
    })),
  },
  {
    id: 'trip',
    Icon: IconMap,
    title: '일본에 언제 가세요?',
    /* 「3일 이내」는 고른 날의 이야기라 사흘이 지나면 거짓말이 된다.
       실제 날짜를 받거나, 아예 안 받는다. */
    desc: '날짜를 넣으면 홈에 「여행까지 N일」로 세어 드려요. 안 넣어도 학습에는 지장 없어요.',
    date: true,
    // 여행으로 배우는 사람에게만 묻는다
    onlyIf: (a) => a.purpose === 'trip',
  },
  {
    id: 'how',
    Icon: IconCheck,
    title: '이렇게 공부해요',
    desc: '카드 한 장이 어떻게 흘러가는지만 알면 됩니다.',
    how: true,
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

export default function Onboarding({ open, onFinish }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    purpose: null, kana: null, amount: null, trip: null,
  });

  /* 물을 것만 남긴다. 여행 장은 목적에 따라 붙었다 떨어진다 —
     목적을 고르는 순간 뒤쪽 장 수가 바뀌니 점도 같이 바뀐다. */
  const shown = SLIDES.filter((s) => !s.onlyIf || s.onlyIf(answers));
  const at = Math.min(step, shown.length - 1);
  const slide = shown[at];
  const picked = answers[slide.id];
  const last = at === shown.length - 1;

  const choose = (value) => setAnswers((a) => ({ ...a, [slide.id]: value }));

  const next = () => {
    if (!last) {
      setStep(at + 1);
      return;
    }
    finish(answers);
  };

  /* ★ 답한 것만 저장한다 ★
     안 물어본 칸을 기본값으로 채워 저장하면, 이미 설정을 맞춰 둔 사람이
     이 화면을 다시 지나갈 때 그 값이 사라진다. */
  const finish = (a) => {
    const patch = { onboarded: true };
    if (a.purpose) patch.purpose = a.purpose;
    if (a.kana !== null) {
      patch.canReadKana = a.kana;
      patch.hangulPron = a.kana === false;
      patch.showKana = a.kana === false;
    }
    if (a.amount) patch.goals = spreadGoal(a.amount);
    // 실제 날짜만 저장한다. 「3일 이내」 같은 선택을 날짜인 척 넣지 않는다
    if (/^\d{4}-\d{2}-\d{2}$/.test(a.trip || '')) patch.tripDate = a.trip;
    onFinish(patch);
  };

  return (
    <div className={`onboarding${open ? '' : ' done'}`}>
      {/* 건너뛰면 「봤다」는 표시만 남긴다 — 아무 답도 안 한 사람의 설정을
          기본값으로 덮어쓰지 않는다. */}
      <button className="ob-skip" onClick={() => onFinish({ onboarded: true })}>건너뛰기</button>

      <div className="ob-slides">
        {shown.map((s, i) => (
          <div key={s.id} className={`ob-slide${i === at ? ' active' : ''}`}>
            <div className="ob-badge"><s.Icon /></div>
            <h2>{s.title}</h2>
            <p>{s.desc}</p>
            {s.how ? (
              /* 고를 게 없는 장. 처음 쓰는 사람이 제일 먼저 막히는 곳이
                 「이 카드를 어떻게 하라는 거지」라서, 흐름만 한 번 보여 준다. */
              <ol className="ob-how">
                {HOW_STEPS.map((h) => (
                  <li key={h.n}><b>{h.n}</b><span>{h.text}</span></li>
                ))}
              </ol>
            ) : s.date ? (
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
          {shown.map((s, i) => <span key={s.id} className={i === at ? 'active' : ''} />)}
        </div>
        {/* 날짜 화면은 「안 정했어요」도 답이고, 설명 장은 고를 게 없다 */}
        <button
          className="ob-next"
          onClick={next}
          disabled={!slide.date && !slide.how && (picked === null || picked === undefined)}
        >
          {last ? '시작하기' : '다음'}
        </button>
      </div>
    </div>
  );
}
