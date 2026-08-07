import { useEffect, useState } from 'react';
import { IconSpeaker } from './Icons.jsx';
import { speakJapanese } from '../lib/tts.js';
import { CLOUD_VOICES, deviceJapaneseVoices } from '../lib/voices.js';

const SAMPLE = 'こんにちは。今日もよろしくお願いします。';

/* 목소리 고르기.
 * 클라우드 키가 있으면 구글 목소리를, 없으면 기기에 깔린 일본어 음성을 고른다.
 * 고르는 즉시 그 목소리로 들려준다 — 이름만 보고는 어떤 소린지 알 수 없다. */
export default function VoicePicker({ settings, onChange, cloudReady }) {
  const [deviceVoices, setDeviceVoices] = useState(() => deviceJapaneseVoices());

  // 기기 음성 목록은 늦게 채워진다
  useEffect(() => {
    const sync = () => setDeviceVoices(deviceJapaneseVoices());
    sync();
    const timer = setTimeout(sync, 800);
    window.speechSynthesis?.addEventListener?.('voiceschanged', sync);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', sync);
    };
  }, []);

  const preview = () => speakJapanese(SAMPLE, settings.speechRate);

  if (cloudReady) {
    return (
      <div className="setrow col">
        <div className="set-title">목소리</div>
        <div className="voicegrid">
          {CLOUD_VOICES.map((v) => (
            <button
              key={v.id}
              className={`voicecell${settings.gttsVoice === v.id ? ' active' : ''}`}
              onClick={() => { onChange({ gttsVoice: v.id }); setTimeout(preview, 120); }}
            >
              <span className="vc-label">{v.label}</span>
              <span className="vc-tier">{v.tier}</span>
            </button>
          ))}
        </div>
        <button className="ghost-btn" style={{ width: '100%', marginTop: 10 }} onClick={preview}>
          <IconSpeaker /> 지금 목소리로 들어보기
        </button>
        <div className="set-note">
          Neural2가 가장 자연스러워요. 프로젝트에 따라 못 쓰는 목소리가 있으면
          다른 걸 골라 주세요.
        </div>
      </div>
    );
  }

  if (deviceVoices.length <= 1) {
    return (
      <div className="setrow col">
        <div className="set-title">목소리</div>
        <div className="set-note" style={{ marginTop: 4 }}>
          {deviceVoices.length === 1
            ? `이 기기에는 일본어 음성이 하나뿐이에요 (${deviceVoices[0].name}).`
            : '이 기기에서 고를 수 있는 일본어 음성이 없어요.'}
          {' '}클라우드 키를 넣으면 남성·여성 목소리를 고를 수 있어요.
        </div>
      </div>
    );
  }

  return (
    <div className="setrow col">
      <div className="set-title">목소리 <span className="set-val">기기 내장</span></div>
      <div className="voicelist">
        {deviceVoices.map((v) => (
          <button
            key={v.voiceURI}
            className={`voicerow${settings.deviceVoiceURI === v.voiceURI ? ' active' : ''}`}
            onClick={() => { onChange({ deviceVoiceURI: v.voiceURI }); setTimeout(preview, 120); }}
          >
            <span>{v.name}</span>
            <IconSpeaker />
          </button>
        ))}
      </div>
      <div className="set-note">클라우드 키를 넣으면 더 자연스러운 목소리를 쓸 수 있어요.</div>
    </div>
  );
}
