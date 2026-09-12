import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconDownload, IconUpload, IconTrash, IconSpeaker, IconRewind, IconList, IconMap, IconChevron,
} from '../components/Icons.jsx';
import {
  exportBackup, importBackup, backupSummary, backupContents, BACKUP_EXCLUDED,
  clearAll, DEFAULT_SETTINGS,
} from '../lib/storage.js';
import { testCloudTTS, ttsStatus, speakJapanese, unlockAudio } from '../lib/tts.js';
import { GOAL_CHOICES, todayKey } from '../lib/review.js';
import {
  normalizeGoals, DAY_PRESETS, spreadGoal, goalTotal, presetOf,
} from '../lib/daily.js';
import Account from './Account.jsx';
import KeyVault from '../components/KeyVault.jsx';
import VoicePicker from '../components/VoicePicker.jsx';
import { usageSummary, formatChars } from '../lib/usage.js';
import { MENUS, MENU_GROUPS } from '../lib/menu.js';
import { PURPOSES, purposeOf, tripLabel } from '../lib/purpose.js';
import {
  DEFAULT_GEMINI_MODEL, PROVIDERS, TRANSCRIBE_MINUTES,
  listGeminiModels, looksLikeGeminiKey, resolveProvider,
} from '../lib/videoTutor.js';

/* 메뉴 목록은 lib/menu.js 하나로 정한다. 여기에 또 적어 두면 학습 탭에서
   없앤 메뉴가 설정에는 남아, 켜도 아무 데도 안 뜨는 칸이 생긴다 —
   「JLPT 단어」를 단어암기에 합칠 때 실제로 그럴 뻔했다. */

/* 갈래별 하루 목표. 「약점」이 왜 따로 있는지 한 줄로 적어 둔다 —
   안 적으면 복습과 뭐가 다른지 모른 채로 숫자만 만지게 된다. */
const LANE_GOALS = [
  { key: 'fresh', label: '새 단어', note: '오늘 처음 보는 것' },
  { key: 'review', label: '복습', note: '복습일이 된 것' },
  { key: 'weak', label: '약점', note: '세 번 넘게 틀린 것 — 열 번 넘으면 한 판에 두 번 나와요' },
];

/* ★ 더보기는 고를 것 여섯 줄 ★
   긴 한 화면을 내려가며 찾던 것을, 이름을 보고 들어가는 목록으로 바꾼다.
   sub에 무엇이 들어 있는지 적는다 — 이름만으로는 어디에 뭐가 있는지 모른다. */
