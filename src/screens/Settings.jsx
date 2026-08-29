import { useEffect, useRef, useState } from 'react';
import { IconDownload, IconUpload, IconTrash, IconSpeaker, IconRewind, IconList } from '../components/Icons.jsx';
import {
  exportBackup, importBackup, backupSummary, clearAll, DEFAULT_SETTINGS,
} from '../lib/storage.js';
import { testCloudTTS, ttsStatus, speakJapanese, unlockAudio } from '../lib/tts.js';
import { GOAL_CHOICES, todayKey } from '../lib/review.js';
import Account from './Account.jsx';
import KeyVault from '../components/KeyVault.jsx';
import VoicePicker from '../components/VoicePicker.jsx';
import { usageSummary, formatChars } from '../lib/usage.js';
import {
  DEFAULT_GEMINI_MODEL, PROVIDERS, TRANSCRIBE_MINUTES,
  listGeminiModels, looksLikeGeminiKey, resolveProvider,
} from '../lib/videoTutor.js';

const MENU_LABELS = {
  basics: '완전기초',
  grammar: '기초문법',
  words: '단어암기',
  jlpt: 'JLPT 단어',
  sentences: '상황별 문장암기',
  quiz: '단어 시험',
  conjugate: '동사 활용',
  match: '짝 맞추기',
  rpg: '실전 연습',
  translate: '번역기',
};

const DIRECTIONS = [
  { id: 'kanji-mean', label: '한자 → 뜻' },
  { id: 'mean-kanji', label: '뜻 → 한자' },
  { id: 'kanji-kana', label: '한자 → 읽기' },
];


/* 영상 설명을 만들 곳.
 *
 * Gemini 키는 음성 키와 같은 구글 API 키 형식이라, 따로 넣지 않으면 그 키를
 * 그대로 쓴다 — 같은 키를 두 번 넣게 할 이유가 없다.
 * 모델 이름은 자주 바뀐다. 내가 적어 둔 값이 낡으면 404가 나는데, 그때 왜 안
 * 되는지 알 길이 없으니 키로 목록을 직접 받아 고를 수 있게 해 둔다. */
