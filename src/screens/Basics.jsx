import { useMemo, useState } from 'react';
import { IconSpeaker, IconChevron, IconArrowLeft } from '../components/Icons.jsx';
import { readingText, speakJapanese } from '../lib/tts.js';
import {
  HIRAGANA_ROWS, KATAKANA_ROWS, DAKUON_ROWS, KATAKANA_DAKUON_ROWS, YOUON, NUMBERS, GREETINGS,
} from '../data/kana.js';
import { shuffled } from '../lib/review.js';

const SECTIONS = [
  { id: 'hira', label: '히라가나' },
  { id: 'kata', label: '가타카나' },
  { id: 'num', label: '숫자' },
  { id: 'greet', label: '인사' },
];

export default function Basics({ settings, onToast }) {
  const [section, setSection] = useState('hira');
  const [quizRow, setQuizRow] = useState(null);

  const rows = useMemo(() => {
    if (section === 'hira') return [...HIRAGANA_ROWS, ...DAKUON_ROWS, { id: 'h-youon', label: '요음', chars: YOUON }];
    if (section === 'kata') return [...KATAKANA_ROWS, ...KATAKANA_DAKUON_ROWS];
    return [];
  }, [section]);

  if (quizRow) {
    return <KanaQuiz row={quizRow} settings={settings} onBack={() => setQuizRow(null)} onToast={onToast} />;
  }

  return (
    <>
      <div className="navtitle">
        <small>완전기초</small>
        기초부터 차근차근
      </div>

      <div className="chiprow">
        {SECTIONS.map((s) => (
          <div key={s.id} className={`chip${section === s.id ? ' active' : ''}`} onClick={() => setSection(s.id)}>
            {s.label}
          </div>
        ))}
      </div>

      {(section === 'hira' || section === 'kata') && (
        <div className="stack" style={{ marginTop: 14 }}>
          {rows.map((row) => (
            <div key={row.id} className="card kanarow">
              <div className="kr-head">
                <span className="kr-label">{row.label}</span>
                <button className="kr-quiz" onClick={() => setQuizRow(row)}>퀴즈 <IconChevron /></button>
              </div>
              <div className="kr-chars">
                {row.chars.map((c) => (
                  <button key={c.kana} className="kanacell" onClick={() => speakJapanese(c.kana, settings.speechRate)}>
                    <span className="kc-kana">{c.kana}</span>
                    <span className="kc-ko">{c.ko}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'num' && (
        <div className="stack" style={{ marginTop: 14 }}>
          {NUMBERS.map((n) => (
            <button key={n.kana} className="listrow" onClick={() => speakJapanese(readingText(n.kana, n.jp), settings.speechRate)}>
              <IconSpeaker />
              <span className="lr-jp">{n.jp}</span>
              <span className="lr-kana">{n.kana}</span>
              <span className="lr-ko">{n.ko}</span>
            </button>
          ))}
        </div>
      )}

      {section === 'greet' && (
        <div className="stack" style={{ marginTop: 14 }}>
          {GREETINGS.map((g) => (
            <button key={g.jp} className="card greetcard" onClick={() => speakJapanese(readingText(g.kana, g.jp), settings.speechRate)}>
              <div className="gc-jp">{g.jp}</div>
              <div className="gc-ko">{g.ko}</div>
              {g.note && <div className="gc-note">{g.note}</div>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// 한 행(5자)씩만 묻는다 — 46자 표를 통째로 보여주면 외우지 못하고 넘긴다.
function KanaQuiz({ row, settings, onBack, onToast }) {
  const [queue, setQueue] = useState(() => shuffled(row.chars));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);

  const current = queue[index];
  const options = useMemo(() => {
    if (!current) return [];
    const others = row.chars.filter((c) => c.ko !== current.ko);
    return shuffled([current.ko, ...shuffled(others).slice(0, 3).map((c) => c.ko)]);
  }, [current, row.chars]);

  if (!current) {
    return (
      <div className="finish">
        <div className="fin-badge">🎉</div>
        <h2>{row.label} 완료</h2>
        <p className="fin-lines"><span>{correct} / {queue.length} 정답</span></p>
        <button className="submit-btn" onClick={onBack}>돌아가기</button>
        <button className="ghost-btn" onClick={() => { setQueue(shuffled(row.chars)); setIndex(0); setCorrect(0); setPicked(null); }}>
          다시 풀기
        </button>
      </div>
    );
  }

  const pick = (opt) => {
    if (picked) return;
    setPicked(opt);
    if (opt === current.ko) setCorrect((c) => c + 1);
    speakJapanese(current.kana, settings.speechRate);
    setTimeout(() => { setPicked(null); setIndex((i) => i + 1); }, 800);
  };

  return (
    <>
      <div className="sub-header" style={{ margin: '-16px -18px 14px' }}>
        <button className="sub-back" onClick={onBack}><IconArrowLeft /> 뒤로</button>
        <div className="sub-title">{row.label} 퀴즈</div>
      </div>

      <div className="quiz-progress">{index + 1} / {queue.length}</div>
      <div className="quiz-card">
        <div className="kanji" style={{ fontSize: 64 }}>{current.kana}</div>
        <div className="ask">어떻게 읽을까요?</div>
      </div>
      <div className="quiz-grid">
        {options.map((opt) => {
          let cls = 'quiz-cell';
          if (picked && opt === current.ko) cls += ' correct';
          else if (picked === opt) cls += ' wrong';
          return <button key={opt} className={cls} onClick={() => pick(opt)}>{opt}</button>;
        })}
      </div>
    </>
  );
}
