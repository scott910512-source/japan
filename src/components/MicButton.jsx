import { useEffect, useRef, useState } from 'react';
import { IconMic } from './Icons.jsx';
import {
  cancelRecording, cloudSTTReady, listenWithBrowser, micReady, recognizeResult,
  startRecording, stopBrowserListening, stopRecordingAndRecognize, sttAvailable,
} from '../lib/stt.js';

/* ★ 발음 점수가 아니다 ★
 *
 * 여기서 하는 일은 음성 인식이 받아 적은 글자를 목표 문장과 견주는 것뿐이다.
 * 발음이 좋은지 억양이 맞는지는 볼 수단이 없다. 「잘 통했어요」는 그럴듯하지만
 * 앱이 알 수 없는 것을 안다고 말하는 문구다 — 인식 결과라고 부른다. */
const VERDICT_TEXT = {
  same: '그대로 인식됐어요',
  near: '조금 다르게 인식됐어요',
  differ: '다르게 인식됐어요',
  none: '인식되지 않았어요',
};

// 짧은 단어일수록 인식이 잘 빗나간다. 안 됐을 때 무엇을 말해야 했는지 보여준다.
function TargetHint({ target }) {
  if (!target) return null;
  return <span className="heard">말할 내용: {target}</span>;
}

/* 말해보기 버튼.
 * expected에는 정답으로 인정할 표기를 전부 넘긴다(한자·가나 둘 다).
 * hints는 인식 정확도를 올리는 힌트로 서버에 함께 보낸다. */
export default function MicButton({
  expected, hints = [], onResult, onToast, label = '말해보기', target,
  autoStart = false, triggerRef, hasKeyboard = false, hotkey,
}) {
  const [state, setState] = useState('idle'); // idle | listening | working
  const [result, setResult] = useState(null);
  const busy = useRef(false);
  const armed = useRef(false);   // 이 카드에서 자동으로 한 번 켰는지

  /* ★ 늦게 온 인식 결과가 다음 카드에 붙으면 안 된다 ★
   *
   * 클라우드 인식은 「보내고 → 기다리고 → 받는다」라 응답이 늦게 올 수 있다.
   * 그사이 카드를 넘기면, 이전 카드에 대고 말한 것이 새 카드의 답으로 뜬다.
   * 부를 때마다 번호를 매겨 두고, 자기 차례가 지난 응답은 버린다. */
  const turn = useRef(0);

  // 카드가 바뀌면 이전 결과를 지우고, 녹음과 요청을 정리한다
  useEffect(() => {
    turn.current += 1;
    setResult(null);
    setState('idle');
    busy.current = false;
    armed.current = false;
    cancelRecording();
    stopBrowserListening();
    return () => {
      turn.current += 1;
      cancelRecording();
      stopBrowserListening();
    };
  }, [expected?.[0]]);

  const available = sttAvailable();

  /* 자동으로 켜기.
   * 권한을 아직 안 받았으면 여기서 여는 건 사용자 제스처가 아니라 막힌다.
   * 그래서 첫 한 번은 버튼을 눌러 권한을 주고, 그다음부터 자동으로 켜진다.
   * 한 카드에서 한 번만 — 답하고 나서 또 켜지면 끝이 없다. */
  useEffect(() => {
    if (!available || !autoStart || armed.current) return;
    if (state !== 'idle' || result) return;
    if (cloudSTTReady() && !micReady()) return;
    armed.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, available]);

  /* ★ 못 쓰는 브라우저에 아무것도 안 띄우면 고장으로 읽힌다 ★
     왜 없는지와 대신 무엇을 하면 되는지를 적어 준다. */
  if (!available) {
    return (
      <div className="micwrap micoff">
        <p className="set-note">
          이 브라우저는 음성 인식을 지원하지 않아요. 카드를 소리로 들으며 따라 읽고,
          뜻은 화면에서 확인해 주세요 — 듣기 탭의 「따라 말하기」도 같은 연습이에요.
        </p>
      </div>
    );
  }

  const finish = (said, mine) => {
    // 자기 차례가 지났으면 버린다 — 이전 카드의 응답이다
    if (mine !== turn.current) return;
    const r = recognizeResult(said, expected);
    setResult(r);
    setState('idle');
    busy.current = false;
    /* 인식 실패(none)는 학습자의 오답이 아니다. 마이크·소음·브라우저 문제일
       수 있어서 판정으로 넘기지 않는다. */
    if (r.verdict !== 'none') onResult?.(r, said);
  };

  const stopCloud = async () => {
    if (busy.current) return;
    busy.current = true;
    const mine = turn.current;
    setState('working');
    try {
      const said = await stopRecordingAndRecognize(hints);
      finish(said, mine);
    } catch (err) {
      if (mine !== turn.current) return;   // 지난 카드의 실패다 — 지금 화면과 상관없다
      setState('idle');
      busy.current = false;
      // 키에 Speech-to-Text 권한이 없으면 여기서 걸린다 — 원인을 그대로 알려준다
      onToast?.(err.status === 403
        ? '이 키로는 음성 인식을 못 써요. Google Cloud에서 Speech-to-Text API를 켜 주세요'
        : `인식에 실패했어요 — ${err.message}`);
    }
  };

  const start = async () => {
    setResult(null);
    const mine = turn.current;
    if (cloudSTTReady()) {
      try {
        setState('listening');
        await startRecording(() => { stopCloud(); });
      } catch {
        setState('idle');
        onToast?.('마이크를 쓸 수 없어요. 브라우저 권한을 확인해 주세요');
      }
      return;
    }
    // 키가 없으면 브라우저 내장 인식으로
    setState('listening');
    const started = listenWithBrowser(
      (said) => finish(said, mine),
      (err) => {
        if (mine !== turn.current) return;
        setState('idle');
        if (err) onToast?.('음성 인식을 쓸 수 없어요');
      },
    );
    if (!started) {
      setState('idle');
      onToast?.('이 브라우저는 음성 인식을 지원하지 않아요');
    }
  };

  const stop = () => {
    if (cloudSTTReady()) stopCloud();
    else stopBrowserListening();
  };

  const toggle = () => {
    if (state === 'listening') stop();
    else if (state === 'idle') { armed.current = true; start(); }
  };
  if (triggerRef) triggerRef.current = toggle;

  return (
    <div className="micwrap">
      <button className={`micbtn ${state}`} onClick={toggle} disabled={state === 'working'}>
        <IconMic />
        <span>
          {state === 'listening' ? '듣는 중… (다 말하면 자동으로 끝나요)'
            : state === 'working' ? '알아듣는 중…'
              : label}
        </span>
        {hasKeyboard && hotkey && <kbd className="inline-key">{hotkey}</kbd>}
      </button>

      {result && (
        <div className={`micresult ${result.verdict}`}>
          <b>{VERDICT_TEXT[result.verdict]}</b>
          {result.heard && <span className="heard">인식된 말: {result.heard}</span>}
          {result.verdict !== 'same' && <TargetHint target={target} />}
          {/* 뜻이 달라지는 차이는 「거의 맞음」으로 넘기지 않고 짚어 준다 */}
          {result.diff && <span className="micwhy">{result.diff.note}</span>}
          {result.flipped && <span className="micwhy">부정이나 수가 달라요 — 뜻이 바뀝니다.</span>}
          {result.verdict === 'none' && (
            <span className="micwhy">소리가 안 잡혔어요. 틀린 걸로 세지 않았어요.</span>
          )}
        </div>
      )}
    </div>
  );
}
