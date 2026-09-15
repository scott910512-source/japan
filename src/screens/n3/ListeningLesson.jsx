import { useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconSpeaker, IconMic } from '../../components/Icons.jsx';
import { listeningById, LISTENING_QUESTIONS } from '../../data/n3/listening.js';
import { speakJapaneseAsync, stopSpeaking } from '../../lib/tts.js';
import QuizRunner from './QuizRunner.jsx';
import JpSpeak from './JpSpeak.jsx';

/* 청해 — 듣기 → 문제 → 다시 듣기 → 스크립트 → 문장 분석 → 섀도잉.
 * 스크립트는 답을 고르기 전에는 보이지 않는다. 속도 0.75 / 1.0 / 1.25.
 * 대화는 줄 단위로 이어 읽는다 — 끝나는 것을 기다려야 두 줄이 겹치지 않는다. */
const SPEEDS = [0.75, 1.0, 1.25];
const STEPS = ['듣기', '문제', '다시', '스크립트', '분석', '섀도잉'];

export default function ListeningLesson({ itemId, rate: baseRate, onAnswer, onFinish, onQuit, exam = false }) {
  const it = listeningById(itemId);
  const [speed, setSpeed] = useState(1.0);
  const [step, setStep] = useState(0);
  const [played, setPlayed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [result, setResult] = useState(null);
  const alive = useRef(true);
  const gen = useRef(0);

  useEffect(() => () => { alive.current = false; stopSpeaking(); }, []);
  if (!it) return null;

  const rate = Math.round(speed * (baseRate || 0.9) * 100) / 100;
  const question = LISTENING_QUESTIONS.find((q) => q.ref === it.id);

  const playAll = async () => {
    const my = ++gen.current;
    setPlaying(true);
    for (let i = 0; i < it.script.length; i += 1) {
      if (!alive.current || my !== gen.current) return;
      setLine(i);
      // eslint-disable-next-line no-await-in-loop
      const how = await speakJapaneseAsync(it.script[i].kana, rate, { id: `ls:${it.id}:${i}` });
      if (how === 'interrupted' && my !== gen.current) return;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 350); });
    }
    if (alive.current && my === gen.current) { setPlaying(false); setLine(-1); setPlayed((n) => n + 1); }
  };
  const stop = () => { gen.current += 1; stopSpeaking(); setPlaying(false); setLine(-1); };

  const Player = ({ label }) => (
    <div className="card n3-player">
      <div className="n3-speeds">
        {SPEEDS.map((s) => <button key={s} className={`chip${speed === s ? ' active' : ''}`} data-speed={s} onClick={() => setSpeed(s)}>{s.toFixed(2).replace(/0$/, '')}x</button>)}
      </div>
      <button className={`n3-playbtn${playing ? ' on' : ''}`} onClick={playing ? stop : playAll} aria-label={playing ? '멈추기' : label}>
        <IconSpeaker />
        <span>{playing ? '재생 중 — 멈추기' : label}</span>
      </button>
      {playing && <div className="n3-playline">{line + 1} / {it.script.length}</div>}
    </div>
  );

  return (
    <div className="n3-lesson n3-listening" data-item={it.id} data-step={step}>
      <div className="sub-header inline">
        <button className="sub-back" onClick={() => { stop(); onQuit(); }}><IconArrowLeft /> 나가기</button>
        <div className="sub-title">L{it.level} · {it.title}</div>
      </div>
      {!exam && (
        <div className="n3-steps">
          {STEPS.map((s, i) => <button key={s} className={`n3-stepdot${i === step ? ' cur' : ''}${i < step ? ' past' : ''}`} disabled={i > step && !result} onClick={() => (i <= step || result) && setStep(i)}>{s}</button>)}
        </div>
      )}

      {step === 0 && (
        <>
          {it.intro && <div className="card n3-intro" lang="ja">{it.intro}</div>}
          <Player label={played ? '한 번 더 듣기' : '듣기 시작'} />
          <p className="set-note">스크립트는 답을 고른 뒤에 열려요. {it.ask ? '먼저 질문을 읽고, 무엇을 들어야 할지 정한 뒤 들으세요.' : '한 번 듣고 바로 문제로 가 보세요.'}</p>
          <button className="submit-btn n3-toq" disabled={!played} onClick={() => { stop(); setStep(1); }}>{played ? '문제 풀기' : '먼저 들어 보세요'}</button>
        </>
      )}

      {step === 1 && question && (
        <QuizRunner
          questions={[{ ...question, type: 'choice' }]}
          rate={rate}
          autoSpeak={false}
          mode={exam ? 'exam' : 'study'}
          hideFinish
          lastLabel="다시 듣기"
          onAnswer={onAnswer}
          onFinish={(r) => { setResult(r); if (exam) onFinish?.(r); else setStep(2); }}
        />
      )}

      {step === 2 && (
        <>
          <div className="card n3-score"><b>{result?.right ? '정답' : '오답'}</b><span>이번엔 답을 알고 다시 들어 보세요 — 어디서 결정됐는지 들려요</span></div>
          <Player label="다시 듣기" />
          <button className="submit-btn" onClick={() => { stop(); setStep(3); }}>스크립트 보기</button>
        </>
      )}

      {step === 3 && (
        <>
          <div className="card n3-script">
            {it.script.map((s, i) => (
              <div key={i} className={`n3-dline ${s.s === 'B' ? 'b' : s.s === 'ナ' ? 'n' : 'a'}${line === i ? ' cur' : ''}`}>
                <span className="n3-dwho">{s.s}</span>
                <span className="n3-dbody"><span className="n3-djp" lang="ja">{s.jp}</span><span className="n3-dko">{s.ko}</span></span>
                <JpSpeak text={s.kana} rate={rate} id={`sl:${it.id}:${i}`} className="n3-spk-sm" />
              </div>
            ))}
          </div>
          <button className="submit-btn" onClick={() => setStep(4)}>문장 분석</button>
        </>
      )}

      {step === 4 && (
        <>
          <div className="stack">
            {it.analysis.map((a, i) => <div key={i} className="card n3-ana"><b lang="ja">{a.jp}</b><span>{a.note}</span></div>)}
            {it.vocab?.length > 0 && (
              <div className="card n3-vlist">{it.vocab.map((v, i) => <div key={i} className="n3-vrow"><b lang="ja">{v.jp}</b><span>{v.kana}</span><em>{v.ko}</em></div>)}</div>
            )}
          </div>
          <button className="submit-btn" style={{ marginTop: 12 }} onClick={() => setStep(5)}>섀도잉</button>
        </>
      )}

      {step === 5 && (
        <>
          <div className="card n3-shadow">
            <p className="n3-shadowhint"><IconMic /> 듣고 나서 바로 따라 말하세요. 세 번씩.</p>
            {(it.shadow || []).map((idx) => {
              const s = it.script[idx];
              if (!s) return null;
              return (
                <div key={idx} className="n3-shline">
                  <span className="n3-djp" lang="ja">{s.jp}</span>
                  <span className="n3-dko">{s.kana}</span>
                  <JpSpeak text={s.kana} rate={rate} id={`sh:${it.id}:${idx}`} />
                </div>
              );
            })}
          </div>
          <button className="submit-btn n3-finish-btn" style={{ marginTop: 12 }} onClick={() => { stop(); onFinish?.(result || { right: 0, total: 1, results: [] }); }}>완료</button>
        </>
      )}
    </div>
  );
}
