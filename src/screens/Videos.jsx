import { useEffect, useMemo, useState } from 'react';
import {
  IconArrowLeft, IconBook, IconChevron, IconPlus, IconSpeaker, IconTrash,
} from '../components/Icons.jsx';
import MicButton from '../components/MicButton.jsx';
import { readingText, speakJapanese, speakSlow } from '../lib/tts.js';
import {
  ANALYZE_CHAR_LIMIT, analyzeScript, resolveProvider, transcriptPrompt, youtubeId,
} from '../lib/videoTutor.js';
import { SEED_VIDEOS } from '../data/videos.js';
import {
  loadVideoAnalyses, loadVideoProgress, loadVideoScripts, loadVideos,
  saveVideoAnalyses, saveVideoProgress, saveVideoScripts, saveVideos,
} from '../lib/storage.js';
import VideoLesson, { buildSteps } from './VideoLesson.jsx';
import ScriptLesson from './ScriptLesson.jsx';
import { clipScript, hasTimes, parseScript, scriptChars } from '../lib/script.js';

/* 영상으로 배우기.
 *
 * 학습의 바탕은 붙여넣은 자막 그 자체다. 자막만 넣으면 바로 학습이 되고,
 * 영상이 줄마다 그 시각으로 되감긴다 — 듣는 말을 눈으로 보면서 따라 말하는 것이
 * 목적이라, 영상과 자막이 따로 놀면 안 된다.
 *
 * 설명(뜻·문법·쉐도잉 정리)은 그 위에 얹는 선택지다. 있으면 더 깊이 보고,
 * 없어도 학습은 된다 — 그것 때문에 시작을 못 하면 안 된다.
 *
 * 자막과 분석 결과는 그 기기에만 남는다. */

function Section({ title, sub, children }) {
  return (
    <div className="card vd-sec">
      <h3 className="vd-h">{title}</h3>
      {sub && <p className="vd-sub">{sub}</p>}
      {children}
    </div>
  );
}

/* 제목은 지어내지 않는다. 유튜브에서 받아오되 못 받으면 주소만 보여 준다.
 *
 * 화면을 보고 있을 때만 부른다 — 탭이 되면서 앱이 켜지자마자 붙는데, 열지도
 * 않은 탭이 유튜브를 부를 이유가 없다.
 * 실패한 것은 기억하지 않는다. 비행기 모드로 앱을 켠 날 한 번 실패했다고
 * 그날 내내 주소만 보이면 안 된다 — 탭에 다시 들어오면 다시 시도한다. */
function useTitles(videos, active) {
  const [titles, setTitles] = useState({});
  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    videos.forEach((v) => {
      if (titles[v.id]) return;
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
  }, [videos, active]);
  return titles;
}

const WORD_TYPES = ['verb', 'noun', 'adj-i', 'adj-na', 'adv', 'conj', 'etc'];
const WORD_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

/* 영상에서 담은 단어도 원래 쓰던 단어장의 카드와 같은 모양이어야 한다.
 * 그래야 레벨 필터·회독·시험이 따로 놀지 않는다.
 *
 * id는 영상과 단어로 고정한다 — 같은 영상을 다시 분석해도 같은 id가 나와야
 * 그동안 쌓인 회독 기록이 이어진다. 시각으로 만들면 누를 때마다 새 단어가 된다. */
function toCard(w, videoId, title) {
  return {
    id: `custom-vid-${videoId}-${w.jp}`,
    kanji: w.jp,
    kana: w.yomi || w.jp,
    mean: w.ko,
    type: WORD_TYPES.includes(w.type) ? w.type : 'etc',
    level: WORD_LEVELS.includes(w.level) ? w.level : 'N4',
    example: w.ex || '',
    exampleKana: w.exYomi || '',
    exampleKo: w.exKo || '',
    custom: true,
    source: { video: videoId, title: title || '' },
  };
}

