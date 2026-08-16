import { useEffect, useMemo, useRef } from 'react';
import {
  IconArrowLeft, IconBook, IconCheck, IconSpeaker,
} from '../components/Icons.jsx';
import MicButton from '../components/MicButton.jsx';
import { readingText, speakJapanese, speakSlow } from '../lib/tts.js';

/* 영상 학습 모듈.
 *
 * 분석 결과를 한 장에 쏟아 놓으면 읽기는 해도 배우지는 않는다. 스크롤을 내리는 건
 * 공부가 아니다. 그래서 회독·시험과 같은 모양으로 — 진행 막대가 있고, 한 번에
 * 하나만 보고, 다음으로 넘어가는 — 단계 학습으로 끌고 간다.
 *
 * 순서는 튜터 프롬프트의 순서 그대로다.
 *   난이도 → 핵심 단어 → 문법 → 실제 회화 표현 → 문장 뜯어보기
 *   → 직역 주의 → 오늘의 정리 → 쉐도잉 → 직접 말해 보기
 *
 * 문법·문장·쉐도잉은 항목마다 한 단계씩 쓴다. 세 문장을 한 화면에 늘어놓으면
 * 결국 같은 스크롤이 되고, 소리 내어 따라 할 틈도 안 생긴다. */

export function buildSteps(a) {
  if (!a) return [];
  const steps = [];
  const push = (kind, title, item) => steps.push({ kind, title, item });

  if (a.overview) push('overview', '이 영상은 어떤가요');
  if (a.words?.length) push('words', '핵심 단어');
  (a.grammar || []).forEach((g) => push('grammar', `문법 · ${g.form}`, g));
  if (a.realTalk?.length) push('realTalk', '일본인이 실제로 쓰는 말');
  (a.breakdown || []).forEach((b) => push('breakdown', '문장 뜯어보기', b));
  if (a.literal?.length) push('literal', '직역하면 어색한 것');
  if (a.takeaway) push('takeaway', '이것만은 가져가기');
  (a.shadowing || []).forEach((s) => push('shadowing', '따라 말하기', s));
  if (a.question?.jp) push('question', '직접 말해 보기');
  return steps;
}

