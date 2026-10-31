import { useMemo, useState } from 'react';
import { IconArrowLeft } from '../../components/Icons.jsx';
import { kanjiByChar } from '../../data/n3/kanji.js';
import { stateOf } from '../../lib/review.js';
import { kanjiConfirmQuestions, kanjiComponents, masteryOf, MASTERY_LABEL } from '../../lib/n3.js';
import QuizRunner from './QuizRunner.jsx';
import JpSpeak from './JpSpeak.jsx';

/* 구성 요소 칩에 붙일 이름 — 부수면 부수 이름(亻 → 사람인변), 이 코스의 한자면 훈음.
   둘 다 아니면 이름을 안 붙인다(모르는 것을 지어내지 않는다). */
function compLabel(c, k) {
  const m = /^(.)\((.+)\)$/.exec(k.rad || '');
  if (m && m[1] === c) return m[2];
  const o = kanjiByChar(c);
  return o && o.k !== k.k ? o.kh : null;
}

/* 한자 카드 — 여섯 칸이 늘 이 순서다.
 *   ① 표기 · 읽기 · 뜻 · 한국 한자음   ② 모양과 구성(뼈대 한자)   ③ 유래
 *   ④ 연상(학습용)                      ⑤ 단어와 예문                ⑥ 확인 문제(레슨 아래 버튼)
 *
 * ★ 유래와 연상은 다른 칸이다 ★ 유래(ety)는 자료로 알려진 것만, 연상(memo)은 외우기
 * 쉽게 지은 이야기다. 섞어 두면 연상을 사실로 외운다. 유래를 모르면 모른다고 적는다 —
 * 그럴듯하게 만들어 채우지 않는다. 구조 설명(st)은 유래가 아니라 「이 글자가 어떤 조각으로
 * 이루어졌나」를 풀어 쓴 것이다. */
export function KanjiCard({ k, rate, review }) {
  const st = review ? stateOf(review, k.id) : null;
  const m = st ? masteryOf(st) : null;
  const comps = kanjiComponents(k);
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

      <div className="n3-ksec" data-sec="shape">
        <i className="n3-kh">모양과 구성</i>
        <div className="n3-kparts"><span>부수 {k.rad}</span></div>
        <div className="n3-kpieces">
          {comps.map((c, i) => {
            const label = compLabel(c, k);
            return (
              <span key={`${c}${i}`} className="n3-kpiece">
                {i > 0 && <em className="n3-kplus" aria-hidden="true">+</em>}
                <b lang="ja">{c}</b>{label && <small>{label}</small>}
              </span>
            );
          })}
        </div>
        {k.st && <div className="n3-kst">{k.st}</div>}
      </div>

      <div className="n3-ksec" data-sec="origin">
        <i className="n3-kh">유래</i>
        {k.ety
          ? <div className="n3-kmemo ety">{k.ety}</div>
          : <div className="n3-knoety">자료로 확인된 유래가 없어서 적지 않았어요.{k.st ? ' 위 구조 설명으로 외워요.' : ''}</div>}
      </div>

      {k.memo && (
        <div className="n3-ksec" data-sec="memo">
          <i className="n3-kh">연상</i>
          <div className="n3-kmemo"><b>연상(학습용)</b> {k.memo}</div>
        </div>
      )}

      <div className="n3-ksec" data-sec="words">
        <i className="n3-kh">단어와 예문</i>
        <div className="n3-kwords">
          {k.words.map(([jp, kana, ko], i) => (
            <div key={i} className="n3-kword">
              <b lang="ja">{jp}</b><span>{kana}</span><em>{ko}</em>
              <JpSpeak text={kana} rate={rate} id={`kw:${k.k}:${i}`} className="n3-spk-sm" />
            </div>
          ))}
        </div>
        {(k.ex || []).map(([jp, kana, ko], i) => (
          <div key={i} className="n3-kex">
            <span className="n3-kexjp" lang="ja">{jp}</span>
            <small>{kana}</small>
            <em>{ko}</em>
            <JpSpeak text={kana} rate={rate} id={`ke:${k.k}:${i}`} className="n3-spk-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KanjiLesson({ title, kanjiIds, rate, review, onAnswer, onFinish, onQuit }) {
  const kanji = useMemo(() => kanjiIds.map((id) => kanjiByChar(id.slice(2))).filter(Boolean), [kanjiIds]);
  const [phase, setPhase] = useState('cards');
  const questions = useMemo(() => (phase === 'quiz' ? kanjiConfirmQuestions(kanji.map((k) => k.id)) : []), [phase, kanji]);
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
          <p className="set-note">한국 한자음을 아는 한자는 음독이 비슷할 때가 많아요(경→けい, 감→かん). 연상은 학습용이고 유래가 아니에요. 문제는 읽기, 뜻, 모양을 돌아가며 나와요.</p>
        </>
      )}
      {phase === 'quiz' && <QuizRunner questions={questions} rate={rate} onAnswer={onAnswer} onDone={(r) => onFinish?.(r)} />}
    </div>
  );
}
