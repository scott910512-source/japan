import { useMemo, useState } from 'react';
import { IconArrowLeft } from '../../components/Icons.jsx';
import { kanjiByChar } from '../../data/n3/kanji.js';
import { stateOf } from '../../lib/review.js';
import { kanjiQuestions, masteryOf, MASTERY_LABEL } from '../../lib/n3.js';
import QuizRunner from './QuizRunner.jsx';
import JpSpeak from './JpSpeak.jsx';

/* 한자 카드 — 신자체 · 한국 한자(정자체)와 훈음 · 모양 차이 · 음독/훈독 · 부수 · 구성 ·
   뜻 · 관련 단어 🔊. 유래(ety)와 연상(memo)은 따로 표시한다 — 섞어 두면 연상을 사실로 외운다. */
export function KanjiCard({ k, rate, review }) {
  const st = review ? stateOf(review, k.id) : null;
  const m = st ? masteryOf(st) : null;
  const realEty = k.memo && /실제 유래/.test(k.memo);
  return (
    <div className="card n3-kanji" data-kanji={k.k}>
      <div className="n3-ktop">
        <b className="n3-kchar" lang="ja">{k.k}</b>
        <div className="n3-kread">
          <span><small>음독</small> {k.on}</span>
          <span><small>훈독</small> {k.kun || '—'}</span>
          <span className="n3-kmean">{k.mean}</span>
          {m && <i className={`n3-mast ${m}`}>{MASTERY_LABEL[m]}</i>}
        </div>
      </div>
      <div className="n3-khanja">
        <span className="n3-khj" lang="ko">{k.ko || k.k}</span>
        <span className="n3-khk">한국 한자 <b>{k.kh}</b>{k.ko && k.ko !== k.k && <em> · 정자체 {k.ko} → 신자체 {k.k}</em>}</span>
      </div>
      {k.diff && <div className="n3-kdiff">모양 차이: {k.diff}</div>}
      <div className="n3-kparts"><span>부수 {k.rad}</span><span>구성 {k.parts}</span></div>
      <div className="n3-kwords">
        {k.words.map(([jp, kana, ko], i) => (
          <div key={i} className="n3-kword">
            <b lang="ja">{jp}</b><span>{kana}</span><em>{ko}</em>
            <JpSpeak text={kana} rate={rate} id={`kw:${k.k}:${i}`} className="n3-spk-sm" />
          </div>
        ))}
      </div>
      {k.memo && (
        <div className={`n3-kmemo${realEty ? ' ety' : ''}`}>
          <b>{realEty ? '유래' : '연상(학습용)'}</b> {k.memo.replace(/\(실제 유래\)\.?/, '')}
        </div>
      )}
    </div>
  );
}

export default function KanjiLesson({ title, kanjiIds, rate, review, onAnswer, onFinish, onQuit }) {
  const kanji = useMemo(() => kanjiIds.map((id) => kanjiByChar(id.slice(2))).filter(Boolean), [kanjiIds]);
  const [phase, setPhase] = useState('cards');
  const questions = useMemo(() => (phase === 'quiz' ? kanjiQuestions(kanji.map((k) => k.id)) : []), [phase, kanji]);
  return (
    <div className="n3-lesson n3-kanjilesson" data-phase={phase}>
      <div className="sub-header inline">
        <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 나가기</button>
        <div className="sub-title">{title} · {kanji.length}자</div>
      </div>
      {phase === 'cards' && (
        <>
          <div className="stack">{kanji.map((k) => <KanjiCard key={k.k} k={k} rate={rate} review={review} />)}</div>
          <button className="submit-btn n3-toquiz" style={{ marginTop: 14 }} onClick={() => setPhase('quiz')}>문제 풀기</button>
          <p className="set-note">한국 한자음을 아는 한자는 음독이 비슷할 때가 많아요(경→けい, 감→かん). 연상은 학습용이고 유래가 아니에요.</p>
        </>
      )}
      {phase === 'quiz' && <QuizRunner questions={questions} rate={rate} onAnswer={onAnswer} onDone={(r) => onFinish?.(r)} />}
    </div>
  );
}
