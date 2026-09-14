import { useEffect, useState } from 'react';
import { IconSpeaker } from './Icons.jsx';
import { onSpeaking, speakIn, stopSpeaking } from '../lib/tts.js';

/* 🔊 버튼 — 지금 읽고 있는지가 보인다.
 *
 * 문장이 열 개 있으면 🔊도 열 개다. 어느 것을 읽는 중인지 안 보이면 연속으로
 * 눌렀을 때 뭐가 나는지 모른다. tts가 「이 id를 읽기 시작했다/끝났다」를
 * 알려 주고, 버튼은 자기 id일 때만 켜진다. 다른 버튼이 시작하면 이전 것은
 * 끊기고(cancel) 그 버튼은 저절로 꺼진다 — 겹치지 않는다.
 *
 * 읽는 중에 다시 누르면 멈춘다. 카드 안에 있을 때 카드의 누름까지 타지 않게
 * 이벤트를 여기서 멈춘다. 손가락 자리는 44px. */
export default function SpeakButton({
  text, lang = 'de-DE', rate = 0.9, id, label = '듣기', className = '', children,
}) {
  const myId = id || `${lang}:${text}`;
  const [playing, setPlaying] = useState(false);

  useEffect(() => onSpeaking((s) => { if (s.id === myId) setPlaying(Boolean(s.active)); }), [myId]);

  const onClick = (e) => {
    e.stopPropagation();
    if (playing) { stopSpeaking(); return; }
    speakIn(text, lang, rate, { id: myId });
  };

  return (
    <button
      type="button"
      className={`spk${playing ? ' playing' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      aria-label={playing ? '멈추기' : `${label}: ${text}`}
      aria-pressed={playing}
      data-lang={lang}
    >
      <IconSpeaker />
      {children}
    </button>
  );
}
