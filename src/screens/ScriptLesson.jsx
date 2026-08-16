import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowLeft, IconCheck, IconRewind, IconSpeaker } from '../components/Icons.jsx';
import MicButton from '../components/MicButton.jsx';
import { speakJapanese, speakSlow } from '../lib/tts.js';
import { formatTime, withDurations } from '../lib/script.js';

/* 자막으로 영상과 함께 학습하기.
 *
 * 붙여넣은 자막 그대로 한 줄씩 돈다. 줄을 넘길 때마다 영상이 그 시각으로
 * 되감겨 그 부분만 다시 재생된다 — 영상은 보고 자막은 따로 읽는 게 아니라,
 * 지금 듣고 있는 말을 눈으로 보면서 따라 말하는 것이 목적이다.
 *
 * 여기서는 뜻을 지어내지 않는다. 사용자가 넣지 않은 번역을 만들어 붙이면
 * 틀린 것을 외우게 된다. 뜻·문법 설명은 '설명 만들기'가 붙었을 때만 보여 준다. */

// 유튜브 임베드는 API 스크립트를 따로 안 불러도 postMessage 명령을 받는다.
function command(iframe, func, args = []) {
  try {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*',
    );
  } catch { /* 재생기가 아직 안 붙었으면 무시한다 */ }
}

export default function ScriptLesson({
  videoId, title, lines, step, settings, notes, onStep, onQuit, onDone, onToast,
}) {
  const timed = useMemo(() => withDurations(lines), [lines]);
  const total = timed.length;
  const at = Math.min(Math.max(step, 0), total - 1);
  const cur = timed[at];
  const frame = useRef(null);
  const stopper = useRef(null);
  const [auto, setAuto] = useState(true);

  const playLine = useCallback((line) => {
    if (!line || line.at == null) return;
    clearTimeout(stopper.current);
    command(frame.current, 'seekTo', [line.at, true]);
    command(frame.current, 'playVideo');
    // 다음 줄이 시작할 때 멈춘다 — 안 멈추면 영상이 혼자 앞서 나간다.
    stopper.current = setTimeout(() => command(frame.current, 'pauseVideo'), (line.dur + 0.4) * 1000);
  }, []);

  useEffect(() => {
    if (auto) playLine(cur);
    return () => clearTimeout(stopper.current);
  }, [at, auto, cur, playLine]);

  /* 재생기가 다 뜨기 전에 보낸 명령은 그냥 버려진다 — 그래서 첫 줄만 영상이
   * 맨 앞에서 시작했다. 다 뜨면 지금 줄로 한 번 더 맞춘다. */
  const onFrameLoad = () => { if (auto) playLine(cur); };

  useEffect(() => () => clearTimeout(stopper.current), []);

  if (!cur) return null;

  const pct = Math.round((at / total) * 100);
  const last = at === total - 1;
  const note = notes?.[cur.jp];

  return (
    <>
      <div className="vl-head">
        <div className="qh-row">
          <button className="sh-close" onClick={onQuit} aria-label="학습 그만두기"><IconArrowLeft /></button>
          <div className="sh-title">{at + 1} / {total}</div>
          <div className="qh-score vl-kind">{cur.at != null ? formatTime(cur.at) : '자막'}</div>
        </div>
        <div className="sh-bar"><i style={{ width: `${pct}%` }} /></div>
      </div>

      {/* 재생기는 학습 내내 붙어 있는다. 줄마다 화면을 나갔다 오면 영상과 같이
          공부하는 게 아니라 영상을 찾아다니는 게 된다. */}
      <div className="vd-player sl-player">
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0`}
          title={title || '영상'}
          onLoad={onFrameLoad}
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>

      <div className="sl-line">
        <p className="sl-jp">{cur.jp}</p>
        {note?.ko && <p className="sl-ko">{note.ko}</p>}
        {note?.point && <p className="sl-point">{note.point}</p>}
      </div>

      <div className="sl-acts">
        <button onClick={() => playLine(cur)} disabled={cur.at == null}>
          <IconRewind /> 이 부분 다시
        </button>
        <button onClick={() => speakJapanese(cur.jp, settings.speechRate)}>
          <IconSpeaker /> 읽어 주기
        </button>
        <button onClick={() => speakSlow(cur.jp)}>천천히</button>
        <MicButton
          expected={[cur.jp]}
          hints={[cur.jp]}
          target={cur.jp}
          onToast={onToast}
          label="따라 말하기"
        />
      </div>

      <label className="sl-auto">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        넘어갈 때 영상도 그 부분으로
      </label>

      <div className="vl-nav">
        {at > 0 && <button className="ghost-btn vl-prev" onClick={() => onStep(at - 1)}>이전</button>}
        <button className="submit-btn vl-next" onClick={() => (last ? onDone() : onStep(at + 1))}>
          {last ? <><IconCheck /> 학습 마치기</> : '다음 줄'}
        </button>
      </div>
    </>
  );
}
