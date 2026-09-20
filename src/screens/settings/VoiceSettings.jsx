import { useEffect, useState } from 'react';
import { IconSpeaker, IconTrash } from '../../components/Icons.jsx';
import KeyVault from '../../components/KeyVault.jsx';
import VoicePicker from '../../components/VoicePicker.jsx';
import {
  testCloudTTS, ttsStatus, speakJapanese, unlockAudio, koreanSoundReport,
} from '../../lib/tts.js';
import { usageSummary, formatChars } from '../../lib/usage.js';
import { looksLikeGeminiKey } from '../../lib/videoTutor.js';

/* 설정 → 음성. Settings.jsx에서 떼어 냈다 — 키 입력·소리 확인·사용량은 이
   묶음만 쓰는 상태라 여기서 들고 있는다. 동작은 그대로다. */
// 키를 그대로 띄우면 어깨너머로 보인다. 저장 여부만 알 수 있게 앞뒤만 남긴다.
function maskKey(key = '') {
  if (key.length <= 10) return `${key.slice(0, 2)}${'•'.repeat(6)}`;
  return `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}`;
}

const STATUS_TEXT = {
  cloud: '클라우드 음성 사용 중',
  device: '기기 내장 일본어 음성 사용 중',
  'device-nojp': '일본어 음성을 못 찾았어요',
  unknown: '음성 상태를 확인하는 중',
};

