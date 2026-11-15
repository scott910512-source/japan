import { IconSpeaker, IconSpeakerOff } from './Icons.jsx';
import { stopSpeaking } from '../lib/tts.js';

/* 소리 켬 · 눈으로만 — 학습 · 복습 · 시험 화면에서 바로 바꾼다.
 *
 * 소리를 낼 수 없는 자리(지하철 · 사무실)에서는 눈으로만 풀고 싶다. 그 설정(자동 음성)은 설정 → 학습 설정 안에 있어서
 * 공부하다가 끄려면 판을 나가야 했다. 여기서 끄면 앱이 알아서 읽어 주는 소리는 전부 멎고,
 * 듣기 단추(🔊 · Space)를 눌렀을 때만 소리가 난다. 듣기만으로 맞히는 단계는 글자를 보고 떠올리는 단계로 바뀐다.
 * 같은 설정(settings.autoTTS)을 바꾸는 것이라 다음에 열어도 그대로다. */
export default function SoundToggle({ on, onChange, onToast, compact = false }) {
  const flip = () => {
    const next = !on;
    if (!next) stopSpeaking();   // 읽던 소리도 바로 멎는다
    onChange?.({ autoTTS: next });
    onToast?.(next ? '소리를 켰어요 · 카드가 나오면 읽어 줘요' : '눈으로만 풀어요 · 듣기 단추를 눌러야만 소리가 나요');
  };
  return (
    <button
      type="button" className={`soundtoggle${on ? ' on' : ' off'}${compact ? ' compact' : ''}`} data-sound={on ? 'on' : 'off'}
      aria-pressed={on} aria-label={on ? '소리 켬. 눌러서 눈으로만 풀기' : '눈으로만 푸는 중. 눌러서 소리 켜기'}
      onClick={(e) => { e.stopPropagation(); flip(); }}
    >
      {on ? <IconSpeaker /> : <IconSpeakerOff />}
      <span>{on ? '소리 켬' : '눈으로만'}</span>
    </button>
  );
}
