import { useEffect, useState } from 'react';
import { IconSpeaker } from '../../components/Icons.jsx';
import { onSpeaking, speakJapaneseAsync, stopSpeaking } from '../../lib/tts.js';

/* 일본어 🔊 — 독일어 SpeakButton과 같은 규칙. 읽는 동안 켜지고, 누르면 멈춘다.
   소리는 늘 읽기(kana)로 낸다 — 한자를 그대로 넘기면 엔진이 읽는 법을 제멋대로 고른다. */
export default function JpSpeak({ text, rate = 0.9, id, label = '듣기', className = '', children }) {
  const myId = id || `ja:${text}`;
  const [playing, setPlaying] = useState(false);
  useEffect(() => onSpeaking((s) => { if (s.id === myId) setPlaying(Boolean(s.active)); }), [myId]);
  const onClick = (e) => {
    e.stopPropagation();
    if (playing) { stopSpeaking(); return; }
    speakJapaneseAsync(text, rate, { id: myId });
  };
  return (
    <button type="button" className={`spk n3-spk${playing ? ' playing' : ''}${className ? ` ${className}` : ''}`} onClick={onClick}
      aria-label={playing ? '멈추기' : `${label}: ${text}`} aria-pressed={playing} data-lang="ja-JP">
      <IconSpeaker />
      {children}
    </button>
  );
}
