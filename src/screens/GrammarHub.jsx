import { useState } from 'react';
import Grammar from './Grammar.jsx';
import Sentence from './Sentence.jsx';
import DailyGrammar from './DailyGrammar.jsx';

/* 문법 — 세 갈래를 한 지붕 아래.
 *
 * 「기초문법」 하나만 메뉴에 있었다. 그 안에 문법 카드와 문형 연습이 있었는데,
 * 이름이 「기초문법」이니 그 안에 뭐가 더 있을 거라고 아무도 생각하지 않았다.
 * 이름은 안에 든 것을 다 덮어야 한다.
 *
 * 그래서 「문법」으로 열고 셋으로 가른다. 셋이 서로 다른 일을 한다.
 *
 *   기초문법 — 규칙을 본다. て형은 이렇게 만든다
 *   일상문법 — 자리에 넣어 본다. 乗る는 に를 받는다
 *   문형 연습 — 내가 외운 단어를 문형에 끼워 넣는다
 *
 * 「규칙을 아는 것」과 「자리에 넣는 것」은 다른 일이다. 앞엣것만 있어서
 * 「電車を乗ります」라고 쓰는 사람이 규칙표를 다시 읽고 있었다. */

const TABS = [
  { id: 'cards', label: '기초문법', sub: '규칙을 본다' },
  { id: 'daily', label: '일상문법', sub: '자리에 넣어 본다' },
  { id: 'pattern', label: '문형 연습', sub: '외운 단어로 만들어 본다' },
];

export default function GrammarHub({
  words, progress, settings, onProgress, onPatternDone, onDailyGrammar, onToast,
}) {
  const [tab, setTab] = useState('cards');

  return (
    <>
      <div className="segment gm-tabs" style={{ marginBottom: 6 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            data-tab={t.id}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </div>
      {/* 셋이 뭐가 다른지 한 줄로 적는다. 이름만 있으면 어느 걸 눌러야 할지
          매번 셋 다 들어가 보게 된다. */}
      <p className="set-note gm-note">{TABS.find((t) => t.id === tab)?.sub}</p>

      {tab === 'cards' && <Grammar words={words} progress={progress} onProgress={onProgress} />}
      {tab === 'daily' && (
        <DailyGrammar
          progress={progress}
          settings={settings}
          onProgress={onDailyGrammar}
          onToast={onToast}
        />
      )}
      {tab === 'pattern' && (
        <Sentence words={words} progress={progress} onPatternDone={onPatternDone} />
      )}
    </>
  );
}
