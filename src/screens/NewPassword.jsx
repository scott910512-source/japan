import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { deriveVaultKey } from '../lib/crypto.js';

/* 재설정 메일 링크로 돌아왔을 때 새 비밀번호를 정하는 화면.
 *
 * 이 단계를 두지 않으면 링크를 눌러 세션만 열린 채 비밀번호는 그대로다.
 * 사용자는 바뀐 줄 알고 다음에 새 비밀번호로 로그인하다 막힌다. */
export default function NewPassword({ session, onDone, onVaultKey, onToast }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 6) { onToast('비밀번호는 6자 이상이어야 해요'); return; }
    if (password !== confirm) { onToast('두 번 입력한 비밀번호가 달라요'); return; }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // 금고 열쇠는 비밀번호에서 나온다. 비밀번호가 바뀌었으니 열쇠도 다시 만든다.
      if (session?.user) {
        onVaultKey?.(await deriveVaultKey(password, session.user.id));
      }
      onToast('비밀번호를 바꿨어요');
      onDone();
    } catch (err) {
      onToast(err.message?.includes('should be different')
        ? '예전과 다른 비밀번호를 넣어 주세요'
        : `바꾸지 못했어요 — ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate-brand">
        <div className="gate-mark">あ</div>
        <h1>새 비밀번호</h1>
        <p>{session?.user?.email}</p>
      </div>

      <div className="card">
        <div className="set-sub" style={{ marginBottom: 12 }}>
          앞으로 이 비밀번호로 로그인해요. 음성 키를 계정에 보관해 두셨다면
          새 비밀번호로 다시 잠가 둘게요.
        </div>
        <input
          className="search-input"
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <input
          className="search-input"
          type="password"
          autoComplete="new-password"
          placeholder="한 번 더 입력"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ marginBottom: 10 }}
        />
        <button className="submit-btn" onClick={submit} disabled={busy}>
          {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </button>
      </div>
    </div>
  );
}
