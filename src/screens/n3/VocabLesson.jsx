import { useMemo, useState } from 'react';
import { IconArrowLeft, IconRepeat } from '../../components/Icons.jsx';
import { extraOf, vocabWordById } from '../../data/n3/vocab.js';
import { kanjiIn } from '../../data/n3/kanji.js';
import { stateOf } from '../../lib/review.js';
import { masteryOf, MASTERY_LABEL, vocabQuestions } from '../../lib/n3.js';
import QuizRunner from './QuizRunner.jsx';
import JpSpeak from './JpSpeak.jsx';

const TYPE_KO = { noun: '명사', verb: '동사', adj: '형용사', 'i-adj': 'い형용사', 'na-adj': 'な형용사', adv: '부사', expr: '표현', particle: '조사', counter: '조수사', other: '기타' };

/* 단어 카드 — 表現 · 읽기 · 뜻 · 품사 · 예문 · 비슷한/반대 표현 · 관련 한자 · 🔊 */
export function WordCard({ w, rate, review, onKanji }) {
  const ex = extraOf(w);
  const ks = kanjiIn(w.kanji);
  const st = review ? stateOf(review, w.id) : null;
  const m = st ? masteryOf(st) : null;
  return (
    <div className="card n3-word" data-word={w.id}>
      <div className="n3-wtop">
        <div className="n3-wmain">
          <b className="n3-wkanji" lang="ja">{w.kanji}</b>
          {w.kana !== w.kanji && <span className="n3-wkana">{w.kana}</span>}
        </div>
        <JpSpeak text={w.kana} rate={rate} id={`w:${w.id}`} />
      </div>
      <div className="n3-wmean">{w.mean}{w.type && <em> · {TYPE_KO[w.type] || w.type}{w.group ? ` ${w.group}그룹` : ''}</em>}{m && <i className={`n3-mast ${m}`}>{MASTERY_LABEL[m]}</i>}</div>
      {w.example && (
        <div className="n3-wex">
          <span lang="ja">{w.example}</span>
          {w.exampleKana && <small>{w.exampleKana}</small>}
          {w.exampleKo && <small className="ko">{w.exampleKo}</small>}
          <JpSpeak text={w.exampleKana || w.example} rate={rate} id={`wx:${w.id}`} className="n3-spk-sm" />
        </div>
      )}
      {(ex?.syn || ex?.ant || ks.length > 0) && (
        <div className="n3-wextra">
          {ex?.syn && <span><b>비슷한</b> {ex.syn.join(' · ')}</span>}
          {ex?.ant && <span><b>반대</b> {ex.ant.join(' · ')}</span>}
          {ks.length > 0 && (
            <span><b>관련 한자</b> {ks.map((k) => (
              <button key={k.k} className="n3-kchip" onClick={() => onKanji?.(k)} type="button">{k.k} <small>{k.kh}</small></button>
            ))}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* 어휘 레슨 — 카드로 익히고(학습) → 문제(문제풀이) → 판정이 회독 기록으로. */
export default function VocabLesson({ title, wordIds, rate, review, onAnswer, onFinish, onQuit, onStartSet, onKanji }) {
  const words = useMemo(() => wordIds.map(vocabWordById).filter(Boolean), [wordIds]);
  const [phase, setPhase] = useState('cards');
  const questions = useMemo(() => (phase === 'quiz' ? vocabQuestions(words.map((w) => w.id)) : []), [phase, words]);

  return (
    <div className="n3-lesson n3-vocab" data-phase={phase}>
      <div className="sub-header inline">
        <button className="sub-back" onClick={onQuit}><IconArrowLeft /> 나가기</button>
        <div className="sub-title">{title} · {words.length}단어</div>
      </div>
      {phase === 'cards' && (
        <>
          <div className="stack">
            {words.map((w) => <WordCard key={w.id} w={w} rate={rate} review={review} onKanji={onKanji} />)}
          </div>
          <div className="btnrow" style={{ marginTop: 14 }}>
            {onStartSet && (
              <button className="ghost-btn" onClick={() => onStartSet(words, title, `n3v-${wordIds.length}`)}><IconRepeat /> 회독으로 더 외우기</button>
            )}
            <button className="submit-btn n3-toquiz" onClick={() => setPhase('quiz')}>문제 풀기</button>
          </div>
          <p className="set-note">카드를 본 것만으로는 숙련도가 안 올라요. 문제를 맞혀야 회독 기록에 「알아요」로 적히고 복습일이 잡혀요.</p>
        </>
      )}
      {phase === 'quiz' && (
        <QuizRunner questions={questions} rate={rate} onAnswer={onAnswer} onDone={(r) => onFinish?.(r)} doneLabel="완료" />
      )}
    </div>
  );
}
