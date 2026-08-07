import { useEffect, useRef, useState } from 'react';
import { IconMic } from './Icons.jsx';
import {
  cancelRecording, cloudSTTReady, listenWithBrowser, micReady, scoreSpeech,
  startRecording, stopBrowserListening, stopRecordingAndRecognize, sttAvailable,
} from '../lib/stt.js';

const VERDICT_TEXT = {
  good: '잘 통했어요',
  close: '거의 맞아요',
  off: '다시 해볼까요',
  none: '못 알아들었어요',
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

  // 카드가 바뀌면 이전 결과를 지우고, 녹음 중이었다면 끊는다
  useEffect(() => {
    setResult(null);
    armed.current = false;
    return () => {
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

  if (!available) return null;

  const finish = (said) => {
    const scored = scoreSpeech(said, expected);
    setResult({ said, ...scored });
    setState('idle');
    busy.current = false;
    onResult?.(scored, said);
  };

  const stopCloud = async () => {
    if (busy.current) return;
    busy.current = true;
    setState('working');
    try {
      const said = await stopRecordingAndRecognize(hints);
      finish(said);
    } catch (err) {
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
      (said) => finish(said),
      (err) => {
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
          {result.said && <span className="heard">들린 말: {result.said}</span>}
          {result.verdict !== 'good' && <TargetHint target={target} />}
        </div>
      )}
    </div>
  );
}
