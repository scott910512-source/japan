import { useEffect, useMemo, useState } from 'react';
import { IconPlus, IconList, IconGear, IconMoon, IconBell, IconRewind, IconArrowLeft, IconTrash, IconDownload } from '../components/Icons.jsx';
import { conjugate } from '../lib/conjugate.js';

function Toast({ message }) {
  return <div className={`toast${message ? ' show' : ''}`}>{message}</div>;
}

export default function My({
  words, customWords, progress, streak, settings,
  onAddWord, onDeleteWord, onSettingsChange, onReplayOnboarding,
}) {
  const [sub, setSub] = useState(null); // null | 'add' | 'manage'
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const totalDays = useMemo(() => {
    // 스트릭 카운트를 총 학습일의 근사치로 사용 (누적 방문일 기록은 v2에서 추가 예정)
    return streak.count;
  }, [streak]);

  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <>
      <div className="navtitle">나의 학습</div>
      <div className="profile-head">
        <div className="avatar" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>학습자님</div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>오늘도 좋은 하루예요</div>
        </div>
      </div>

      <div className="progress-grid" style={{ marginTop: 14 }}>
        <div className="progress-cell"><div className="val">{totalDays}일</div><div className="lab">연속 학습</div></div>
        <div className="progress-cell"><div className="val">{progress.known.length}개</div><div className="lab">암기 단어</div></div>
        <div className="progress-cell"><div className="val">{customWords.length}개</div><div className="lab">추가한 단어</div></div>
      </div>

      <div className="section-label">단어장</div>
      <div className="card" style={{ padding: '4px 12px' }}>
        <div className="listrow" onClick={() => setSub('add')}><IconPlus />단어 / 문장 추가하기</div>
        <div className="listrow" onClick={() => setSub('manage')}><IconList />전체 단어 목록 관리</div>
      </div>

      <div className="section-label">설정</div>
      <div className="card" style={{ padding: '4px 12px' }}>
        <div className="listrow" style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <IconGear />발음 속도
          </div>
          <div className="segment">
            {[[0.6, '느리게'], [0.82, '기본'], [1.0, '빠르게']].map(([rate, label]) => (
              <button key={rate} className={settings.speechRate === rate ? 'active' : ''} onClick={() => onSettingsChange({ speechRate: rate })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="listrow" style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <IconMoon />화면 모드
          </div>
          <div className="segment">
            {[['dark', '다크'], ['system', '시스템'], ['light', '라이트']].map(([v, label]) => (
              <button key={v} className={settings.theme === v ? 'active' : ''} onClick={() => onSettingsChange({ theme: v })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="listrow toggle-row">
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}><IconBell />학습 리마인더 알림</span>
          <button
            className={`toggle${settings.notifications ? ' on' : ''}`}
            onClick={() => onSettingsChange({ notifications: !settings.notifications })}
          />
        </div>
        <div className="listrow" onClick={onReplayOnboarding}><IconRewind />온보딩 다시 보기</div>
      </div>

      <div className="section-label">앱 설치</div>
      {installPrompt ? (
        <button className="install-card" onClick={install}>
          <IconDownload />
          <div><div className="t">홈 화면에 추가</div><div className="s">오프라인에서도 단어장을 열 수 있어요</div></div>
        </button>
      ) : (
        <div className="install-card" style={{ opacity: 0.6, cursor: 'default' }}>
          <IconDownload />
          <div><div className="t">홈 화면에 추가</div><div className="s">브라우저 메뉴에서 "홈 화면에 추가"를 선택해보세요</div></div>
        </div>
      )}

      {sub === 'add' && (
        <AddWordScreen
          onBack={() => setSub(null)}
          onSubmit={(word) => {
            onAddWord(word);
            setSub(null);
            showToast(`「${word.mean}」가 등록되었습니다`);
          }}
        />
      )}
      {sub === 'manage' && (
        <ManageScreen
          defaultWords={words.filter((w) => !w.custom)}
          customWords={customWords}
          onBack={() => setSub(null)}
          onDelete={onDeleteWord}
        />
      )}

      <Toast message={toast} />
    </>
  );
}

function AddWordScreen({ onBack, onSubmit }) {
  const [kind, setKind] = useState('verb');
  const [kanji, setKanji] = useState('');
  const [kana, setKana] = useState('');
  const [mean, setMean] = useState('');
  const [group, setGroup] = useState('2');
  const [wordKind, setWordKind] = useState('noun');

  const preview = kana ? conjugate(kana, group) : null;
  const previewRows = preview ? [
    ['ます', preview.masu], ['て형', preview.te], ['ない', preview.nai],
    ['가능형', preview.potentialDict], ['의지형', preview.volitionalCasual],
    ['ば', preview.ba], ['ながら', preview.nagara],
  ] : [];

  const submit = () => {
    if (!kana.trim() || !mean.trim()) return;
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (kind === 'verb') {
      onSubmit({ id, kanji: kanji.trim() || kana.trim(), kana: kana.trim(), mean: mean.trim(), type: 'verb', group, custom: true });
    } else {
      onSubmit({ id, kanji: kanji.trim() || kana.trim(), kana: kana.trim(), mean: mean.trim(), type: wordKind, custom: true });
    }
  };

  return (
    <div className="subscreen open">
      <div className="sub-header">
        <button className="sub-back" onClick={onBack}><IconArrowLeft />나</button>
        <div className="sub-title">단어 추가</div>
      </div>
      <div className="sub-body">
        <div className="segment" style={{ marginBottom: 16 }}>
          <button className={kind === 'verb' ? 'active' : ''} onClick={() => setKind('verb')}>동사</button>
          <button className={kind === 'other' ? 'active' : ''} onClick={() => setKind('other')}>명사 · 형용사</button>
        </div>

        <div className="field"><label>한자 (선택)</label><input value={kanji} onChange={(e) => setKanji(e.target.value)} placeholder="食べる" /></div>
        <div className="field"><label>히라가나</label><input value={kana} onChange={(e) => setKana(e.target.value)} placeholder="たべる" /></div>
        <div className="field"><label>뜻</label><input value={mean} onChange={(e) => setMean(e.target.value)} placeholder="먹다" /></div>

        {kind === 'verb' ? (
          <>
            <div className="field">
              <label>그룹</label>
              <div className="grouppick">
                {['2', '1', '3'].map((g) => (
                  <button key={g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>{g}그룹</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>활용 미리보기</label>
              <div className="preview-grid">
                {preview ? previewRows.map(([k, v]) => (
                  <div key={k} className="preview-cell"><div className="k">{k}</div><div className="v">{v}</div></div>
                )) : (
                  <div className="preview-cell" style={{ gridColumn: '1/3', color: 'var(--ink-soft)' }}>히라가나를 입력하면 활용형이 보여요</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <label>분류</label>
            <div className="grouppick">
              <button className={wordKind === 'noun' ? 'active' : ''} onClick={() => setWordKind('noun')}>명사</button>
              <button className={wordKind === 'adj' ? 'active' : ''} onClick={() => setWordKind('adj')}>형용사</button>
            </div>
          </div>
        )}

        <button className="submit-btn" onClick={submit}>등록하기</button>
      </div>
    </div>
  );
}

function ManageScreen({ defaultWords, customWords, onBack, onDelete }) {
  const [query, setQuery] = useState('');
  const match = (w) => (w.kanji + w.kana + w.mean).includes(query);

  return (
    <div className="subscreen open">
      <div className="sub-header">
        <button className="sub-back" onClick={onBack}><IconArrowLeft />나</button>
        <div className="sub-title">전체 단어 목록</div>
      </div>
      <div className="sub-body">
        <input className="search-input" placeholder="단어 검색" value={query} onChange={(e) => setQuery(e.target.value)} />

        <div className="manage-group-label">내가 추가한 단어 · {customWords.length}개</div>
        <div className="card" style={{ padding: '2px 12px' }}>
          {customWords.filter(match).length === 0 ? (
            <div className="manage-kr" style={{ padding: '10px 0' }}>아직 추가한 단어가 없어요</div>
          ) : customWords.filter(match).map((w) => (
            <div key={w.id} className="manage-row">
              <div>
                <div className="manage-jp">{w.kanji} <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>· {w.kana}</span></div>
                <div className="manage-kr">{w.mean}</div>
              </div>
              <button className="del-btn" onClick={() => onDelete(w.id)}><IconTrash /></button>
            </div>
          ))}
        </div>

        <div className="manage-group-label">기본 단어 · {defaultWords.length}개</div>
        <div className="card" style={{ padding: '2px 12px' }}>
          {defaultWords.filter(match).map((w) => (
            <div key={w.id} className="manage-row">
              <div>
                <div className="manage-jp">{w.kanji} <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>· {w.kana}</span></div>
                <div className="manage-kr">{w.mean}</div>
              </div>
              <span className="badge-default">기본</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
