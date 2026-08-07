import { useMemo, useState } from 'react';
import BottomSheet from '../components/BottomSheet.jsx';
import { GRAMMAR_MODULES } from '../data/grammar.js';
import { conjugate, FORM_LABELS } from '../lib/conjugate.js';
import { IconGrid } from '../components/Icons.jsx';

const NAIVE_SUFFIX = {
  masu: 'ます', masuNeg: 'ません', mashita: 'ました', masenDeshita: 'ませんでした',
  nai: 'ない', ta: 'た', te: 'て', potentialDict: 'られる', potentialMasu: 'られます',
  volitionalCasual: 'よう', volitionalPolite: 'ましょう', ba: 'ば', nagara: 'ながら',
  teiru: 'ています', tekudasai: 'てください', temoiidesuka: 'てもいいですか',
  naidekudasai: 'ないでください', tara: 'たら',
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(verbWords, moduleForms) {
  const word = verbWords[Math.floor(Math.random() * verbWords.length)];
  const formKey = moduleForms[Math.floor(Math.random() * moduleForms.length)];
  const forms = conjugate(word.kana, word.group);
  const answer = forms[formKey];

  const wrongGroup = word.group === '2' ? '1' : '2';
  const wrongGroupForms = conjugate(word.kana, wrongGroup);
  const naive = word.kana + (NAIVE_SUFFIX[formKey] || '');
  const other = verbWords[Math.floor(Math.random() * verbWords.length)];
  const otherForms = conjugate(other.kana, other.group);

  const pool = [wrongGroupForms[formKey], naive, otherForms[formKey]].filter(
    (v) => v && v !== answer
  );
  const distractors = [...new Set(pool)].slice(0, 3);
  while (distractors.length < 3) distractors.push(naive + '　');

  return {
    word, formKey, answer,
    options: shuffle([answer, ...distractors]),
  };
}

export default function Grammar({ words, onProgress }) {
  const [openId, setOpenId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState(null);

  const verbWords = useMemo(() => words.filter((w) => w.type === 'verb'), [words]);
  const module = GRAMMAR_MODULES.find((m) => m.id === openId);

  const open = (id) => {
    setOpenId(id);
    const mod = GRAMMAR_MODULES.find((m) => m.id === id);
    setQuestion(buildQuestion(verbWords, mod.forms));
    setAnswered(false);
    setPicked(null);
  };
  const close = () => setOpenId(null);

  const pick = (opt) => {
    if (answered) return;
    setAnswered(true);
    setPicked(opt);
    onProgress(openId, 1);
  };
  const nextQuestion = () => {
    setQuestion(buildQuestion(verbWords, module.forms));
    setAnswered(false);
    setPicked(null);
  };

  return (
    <>
      <div className="navtitle">문법</div>
      <div className="gram-grid">
        {GRAMMAR_MODULES.map((m) => (
          <div key={m.id} className="gram-card" onClick={() => open(m.id)}>
            <div className="gram-icon"><IconGrid /></div>
            <div className="gram-title">{m.title}</div>
            <div className="gram-sub">{m.forms.length}개 형태</div>
          </div>
        ))}
      </div>

      <BottomSheet open={!!module} onClose={close}>
        {module && question && (
          <>
            <h3>{module.title}</h3>
            <div className="sub">규칙 정리 &amp; 미니 퀴즈</div>
            <table className="ruletable">
              <tbody>
                {module.rules.map(([k, v]) => (
                  <tr key={k}><th>{k}</th><td>{v}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="quiz-q">
              {question.word.kanji}({question.word.kana})의 {FORM_LABELS[question.formKey]}은?
            </div>
            <div>
              {question.options.map((opt) => {
                const isAnswer = opt === question.answer;
                const isPicked = opt === picked;
                let cls = 'quiz-opt';
                if (answered && isAnswer) cls += ' correct';
                else if (answered && isPicked) cls += ' wrong';
                return (
                  <button key={opt} className={cls} onClick={() => pick(opt)}>
                    {opt}
                    {answered && isAnswer && <span className="stamp ok">정답</span>}
                    {answered && isPicked && !isAnswer && <span className="stamp no">내가 고른 답</span>}
                  </button>
                );
              })}
            </div>

            {/* 어느 게 정답인지 색만으로 알려주면 헷갈린다. 결과를 문장으로도 말해 준다. */}
            {answered && (
              <div className={`quizverdict ${picked === question.answer ? 'ok' : 'no'}`}>
                {picked === question.answer
                  ? '맞았어요'
                  : <>아쉬워요 — 정답은 <b>{question.answer}</b> 예요</>}
              </div>
            )}

            {answered && (
              <button className="swap-btn" onClick={nextQuestion} style={{ marginTop: 4 }}>
                다음 문제 →
              </button>
            )}
          </>
        )}
      </BottomSheet>
    </>
  );
}
