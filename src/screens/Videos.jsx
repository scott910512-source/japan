import { useEffect, useMemo, useState } from 'react';
import {
  IconArrowLeft, IconBook, IconChevron, IconPlus, IconSpeaker, IconTrash,
} from '../components/Icons.jsx';
import MicButton from '../components/MicButton.jsx';
import { readingText, speakJapanese, speakSlow } from '../lib/tts.js';
import { analyzeScript, youtubeId } from '../lib/videoTutor.js';
import { SEED_VIDEOS } from '../data/videos.js';
import {
  loadVideoAnalyses, loadVideos, saveVideoAnalyses, saveVideos,
} from '../lib/storage.js';

/* 영상으로 배우기.
 *
 * 영상을 한 번 보고 끝내지 않고 다음 순서로 끌고 간다 —
 * 시청 → 핵심 표현 이해 → 문장 구조 이해 → 소리 내어 쉐도잉 → 직접 문장 만들기.
 * 그래서 화면도 그 순서로 쌓아 두었다.
 *
 * 자막은 저작물이라 저장소에 담지 않는다. 사용자가 붙여넣은 자막과 분석 결과는
 * 그 기기에만 남는다. */

function Section({ title, sub, children }) {
  return (
    <div className="card vd-sec">
      <h3 className="vd-h">{title}</h3>
      {sub && <p className="vd-sub">{sub}</p>}
      {children}
    </div>
  );
}

