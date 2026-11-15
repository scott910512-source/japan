import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { deriveVaultKey } from '../lib/crypto.js';

/* ★ 로그인은 돼 있는데 API 키가 안 넘어오는 기기 ★
 *
 * 계정에 보관한 API 키(음성 · AI)는 로그인 비밀번호로 만든 금고 열쇠로 잠근다. 그 열쇠는 비밀번호를 친 순간에만 만들 수 있다.
 * 그래서 비밀번호를 안 치고 로그인된 기기 — 메일로 온 로그인 링크(아이디 찾기 · 가입 확인)로 들어왔거나, 키 보관이 생기기 전부터
 * 로그인돼 있던 기기 — 에는 열쇠가 없어서, 로그인해 있어도 키가 안 넘어오고 이 기기의 키도 계정에 안 올라갔다.
 * 「이 기기에서 한 번 로그인하면 켜져요」라고만 적혀 있어서 로그아웃했다 다시 들어오는 것 말고는 길이 없었다.
 *
 * 여기서 비밀번호를 한 번 넣으면 열쇠를 만든다. 비밀번호는 서버에 한 번 맞춰 보고(틀린 비밀번호로 열쇠를 만들면 다른 기기가
 * 봉투를 못 연다) 열쇠 바이트만 기기에 남긴다. 비밀번호 자체는 저장하지 않는다. */
export default function VaultUnlock({ session, onVaultKey, onToast, compact = false }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const email = session?.user?.email;
  if (!session?.user || !email) return null;

  const unlock = async () => {
    if (!pw || busy) return;
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error || data?.user?.id !== session.user.id) {
        setErr(/invalid/i.test(error?.message || '') ? '비밀번호가 맞지 않아요. 이 계정의 로그인 비밀번호를 넣어 주세요.' : '확인하지 못했어요. 인터넷을 확인하고 다시 해 주세요.');
        return;
      }
      onVaultKey?.(await deriveVaultKey(pw, session.user.id));
      setPw('');
      onToast?.('키 보관을 켰어요 · 계정의 API 키를 가져오고, 이 기기의 키도 계정에 올려요');
    } catch {
      setErr('확인하지 못했어요. 인터넷을 확인하고 다시 해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`vault-unlock${compact ? ' compact' : ''}`}>
      <b>이 기기는 API 키 보관이 꺼져 있어요</b>
      <span>
        메일 링크로 로그인했거나 오래전부터 로그인돼 있던 기기예요. 로그인 비밀번호를 한 번 넣으면
        계정에 보관된 음성 · AI 키를 가져오고, 이 기기에 넣은 키도 계정에 올려요.
      </span>
      <div className="vu-row">
        <input
          className="search-input" type="password" autoComplete="current-password" placeholder="로그인 비밀번호"
          value={pw} onChange={(e) => { setPw(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') unlock(); }}
        />
        <button type="button" className="submit-btn vu-go" onClick={unlock} disabled={!pw || busy}>{busy ? '확인 중…' : '키 연결'}</button>
      </div>
      {err && <div className="vu-err" role="alert">{err}</div>}
    </div>
  );
}