export default function VideoLesson({
  analysis, title, step, settings, findKnown, onKeep, onKeepAll, onStudyWords,
  onStep, onQuit, onDone, onToast,
}) {
  const steps = useMemo(() => buildSteps(analysis), [analysis]);
  const total = steps.length;
  const at = Math.min(step, total - 1);
  const cur = steps[at];
  const bodyRef = useRef(null);

  const say = (t) => speakJapanese(t, settings.speechRate);

  /* 단계를 넘길 때마다 위에서부터 보게 한다 — 안 그러면 이전 단계에서 내려둔
   * 자리에 그대로 남아, 새 단계의 첫 줄을 놓친다. */
  useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }); window.scrollTo({ top: 0 }); }, [at]);

  if (!cur) return null;

  const pct = Math.round((at / total) * 100);
  const last = at === total - 1;

  return (
    <>
      <div className="vl-head">
        <div className="qh-row">
          <button className="sh-close" onClick={onQuit} aria-label="학습 그만두기"><IconArrowLeft /></button>
          <div className="sh-title">{at + 1} / {total}</div>
          <div className="qh-score vl-kind">{cur.title}</div>
        </div>
        <div className="sh-bar"><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="vl-body" ref={bodyRef}>
        <div className="vl-vid">{title}</div>

        {cur.kind === 'overview' && (
          <div className="card vd-sec">
            <h3 className="vd-h">이 영상은 어떤가요</h3>
            <div className="vd-badges">
              {analysis.overview.jlpt && <span className="vd-badge">{analysis.overview.jlpt}</span>}
            </div>
            {analysis.overview.speed && <p className="vd-p">{analysis.overview.speed}</p>}
            {analysis.overview.worth && <p className="vd-p">{analysis.overview.worth}</p>}
            {analysis.overview.points?.length > 0 && (
              <>
                <p className="vd-sub" style={{ marginTop: 12 }}>이 영상에서 가져갈 것</p>
                <ul className="vd-ul">{analysis.overview.points.map((p) => <li key={p}>{p}</li>)}</ul>
              </>
            )}
          </div>
        )}

        {cur.kind === 'words' && (
          <div className="card vd-sec">
            <h3 className="vd-h">핵심 단어</h3>
            <p className="vd-sub">누르면 읽어 줘요. 담기를 누르면 원래 쓰던 단어장으로 들어갑니다.</p>
            {analysis.words.map((w) => {
              const found = findKnown(w);
              return (
                <div key={w.jp + w.yomi} className="vd-word">
                  <button className="vd-wordmain" onClick={() => say(readingText(w.yomi, w.jp))}>
                    <span className="vd-jp">{w.jp}</span>
                    <span className="vd-yomi">{w.yomi}</span>
                    <span className="vd-ko">{w.ko}</span>
                    {w.point && <span className="vd-point">{w.point}</span>}
                  </button>
                  {found ? (
                    <span className="vd-have">{found.level || 'N5'}에<br />있어요</span>
                  ) : (
                    <button className="vd-keep" onClick={() => onKeep(w)}>담기</button>
                  )}
                </div>
              );
            })}
            <div className="vd-wordacts">
              <button className="vd-keepall" onClick={onKeepAll}>전부 담기</button>
              <button className="vd-study" onClick={onStudyWords}><IconBook /> 이 단어로 회독하기</button>
            </div>
          </div>
        )}

        {cur.kind === 'grammar' && (
          <div className="card vd-sec">
            <h3 className="vd-h">{cur.item.form}</h3>
            <p className="vd-sub">{cur.item.meaning}</p>
            {cur.item.howTo && <p className="vd-p">{cur.item.howTo}</p>}
            {cur.item.forms?.length > 0 && (
              <ul className="vd-ul">{cur.item.forms.map((f) => <li key={f}>{f}</li>)}</ul>
            )}
            {cur.item.fromVideo?.jp && (
              <>
                <p className="vd-sub" style={{ marginTop: 12 }}>영상에서는 이렇게 나왔어요</p>
                <div className="vd-quote">
                  <button className="vd-line" onClick={() => say(cur.item.fromVideo.jp)}>
                    <IconSpeaker /> {cur.item.fromVideo.jp}
                  </button>
                  <div className="vd-ko">{cur.item.fromVideo.ko}</div>
                </div>
              </>
            )}
            {cur.item.examples?.length > 0 && (
              <>
                <p className="vd-sub" style={{ marginTop: 12 }}>이렇게도 씁니다</p>
                {cur.item.examples.map((ex) => (
                  <div key={ex.jp} className="vd-ex">
                    <button className="vd-line" onClick={() => say(ex.jp)}><IconSpeaker /> {ex.jp}</button>
                    <div className="vd-ko">{ex.ko}</div>
                  </div>
                ))}
              </>
            )}
            {cur.item.mistake && <p className="vd-warn">⚠ {cur.item.mistake}</p>}
          </div>
        )}

        {cur.kind === 'realTalk' && (
          <div className="card vd-sec">
            <h3 className="vd-h">일본인이 실제로 쓰는 말</h3>
            <p className="vd-sub">교과서에서 덜 다루지만 회화에서는 자주 나와요</p>
            {analysis.realTalk.map((r) => (
              <div key={r.expr} className="vd-real">
                <div className="vd-realhead">{r.expr}</div>
                <p className="vd-p">{r.meaning}{r.origin ? ` (원래 형태: ${r.origin})` : ''}</p>
                {r.when && <p className="vd-p">{r.when}</p>}
                {r.vsTextbook && <p className="vd-p vd-dim">{r.vsTextbook}</p>}
                {r.examples?.map((ex) => (
                  <div key={ex.jp} className="vd-ex">
                    <button className="vd-line" onClick={() => say(ex.jp)}><IconSpeaker /> {ex.jp}</button>
                    <div className="vd-ko">{ex.ko}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {cur.kind === 'breakdown' && (
          <div className="card vd-sec">
            <h3 className="vd-h">문장 뜯어보기</h3>
            <p className="vd-sub">왜 이 조사와 활용이 쓰였는지까지 봅니다</p>
            <div className="vd-break">
              <button className="vd-line" onClick={() => say(cur.item.sentence)}>
                <IconSpeaker /> {cur.item.sentence}
              </button>
              <div className="vd-parts">
                {cur.item.parts?.map((p) => (
                  <div key={p.token} className="vd-part"><b>{p.token}</b> {p.note}</div>
                ))}
              </div>
              {cur.item.natural && <div className="vd-ko">→ {cur.item.natural}</div>}
              {cur.item.why && <p className="vd-p vd-dim">{cur.item.why}</p>}
            </div>
          </div>
        )}

        {cur.kind === 'literal' && (
          <div className="card vd-sec">
            <h3 className="vd-h">직역하면 어색한 것</h3>
            <p className="vd-sub">틀린 게 아니라 뉘앙스가 다릅니다</p>
            {analysis.literal.map((l) => (
              <div key={l.natural} className="vd-lit">
                <div className="vd-litko">{l.koStyle}</div>
                <div className="vd-litjp">→ {l.natural}</div>
                {l.note && <p className="vd-p vd-dim">{l.note}</p>}
              </div>
            ))}
          </div>
        )}

        {cur.kind === 'takeaway' && (
          <div className="card vd-sec">
            <h3 className="vd-h">이것만은 가져가기</h3>
            <p className="vd-sub">전부 외우려 하지 말고 이것만</p>
            {analysis.takeaway.grammar?.map((g) => (
              <div key={g.expr} className="vd-take">
                <b>{g.expr}</b> — {g.meaning}
                {g.example && (
                  <button className="vd-line" onClick={() => say(g.example)}><IconSpeaker /> {g.example}</button>
                )}
              </div>
            ))}
            {analysis.takeaway.words?.map((w) => (
              <div key={w.jp} className="vd-take">
                <b>{w.jp}</b> — {w.ko} <span className="vd-dim">{w.usage}</span>
              </div>
            ))}
          </div>
        )}

        {cur.kind === 'shadowing' && (
          <div className="card vd-sec">
            <h3 className="vd-h">따라 말하기</h3>
            <p className="vd-sub">듣고, 소리 내어 말해 보세요. 눈으로 읽는 것과 다릅니다.</p>
            <div className="vd-shadow vl-shadow">
              <div className="vd-jp">{cur.item.jp}</div>
              <div className="vd-yomi">{cur.item.yomi}</div>
              <div className="vd-ko">{cur.item.ko}</div>
              {cur.item.point && <div className="vd-point">{cur.item.point}</div>}
              <div className="vd-shadowbtns">
                <button onClick={() => say(readingText(cur.item.yomi, cur.item.jp))}><IconSpeaker /> 듣기</button>
                <button onClick={() => speakSlow(readingText(cur.item.yomi, cur.item.jp))}>천천히</button>
                <MicButton
                  expected={[cur.item.jp, cur.item.yomi].filter(Boolean)}
                  hints={[cur.item.jp, cur.item.yomi].filter(Boolean)}
                  target={cur.item.jp}
                  onToast={onToast}
                  label="따라 말하기"
                />
              </div>
            </div>
          </div>
        )}

        {cur.kind === 'question' && (
          <div className="card vd-sec">
            <h3 className="vd-h">직접 말해 보기</h3>
            {analysis.question.target && <p className="vd-sub">목표 표현: {analysis.question.target}</p>}
            <button className="vd-line vd-q" onClick={() => say(analysis.question.jp)}>
              <IconSpeaker /> {analysis.question.jp}
            </button>
            <div className="vd-ko">{analysis.question.ko}</div>
            <div className="vd-shadowbtns" style={{ marginTop: 12 }}>
              <MicButton
                expected={[]}
                hints={[analysis.question.target].filter(Boolean)}
                onToast={onToast}
                label="일본어로 답하기"
              />
            </div>
            <p className="vd-note" style={{ marginTop: 12 }}>
              답을 소리 내어 말한 뒤, 목표 표현이 실제로 입에서 나왔는지 확인해 보세요.
            </p>
          </div>
        )}
      </div>

      <div className="vl-nav">
        {at > 0 && (
          <button className="ghost-btn vl-prev" onClick={() => onStep(at - 1)}>이전</button>
        )}
        <button className="submit-btn vl-next" onClick={() => (last ? onDone() : onStep(at + 1))}>
          {last ? <><IconCheck /> 학습 마치기</> : '다음'}
        </button>
      </div>
    </>
  );
}
