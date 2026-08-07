/* 고를 수 있는 일본어 음성 목록.
 *
 * Neural2가 가장 자연스럽지만 프로젝트에 따라 못 쓰는 경우가 있어
 * WaveNet과 Standard도 함께 둔다. 호출이 실패하면 tts.js가 기기 음성으로 넘어간다. */

export const CLOUD_VOICES = [
  { id: 'ja-JP-Neural2-B', label: '여성 1', tier: 'Neural2', gender: 'female' },
  { id: 'ja-JP-Neural2-C', label: '남성 1', tier: 'Neural2', gender: 'male' },
  { id: 'ja-JP-Neural2-D', label: '남성 2', tier: 'Neural2', gender: 'male' },
  { id: 'ja-JP-Wavenet-A', label: '여성 2', tier: 'WaveNet', gender: 'female' },
  { id: 'ja-JP-Wavenet-B', label: '여성 3', tier: 'WaveNet', gender: 'female' },
  { id: 'ja-JP-Wavenet-C', label: '남성 3', tier: 'WaveNet', gender: 'male' },
  { id: 'ja-JP-Wavenet-D', label: '남성 4', tier: 'WaveNet', gender: 'male' },
  { id: 'ja-JP-Standard-A', label: '여성 4', tier: 'Standard', gender: 'female' },
  { id: 'ja-JP-Standard-C', label: '남성 5', tier: 'Standard', gender: 'male' },
];

export const DEFAULT_CLOUD_VOICE = 'ja-JP-Neural2-B';

export function voiceLabel(id) {
  const found = CLOUD_VOICES.find((v) => v.id === id);
  return found ? `${found.label} · ${found.tier}` : id;
}

// 기기에 깔린 일본어 음성. 기종·OS마다 달라 목록을 미리 정할 수 없다.
export function deviceJapaneseVoices() {
  const all = (typeof window !== 'undefined' && window.speechSynthesis?.getVoices()) || [];
  return all.filter((v) => v.lang?.toLowerCase().startsWith('ja'));
}
