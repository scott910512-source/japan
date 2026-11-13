import { useEffect, useMemo, useRef, useState } from 'react';
import { IconHeadphone, IconPlay, IconTrash, IconUpload } from '../components/Icons.jsx';
import { useHotkeys, useHasKeyboard } from '../lib/useHotkeys.js';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { speakJapaneseAsync, speakKorean, stopSpeaking, soundPlaying, unlockAudio } from '../lib/tts.js';
import {
  STORY_RATES, STORY_REPEATS, STORY_KO,
  saveStories, loadStoryPos, saveStoryPos, loadStoryPrefs, saveStoryPrefs,
  storiesFromFile, addStories, removeStory, flatStory, storyStats, storyMinutes, sectionStarts, resumeAt, nextStoryAt,
} from '../lib/story.js';

/* 이야기 연속 듣기 — 긴 글을 처음부터 끝까지 이어서 듣는다.
 *
 * 자동 듣기는 카드 한 장씩(일본어 → 뜻 → 다음 장) 끊어 간다. 여기는 글 한 편이 통째로 흘러간다 —
 * 문장이 끝나면 곧바로 다음 문장이고, 화면에는 글 전체가 떠 있어 지금 읽는 문장만 밝아진다.
 *
 * 고르는 것은 셋이다: 읽는 속도(기본은 천천히) · 문장마다 몇 번 · 해석(끔 · 글자로 · 소리로도).
 * 긴 글이라 어디까지 들었는지 기기에 적어 두고 이어 듣는다.
 *
 * 글은 앱에 들어 있지 않다. 사용자가 파일로 불러온 것만 그 사람의 기기와 계정에 남는다(lib/story.js).
 * 묶음(store = { list, removed })은 App이 들고 있다 — 동기화에 실어야 다른 기기에도 뜬다. */

const sleepers = () => {
  const ids = new Set();
  return {
    wait: (ms) => new Promise((resolve) => { const id = setTimeout(() => { ids.delete(id); resolve(); }, ms); ids.add(id); }),
    clear: () => { ids.forEach(clearTimeout); ids.clear(); },
  };
};

const KO_LABEL = { [STORY_KO.OFF]: '끔', [STORY_KO.TEXT]: '글자로', [STORY_KO.VOICE]: '소리로도' };

const EMPTY = { list: [], removed: {} };

