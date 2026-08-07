import { useState } from 'react';
import { IconUpload, IconDownload } from './Icons.jsx';
import { encryptSecret, decryptSecret } from '../lib/crypto.js';

/* 음성 API 키를 계정에 암호화해서 보관하고, 다른 기기에서 꺼내 쓰는 칸.
 *
 * 서버에는 암호문만 올라간다. 동기화 암호는 저장하지 않는다 —
 * 올릴 때와 꺼낼 때만 물어보고 바로 버린다. */
export default function KeyVault({ session, localKey, remoteEnvelope, onSaveRemote, onKeyRestored, onToast }) {
  const [mode, setMode] = useState(null); // null | 'save' | 'restore'
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <div className="set-note" style={{ marginTop: 10 }}>
        로그인하면 이 키를 계정에 암호화해 두고 다른 기기에서도 쓸 수 있어요.
      </div>
    );
  }

  const close = () => { setMode(null); setPass(''); };

  const save = async () => {
    if (pass.length < 4) { onToast('동기화 암호는 4자 이상으로 정해 주세요'); return; }
    setBusy(true);
    try {
      const envelope = await encryptSecret(localKey, pass);
      await onSaveRemote(envelope);
      onToast('키를 계정에 암호화해서 올렸어요');
      close();
    } catch (err) {
      onToast(`올리지 못했어요 — ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const key = await decryptSecret(remoteEnvelope, pass);
      if (!key) { onToast('동기화 암호가 맞지 않아요'); return; }
      onKeyRestored(key);
      onToast('키를 가져왔어요');
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vault">
      <div className="vault-state">
        {remoteEnvelope
          ? <><b>계정에 보관 중</b> · 암호문으로만 저장돼요</>
          : <>계정에 보관된 키가 없어요</>}
      </div>

      {mode === null && (
        <div className="btnrow" style={{ marginTop: 10 }}>
          <button className="ghost-btn" onClick={() => setMode('save')} disabled={!localKey}>
            <IconUpload /> 계정에 저장
          </button>
          <button className="ghost-btn" onClick={() => setMode('restore')} disabled={!remoteEnvelope}>
            <IconDownload /> 계정에서 가져오기
          </button>
        </div>
      )}

      {mode && (
        <div className="vault-form">
          <div className="set-sub" style={{ marginBottom: 8 }}>
            {mode === 'save'
              ? '이 암호로 키를 잠급니다. 다른 기기에서 꺼낼 때 같은 암호가 필요해요. 잊으면 다시 넣어야 해요.'
              : '이 계정에 키를 저장할 때 쓴 동기화 암호를 입력해 주세요.'}
          </div>
          <input
            className="search-input"
            type="password"
            autoComplete="off"
            placeholder="동기화 암호"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (mode === 'save' ? save() : restore())}
            style={{ marginBottom: 10 }}
          />
          <div className="btnrow">
            <button className="ghost-btn" onClick={mode === 'save' ? save : restore} disabled={busy || !pass}>
              {busy ? '처리 중…' : mode === 'save' ? '암호화해서 올리기' : '가져오기'}
            </button>
            <button className="ghost-btn" onClick={close}>취소</button>
          </div>
        </div>
      )}

      <div className="set-note">
        동기화 암호는 어디에도 저장하지 않아요. 서버에는 암호문만 올라가서,
        데이터베이스를 통째로 열어봐도 암호를 모르면 키를 읽을 수 없어요.
      </div>
    </div>
  );
}