export default function VoiceSettings({ settings, onChange, onToast, session, remoteKeyEnvelope, vaultReady }) {
  const [keyDraft, setKeyDraft] = useState(settings.gttsKey || '');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  // 다른 경로로 키가 바뀌면(기존 앱에서 승계, 계정 동기화) 입력칸도 따라간다
  useEffect(() => {
    setKeyDraft(settings.gttsKey || '');
  }, [settings.gttsKey]);
  const [status, setStatus] = useState(() => ttsStatus());

  // 음성 목록은 늦게 채워지고 키를 바꾸면 경로도 바뀐다 — 화면이 열려 있는 동안 계속 맞춘다.
  useEffect(() => {
    const sync = () => setStatus(ttsStatus());
    sync();
    const timer = setInterval(sync, 1000);
    if (window.speechSynthesis) window.speechSynthesis.addEventListener?.('voiceschanged', sync);
    return () => {
      clearInterval(timer);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', sync);
    };
  }, [settings.gttsKey, settings.useCloudTTS]);

  /* 이번 달 읽어준 글자 수.
   * 콘솔 측정항목에는 요청 수만 나오고 글자 수는 결제 보고서에 하루 늦게 뜬다.
   * 여기서 바로 보이면 콘솔에 들어갈 일이 없다. 소리를 낼 때마다 다시 읽는다. */
  const [usage, setUsage] = useState(() => usageSummary(settings.gttsVoice));
  useEffect(() => {
    const tick = () => setUsage(usageSummary(settings.gttsVoice));
    tick();
    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [settings.gttsVoice]);

  // 버튼을 눌러 소리를 내보는 건 사용자 제스처라, iOS에서 재생이 막혀 있던 것도 이때 풀린다.
  const tryVoice = () => {
    unlockAudio();
    speakJapanese('こんにちは。日本語の勉強を始めましょう。', settings.speechRate);
    setStatus(ttsStatus());
  };

  /* ★ 한국어 뜻이 왜 조용한지 눌러서 본다 ★
     이건 기기에서만 드러나는 문제다. 크롬에서는 멀쩡한데 아이폰에서만 조용해서,
     짐작으로 두 번 고치고 두 번 빗나갔다. 무엇이 일어나는지 보이게 둔다. */
  const [koReport, setKoReport] = useState(null);
  const [koTesting, setKoTesting] = useState(false);
  const tryKorean = async () => {
    unlockAudio();
    setKoTesting(true);
    setKoReport(null);
    try {
      setKoReport(await koreanSoundReport(settings.speechRate || 1));
    } catch (err) {
      setKoReport([`확인하다 막혔어요 — ${err.message}`]);
    }
    setKoTesting(false);
  };

  const saveKey = async () => {
    const key = keyDraft.trim();
    if (!key) {
      onChange({ gttsKey: '' });
      onToast('기기 내장 음성으로 재생해요');
      return;
    }
    /* Gemini 키를 음성 칸에 넣으면 구글이 "Expected OAuth2 access token…"으로
       거절한다. 그 말로는 뭐가 잘못됐는지 알 수 없으니, 저장하기 전에 막는다.
       기존에 되던 키를 덮어쓰는 게 더 큰 손해라 저장 자체를 하지 않는다. */
    if (looksLikeGeminiKey(key)) {
      onToast('이건 Gemini 키예요. 음성에는 Cloud TTS 키(AIza…)가 필요해요');
      return;
    }
    onChange({ gttsKey: key });
    setTesting(true);
    const result = await testCloudTTS(key);
    setTesting(false);
    onToast(result.ok ? '클라우드 음성이 연결됐어요' : `키를 확인해 주세요 — ${result.message}`);
  };

  return (
    <>

      <div className="section-label">음성</div>
      <div className="card">
        <div className={`ttsbadge ${status.mode}`}>{STATUS_TEXT[status.mode]}</div>
        {status.mode !== 'cloud' && (
          <div className="set-sub" style={{ marginTop: 8 }}>
            {status.mode === 'device-nojp' || status.mode === 'unknown'
              ? '이 기기에 일본어 음성이 없을 수 있어요. 아래에 클라우드 키를 넣으면 확실하게 들려요.'
              : '클라우드 키를 넣으면 훨씬 자연스러운 음성으로 읽어줘요.'}
          </div>
        )}

        <VoicePicker
          settings={settings}
          onChange={onChange}
          cloudReady={status.mode === 'cloud'}
        />

        <div className="btnrow" style={{ marginTop: 10 }}>
          <button className="ghost-btn" onClick={tryVoice}><IconSpeaker /> 지금 소리 내보기</button>
          <button className="ghost-btn ko-check" onClick={tryKorean} disabled={koTesting}>
            <IconSpeaker /> {koTesting ? '확인 중…' : '한국어 뜻 확인'}
          </button>
        </div>
        <div className="set-note">
          소리가 안 나면 폰의 무음 스위치와 볼륨을 먼저 확인해 주세요.
        </div>
        {/* 자동 듣기에서 뜻이 조용할 때, 어디서 끊기는지 눌러서 볼 수 있게 둔다 */}
        {koReport && (
          <div className="korep">
            {koReport.map((line) => <div key={line} className="korep-line">{line}</div>)}
          </div>
        )}

        {status.mode === 'cloud' && (
          <div className="usagebox">
            <div className="ub-top">
              <span className="ub-label">이번 달 읽어준 글자</span>
              <span className={`ub-val${usage.over ? ' over' : ''}`}>
                {formatChars(usage.used)} / {formatChars(usage.limit)}자
              </span>
            </div>
            <div className="ub-bar"><i style={{ width: `${Math.min(100, usage.percent)}%` }} /></div>
            <div className="set-note" style={{ marginTop: 6 }}>
              {usage.over
                ? '무료 한도를 넘었어요. 넘은 만큼만 요금이 붙어요.'
                : `무료 한도까지 ${formatChars(usage.left)}자 남았어요.`}
              {' '}이 기기에서 보낸 것만 세고, 매달 1일에 다시 0부터예요.
              같은 단어를 다시 들을 땐 저장해 둔 소리를 쓰므로 늘지 않아요.
            </div>
          </div>
        )}

        <div className="set-title" style={{ marginTop: 16 }}>Google Cloud TTS 키</div>

        {/* 빈 칸만 보이면 "저장이 안 된 건지, 원래 안 보이는 건지" 알 수 없다.
            저장된 키가 있으면 가려서라도 보여준다. */}
        <div className="keystate">
          {settings.gttsKey
            ? <><b>저장됨</b> · {maskKey(settings.gttsKey)}</>
            : <>이 기기에는 아직 키가 없어요</>}
        </div>
        <div className="set-sub" style={{ margin: '6px 0 8px' }}>
          키는 기기마다 따로 저장돼요. 아이폰에 넣어도 아이패드에는 자동으로 오지 않아요.
        </div>

        {/* type=password로 두면 iOS 암호 자동완성이 끼어들어 화면 값과 실제 값이
            어긋난 채 저장될 수 있다. 직접 가리고 자동완성은 꺼 둔다. */}
        <input
          className="search-input"
          type={showKey ? 'text' : 'password'}
          name="gtts-api-key"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="AIza..."
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          style={{ marginBottom: 6 }}
        />
        {looksLikeGeminiKey(keyDraft) && (
          <p className="set-warn">
            이건 AI Studio에서 받은 <b>Gemini 키</b>예요. 음성에는 Google Cloud의
            TTS 키(AIza…)가 필요합니다. 이 키는 <b>영상 학습 → 구글 API 키</b>에 넣어 주세요.
          </p>
        )}
        <button className="keypeek" onClick={() => setShowKey((v) => !v)}>
          {showKey ? '가리기' : '입력한 키 보기'}
        </button>
        <div className="btnrow">
          <button className="ghost-btn" onClick={saveKey} disabled={testing}>
            <IconSpeaker /> {testing ? '확인 중...' : '저장하고 확인'}
          </button>
          {settings.gttsKey && (
            <button className="ghost-btn danger" onClick={() => { setKeyDraft(''); onChange({ gttsKey: '' }); onToast('키를 지웠어요'); }}>
              <IconTrash /> 키 지우기
            </button>
          )}
        </div>
        <KeyVault
          session={session}
          localKey={settings.gttsKey}
          remoteEnvelope={remoteKeyEnvelope}
          vaultReady={vaultReady}
        />

        <div className="set-note">
          웹에 올라간 앱에서 쓰는 키는 브라우저에 노출될 수밖에 없어요.
          Google Cloud 콘솔에서 이 키에 <b>웹사이트 제한(HTTP 리퍼러)</b>과
          <b> Text-to-Speech API만 허용</b>을 걸어 두세요. 기존 여행 RPG 앱에 저장해 둔 키가 있으면 자동으로 가져와요.
        </div>
      </div>

          </>
  );
}
