import { useRef, useState } from 'react';
import { IconDownload, IconUpload, IconTrash, IconSpeaker, IconRewind, IconList } from '../components/Icons.jsx';
import {
  exportBackup, importBackup, backupSummary, clearAll, DEFAULT_SETTINGS,
} from '../lib/storage.js';
import { testCloudTTS, cloudTTSReady } from '../lib/tts.js';
import { todayKey } from '../lib/review.js';

const MENU_LABELS = {
  basics: '완전기초',
  grammar: '기초문법',
  words: '단어암기',
  sentences: '상황별 문장암기',
  rpg: '실전연습 (여행연습)',
};

const DIRECTIONS = [
  { id: 'kanji-mean', label: '한자 → 뜻' },
  { id: 'mean-kanji', label: '뜻 → 한자' },
  { id: 'kanji-kana', label: '한자 → 읽기' },
];

const GOALS = [10, 20, 30, 50];

export default function Settings({ settings, onChange, onReplayOnboarding, onOpenWordManager, onToast, onReload }) {
  const fileRef = useRef(null);
  const [keyDraft, setKeyDraft] = useState(settings.gttsKey || '');
  const [testing, setTesting] = useState(false);

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
        <div className="set-title">Google Cloud TTS 키</div>
        <div className="set-sub" style={{ marginBottom: 8 }}>
          {cloudTTSReady()
            ? '클라우드 음성으로 재생 중이에요.'
            : '키를 넣으면 훨씬 자연스러운 음성으로 읽어줘요. 비워 두면 기기 내장 음성을 써요.'}
        </div>
        <input className="search-input" type="password" placeholder="AIza..." value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)} style={{ marginBottom: 10 }} />
        <div className="btnrow">
          <button className="ghost-btn" onClick={saveKey} disabled={testing}>
            <IconSpeaker /> {testing ? '확인 중...' : '저장하고 확인'}
          </button>
        </div>
        <div className="set-note">기존 여행 RPG 앱에 저장해 둔 키가 있으면 자동으로 가져와요.</div>
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
        <div className="set-note">JS일본어 · 회독 학습 v1</div>
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
