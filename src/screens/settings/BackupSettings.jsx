import { useEffect, useMemo, useRef, useState } from 'react';
import { IconDownload, IconUpload, IconTrash } from '../../components/Icons.jsx';
import {
  exportBackup, importBackup, backupSummary, backupContents, BACKUP_EXCLUDED, clearAll,
} from '../../lib/storage.js';
import { todayKey } from '../../lib/review.js';

/* 설정 → 기록 백업. Settings.jsx에서 떼어 냈다 — 저장 상태 한 줄·백업 범위·
   내려받기·복원·초기화. 동작은 그대로다. */
export default function BackupSettings({ settings, onChange, onToast, onReload, session, syncState, storeError }) {
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

  const reset = () => {
    const typed = window.prompt('학습 기록을 모두 지우려면 "초기화"라고 입력해 주세요.');
    if (typed !== '초기화') return;
    clearAll();
    onToast('초기화했어요');
    setTimeout(onReload, 500);
  };

  return (
    <>

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
          </>
  );
}
