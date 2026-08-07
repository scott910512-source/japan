import { useEffect, useRef, useState } from 'react';
import { IconDownload, IconUpload, IconTrash, IconSpeaker, IconRewind, IconList } from '../components/Icons.jsx';
import {
  exportBackup, importBackup, backupSummary, clearAll, DEFAULT_SETTINGS,
} from '../lib/storage.js';
import { testCloudTTS, ttsStatus, speakJapanese, unlockAudio } from '../lib/tts.js';
import { todayKey } from '../lib/review.js';
import Account from './Account.jsx';
import KeyVault from '../components/KeyVault.jsx';
import VoicePicker from '../components/VoicePicker.jsx';

const MENU_LABELS = {
  basics: '완전기초',
  grammar: '기초문법',
  words: '단어암기',
  sentences: '상황별 문장암기',
  quiz: '단어 시험',
  rpg: '실전연습 (여행연습)',
};

const DIRECTIONS = [
  { id: 'kanji-mean', label: '한자 → 뜻' },
  { id: 'mean-kanji', label: '뜻 → 한자' },
  { id: 'kanji-kana', label: '한자 → 읽기' },
];

const GOALS = [10, 20, 30, 50];

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
    onChange({ gttsKey: key });
    if (!key) {
      onToast('기기 내장 음성으로 재생해요');
      return;
    }
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
          <div key={id} className="toggle-row setrow">
            <div>
              <div className="set-title">{label}</div>
              {id === 'rpg' && <div className="set-sub">기존 여행 RPG — 이관 준비 중</div>}
            </div>
            <button className={`toggle${menus[id] ? ' on' : ''}`} onClick={() => toggleMenu(id)} aria-label={label} />
          </div>
        ))}
        <div className="set-note">끈 메뉴의 학습 기록은 그대로 남아 있어요.</div>
      </div>

      <div className="section-label">학습 기능</div>
      <div className="card">
        <Toggle label="자동 음성" sub="카드가 나오면 바로 읽어줘요"
          on={settings.autoTTS} onClick={() => onChange({ autoTTS: !settings.autoTTS })} />
        <Toggle label="히라가나 항상 보기" sub="앞면에 읽는 법을 함께 표시해요"
          on={settings.showKana} onClick={() => onChange({ showKana: !settings.showKana })} />
        <Toggle label="한글 발음 표기" sub="가나를 한글로 옮겨 적어요 (근사값)"
          on={settings.hangulPron} onClick={() => onChange({ hangulPron: !settings.hangulPron })} />
        <Toggle label="예문 보기" sub="뜻과 함께 예문을 보여줘요"
          on={settings.showExample} onClick={() => onChange({ showExample: !settings.showExample })} />
        <Toggle label="카드 섞기" sub="순서를 외워버리는 걸 막아요"
          on={settings.shuffle} onClick={() => onChange({ shuffle: !settings.shuffle })} />

        <div className="setrow col">
          <div className="set-title">오늘 학습량</div>
          <div className="grouppick">
            {GOALS.map((g) => (
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
          placeholder="AIza... 또는 AQ..."
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          style={{ marginBottom: 6 }}
        />
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

function Toggle({ label, sub, on, onClick }) {
  return (
    <div className="toggle-row setrow">
      <div>
        <div className="set-title">{label}</div>
        {sub && <div className="set-sub">{sub}</div>}
      </div>
      <button className={`toggle${on ? ' on' : ''}`} onClick={onClick} aria-label={label} />
    </div>
  );
}
