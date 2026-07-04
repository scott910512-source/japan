import { useMemo, useState } from 'react';
import { IconSpeaker, IconShuffle, IconCheck, IconX } from '../components/Icons.jsx';
import { speakJapanese } from '../lib/tts.js';

const CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'verb', label: '동사' },
  { id: 'adj', label: '형용사' },
  { id: 'noun', label: '명사' },
  { id: 'known', label: '암기' },
  { id: 'unknown', label: '모름' },
];

const TYPE_LABEL = { verb: '동사', noun: '명사', adj: '형용사' };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Vocab({ words, progress, settings, onKnown, onUnknown }) {
  const [mode, setMode] = useState('card');
  const [category, setCategory] = useState('all');
  const [shuffled, setShuffled] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const knownSet = useMemo(() => new Set(progress.known), [progress.known]);
  const unknownSet = useMemo(() => new Set(progress.unknown), [progress.unknown]);

  const filtered = useMemo(() => {
    const base = shuffled && shuffled.length === words.length ? shuffled : words;
    let list;
    if (category === 'all') list = base;
    else if (category === 'known') list = base.filter((w) => knownSet.has(w.id));
    else if (category === 'unknown') list = base.filter((w) => unknownSet.has(w.id));
    else list = base.filter((w) => w.type === category);
    return list.length ? list : base;
  }, [shuffled, words, category, knownSet, unknownSet]);

  const current = filtered[index % filtered.length];

  const selectCategory = (id) => {
    setCategory(id);
    setIndex(0);
    setFlipped(false);
  };
  const doShuffle = () => {
    setShuffled(shuffle(words));
    setIndex(0);
    setFlipped(false);
  };
  const advance = () => {
    setIndex((i) => i + 1);
    setFlipped(false);
  };

  return (
    <>
      <div className="navtitle">단어</div>
      <div className="segment">
        <button className={mode === 'card' ? 'active' : ''} onClick={() => setMode('card')}>플래시카드</button>
        <button className={mode === 'quiz' ? 'active' : ''} onClick={() => setMode('quiz')}>객관식 퀴즈</button>
      </div>

      <div className="chiprow">
        {CATEGORIES.map((c) => (
          <div key={c.id} className={`chip${category === c.id ? ' active' : ''}`} onClick={() => selectCategory(c.id)}>
            {c.label}
          </div>
        ))}
      </div>

      {mode === 'card' ? (
        current ? (
          <>
            <div className="cardstage">
              <div className={`flashcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
                <div className="face front">
                  <div className="tag">{TYPE_LABEL[current.type]}{current.group ? ` · ${current.group}그룹` : ''}</div>
                  <div className="kanji">{current.kanji}</div>
                  <div className="kana">{current.kana}</div>
                  <button
                    className="speak-btn"
                    onClick={(e) => { e.stopPropagation(); speakJapanese(current.kanji, settings.speechRate); }}
                  >
                    <IconSpeaker />
                  </button>
                </div>
                <div className="face back">
                  <div className="meaning">{current.mean}</div>
                  <div className="kana">{current.kana}</div>
                </div>
              </div>
            </div>

            <div className="actionrow">
              <button
                className={`actionbtn dontknow${unknownSet.has(current.id) ? ' tagged' : ''}`}
                onClick={() => { onUnknown(current.id); advance(); }}
              >
                <IconX />모름
              </button>
              <button className="actionbtn" onClick={doShuffle}>
                <IconShuffle />셔플
              </button>
              <button
                className={`actionbtn know${knownSet.has(current.id) ? ' tagged' : ''}`}
                onClick={() => { onKnown(current.id); advance(); }}
              >
                <IconCheck />암기
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">이 필터에 해당하는 단어가 없어요</div>
        )
      ) : (
        <VocabQuiz words={filtered} />
      )}
    </>
  );
}

function VocabQuiz({ words }) {
  const [quizIndex, setQuizIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState(null);

  const word = words[quizIndex % words.length];

  const options = useMemo(() => {
    const distractors = shuffle(words.filter((w) => w.mean !== word.mean)).slice(0, 3).map((w) => w.mean);
    return shuffle([word.mean, ...distractors]);
  }, [word, words]);

  const pick = (opt) => {
    if (answered) return;
    setAnswered(true);
    setPicked(opt);
  };
  const next = () => {
    setQuizIndex((i) => i + 1);
    setAnswered(false);
    setPicked(null);
  };

  return (
    <>
      <div className="quiz-progress">{(quizIndex % words.length) + 1} / {words.length}</div>
      <div className="quiz-card">
        <div className="kanji" style={{ fontSize: 36 }}>{word.kanji}</div>
        <div className="kana">{word.kana}</div>
        <div className="ask">이 단어의 뜻은?</div>
      </div>
      <div className="quiz-grid">
        {options.map((opt, i) => {
          let cls = 'quiz-cell';
          if (answered && opt === word.mean) cls += ' correct';
          else if (answered && opt === picked) cls += ' wrong';
          return (
            <button key={opt} className={cls} onClick={() => pick(opt)}>
              <span className="num">{i + 1}</span>{opt}
            </button>
          );
        })}
      </div>
      <button className={`quiz-next${answered ? ' show' : ''}`} onClick={next}>다음 문제 →</button>
    </>
  );
}