export default function StoryListen({ store = EMPTY, setStore, onActivity, onToast }) {
  const stories = store?.list || EMPTY.list;
  const [pos, setPos] = useState(loadStoryPos);
  const [prefs, setPrefsState] = useState(loadStoryPrefs);
  const [pick, setPick] = useState(null);
  const [run, setRun] = useState(null);          // { id, at, playing, tick }
  const [phase, setPhase] = useState('jp');      // jp | again | ko
  const fileRef = useRef(null);
  const sleep = useRef(null);
  if (!sleep.current) sleep.current = sleepers();
  const hasKeyboard = useHasKeyboard();

  const setPref = (k, v) => setPrefsState((p) => { const n = { ...p, [k]: v }; saveStoryPrefs(n); return n; });

  const chosenId = stories.some((s) => s.id === pick) ? pick : stories[0]?.id || null;
  const story = useMemo(() => stories.find((s) => s.id === (run?.id || chosenId)) || null, [stories, run?.id, chosenId]);
  const flat = useMemo(() => flatStory(story), [story]);
  const starts = useMemo(() => sectionStarts(story), [story]);
  const line = run ? flat[run.at] : null;
  const hasKo = useMemo(() => flat.some((l) => l.ko), [flat]);
  const koMode = hasKo ? prefs.ko : STORY_KO.OFF;

  useWakeLock(Boolean(run?.playing));
  useEffect(() => () => { sleep.current.clear(); stopSpeaking(); }, []);

  /* 듣던 이야기가 사라졌으면(다른 기기에서 지웠다) 듣기를 닫는다 */
  useEffect(() => { if (run && !stories.some((s) => s.id === run.id)) setRun(null); }, [run, stories]);

  const savePos = (id, at) => setPos((p) => { const n = { ...p, [id]: at }; saveStoryPos(n); return n; });

  /* ── 한 문장을 읽고 다음으로 ──
     일본어는 끝났다는 기별을 받고 넘어간다(문장 길이가 제각각이라 시간으로 어림하면 말이 겹치거나 뜸이 든다).
     한국어 뜻 읽기는 끝 기별이 없는 길이라 소리가 났다가 멎는 것을 보고, 못 알아내는 기기는 글자 수로 닫는다. */
  useEffect(() => {
    if (!run || !run.playing || !line) return undefined;
    let dead = false;
    const { wait } = sleep.current;
    const pause = () => setRun((r) => (r ? { ...r, playing: false } : r));
    (async () => {
      for (let i = 0; i < prefs.repeat; i += 1) {
        setPhase(i === 0 ? 'jp' : 'again');
        const how = await speakJapaneseAsync(line.jp, prefs.rate, { id: `story:${run.at}:${i}` });
        if (dead) return;
        if (how === 'interrupted') { pause(); return; }     // 다른 소리가 끼어들었다 — 겹쳐 읽지 않고 멈춘다
        if (how === 'failed') { onToast?.('이 기기에서 일본어를 소리로 읽지 못했어요. 설정 → 음성을 확인해 주세요'); pause(); return; }
        await wait(i + 1 < prefs.repeat ? 450 : 120);
        if (dead) return;
      }
      if (koMode === STORY_KO.VOICE && line.ko) {
        setPhase('ko');
        speakKorean(line.ko, 1);
        const cap = Math.min(15000, 900 + [...line.ko].length * 190);
        const t0 = Date.now(); let heard = false;
        while (Date.now() - t0 < cap) {
          await wait(150);
          if (dead) return;
          if (soundPlaying()) heard = true;
          else if (heard) break;                              // 났다가 멎었다
          else if (Date.now() - t0 > 3000) break;             // 끝내 조용하다 — 기다리지 않는다
        }
      }
      await wait(line.last ? 650 : 180);                      // 문단 끝은 숨을 조금 더 둔다
      if (dead) return;
      onActivity?.({ listened: 1 });
      const next = nextStoryAt(run.at, flat.length, prefs.loop);
      if (next === null) {
        savePos(run.id, 0);
        setRun(null);
        onToast?.('끝까지 들었어요');
        return;
      }
      savePos(run.id, next);
      setRun((r) => (r ? { ...r, at: next } : r));
    })();
    return () => { dead = true; sleep.current.clear(); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.at, run?.playing, run?.tick, prefs.rate, prefs.repeat, koMode]);

  /* 지금 읽는 문장이 화면에 보이게 */
  useEffect(() => {
    if (!run) return;
    const el = document.querySelector(`.sl-s[data-at="${run.at}"]`);
    try { el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { el?.scrollIntoView(); }
  }, [run?.id, run?.at]);   // eslint-disable-line react-hooks/exhaustive-deps

  const start = (at) => {
    if (!story || !flat.length) return;
    unlockAudio();
    setPhase('jp');
    savePos(story.id, at);
    setRun({ id: story.id, at, playing: true, tick: 0 });
  };
  const jump = (at) => {
    if (!run) return;
    const to = Math.min(flat.length - 1, Math.max(0, at));
    savePos(run.id, to);
    setRun((r) => (r ? { ...r, at: to, playing: true, tick: r.tick + 1 } : r));
  };
  const toggle = () => setRun((r) => (r ? { ...r, playing: !r.playing, tick: r.tick + 1 } : r));
  const quit = () => { sleep.current.clear(); stopSpeaking(); setRun(null); };

  useHotkeys({
    Space: () => { if (run) toggle(); },
    ArrowRight: () => { if (run) jump(run.at + 1); },
    ArrowLeft: () => { if (run) jump(run.at - 1); },
    Escape: () => { if (run) quit(); },
  });

  /* ── 파일 불러오기 ── */
  const onFiles = async (files) => {
    const incoming = []; let bad = 0;
    for (const f of [...(files || [])]) {
      if (f.size > 3_000_000) { bad += 1; continue; }
      let got = [];
      try { got = storiesFromFile(f.name, await f.text()); } catch { got = []; }
      if (!got.length) bad += 1;
      incoming.push(...got);
    }
    if (fileRef.current) fileRef.current.value = '';
    if (!incoming.length) { onToast?.(bad ? '이야기로 읽을 수 없는 파일이에요 (.json · .txt)' : '고른 파일이 없어요'); return; }
    const res = addStories(stories, incoming);
    if (!res.added && !res.replaced) { onToast?.('이야기를 더 담을 자리가 없어요. 안 듣는 것을 지운 뒤 다시 해 주세요'); return; }
    if (!saveStories(res.list)) { onToast?.('기기 저장 공간이 모자라 불러오지 못했어요'); return; }
    setStore?.((cur) => ({ list: addStories(cur?.list || [], incoming).list, removed: cur?.removed || {} }));
    setPick(incoming[0].id);
    const parts = [];
    if (res.added) parts.push(`${res.added}편을 불러왔어요`);
    if (res.replaced) parts.push(`${res.replaced}편을 새 내용으로 바꿨어요`);
    if (res.rejected || bad) parts.push(`${res.rejected + bad}개는 못 읽었어요`);
    onToast?.(`이야기 ${parts.join(' · ')}`);
  };
  const drop = (s) => {
    if (!window.confirm(`「${s.title}」을(를) 지울까요?\n로그인한 다른 기기에서도 사라져요. 파일을 다시 불러오면 돌아와요.`)) return;
    /* 지운 시각을 남긴다 — 안 남기면 다음 동기화에 계정에서 다시 내려온다 */
    setStore?.((cur) => ({ list: removeStory(cur?.list || [], s.id), removed: { ...(cur?.removed || {}), [s.id]: Date.now() } }));
    setPos((p) => { const { [s.id]: _gone, ...rest } = p; saveStoryPos(rest); return rest; });
  };

  /* ── 듣는 중 ── */
  if (run && story && line) {
    const secNow = line.sec;
    let n = -1;
    return (
      <div className="story sl-run" data-at={run.at} data-playing={run.playing ? '1' : '0'} data-phase={phase}>
        <div className="sl-top">
        <div className="sl-head">
          <span className="sl-pos"><b>{run.at + 1}</b> / {flat.length}</span>
          <span className="sl-title">{story.title}</span>
          <button className="ghost-btn sl-quit" onClick={quit}>그만 듣기</button>
        </div>
        {story.sections.length > 1 && (
          <div className="sl-secs" role="tablist" aria-label="구간">
            {story.sections.map((sec, i) => (
              <button key={i} className={`sl-sec${i === secNow ? ' active' : ''}`} data-sec={i} role="tab" aria-selected={i === secNow} onClick={() => jump(starts[i])}>
                {sec.titleKo || sec.title || (i === 0 ? '처음' : `${i + 1}번째`)}
              </button>
            ))}
          </div>
        )}
        </div>

        <div className="card sl-text" lang="ja">
          {story.sections.map((sec, s) => (
            <section key={s} className="sl-section">
              {sec.title && <h3 className="sl-sectitle">{sec.title}{sec.titleKo && <small lang="ko">{sec.titleKo}</small>}</h3>}
              {sec.paras.map((para, p) => (
                <p key={p} className="sl-para">
                  {para.map((l) => {
                    n += 1; const at = n;
                    return (
                      <span key={at} className={`sl-s${at === run.at ? ' cur' : ''}${at < run.at ? ' past' : ''}`} data-at={at} role="button" tabIndex={-1} onClick={() => jump(at)}>{l.jp}</span>
                    );
                  })}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="sl-bar">
          {koMode !== STORY_KO.OFF && <div className={`sl-ko${phase === 'ko' ? ' saying' : ''}`} lang="ko">{line.ko || '이 문장은 해석이 없어요'}</div>}
          <div className="sl-status" role="status">
            {!run.playing ? '잠시 멈춤' : phase === 'ko' ? '해석' : phase === 'again' ? '한 번 더' : '듣는 중'}
          </div>
          <div className="sl-controls">
            <button className="ghost-btn sl-prev" onClick={() => jump(run.at - 1)} disabled={run.at === 0} aria-label="이전 문장">이전</button>
            <button className="submit-btn sl-pause" onClick={toggle} aria-pressed={!run.playing}>
              {run.playing ? '잠시 멈춤' : '이어서'}{hasKeyboard && <kbd className="inline-key">Space</kbd>}
            </button>
            <button className="ghost-btn sl-next" onClick={() => jump(run.at + 1)} disabled={run.at + 1 >= flat.length} aria-label="다음 문장">다음</button>
          </div>
          <div className="sl-quick" aria-label="읽기 속도">
            {STORY_RATES.map((r) => (
              <button key={r.v} className={`sl-chip${prefs.rate === r.v ? ' active' : ''}`} data-rate={r.v} aria-pressed={prefs.rate === r.v} onClick={() => setPref('rate', r.v)}>{r.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── 고르기 ── */
  const cont = story ? resumeAt(pos, story.id, flat.length) : 0;
  const stat = story ? storyStats(story) : null;
  return (
    <div className="story sl-setup">
      <p className="vd-note" style={{ marginTop: 0 }}>
        긴 글 한 편을 처음부터 끝까지 이어서 들어요. 문장이 끝나면 바로 다음 문장으로 넘어가고, 어디까지 들었는지 기억해요.
      </p>

      {stories.length === 0 ? (
        <div className="card sl-empty">
          <b>아직 불러온 이야기가 없어요</b>
          <p>스크립트 파일(.json · .txt)을 불러오면 여기에 떠요. 한 번 불러오면 로그인한 다른 기기에도 떠요.</p>
        </div>
      ) : (
        <div className="sl-list" role="radiogroup" aria-label="이야기">
          {stories.map((s) => {
            const st = storyStats(s);
            const at = resumeAt(pos, s.id, st.sentences);
            const on = s.id === chosenId;
            return (
              <div key={s.id} className={`sl-item${on ? ' active' : ''}`} data-story={s.id}>
                <button className="sl-itembody" role="radio" aria-checked={on} onClick={() => setPick(s.id)}>
                  <b>{s.level && <i className="sl-level">{s.level}</i>}{s.title}</b>
                  <span>{st.sentences}문장 · 약 {storyMinutes(s, prefs)}분{st.hasKo ? ' · 해석 있음' : ''}{s.source ? ` · ${s.source}` : ''}</span>
                  {at > 0 && <span className="sl-resume">{at + 1}번째 문장까지 들었어요</span>}
                </button>
                <button className="sl-del" onClick={() => drop(s)} aria-label={`${s.title} 지우기`}><IconTrash /></button>
              </div>
            );
          })}
        </div>
      )}

      {story && (
        <>
          <div className="section-label">읽기 속도</div>
          <div className="ls-pills sl-rates">
            {STORY_RATES.map((r) => (
              <button key={r.v} className={`ls-pill${prefs.rate === r.v ? ' active' : ''}`} data-rate={r.v} aria-pressed={prefs.rate === r.v} onClick={() => setPref('rate', r.v)}>
                {r.label} <span className="pk-count">{r.v}배</span>
              </button>
            ))}
          </div>

          <div className="section-label">반복 횟수</div>
          <div className="ls-pills sl-repeats">
            {STORY_REPEATS.map((r) => (
              <button key={r} className={`ls-pill${prefs.repeat === r ? ' active' : ''}`} data-repeat={r} aria-pressed={prefs.repeat === r} onClick={() => setPref('repeat', r)}>문장마다 {r}번</button>
            ))}
            <button className={`ls-pill${prefs.loop ? ' active' : ''}`} data-loop={prefs.loop ? '1' : '0'} aria-pressed={prefs.loop} onClick={() => setPref('loop', !prefs.loop)}>끝나면 처음부터 다시</button>
          </div>

          <div className="section-label">해석</div>
          <div className="ls-pills sl-kos">
            {Object.values(STORY_KO).map((k) => (
              <button key={k} className={`ls-pill${koMode === k ? ' active' : ''}`} data-ko={k} aria-pressed={koMode === k} disabled={!stat.hasKo && k !== STORY_KO.OFF} onClick={() => setPref('ko', k)}>{KO_LABEL[k]}</button>
            ))}
          </div>
          <p className="set-note sl-konote">
            {stat.hasKo
              ? '「글자로」는 지금 읽는 문장의 뜻을 화면에 보여 줘요. 「소리로도」는 문장을 읽은 뒤 뜻까지 읽어 줘요.'
              : '이 이야기는 해석이 없는 파일이에요. 일본어만 들려요.'}
          </p>

          {cont > 0 && (
            <button className="bigstart sl-start sl-continue" onClick={() => start(cont)}>
              <span className="bs-t"><IconPlay /> 이어 듣기</span>
              <span className="bs-s">{cont + 1}번째 문장부터 · 전체 {flat.length}문장</span>
            </button>
          )}
          <button className={cont > 0 ? 'ghost-btn sl-start sl-first' : 'bigstart sl-start sl-first'} onClick={() => start(0)}>
            {cont > 0 ? '처음부터 듣기' : (
              <>
                <span className="bs-t"><IconHeadphone /> 듣기 시작</span>
                <span className="bs-s">{flat.length}문장 · 약 {storyMinutes(story, prefs)}분</span>
              </>
            )}
          </button>
        </>
      )}

      <div className="section-label">이야기 불러오기</div>
      <button className="ghost-btn sl-import" onClick={() => fileRef.current?.click()}><IconUpload /> 스크립트 파일 불러오기</button>
      <input ref={fileRef} className="sl-file" type="file" accept=".json,.txt,application/json,text/plain" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <p className="set-note">
        .json(해석이 붙은 파일)과 .txt(글만 있는 파일)를 받아요. 여러 개를 한꺼번에 골라도 돼요.
        글은 내 계정에만 저장돼요(다른 사람은 볼 수 없어요). 한 번 불러오면 로그인한 다른 기기에도 떠요.
      </p>
    </div>
  );
}
