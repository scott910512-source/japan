import { lazy, Suspense, useState } from 'react';
import { GRAMMAR_USE, statusOf, modeOf } from '../lib/grammarUse.js';
import { todayKey } from '../lib/review.js';

const GrammarUse = lazy(() => import('./GrammarUse.jsx'));
import Grammar from './Grammar.jsx';
import GrammarMap from '../components/GrammarMap.jsx';
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
  { id: 'use', label: '활용', sub: '외운 단어로 만든 문장에서 문법을 확인한다(오늘의 퀘스트와 같은 화면)' },
];

export default function GrammarHub({
  words, progress, settings, onProgress, onPatternDone, onDailyGrammar, onToast, onAttempt,
  review = {}, onGrammarRecord, onWordForgot, onSettingsChange = null,
}) {
  const [tab, setTab] = useState('cards');
  const [useGid, setUseGid] = useState(undefined);   // undefined = 목록, null = 오늘 세트, 문자열 = 그 문법

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

      {tab === 'cards' && <Grammar words={words} progress={progress} onProgress={onProgress} onAttempt={onAttempt} />}
      {tab === 'daily' && (
        <DailyGrammar
          progress={progress}
          settings={settings}
          onProgress={onDailyGrammar}
          onToast={onToast}
        />
      )}
      {tab === 'use' && (useGid === undefined ? (
        <UseList gu={progress?.grammarUse} onPick={setUseGid} />
      ) : (
        <Suspense fallback={<p className="set-note">불러오는 중…</p>}>
          <button className="ghost-btn gu-back" onClick={() => setUseGid(undefined)}>← 문법 목록</button>
          <GrammarUse key={useGid || 'today'} embedded words={words} review={review} progress={progress} gid={useGid} settings={settings}
            onRecord={onGrammarRecord} onAttempt={onAttempt} onWordForgot={onWordForgot} onToast={onToast} onSettingsChange={onSettingsChange} onExit={() => setUseGid(undefined)} />
        </Suspense>
      ))}
      {tab === 'pattern' && (
        <Sentence words={words} progress={progress} onPatternDone={onPatternDone} />
      )}

      {/* 규칙을 익힌 뒤 굴려 보는 연습 — 동사 활용 */}
    </>
  );
}

/* 활용 탭의 목록 — 24개 문법과 지금 상태(확인한 날 · 약점 · 안 봄). 누르면 그 문법 세트 */
function UseList({ gu, onPick }) {
  const today = todayKey();
  const mode = modeOf(gu);
  return (
    <div className="gu-list">
      <button className="submit-btn gu-today" onClick={() => onPick(null)}>
        {mode === 'place' ? '초기 진단 시작' : mode === 'explore' ? '오늘의 탐색 테스트' : '오늘의 문법 확인'}
      </button>
      <GrammarMap gu={gu} cardsTabs={false} onPick={onPick} />
      {GRAMMAR_USE.map((g) => {
        const st = statusOf(gu, g.id, today);
        const tag = st.weak ? '복습 대상' : st.level > 0 ? `확인 ${st.level}일` : st.place === 1 ? '진단 맞음' : st.place === 0 ? '진단 틀림' : '안 봄';
        return (
          <button key={g.id} className={`rowcard gu-row${st.weak ? ' weak' : st.level > 0 ? ' ok' : ''}`} data-gid={g.id} onClick={() => onPick(g.id)}>
            <span className="rc-body"><b>{g.title}</b><span>{g.level} · {tag}</span></span>
          </button>
        );
      })}
    </div>
  );
}