// 제목은 지어내지 않는다. 유튜브에서 받아오되 못 받으면 주소만 보여 준다.
function useTitles(videos) {
  const [titles, setTitles] = useState({});
  useEffect(() => {
    let alive = true;
    videos.forEach((v) => {
      if (titles[v.id] !== undefined) return;
      fetch(`https://www.youtube.com/oembed?url=https://youtu.be/${v.id}&format=json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!alive) return;
          setTitles((prev) => ({ ...prev, [v.id]: j ? { title: j.title, channel: j.author_name } : null }));
        })
        .catch(() => { if (alive) setTitles((prev) => ({ ...prev, [v.id]: null })); });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);
  return titles;
}

export default function Videos({ settings, onAddWord, onToast }) {
  const [videos, setVideos] = useState(() => {
    const saved = loadVideos();
    return saved.length ? saved : SEED_VIDEOS;
  });
  const [analyses, setAnalyses] = useState(() => loadVideoAnalyses());
  const [openId, setOpenId] = useState(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [script, setScript] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => saveVideos(videos), [videos]);
  useEffect(() => saveVideoAnalyses(analyses), [analyses]);

  const titles = useTitles(videos);
  const open = videos.find((v) => v.id === openId) || null;
  const info = open ? titles[open.id] : null;
  const analysis = open ? analyses[open.id] : null;

  useEffect(() => { setScript(''); }, [openId]);

  const addVideo = () => {
    const id = youtubeId(urlDraft);
    if (!id) { onToast('유튜브 주소를 확인해 주세요'); return; }
    if (videos.some((v) => v.id === id)) { onToast('이미 담아 둔 영상이에요'); setUrlDraft(''); return; }
    setVideos((prev) => [...prev, { id, addedAt: Date.now() }]);
    setUrlDraft('');
  };

  const removeVideo = (id) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    setAnalyses((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (openId === id) setOpenId(null);
  };

  const runAnalysis = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await analyzeScript({
        apiKey: settings.claudeKey,
        model: settings.claudeModel,
        title: info?.title,
        channel: info?.channel,
        script,
      });
      setAnalyses((prev) => ({ ...prev, [open.id]: { ...result, at: Date.now() } }));
      onToast('학습자료를 만들었어요');
    } catch (err) {
      onToast(err.message || '분석에 실패했어요');
    } finally {
      setBusy(false);
    }
  };

  const say = (text) => speakJapanese(text, settings.speechRate);

  /* ── 목록 ── */
  if (!open) {
    return (
      <>
        <div className="navtitle"><small>영상으로 배우기</small>보고 듣고 따라 말하기</div>
        <p className="vd-note">
          영상을 보고 자막을 붙여넣으면, 지금 수준에서 쓸 값이 있는 표현만 골라
          학습자료로 만들어 줘요.
        </p>

        <div className="vd-add">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addVideo()}
            placeholder="유튜브 주소 붙여넣기"
            inputMode="url"
          />
          <button className="vd-addbtn" onClick={addVideo} aria-label="영상 담기"><IconPlus /></button>
        </div>

        <div className="stack" style={{ marginTop: 14 }}>
          {videos.map((v) => {
            const t = titles[v.id];
            const done = Boolean(analyses[v.id]);
            return (
              <div key={v.id} className="card vd-item">
                <button className="vd-open" onClick={() => setOpenId(v.id)}>
                  <img className="vd-thumb" src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />
                  <div className="vd-body">
                    <div className="vd-title">{t?.title || `youtu.be/${v.id}`}</div>
                    <div className="vd-meta">
                      {t?.channel ? `${t.channel} · ` : ''}
                      {done ? '학습자료 있음' : '자막 붙여넣기 전'}
                    </div>
                  </div>
                  <IconChevron className="chev" />
                </button>
                <button className="vd-del" onClick={() => removeVideo(v.id)} aria-label="영상 빼기"><IconTrash /></button>
              </div>
            );
          })}
          {videos.length === 0 && <div className="empty-state">담아 둔 영상이 없어요</div>}
        </div>
      </>
    );
  }

  /* ── 영상 상세 ── */
  return (
    <>
      <button className="inner-back" onClick={() => setOpenId(null)}>
        <IconArrowLeft /> 영상 목록
      </button>
      <div className="navtitle">
        <small>{info?.channel || '영상으로 배우기'}</small>
        {info?.title || `youtu.be/${open.id}`}
      </div>

      <div className="vd-player">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${open.id}`}
          title="영상"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>

      {!analysis && (
        <Section title="자막 붙여넣기" sub="영상의 일본어 자막을 그대로 붙여넣으세요. 한국어 번역이 없어도 됩니다.">
          <textarea
            className="vd-script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={'[00:00]\nこんにちは。今日は…'}
            rows={7}
          />
          <button className="vd-run" disabled={busy || !script.trim()} onClick={runAnalysis}>
            {busy ? '읽는 중…' : '학습자료 만들기'}
          </button>
          {!settings.claudeKey && (
            <p className="vd-note" style={{ marginTop: 10 }}>
              설정 → 영상 학습에서 Claude API 키를 넣으면 자막을 분석해 줘요.
              키는 이 기기에만 저장됩니다.
            </p>
          )}
        </Section>
      )}

      {analysis && (
        <>
          {analysis.overview && (
            <Section title="이 영상은 어떤가요">
              <div className="vd-badges">
                {analysis.overview.jlpt && <span className="vd-badge">{analysis.overview.jlpt}</span>}
              </div>
              {analysis.overview.speed && <p className="vd-p">{analysis.overview.speed}</p>}
              {analysis.overview.worth && <p className="vd-p">{analysis.overview.worth}</p>}
              {analysis.overview.points?.length > 0 && (
                <ul className="vd-ul">
                  {analysis.overview.points.map((p) => <li key={p}>{p}</li>)}
                </ul>
              )}
            </Section>
          )}

          {analysis.words?.length > 0 && (
            <Section title="핵심 단어" sub="누르면 읽어 줘요. 담기를 누르면 회독에 들어갑니다.">
              {analysis.words.map((w) => (
                <div key={w.jp + w.yomi} className="vd-word">
                  <button className="vd-wordmain" onClick={() => say(readingText(w.yomi, w.jp))}>
                    <span className="vd-jp">{w.jp}</span>
                    <span className="vd-yomi">{w.yomi}</span>
                    <span className="vd-ko">{w.ko}</span>
                    {w.point && <span className="vd-point">{w.point}</span>}
                  </button>
                  <button
                    className="vd-keep"
                    onClick={() => {
                      onAddWord({
                        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        kanji: w.jp, kana: w.yomi || w.jp, mean: w.ko,
                        type: 'noun', level: 'N4', custom: true,
                      });
                      onToast(`${w.jp} 담았어요`);
                    }}
                  >담기</button>
                </div>
              ))}
            </Section>
          )}

          {analysis.grammar?.map((g) => (
            <Section key={g.form} title={`문법 · ${g.form}`} sub={g.meaning}>
              {g.howTo && <p className="vd-p">{g.howTo}</p>}
              {g.forms?.length > 0 && (
                <ul className="vd-ul">{g.forms.map((f) => <li key={f}>{f}</li>)}</ul>
              )}
              {g.fromVideo?.jp && (
                <div className="vd-quote">
                  <button className="vd-line" onClick={() => say(g.fromVideo.jp)}>
                    <IconSpeaker /> {g.fromVideo.jp}
                  </button>
                  <div className="vd-ko">{g.fromVideo.ko}</div>
                </div>
              )}
              {g.examples?.map((ex) => (
                <div key={ex.jp} className="vd-ex">
                  <button className="vd-line" onClick={() => say(ex.jp)}><IconSpeaker /> {ex.jp}</button>
                  <div className="vd-ko">{ex.ko}</div>
                </div>
              ))}
              {g.mistake && <p className="vd-warn">⚠ {g.mistake}</p>}
            </Section>
          ))}

          {analysis.realTalk?.length > 0 && (
            <Section title="일본인이 실제로 쓰는 말" sub="교과서에서 덜 다루지만 회화에서는 자주 나와요">
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
            </Section>
          )}

          {analysis.breakdown?.length > 0 && (
            <Section title="문장 뜯어보기" sub="왜 이 조사와 활용이 쓰였는지까지 봅니다">
              {analysis.breakdown.map((b) => (
                <div key={b.sentence} className="vd-break">
                  <button className="vd-line" onClick={() => say(b.sentence)}><IconSpeaker /> {b.sentence}</button>
                  <div className="vd-parts">
                    {b.parts?.map((p) => (
                      <div key={p.token} className="vd-part"><b>{p.token}</b> {p.note}</div>
                    ))}
                  </div>
                  {b.natural && <div className="vd-ko">→ {b.natural}</div>}
                  {b.why && <p className="vd-p vd-dim">{b.why}</p>}
                </div>
              ))}
            </Section>
          )}

          {analysis.literal?.length > 0 && (
            <Section title="직역하면 어색한 것" sub="틀린 게 아니라 뉘앙스가 다릅니다">
              {analysis.literal.map((l) => (
                <div key={l.natural} className="vd-lit">
                  <div className="vd-litko">{l.koStyle}</div>
                  <div className="vd-litjp">→ {l.natural}</div>
                  {l.note && <p className="vd-p vd-dim">{l.note}</p>}
                </div>
              ))}
            </Section>
          )}

          {analysis.shadowing?.length > 0 && (
            <Section title="따라 말하기" sub="듣고, 소리 내어 말해 보세요">
              {analysis.shadowing.map((s) => (
                <div key={s.jp} className="vd-shadow">
                  <div className="vd-jp">{s.jp}</div>
                  <div className="vd-yomi">{s.yomi}</div>
                  <div className="vd-ko">{s.ko}</div>
                  {s.point && <div className="vd-point">{s.point}</div>}
                  <div className="vd-shadowbtns">
                    <button onClick={() => say(readingText(s.yomi, s.jp))}><IconSpeaker /> 듣기</button>
                    <button onClick={() => speakSlow(readingText(s.yomi, s.jp))}>천천히</button>
                    <MicButton
                      expected={[s.jp, s.yomi].filter(Boolean)}
                      hints={[s.jp, s.yomi].filter(Boolean)}
                      target={s.jp}
                      onToast={onToast}
                      label="따라 말하기"
                    />
                  </div>
                </div>
              ))}
            </Section>
          )}

          {analysis.takeaway && (
            <Section title="이것만은 가져가기" sub="전부 외우려 하지 말고 이것만">
              {analysis.takeaway.grammar?.map((g) => (
                <div key={g.expr} className="vd-take">
                  <b>{g.expr}</b> — {g.meaning}
                  {g.example && (
                    <button className="vd-line" onClick={() => say(g.example)}><IconSpeaker /> {g.example}</button>
                  )}
                </div>
              ))}
              {analysis.takeaway.words?.map((w) => (
                <div key={w.jp} className="vd-take"><b>{w.jp}</b> — {w.ko} <span className="vd-dim">{w.usage}</span></div>
              ))}
            </Section>
          )}

          {analysis.question?.jp && (
            <Section title="직접 말해 보기" sub={analysis.question.target ? `목표: ${analysis.question.target}` : null}>
              <button className="vd-line vd-q" onClick={() => say(analysis.question.jp)}>
                <IconSpeaker /> {analysis.question.jp}
              </button>
              <div className="vd-ko">{analysis.question.ko}</div>
              <div className="vd-shadowbtns" style={{ marginTop: 10 }}>
                <MicButton
                  expected={[]}
                  hints={[analysis.question.target].filter(Boolean)}
                  onToast={onToast}
                  label="일본어로 답하기"
                />
              </div>
              <p className="vd-note" style={{ marginTop: 10 }}>
                <IconBook /> 답을 소리 내어 말해 본 뒤, 위 표현이 실제로 입에서 나왔는지 확인해 보세요.
              </p>
            </Section>
          )}

          <button className="vd-redo" onClick={() => {
            setAnalyses((prev) => { const next = { ...prev }; delete next[open.id]; return next; });
          }}>자막 다시 넣기
          </button>
        </>
      )}
    </>
  );
}