function VideoAI({ settings, onChange, onToast }) {
  const { provider, apiKey, borrowed } = resolveProvider(settings);
  const gemini = provider === PROVIDERS.GEMINI;
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadModels = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const list = await listGeminiModels(apiKey);
      setModels(list);
      onToast(list.length ? `쓸 수 있는 모델 ${list.length}개를 받았어요` : '쓸 수 있는 모델이 없어요');
    } catch (err) {
      onToast(err.message || '모델 목록을 받지 못했어요');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="setrow col">
        <div className="set-title">설명을 만들 곳</div>
        <div className="set-note">
          자막으로 하는 학습은 키 없이도 됩니다. 뜻·문법 설명을 만들 때만 씁니다.
        </div>
        <div className="pickrow-group">
          {[
            { id: PROVIDERS.GEMINI, label: 'Gemini', sub: '구글 · 무료 한도 있음' },
            { id: PROVIDERS.CLAUDE, label: 'Claude', sub: '유료 (쓴 만큼)' },
          ].map((o) => (
            <button
              key={o.id}
              className={`pickrow ai-pick${provider === o.id ? ' active' : ''}`}
              onClick={() => onChange({ aiProvider: o.id })}
            >
              <b>{o.label}</b><span>{o.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {gemini ? (
        <>
          <div className="setrow col">
            <div className="set-title">구글 API 키</div>
            <div className="set-note">
              {borrowed
                ? '아래 음성 키를 그대로 쓰고 있어요. 그 키가 붙은 구글 프로젝트에서 Generative Language API를 켜 두어야 통합니다. 다른 키를 쓰려면 여기 넣으세요.'
                : '비워 두면 아래 음성 키를 그대로 씁니다. 키는 이 기기에만 저장돼요.'}
            </div>
            <input
              type="password"
              value={settings.geminiKey || ''}
              placeholder={settings.gttsKey ? '비우면 음성 키를 씁니다' : 'AIza...'}
              onChange={(e) => onChange({ geminiKey: e.target.value.trim() })}
            />
          </div>

          <div className="setrow col">
            <div className="set-title">모델</div>
            <div className="set-note">
              비우면 기본값을 씁니다. 이름이 맞지 않으면 아래에서 목록을 받아 고르세요.
            </div>
            <input
              value={settings.geminiModel || ''}
              placeholder={DEFAULT_GEMINI_MODEL}
              onChange={(e) => onChange({ geminiModel: e.target.value.trim() })}
            />
            <button className="ghost-btn" disabled={!apiKey || loading} onClick={loadModels}>
              {loading ? '받는 중…' : '쓸 수 있는 모델 보기'}
            </button>
            {models.length > 0 && (
              <div className="modellist">
                {models.map((m) => (
                  <button
                    key={m}
                    className={`modelpick${settings.geminiModel === m ? ' on' : ''}`}
                    onClick={() => onChange({ geminiModel: m })}
                  >{m}</button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="setrow col">
          <div className="set-title">Claude API 키</div>
          <div className="set-note">이 기기에만 저장되고 서버로 보내지 않아요.</div>
          <input
            type="password"
            value={settings.claudeKey || ''}
            placeholder="sk-ant-..."
            onChange={(e) => onChange({ claudeKey: e.target.value.trim() })}
          />
        </div>
      )}

      {/* 영상을 직접 듣게 하는 건 요금이 많이 든다. 기본은 꺼 두고, 알고 켜는
          사람만 쓰게 한다. Gemini만 유튜브를 볼 수 있어 Claude에서는 안 보인다. */}
      {gemini && (
        <>
          <Toggle
            label="영상에서 자막 직접 받아오기"
            sub={`Gemini가 영상을 ${TRANSCRIBE_MINUTES}분까지 듣고 받아 적어요`}
            on={Boolean(settings.videoTranscribe)}
            onClick={() => onChange({ videoTranscribe: !settings.videoTranscribe })}
          />
          <div className="setrow col">
            <div className="set-note">
              끄면 「Gemini 앱에 물어볼 말 복사」로 하시면 돼요 — 유튜브 자막을 그대로
              읽어 오고 요금이 안 듭니다.
              {' '}켜면 앱을 왔다갔다 안 해도 되는 대신 영상 10분에 3만 토큰쯤 써요.
              무료 한도가 금방 닳고, 사람이 만든 자막이 아니라 틀릴 수도 있습니다.
              {' '}자막이 아예 없는 영상에는 이쪽이 유일한 방법이에요.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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

export default function Settings({
  settings, onChange, onReplayOnboarding, onOpenWordManager, onToast, onReload,
  session, syncState, onSync, onSignedOut, onVaultKey, remoteKeyEnvelope, vaultReady,
}) {
  const fileRef = useRef(null);
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

  const menus = settings.menus || DEFAULT_SETTINGS.menus;
  const enabledCount = Object.values(menus).filter(Boolean).length;

  const toggleMenu = (id) => {
    if (menus[id] && enabledCount <= 1) {
      onToast('메뉴를 최소 하나는 켜 두어야 해요');
      return;
    }
    onChange({ menus: { ...menus, [id]: !menus[id] } });
  };

  const download = () => {
    const backup = exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `js-japanese-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onChange({ lastBackup: todayKey() });
    onToast('백업 파일을 내려받았어요');
  };

  const restore = async (file) => {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const s = backupSummary(backup);
      const ok = window.confirm(
        `이 백업으로 되돌릴까요?\n\n내 단어 ${s.customWords}개 · 학습한 단어 ${s.reviewed}개 · 연속 ${s.streak}일` +
        `${s.lastDate ? `\n마지막 학습일 ${s.lastDate}` : ''}\n\n지금 기기의 학습 기록은 이 백업으로 완전히 교체돼요.`,
      );
      if (!ok) return;
      importBackup(backup);
      onToast('복원했어요. 앱을 다시 불러올게요');
      setTimeout(onReload, 600);
    } catch (err) {
      onToast(err.message || '백업 파일을 읽지 못했어요');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* 서비스워커가 옛 화면을 붙잡고 있으면 고친 게 안 보인다.
   * 홈 화면에 추가한 iOS 앱은 사실상 안 닫혀서 갱신이 늦다.
   * 캐시만 비우고 다시 받는다 — 학습 기록은 localStorage에 있어서 그대로 남는다. */
  const forceUpdate = async () => {
    onToast('최신 버전을 받는 중이에요');
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches?.keys?.() ?? [];
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch { /* 지우지 못해도 새로고침은 해 본다 */ }
    window.location.reload(true);
  };

  const reset = () => {
    const typed = window.prompt('학습 기록을 모두 지우려면 "초기화"라고 입력해 주세요.');
    if (typed !== '초기화') return;
    clearAll();
    onToast('초기화했어요');
    setTimeout(onReload, 500);
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
      <div className="navtitle">
        <small>JS일본어</small>
        설정
      </div>

      <div className="section-label">계정</div>
      <Account
        session={session}
        syncState={syncState}
        onSync={onSync}
        onSignedOut={onSignedOut}
        onVaultKey={onVaultKey}
        onToast={onToast}
      />

      <div className="section-label">학습 메뉴</div>
      <div className="card">
        {Object.entries(MENU_LABELS).map(([id, label]) => (
          <button key={id} className="toggle-row setrow" onClick={() => toggleMenu(id)} aria-pressed={Boolean(menus[id])}>
            <span>
              <span className="set-title">{label}</span>
              {id === 'translate' && <span className="set-sub">한국어로 적으면 지금 말할 일본어로 — 발음까지</span>}
            </span>
            <span className={`toggle${menus[id] ? ' on' : ''}`} aria-hidden="true" />
          </button>
        ))}
        <div className="set-note">끈 메뉴의 학습 기록은 그대로 남아 있어요.</div>
      </div>

      <div className="section-label">학습 기능</div>
      <div className="card">
        <Toggle label="자동 음성" sub="카드가 나오면 바로 읽어줘요"
          on={settings.autoTTS} onClick={() => onChange({ autoTTS: !settings.autoTTS })} />
        <Toggle label="판정할 때 읽어주기" sub="몰라요·애매해요·알아요를 고르면 그 단어를 한 번 더 읽어줘요"
          on={settings.speakOnJudge} onClick={() => onChange({ speakOnJudge: !settings.speakOnJudge })} />
        <Toggle label="히라가나 항상 보기" sub="앞면에 읽는 법을 함께 표시해요"
          on={settings.showKana} onClick={() => onChange({ showKana: !settings.showKana })} />
        <Toggle label="한글 발음 표기" sub="가나를 한글로 옮겨 적어요 (근사값)"
          on={settings.hangulPron} onClick={() => onChange({ hangulPron: !settings.hangulPron })} />
        <Toggle label="자동 마이크" sub="뜻을 열면 바로 듣기 시작해요 (처음 한 번은 직접 눌러 권한을 주세요)"
          on={settings.autoMic} onClick={() => onChange({ autoMic: !settings.autoMic })} />
        <Toggle label="예문 보기" sub="뜻과 함께 예문을 보여줘요"
          on={settings.showExample} onClick={() => onChange({ showExample: !settings.showExample })} />
        <Toggle label="카드 섞기" sub="순서를 외워버리는 걸 막아요"
          on={settings.shuffle} onClick={() => onChange({ shuffle: !settings.shuffle })} />

        <div className="setrow col">
          <div className="set-title">여행지</div>
          <div className="set-sub">
            적어 두면 번역기가 그 지역에서 실제로 쓰는 말(사투리)도 같이 알려 줘요.
          </div>
          <input
            type="text"
            value={settings.tripPlace || ''}
            placeholder="예: 오사카 · 후쿠오카"
            onChange={(e) => onChange({ tripPlace: e.target.value })}
          />
        </div>

        <div className="setrow col">
          <div className="set-title">오늘 학습량</div>
          <div className="set-sub">
            하루에 볼 카드 수예요. 이 안에서 새 단어 4 : 복습 1로 나눠 담습니다.
          </div>
          <div className="grouppick">
            {GOAL_CHOICES.map((g) => (
              <button key={g} className={settings.dailyGoal === g ? 'active' : ''}
                onClick={() => onChange({ dailyGoal: g })}>{g}장</button>
            ))}
          </div>
        </div>

        <div className="setrow col">
          <div className="set-title">회독 방향</div>
          <div className="grouppick">
            {DIRECTIONS.map((d) => (
              <button key={d.id} className={settings.direction === d.id ? 'active' : ''}
                onClick={() => onChange({ direction: d.id })}>{d.label}</button>
            ))}
          </div>
        </div>

        <div className="setrow col">
          <div className="set-title">음성 속도 <span className="set-val">{settings.speechRate.toFixed(2)}x</span></div>
          <input type="range" min="0.6" max="1.2" step="0.05" value={settings.speechRate}
            onChange={(e) => onChange({ speechRate: Number(e.target.value) })} />
        </div>
      </div>

      <div className="section-label">영상 학습</div>
      <VideoAI settings={settings} onChange={onChange} onToast={onToast} />

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
        </div>
        <div className="set-note">
          소리가 안 나면 폰의 무음 스위치와 볼륨을 먼저 확인해 주세요.
        </div>

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

      <div className="section-label">데이터</div>
      <div className="card">
        <div className="set-sub" style={{ marginBottom: 10 }}>
          학습 기록은 이 브라우저에만 저장돼요. 브라우저 데이터를 지우면 함께 사라지니 가끔 백업해 두세요.
          {settings.lastBackup && <><br />마지막 백업 {settings.lastBackup}</>}
        </div>
        <div className="btnrow">
          <button className="ghost-btn" onClick={download}><IconDownload /> 백업 내려받기</button>
          <button className="ghost-btn" onClick={() => fileRef.current?.click()}><IconUpload /> 복원하기</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden
          onChange={(e) => restore(e.target.files?.[0])} />
        <button className="ghost-btn danger" style={{ marginTop: 10, width: '100%' }} onClick={reset}>
          <IconTrash /> 학습 기록 초기화
        </button>
      </div>

      <div className="section-label">기타</div>
      <div className="card">
        <button className="listrow" onClick={onOpenWordManager}>
          <IconList /> 내 단어장 관리
        </button>
        <button className="listrow" onClick={onReplayOnboarding}>
          <IconRewind /> 처음 질문 다시 하기
        </button>
        <button className="listrow" onClick={forceUpdate}>
          <IconDownload /> 최신 버전 받기
        </button>
        <div className="set-note">
          JS일본어 · 회독 학습 · 빌드 {__BUILD_STAMP__}
          <br />
          고친 게 안 보이면 위 버튼을 누르세요. 빌드 시각이 바뀌면 새 버전입니다.
          학습 기록은 지워지지 않아요.
        </div>
      </div>
    </>
  );
}

/* 줄 전체가 눌린다. 44×26짜리 스위치만 받으면 폰에서 헛누름이 잦다 —
   글씨를 눌렀는데 아무 일도 안 일어나면 고장 난 걸로 읽힌다. */
function Toggle({ label, sub, on, onClick }) {
  return (
    <button className="toggle-row setrow" onClick={onClick} aria-pressed={on}>
      <span>
        <span className="set-title">{label}</span>
        {sub && <span className="set-sub">{sub}</span>}
      </span>
      <span className={`toggle${on ? ' on' : ''}`} aria-hidden="true" />
    </button>
  );
}