export default function Videos({ active, settings, words, onAddWord, onStartSet, onToast }) {
  const [videos, setVideos] = useState(() => {
    const saved = loadVideos();
    return saved.length ? saved : SEED_VIDEOS;
  });
  const [analyses, setAnalyses] = useState(() => loadVideoAnalyses());
  const [progress, setProgress] = useState(() => loadVideoProgress());
  const [scripts, setScripts] = useState(() => loadVideoScripts());
  const [openId, setOpenId] = useState(null);
  const [mode, setMode] = useState(null); // null=영상 화면, 'lesson'=단계 학습, 'full'=전체 보기
  const [urlDraft, setUrlDraft] = useState('');
  const [script, setScript] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => saveVideos(videos), [videos]);
  useEffect(() => saveVideoAnalyses(analyses), [analyses]);
  useEffect(() => saveVideoProgress(progress), [progress]);
  useEffect(() => saveVideoScripts(scripts), [scripts]);

  const titles = useTitles(videos, active);
  const open = videos.find((v) => v.id === openId) || null;
  const info = open ? titles[open.id] : null;
  const analysis = open ? analyses[open.id] : null;
  const savedScript = open ? scripts[open.id] || '' : '';

  useEffect(() => { setScript(openId ? loadVideoScripts()[openId] || '' : ''); setMode(null); }, [openId]);

  const lines = useMemo(() => parseScript(savedScript), [savedScript]);
  /* 설명에 실을 몫. 자막 학습은 API를 안 쓰니 전부 그대로 돌고, 이 한도는
     설명을 만들 때만 걸린다. */
  const clip = useMemo(() => clipScript(savedScript, ANALYZE_CHAR_LIMIT), [savedScript]);
  const steps = useMemo(() => buildSteps(analysis), [analysis]);

  /* 설명이 있으면 줄마다 뜻을 붙여 준다. 자막 문장과 똑같이 적힌 것만 쓴다 —
     비슷해 보인다고 갖다 붙이면 엉뚱한 줄에 엉뚱한 뜻이 달린다. */
  const notes = useMemo(() => {
    const map = {};
    (analysis?.shadowing || []).forEach((sh) => { if (sh.jp) map[sh.jp] = { ko: sh.ko, point: sh.point }; });
    (analysis?.breakdown || []).forEach((b) => { if (b.sentence && !map[b.sentence]) map[b.sentence] = { ko: b.natural, point: b.why }; });
    return map;
  }, [analysis]);
  /* 진도는 자막 학습과 설명 학습을 따로 센다. 자막은 줄 수, 설명은 단계 수라
     길이가 달라서, 한 칸에 같이 적으면 어느 쪽 진도인지 알 수 없다. */
  const mark = open ? (progress[open.id] || {}) : {};
  const scriptMark = { step: mark.scriptStep || 0, done: Boolean(mark.scriptDone) };
  const lessonMark = { step: mark.step || 0, done: Boolean(mark.done) };
  const patchMark = (patch) => setProgress((p) => ({ ...p, [open.id]: { ...(p[open.id] || {}), ...patch } }));
  const finish = () => {
    patchMark({ step: 0, done: true });
    setMode(null);
    onToast('설명 학습을 마쳤어요');
  };
  const finishScript = () => {
    patchMark({ scriptStep: 0, scriptDone: true });
    setMode(null);
    onToast('자막 학습을 마쳤어요');
  };

  const saveScript = () => {
    const text = script.trim();
    if (parseScript(text).length === 0) { onToast('자막을 읽지 못했어요'); return; }
    setScripts((prev) => ({ ...prev, [open.id]: text }));
    onToast('자막을 저장했어요');
  };

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
    setScripts((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setProgress((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (openId === id) setOpenId(null);
  };

  const runAnalysis = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await analyzeScript({
        ...resolveProvider(settings),
        title: info?.title,
        channel: info?.channel,
        script: clip.text || savedScript || script,
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
  const ai = resolveProvider(settings);
  const aiKey = ai.apiKey;

  /* Gemini 앱에 물어볼 말. 복사가 막힌 브라우저도 있으니(https가 아니거나 권한이
     없으면 clipboard가 거절한다) 글 자체를 늘 펼쳐 두고, 버튼은 편의로만 둔다. */
  const prompt = open ? transcriptPrompt(`https://youtu.be/${open.id}`) : '';
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      onToast('복사했어요. Gemini 앱에 붙여넣고, 받은 자막을 여기에 넣어 주세요');
    } catch {
      onToast('복사가 막혀 있어요. 아래 글을 길게 눌러 직접 복사해 주세요');
    }
  };

  /* 설명 카드에 적을 한 줄. 급한 것부터 말한다 — 키가 없으면 그게 먼저고,
     이미 만들었으면 진도, 자막이 길면 얼마만 쓰는지. */
  const lessonNote = (() => {
    if (!aiKey) return '설정 → 영상 학습에서 API 키를 넣으면, 이 자막에서 단어와 문법 설명을 뽑아 줘요. 없어도 위 자막 학습은 됩니다.';
    if (analysis) {
      if (lessonMark.step > 0) return `${steps.length}단계 중 ${lessonMark.step + 1}단계까지 왔어요.`;
      if (lessonMark.done) return '한 번 마친 설명이에요. 다시 볼 수 있어요.';
      return `핵심 단어·문법·실제 회화 표현을 ${steps.length}단계로 봅니다.`;
    }
    if (clip.clipped) {
      return `자막이 ${clip.total}줄 ${scriptChars(savedScript).toLocaleString()}자예요.`
        + ` 설명은 앞 ${clip.lines}줄(${clip.chars.toLocaleString()}자)로 만듭니다`
        + ' — 한 번에 배울 분량이 그쯤이고, 더 넣는다고 좋아지지 않아요.';
    }
    return '자막에서 핵심 단어와 문법을 뽑아 설명으로 만들어요. 한 번 만들면 그대로 남습니다.';
  })();

  /* 이미 단어장에 있는 단어를 또 만들지 않는다. 結構는 N3에 이미 있는데
   * 영상에서 담았다고 새 카드를 만들면, 같은 단어를 두 번 외우면서 회독 기록도
   * 반으로 갈린다. 있으면 그 카드를 그대로 쓴다. */
  const known = useMemo(() => {
    const byPair = new Map();
    const byKanji = new Map();
    const byKana = new Map(); // 표기가 가나뿐인 단어만 — 아래 이유 참고
    (words || []).forEach((w) => {
      byPair.set(`${w.kanji}|${w.kana}`, w);
      if (!byKanji.has(w.kanji)) byKanji.set(w.kanji, w);
      if (!/[一-龯]/.test(w.kanji)) byKana.set(w.kana, (byKana.get(w.kana) || []).concat(w));
    });
    return { byPair, byKanji, byKana };
  }, [words]);

  /* 표기가 달라도 같은 단어인 경우를 잡는다 — 영상은 結構라고 쓰는데 단어장에는
   * けっこう로 들어 있는 식이다.
   *
   * 다만 읽기만 같다고 합치면 안 된다. あつい 하나에 熱い·厚い·暑い가 걸리고,
   * 그걸 합치면 뜻이 다른 단어를 같은 카드로 외우게 된다. 그래서 단어장 쪽 표기가
   * 가나뿐이고(= 한자 표기가 따로 없는 단어) 후보가 하나일 때만 같다고 본다.
   * 못 찾아서 카드가 하나 늘어나는 건 성가신 정도지만, 잘못 합치면 틀리게 외운다. */
  const findKnown = (w) => {
    const exact = known.byPair.get(`${w.jp}|${w.yomi}`) || known.byKanji.get(w.jp);
    if (exact) return exact;
    const sameKana = known.byKana.get(w.yomi);
    return sameKana?.length === 1 ? sameKana[0] : null;
  };

  // 담을 카드를 돌려준다. 새 카드면 단어장에 넣고, 이미 있으면 그 카드를 쓴다.
  const keepWord = (w) => {
    const found = findKnown(w);
    if (found) return { card: found, added: false };
    const card = toCard(w, open.id, info?.title);
    onAddWord(card);
    return { card, added: true };
  };

  const keepAll = () => {
    const results = (analysis?.words || []).map(keepWord);
    const added = results.filter((r) => r.added).length;
    onToast(added ? `${added}개 담았어요` : '모두 이미 단어장에 있어요');
  };

  // 영상에서 나온 단어만 모아 도는 덱. 오늘 학습 세션과 섞지 않는다.
  const studyVideo = () => {
    const cards = (analysis?.words || []).map((w) => keepWord(w).card);
    if (!cards.length) { onToast('담을 단어가 없어요'); return; }
    onStartSet(cards, `영상 · ${info?.title || open.id}`, `video-${open.id}`);
  };

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
            const p = progress[v.id];
            const total = parseScript(scripts[v.id] || '').length;
            const done = total === 0
              ? '자막 붙여넣기 전'
              : p?.scriptStep > 0 ? `학습 중 · ${p.scriptStep + 1}/${total}줄`
                : p?.scriptDone ? '학습 마침'
                  : `학습 준비됨 · ${total}줄`;
            return (
              <div key={v.id} className="card vd-item">
                <button className="vd-open" onClick={() => setOpenId(v.id)}>
                  <img className="vd-thumb" src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />
                  <div className="vd-body">
                    <div className="vd-title">{t?.title || `youtu.be/${v.id}`}</div>
                    <div className="vd-meta">
                      {t?.channel ? `${t.channel} · ` : ''}
                      {done}
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

  /* ── 자막으로 영상과 함께 학습 ── */
  if (mode === 'script' && lines.length > 0) {
    return (
      <ScriptLesson
        videoId={open.id}
        title={info?.title || `youtu.be/${open.id}`}
        lines={lines}
        step={scriptMark.step}
        settings={settings}
        notes={notes}
        onStep={(step) => patchMark({ scriptStep: step })}
        onQuit={() => setMode(null)}
        onDone={finishScript}
        onToast={onToast}
      />
    );
  }

  /* ── 설명으로 단계 학습 ── */
  if (mode === 'lesson' && analysis && steps.length > 0) {
    return (
      <VideoLesson
        analysis={analysis}
        title={info?.title || `youtu.be/${open.id}`}
        step={lessonMark.step}
        settings={settings}
        findKnown={findKnown}
        onKeep={(w) => { keepWord(w); onToast(`${w.jp} 담았어요`); }}
        onKeepAll={keepAll}
        onStudyWords={studyVideo}
        onStep={(step) => patchMark({ step })}
        onQuit={() => setMode(null)}
        onDone={finish}
        onToast={onToast}
      />
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

      {(!savedScript || mode === 'edit') && (
        <Section
          title="자막 붙여넣기"
          sub="영상의 일본어 자막을 그대로 붙여넣으세요. 시간([00:12])이 같이 들어오면 그 부분으로 영상이 맞춰집니다."
        >
          <textarea
            className="vd-script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={'[00:00]\nこんにちは。今日は…'}
            rows={7}
          />
          {script.trim() && (
            <div className={`vd-count${scriptChars(script) > ANALYZE_CHAR_LIMIT ? ' over' : ''}`}>
              {parseScript(script).length}줄 · {scriptChars(script).toLocaleString()}자
              {scriptChars(script) > ANALYZE_CHAR_LIMIT
                && ` — 줄 학습은 전부 되고, 설명은 앞 ${ANALYZE_CHAR_LIMIT.toLocaleString()}자로 만들어요`}
            </div>
          )}
          <div className="vd-scriptacts">
            <button className="vd-run" disabled={busy || !script.trim()} onClick={() => { saveScript(); setMode(null); }}>
              자막으로 학습 준비하기
            </button>
          </div>

          {/* 자막을 어디서 구하는지가 이 화면의 진짜 문턱이다. 다만 한 번 해 보면
              그다음부터는 아는 일이라, 늘 펼쳐 두면 자리만 차지한다. 접어 둔다. */}
          <details className="vd-how">
            <summary>자막 가져오는 방법 보기</summary>
            <ol className="vd-steps">
              <li>아래 글을 복사합니다.</li>
              <li>Gemini 앱(또는 gemini.google.com)에 붙여넣고 보냅니다.</li>
              <li>나온 일본어 줄을 전부 복사합니다.</li>
              <li>위 자막 칸에 붙여넣고 「자막으로 학습 준비하기」를 누릅니다.</li>
            </ol>
            <textarea className="vd-prompt" value={prompt} readOnly rows={7} />
            <button className="ghost-btn" onClick={copyPrompt}>이 글 복사</button>
            <p className="vd-note" style={{ marginTop: 10 }}>
              앱의 Gemini는 유튜브에 등록된 자막을 그대로 읽어 와요. 영상을 듣는 게
              아니라 글을 읽는 거라 빠르고, API 요금이 들지 않습니다.
              {' '}자막이 없는 영상이면 못 가져와요 — 그때는 들으면서 직접 적어 주세요.
              {' '}한국어 번역이 섞여 오면 그 줄은 지우고 넣으세요. 일본어 줄만 있어야 해요.
            </p>
          </details>

          <p className="vd-note" style={{ marginTop: 10 }}>
            자막은 이 기기에만 저장돼요. 뜻과 문법 설명은 학습을 시작한 뒤에 따로 붙일 수 있어요.
          </p>
        </Section>
      )}

      {/* 학습의 바탕은 자막이다. 설명이 없어도 여기서 바로 시작한다. */}
      {savedScript && mode !== 'edit' && lines.length > 0 && (
        <div className="card vd-entry">
          <h3 className="vd-h">자막으로 영상과 함께</h3>
          {/* 진행 중이 마침보다 먼저다. 마친 영상을 다시 시작해 중간에 멈추면
              지금 어디인지가 궁금하지, 예전에 끝냈다는 사실이 궁금한 게 아니다. */}
          <p className="vd-sub">
            {scriptMark.step > 0
              ? `${lines.length}줄 중 ${scriptMark.step + 1}번째 줄까지 왔어요.`
              : scriptMark.done
                ? '한 번 마친 영상이에요. 다시 처음부터 볼 수 있어요.'
                : hasTimes(lines)
                  ? `${lines.length}줄을 한 줄씩, 그 부분 영상과 같이 봅니다.`
                  : `${lines.length}줄을 한 줄씩 봅니다. 시간이 없는 자막이라 영상은 따로 재생해 주세요.`}
          </p>
          <div className="vd-entrybar">
            <i style={{ width: `${Math.round(((scriptMark.step > 0 ? scriptMark.step : scriptMark.done ? lines.length : 0) / Math.max(lines.length, 1)) * 100)}%` }} />
          </div>
          <div className="vd-entryacts">
            <button className="submit-btn" onClick={() => setMode('script')}>
              {scriptMark.step > 0 ? '이어서 학습하기' : scriptMark.done ? '다시 학습하기' : '학습 시작'}
            </button>
            <button className="ghost-btn" onClick={() => { setScript(savedScript); setMode('edit'); }}>
              자막 고치기
            </button>
          </div>
        </div>
      )}

      {/* 설명은 얹는 것이다. 없어도 위에서 학습은 된다. */}
      {savedScript && mode !== 'edit' && (
        <div className="card vd-entry">
          <h3 className="vd-h">뜻·문법 설명</h3>
          <p className="vd-sub">{lessonNote}</p>
          <div className="vd-entryacts">
            {analysis ? (
              <>
                <button className="submit-btn" onClick={() => setMode('lesson')}>
                  {lessonMark.step > 0 ? '이어서 보기' : lessonMark.done ? '다시 보기' : '설명 보기'}
                </button>
                <button className="ghost-btn" onClick={() => setMode(mode === 'full' ? null : 'full')}>
                  {mode === 'full' ? '전체 접기' : '전체 보기'}
                </button>
              </>
            ) : (
              <button className="submit-btn" disabled={busy || !aiKey} onClick={runAnalysis}>
                {busy ? '읽는 중…' : '설명 만들기'}
              </button>
            )}
          </div>
        </div>
      )}

      {analysis && mode === 'full' && (
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
            <Section title="핵심 단어" sub="누르면 읽어 줘요. 담기를 누르면 원래 쓰던 단어장으로 들어갑니다.">
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
                      <button
                        className="vd-keep"
                        onClick={() => { keepWord(w); onToast(`${w.jp} 담았어요`); }}
                      >담기</button>
                    )}
                  </div>
                );
              })}
              <div className="vd-wordacts">
                <button className="vd-keepall" onClick={keepAll}>전부 담기</button>
                <button className="vd-study" onClick={studyVideo}>
                  <IconBook /> 이 단어로 회독하기
                </button>
              </div>
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

        </>
      )}

      {analysis && mode !== 'edit' && (
        <button className="vd-redo" onClick={() => {
          setAnalyses((prev) => { const next = { ...prev }; delete next[open.id]; return next; });
          patchMark({ step: 0, done: false });
          setMode(null);
        }}>설명 다시 만들기
        </button>
      )}
    </>
  );
}
