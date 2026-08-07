import { useState } from 'react';
import Grammar from './Grammar.jsx';
import Sentence from './Sentence.jsx';

// 기초문법 = 문법 카드 + 문형 연습(암기한 단어를 문형에 끼워 넣어보기).
// 문형 연습은 상황별 문장암기와 성격이 달라 문법 쪽에 둔다.
export default function GrammarHub({ words, progress, onProgress, onPatternDone }) {
  const [tab, setTab] = useState('cards');

  return (
    <>
      <div className="segment" style={{ marginBottom: 16 }}>
        <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>문법 카드</button>
        <button className={tab === 'pattern' ? 'active' : ''} onClick={() => setTab('pattern')}>문형 연습</button>
      </div>

      {tab === 'cards'
        ? <Grammar words={words} progress={progress} onProgress={onProgress} />
        : <Sentence words={words} progress={progress} onPatternDone={onPatternDone} />}
    </>
  );
}
