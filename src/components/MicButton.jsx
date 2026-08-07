import { useEffect, useRef, useState } from 'react';
import { IconMic } from './Icons.jsx';
import {
  cancelRecording, cloudSTTReady, listenWithBrowser, scoreSpeech,
  startRecording, stopBrowserListening, stopRecordingAndRecognize, sttAvailable,
} from '../lib/stt.js';

const VERDICT_TEXT = {
  good: '잘 통했어요',
  close: '거의 맞아요',
  off: '다시 해볼까요',
  none: '못 알아들었어요',
};

/* 말해보기 버튼.
 * expected에는 정답으로 인정할 표기를 전부 넘긴다(한자·가나 둘 다).
 * hints는 인식 정확도를 올리는 힌트로 서버에 함께 보낸다. */
export default function MicButton({ expected, hints = [], onResult, onToast, label = '말해보기' }) {
  const [state, setState] = useState('idle'); // idle | listening | working
  const [result, setResult] = useState(null);
  const busy = useRef(false);

  // 카드가 바뀌면 이전 결과를 지우고, 녹음 중이었다면 끊는다
  useEffect(() => {
    setResult(null);
    return () => {
      cancelRecording();
      stopBrowserListening();
    };
  }, [expected?.[0]]);

  if (!sttAvailable()) return null;

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

  return (
    <div className="micwrap">
      <button
        className={`micbtn ${state}`}
        onClick={() => (state === 'listening' ? stop() : state === 'idle' && start())}
        disabled={state === 'working'}
      >
        <IconMic />
        <span>
          {state === 'listening' ? '듣는 중… (다 말하면 자동으로 끝나요)'
            : state === 'working' ? '알아듣는 중…'
              : label}
        </span>
      </button>

      {result && (
        <div className={`micresult ${result.verdict}`}>
          <b>{VERDICT_TEXT[result.verdict]}</b>
          {result.said && <span className="heard">들린 말: {result.said}</span>}
        </div>
      )}
    </div>
  );
}
