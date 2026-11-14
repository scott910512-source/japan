/* 고를 수 있는 일본어 음성 목록.
 *
 * 회화형(Chirp 3 HD)은 사람이 말하듯 읽는다 — 쉼표 없이 긴 글이나 일상 회화 대본에서
 * 낭독형(Neural2)보다 덜 딱딱하다. 대신 무료 분량(월 100만 자)을 넘으면 요금이 약 2배다.
 * 키에 따라 못 쓰는 목소리가 있으면 tts.js가 「여성 1」(Neural2)로 대신 읽고 알려 준다.
 * 프로젝트에 따라 Neural2도 못 쓰는 경우가 있어 WaveNet과 Standard도 함께 둔다. */

export const CLOUD_VOICES = [
  /* 결(trait)은 구글이 목소리마다 붙여 둔 성격이다 — 이름만으로는 어떤 소리인지 알 수 없어 같이 보인다.
     들어 보고 고르는 것이 제일 정확하다(누르면 바로 들려준다). 번호는 넣은 순서라 바꾸지 않는다(기기에 남은 설정이 이름으로 남아 있다) */
  { id: 'ja-JP-Chirp3-HD-Aoede', label: '회화 여성 1', tier: 'Chirp 3 HD', trait: '산뜻한', gender: 'female', talk: true },
  { id: 'ja-JP-Chirp3-HD-Kore', label: '회화 여성 2', tier: 'Chirp 3 HD', trait: '또렷한', gender: 'female', talk: true },
  { id: 'ja-JP-Chirp3-HD-Leda', label: '회화 여성 3', tier: 'Chirp 3 HD', trait: '젊은', gender: 'female', talk: true },
  { id: 'ja-JP-Chirp3-HD-Vindemiatrix', label: '회화 여성 4', tier: 'Chirp 3 HD', trait: '상냥한', gender: 'female', talk: true },
  { id: 'ja-JP-Chirp3-HD-Achernar', label: '회화 여성 5', tier: 'Chirp 3 HD', trait: '부드러운', gender: 'female', talk: true },
  { id: 'ja-JP-Chirp3-HD-Charon', label: '회화 남성 1', tier: 'Chirp 3 HD', trait: '차분한', gender: 'male', talk: true },
  { id: 'ja-JP-Chirp3-HD-Puck', label: '회화 남성 2', tier: 'Chirp 3 HD', trait: '밝은', gender: 'male', talk: true },
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

export const isTalkVoice = (id = '') => /chirp/i.test(String(id));
export const voiceLabel = (id) => CLOUD_VOICES.find((v) => v.id === id)?.label || '';

// 기기에 깔린 일본어 음성. 기종·OS마다 달라 목록을 미리 정할 수 없다.
export function deviceJapaneseVoices() {
  const all = (typeof window !== 'undefined' && window.speechSynthesis?.getVoices()) || [];
  return all.filter((v) => v.lang?.toLowerCase().startsWith('ja'));
}