const MORE_GROUPS = [
  { id: 'study', label: '학습 설정', sub: '학습 목적 · 하루 분량 · 문장 범위 · 메뉴 · 표시 방식' },
  { id: 'voice', label: '음성', sub: '목소리 · 속도 · 자동 읽기 · 소리 테스트' },
  { id: 'account', label: '계정과 동기화', sub: '로그인 · 기기 간 동기화 상태' },
  { id: 'backup', label: '기록 백업', sub: '내려받기 · 복원 · 무엇이 들어가나' },
  { id: 'tools', label: '학습 도구', sub: '내 단어장 · 번역기 · 영상 AI 연결' },
  { id: 'about', label: '앱 정보', sub: '버전 · 최신 버전 받기 · 초기화' },
];

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
  settings, onChange, onReplayOnboarding, onOpenWordManager, onOpenTranslate, onToast, onReload,
  session, syncState, storeError, onSync, onSignedOut, onVaultKey, remoteKeyEnvelope, vaultReady,
}) {
  const goals = normalizeGoals(settings.goals ?? settings.dailyGoal);
  /* 총량으로 고르고 갈래는 접어 둔다. 기존에 직접 맞춰 둔 목표는 프리셋에
     억지로 끼우지 않는다 — presetOf가 null이면 「직접 정함」이 사실이다. */
  const total = goalTotal(goals);
  const preset = presetOf(goals);
  const [showLanes, setShowLanes] = useState(false);
  // 어느 묶음을 보고 있나. null이면 고르는 목록.
  const [group, setGroup] = useState(null);
  /* ── 저장 상태 한 줄 ──
   *
   * 화면에 「계정에 저장돼요」와 「이 브라우저에만 저장돼요」가 같이 있어서,
   * 무엇이 어디에 있는지 알 수 없었다. 실제 상태에서 하나만 만든다.
   *
   * 없는 정보는 말하지 않는다. 「미전송 변경 N개」는 그걸 세는 장치가 없어서
   * 적지 않는다 — 숫자를 지어내는 것보다 안 적는 게 낫다. */
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const save = (() => {
    /* 저장이 막힌 건 다른 무엇보다 먼저 알려야 한다 — 지금 공부하는 게
       하나도 안 남고 있다는 뜻이다. */
    if (storeError) {
      return { tone: 'bad', title: '기록을 저장하지 못했어요', sub: `${storeError} 지금 백업해 두고 저장 공간을 비워 주세요.` };
    }
    if (!session) {
      return {
        tone: 'warn',
        title: '이 기기에만 저장 중',
        sub: '브라우저 데이터를 지우면 함께 사라져요. 가끔 백업하거나 로그인해 주세요.',
      };
    }
    if (syncState?.busy) return { tone: 'ok', title: '동기화 중이에요', sub: '잠시만 기다려 주세요.' };
    if (syncState?.error) {
      return { tone: 'bad', title: '마지막 동기화가 실패했어요', sub: `${syncState.error} — 이 기기에는 저장돼 있어요.` };
    }
    if (!online) {
      return { tone: 'warn', title: '이 기기에 저장됨 · 연결 후 동기화', sub: '지금은 오프라인이에요. 연결되면 계정으로 올려요.' };
    }
    if (syncState?.at) {
      const at = new Date(syncState.at);
      const when = Number.isNaN(at.getTime()) ? '' : ` ${at.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      return { tone: 'ok', title: '계정에 동기화됨', sub: `마지막 성공${when}. 영상 자료는 따로 올라가요.` };
    }
    return { tone: 'warn', title: '아직 동기화하지 않았어요', sub: '계정에 올리려면 위에서 「지금 동기화」를 눌러 주세요.' };
  })();

  const fileRef = useRef(null);
  /* 백업 범위는 열었을 때만 센다 — 저장소를 읽는 일이라 매번 그릴 때마다
     하면 설정 화면이 스크롤할 때 같이 무거워진다. */
  const [showScope, setShowScope] = useState(false);
  const scope = useMemo(
    () => (showScope ? backupContents(exportBackup()) : []),
    [showScope],
  );
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
      /* ★ 이 파일에 실제로 든 것만 교체된다 ★
         「완전히 교체」라고만 적어 두면, 이 파일에 없는 칸(옛 백업의 영상·자막)이
         지워진 줄 알거나 남은 줄 알거나 둘 다 짐작이 된다. 든 것을 세어 보여 준다. */
      const has = backupContents(backup).filter((r) => r.present && r.count !== 0);
      const ok = window.confirm(
        `이 백업으로 되돌릴까요?\n\n내 단어 ${s.customWords}개 · 학습한 단어 ${s.reviewed}개 · 연속 ${s.streak}일`
        + `${s.lastDate ? `\n마지막 학습일 ${s.lastDate}` : ''}`
        + `\n\n이 파일에 든 것: ${has.map((r) => r.label).join(' · ') || '없음'}`
        + '\n이 항목만 교체돼요. 파일에 없는 기록과 이 기기의 API 키는 그대로 남아요.',
      );
      if (!ok) return;
      importBackup(backup);   // 하나라도 저장에 실패하면 되돌리고 던진다
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
   * 캐시만 비우고 다시 받는다 — 학습 기록은 localStorage에 있어서 그대로 남는다.
   *
   * ★ 우리 것만 지운다 ★
   *
   * 여태 getRegistrations()와 caches.keys()로 가져온 것을 전부 해제·삭제했다.
   * 같은 출처(scott910512-source.github.io)에 다른 앱도 올라가니, 이 버튼이
   * 남의 앱 캐시와 서비스워커까지 지울 수 있는 구조였다. 다른 앱에 실제로
   * 서비스워커가 있다는 뜻은 아니지만, 「최신 버전 받기」가 옆 앱을 망가뜨릴
   * 수 있게 두어야 할 이유는 없다.
   *
   * 서비스워커는 scope가 이 앱 밑인 것만, 캐시는 이름표(cacheId)가 붙은 것만
   * 골라 지운다. */
  const forceUpdate = async () => {
    onToast('최신 버전을 받는 중이에요');
    try {
      const here = new URL(__BASE_PATH__, window.location.origin).href;
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? [];
      await Promise.all(regs
        .filter((r) => (r.scope || '').startsWith(here))
        .map((r) => r.unregister()));
      const keys = await caches?.keys?.() ?? [];
      await Promise.all(keys
        /* workbox가 만든 이름에는 cacheId가 들어간다. 옛 배포에서 만든 캐시는
           이름표가 없을 수 있어서 경로로도 한 번 걸러 준다. */
        .filter((k) => k.includes(__CACHE_ID__) || k.includes(__BASE_PATH__))
        .map((k) => caches.delete(k)));
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

  /* ★ 긴 한 화면을 짧은 목록으로 ★
   *
   * 계정 · 목적 · 문장 범위 · 학습 메뉴 · 학습 기능 · 영상 · 음성 · 데이터 ·
   * 도구 · 기타가 한 화면에 이어져 있었다. 음성 속도를 바꾸려면 열 덩이를
   * 지나쳐 내려가야 하고, 무엇이 어디 있는지는 외워야 알았다.
   *
   * 여섯 묶음으로 나눈다. 처음 화면은 고를 것 여섯 줄이고, 하나를 고르면
   * 그 묶음만 나온다. 안에 있는 설정은 그대로 두었다 — 자리만 옮긴다. */
  const open = MORE_GROUPS.find((x) => x.id === group);
  const G = (id) => group === id;

  return (
    <>
      {!group && (
        <>
          <div className="navtitle">
            <small>JS일본어</small>
            더보기
          </div>
          <div className="card">
            {MORE_GROUPS.map((x) => (
              <button key={x.id} className="listrow moregroup" onClick={() => setGroup(x.id)}>
                <span className="mg-body">
                  <b>{x.label}</b>
                  <span>{x.sub}</span>
                </span>
                <IconChevron className="chev" />
              </button>
            ))}
          </div>
          {/* 저장 상태는 묶음 안에 숨기지 않는다 — 저장이 막혔으면 설정을
              열자마자 보여야 한다. */}
          {storeError && (
            <div className="savestate bad" style={{ marginTop: 12 }}>
              <b>기록을 저장하지 못했어요</b>
              <span>{storeError} 「기록 백업」에서 백업해 두고 저장 공간을 비워 주세요.</span>
            </div>
          )}
        </>
      )}

      {group && (
        <>
          <button className="ghost-btn moreback" onClick={() => setGroup(null)}>
            ← 더보기
          </button>
          <div className="navtitle" style={{ marginTop: 10 }}>
            <small>더보기</small>
            {open?.label}
          </div>
        </>
      )}

      {G('account') && (<>
      <div className="section-label">계정</div>
      <Account
        session={session}
        syncState={syncState}
        onSync={onSync}
        onSignedOut={onSignedOut}
        onVaultKey={onVaultKey}
        onToast={onToast}
      />

      {/* 학습 탭과 같은 묶음으로 보여 준다 — 거기선 셋으로 갈라 놓고 여기선
          한 줄로 늘어놓으면 어느 칸이 어디 것인지 다시 찾아야 한다. */}
      {/* ★ 하는 만큼만 말한다 ★
          온보딩은 「남은 기간에 맞춰 학습량과 우선순위를 잡아 드려요」라고
          적어 두고 아무것도 안 했다. 이제 정말로 배정 차례를 바꾸고,
          목적마다 무엇이 달라지는지 그 자리에 적는다. */}
      </>)}
      {G('study') && (<>
      <div className="section-label">학습 목적</div>
      <div className="card">
        <div className="setrow col">
          <div className="grouppick">
            {PURPOSES.map((p) => (
              <button
                key={p.id}
                className={purposeOf(settings) === p.id ? 'active' : ''}
                onClick={() => onChange({ purpose: p.id })}
              >{p.label}</button>
            ))}
          </div>
          <div className="set-note">
            {PURPOSES.find((p) => p.id === purposeOf(settings))?.does}
            {' '}목적을 바꿔도 회독 기록과 복습일은 그대로예요.
          </div>
        </div>
        <div className="setrow col">
          <div className="set-title">일본 출발일</div>
          <input
            className="ob-date"
            type="date"
            value={settings.tripDate || ''}
            onChange={(e) => onChange({ tripDate: e.target.value || null })}
            aria-label="여행 출발일"
          />
          <div className="set-note">
            {tripLabel(settings, todayKey())
              || '넣으면 홈에 남은 날을 세어 드려요. 학습량은 안 바뀌어요.'}
          </div>
        </div>
      </div>

      {/* 문장 레벨은 문장에 나오는 낱말의 급수로 잰다. 근거를 못 찾은 문장은
          미분류로 남는데, 그걸 새 학습에 넣을지는 고를 수 있어야 한다.
          모른다는 게 어렵다는 뜻은 아니라서 기본은 넣는 쪽이다. */}
      </>)}
      {G('study') && (<>
      <div className="section-label">문장 범위</div>
      <div className="card">
        <Toggle
          label="레벨을 못 잰 문장도 배정"
          sub="문장 레벨은 그 문장에 나오는 낱말의 급수로 재요. 낱말을 못 찾은 문장은 미분류로 남는데, 끄면 그런 문장은 새로 배정하지 않아요 — 이미 배운 문장은 계속 복습합니다."
          on={settings.sentenceScope !== 'level'}
          onClick={() => onChange({ sentenceScope: settings.sentenceScope === 'level' ? 'all' : 'level' })}
        />
      </div>

      </>)}
      {G('study') && (<>
      <div className="section-label">학습 메뉴</div>
      <div className="card">
        {MENU_GROUPS.map((g) => (
          <div key={g.id} className="setgroup">
            <div className="sg-label">{g.label}</div>
            {MENUS.filter((m) => m.group === g.id).map(({ id, label, sub }) => (
              <button key={id} className="toggle-row setrow" onClick={() => toggleMenu(id)} aria-pressed={Boolean(menus[id])}>
                <span>
                  <span className="set-title">{label}</span>
                  <span className="set-sub">{sub}</span>
                </span>
                <span className={`toggle${menus[id] ? ' on' : ''}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        ))}
        <div className="set-note">끈 메뉴의 학습 기록은 그대로 남아 있어요.</div>
      </div>

      </>)}
      {G('study') && (<>
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
        {/* ★ 답을 보기 전에 판정할 수 있게 할까 ★
            기본은 끈다 — 답을 보기 전에 누르면 「떠올렸나」가 아니라 「떠올린 것
            같나」를 적게 되고, 그 기록이 복습 간격을 정한다. 대신 없애지는 않는다.
            아는 것만 많은 회독에서는 카드마다 한 번 더 두드리는 게 전부 마찰이다. */}
        <Toggle label="빠른 판정" sub="답을 보기 전에도 바로 판정해요. 아는 게 많아 넘기기만 할 때 씁니다 — 끄면 답을 보고 고르게 돼요"
          on={settings.quickJudge} onClick={() => onChange({ quickJudge: !settings.quickJudge })} />
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

        {/* ★ 고르는 자리는 총량 하나 ★
         *
         * 갈래마다 따로 세는 것은 이유가 있다 — 복습이 밀린 날 새로 배우는 몫을
         * 뺏기면 진도가 밀린 벌로 새 단어를 못 보게 된다. 그 판단은 그대로 둔다.
         *
         * 문제는 처음 쓰는 사람이 보는 숫자였다. 기본값이 셋 다 20이라 자료가
         * 쌓이면 하루가 예순 장이 되는데, 「20」 셋을 본 사람은 스무 장을 고른
         * 줄로 안다. 총량으로 고르고, 갈래 배분은 아래 고급에서 만진다. */}
        <div className="setrow col">
          <div className="set-title">
            오늘 학습량
            <span className="set-val">하루 최대 {total}장</span>
          </div>
          <div className="set-sub">
            고른 양을 복습 · 새로 배우기 · 약점으로 나눠 배정해요. 있는 만큼만
            담기니 실제로는 이보다 적을 수 있어요.
          </div>
          <div className="grouppick">
            {DAY_PRESETS.map((p) => (
              <button key={p.id} className={preset === p.id ? 'active' : ''}
                onClick={() => onChange({ goals: spreadGoal(p.total) })}>
                {p.label} {p.total}
              </button>
            ))}
            {/* 기존에 직접 맞춰 둔 목표를 프리셋에 억지로 끼우지 않는다.
                고른 적 없는 사람에게 「직접 정함」이 켜져 있으면 그게 사실이다. */}
            {!preset && <button className="active" disabled>직접 정함 {total}</button>}
          </div>
          <div className="set-sub" style={{ marginTop: 8 }}>
            복습 {goals.review} · 새로 배우기 {goals.fresh} · 약점 {goals.weak}
            {goals.review > goals.fresh && ' — 복습에 더 많이 배정했어요'}
          </div>

          {/* 갈래를 직접 만지는 자리는 접어 둔다. 처음부터 셋을 들이밀면
              무엇을 고르는 건지 모른 채로 숫자를 만지게 된다. */}
          <button className="ghost-btn" style={{ marginTop: 10 }}
            onClick={() => setShowLanes((v) => !v)} aria-expanded={showLanes}>
            {showLanes ? '갈래별 설정 접기' : '갈래별로 직접 정하기'}
          </button>
          {showLanes && (
            <>
              <div className="set-sub" style={{ marginTop: 8 }}>
                갈래마다 따로 셉니다. 복습이 밀려도 새 단어 몫은 그대로예요.
              </div>
              <div className="goalrow">
                {LANE_GOALS.map(({ key, label, note }) => (
                  <div key={key} className="goalone">
                    <div className="set-title">
                      {label}
                      <span className="set-val">{goals[key]}장</span>
                    </div>
                    <div className="set-sub">{note}</div>
                    <div className="grouppick">
                      {GOAL_CHOICES.map((g) => (
                        <button key={g} className={goals[key] === g ? 'active' : ''}
                          onClick={() => onChange({ goals: { ...goals, [key]: g } })}>{g}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
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

      </>)}
      {G('tools') && (<>
      <div className="section-label">영상 학습</div>
      <VideoAI settings={settings} onChange={onChange} onToast={onToast} />

      </>)}
      {G('voice') && (<>
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

      </>)}
      {G('backup') && (<>
      <div className="section-label">데이터</div>
      <div className="card">
        {/* ★ 저장 상태를 한 줄로 ★
         *
         * 「계정에 저장돼요」와 「이 브라우저에만 저장돼요」가 화면에 같이 있었다.
         * 무엇이 어디에 저장됐는지 사용자가 판단할 방법이 없었다. 실제 상태를
         * 보고 한 가지만 말한다 — 모르는 것은 말하지 않는다. */}
        <div className={`savestate ${save.tone}`}>
          <b>{save.title}</b>
          <span>{save.sub}</span>
        </div>
        {settings.lastBackup && (
          <div className="set-sub" style={{ marginBottom: 10 }}>
            마지막 백업 {settings.lastBackup}
          </div>
        )}

        {/* ★ 무엇이 들어가는지 내보내기 전에 보여 준다 ★
            여태 일곱 칸만 담으면서 「완전히 교체」라고 안내했다. 빠진 걸 모르면
            브라우저가 데이터를 비운 뒤에야 없다는 걸 알게 된다. */}
        <button className="ghost-btn" style={{ width: '100%', marginBottom: 10 }}
          onClick={() => setShowScope((v) => !v)} aria-expanded={showScope}>
          {showScope ? '백업 범위 접기' : '무엇이 백업되나요?'}
        </button>
        {showScope && (
          <div className="bk-scope">
            <div className="bk-head">백업에 들어가요</div>
            <ul className="bk-list">
              {scope.map((r) => (
                <li key={r.key}>
                  <span>{r.label}</span>
                  <b>{r.count == null ? (r.present ? '있음' : '없음') : `${r.count}개`}</b>
                </li>
              ))}
            </ul>
            <div className="bk-head">안 들어가요</div>
            <ul className="bk-list bk-out">
              {BACKUP_EXCLUDED.map((r) => (
                <li key={r.label}><span>{r.label}</span><em>{r.why}</em></li>
              ))}
            </ul>
          </div>
        )}

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

      {/* ★ 공부가 아닌 것은 여기로 ★
          번역기와 내 단어장은 학습 탭에 있었다. 그런데 학습 탭은 「오늘 뭘
          공부하지」를 고르는 자리다 — 거기에 현지에서 쓰는 도구가 끼어 있으면
          고를 것이 하나 더 늘 뿐이다. */}
      </>)}
      {G('tools') && (<>
      <div className="section-label">도구</div>
      <div className="card">
        <button className="listrow tool-translate" onClick={onOpenTranslate}>
          <IconMap /> 번역기
          <span className="lr-sub">한국어로 적으면 지금 말할 일본어로 — 발음까지</span>
        </button>
        <button className="listrow" onClick={onOpenWordManager}>
          <IconList /> 내 단어장 관리
          <span className="lr-sub">직접 담은 단어를 고치고 지워요</span>
        </button>
      </div>

      </>)}
      {G('about') && (<>
      <div className="section-label">기타</div>
      <div className="card">
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
      </>)}
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
