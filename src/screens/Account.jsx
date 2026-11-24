import { useState } from 'react';
import { IconPerson, IconDownload, IconUpload } from '../components/Icons.jsx';
import { supabase, supabaseConfigured, redirectUrl } from '../lib/supabase.js';
import { deriveVaultKey } from '../lib/crypto.js';
import { VIDEO_COLUMN_SQL } from '../lib/sync.js';
import { isServerProblem, readableAuthError } from '../lib/authboot.js';
import { findAccount, lastEmail, maskEmail } from '../lib/idfind.js';
import VaultUnlock from '../components/VaultUnlock.jsx';

const MODES = {
  signin: { title: '로그인', action: '로그인', other: 'signup', otherLabel: '처음이신가요? 가입하기' },
  signup: { title: '가입하기', action: '가입하고 시작', other: 'signin', otherLabel: '이미 계정이 있어요' },
  reset: { title: '비밀번호 재설정', action: '재설정 메일 보내기', other: 'signin', otherLabel: '로그인으로 돌아가기' },
  find: { title: '아이디 찾기', action: '가입된 이메일인지 확인', other: 'signin', otherLabel: '로그인으로 돌아가기' },
};

export default function Account({ session, syncState, onSync, onFlush, onSignedOut, onToast, onVaultKey, onServerProblem, vaultReady = true }) {
  // 복사가 막힌 브라우저에서도 글은 그대로 보이니 길게 눌러 복사하면 된다
  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(VIDEO_COLUMN_SQL);
      onToast('복사했어요. Supabase → SQL Editor에 붙여넣고 Run 하세요');
    } catch {
      onToast('복사가 막혀 있어요. 아래 글을 길게 눌러 복사해 주세요');
    }
  };
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [found, setFound] = useState('');            // 방금 가입된 주소로 확인된 이메일
  const [known] = useState(lastEmail);                // 이 기기에서 로그인했던 이메일

  if (!supabaseConfigured) {
    return (
      <div className="card">
        <div className="set-title">계정 동기화가 아직 켜지지 않았어요</div>
        <div className="set-sub" style={{ marginTop: 6 }}>
          지금은 학습 기록이 이 기기에만 저장돼요.
          설정의 백업 내려받기로 다른 기기에 옮길 수 있어요.
        </div>
      </div>
    );
  }

  /* ── 로그인한 뒤 ── */
  if (session) {
    return (
      <div className="card">
        <div className="acct-head">
          <span className="acct-avatar"><IconPerson /></span>
          <div>
            <div className="set-title">{session.user.email}</div>
            <div className="set-sub">
              {syncState.at ? `마지막 동기화 ${syncState.at}` : '아직 동기화하지 않았어요'}
            </div>
          </div>
        </div>

        {syncState.error && (
          <div className="syncerror">
            <b>동기화가 안 되고 있어요</b>
            <span>{syncState.error}</span>
          </div>
        )}

        {/* 안내는 오류와 자리를 나눈다 — 나머지는 다 올라간 상태다 */}
        {!syncState.error && syncState.note && (
          <div className="syncnote">
            <b>학습 기록은 올라갔어요</b>
            <span>{syncState.note}</span>
            <code className="syncsql">{VIDEO_COLUMN_SQL}</code>
            <button className="ghost-btn" onClick={copySql}>이 줄 복사</button>
          </div>
        )}

        <div className="btnrow" style={{ marginTop: 12 }}>
          <button className="ghost-btn" onClick={onSync} disabled={syncState.busy}>
            <IconUpload /> {syncState.busy ? '동기화 중…' : '지금 동기화'}
          </button>
          <button
            className="ghost-btn"
            onClick={async () => {
              /* 나가기 전에 아직 못 올린 것을 올린다 — 다른 계정으로 로그인하면 이 기기의 기록은 따로 보관되고 그 계정에 안 섞인다.
                 오래 걸리면(오프라인) 기다리지 않는다 — 못 올린 것은 보관함에 남았다가 이 계정으로 돌아오면 이어진다 */
              await Promise.race([Promise.resolve(onFlush?.()).catch(() => {}), new Promise((r) => { setTimeout(r, 5000); })]);
              await supabase.auth.signOut(); onSignedOut();
            }}
          >
            로그아웃
          </button>
        </div>

        {/* API 키가 안 넘어오는 기기 — 비밀번호를 한 번 넣어 키 보관을 켠다 */}
        {!vaultReady && <VaultUnlock session={session} onVaultKey={onVaultKey} onToast={onToast} compact />}

        <div className="set-note">
          다른 기기에서도 같은 계정으로 로그인하면 진도가 이어져요.
          양쪽에서 공부했으면 더 최근에 본 기록이 남아요.
        </div>
      </div>
    );
  }

  /* ── 로그인 전 ── */
  const submit = async () => {
    const address = email.trim();
    if (!address) { onToast('이메일을 입력해 주세요'); return; }
    // 서버까지 갔다 와서 알려주면 느리다. 형식이 아닌 건 여기서 바로 잡는다.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      onToast('아이디가 아니라 이메일 주소를 넣어 주세요 (예: name@gmail.com)');
      return;
    }
    /* 새로 만드는 비밀번호는 8자 이상(보안 감사 #9). 로그인은 예전에 6자로 만든 비밀번호도 받는다 */
    if (mode === 'signup' && password.length < 8) { onToast('비밀번호는 8자 이상이어야 해요'); return; }
    if (mode !== 'reset' && mode !== 'find' && password.length < 6) { onToast('비밀번호는 6자 이상이어야 해요'); return; }

    setBusy(true);
    setNotice('');
    try {
      if (mode === 'find') {
        setFound('');
        const answer = await findAccount(supabase, address, redirectUrl());
        /* ★ 가입 여부를 화면에 드러내지 않는다 ★ (보안 감사 #9) 「가입된 주소예요 / 없어요」로 갈라 답하면 남의 이메일이
           이 앱에 가입했는지 누구나 알아낼 수 있다. 비밀번호 재설정과 같은 원칙으로, 가입된 주소든 아니든 같은 안내를 준다.
           가입된 주소라면 서버가 로그인 링크를 메일로 보낸다(없는 주소로 계정을 만들지는 않는다 — idfind.js) */
        if (answer === 'wait') {
          setNotice('너무 자주 확인했어요. 1분쯤 뒤에 다시 해 주세요.');
        } else {
          setFound(address);
          setNotice('가입된 주소라면 그 이메일이 아이디이고, 로그인 링크를 메일로 보냈어요. 메일이 안 오면 주소를 다시 확인해 주세요. 비밀번호가 기억나면 「이 이메일로 로그인」을 누르세요.');
        }
        return;
      }
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: redirectUrl(),
        });
        if (error) throw error;
        // 가입 안 된 메일인지 알려주면 계정 존재 여부가 새어 나간다 — 항상 같은 안내를 준다
        setNotice('재설정 메일을 보냈어요. 메일함을 확인해 주세요.');
        return;
      }

      const fn = mode === 'signup' ? 'signUp' : 'signInWithPassword';
      const { data, error } = await supabase.auth[fn]({
        email: address,
        password,
        ...(mode === 'signup' ? { options: { emailRedirectTo: redirectUrl() } } : {}),
      });
      if (error) throw error;

      if (mode === 'signup' && !data.session) {
        setNotice('가입 확인 메일을 보냈어요. 링크를 누르면 로그인돼요.');
        return;
      }

      // 지금이 계정 비밀번호를 아는 유일한 순간이다. 여기서 금고 열쇠를 만들어 두면
      // 이후로는 API 키를 자동으로 잠그고 풀 수 있다. 비밀번호 자체는 저장하지 않는다.
      if (data.session?.user) {
        onVaultKey?.(await deriveVaultKey(password, data.session.user.id));
      }
      setPassword('');
    } catch (err) {
      /* 서버 쪽 문제면 부른 쪽(로그인 관문)이 「이 기기 기록으로 계속하기」를 열 수 있게 알린다 */
      if (isServerProblem(err)) onServerProblem?.();
      onToast(readableAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const cfg = MODES[mode];

  return (
    <div className="card">
      <div className="set-title">{cfg.title}</div>
      <div className="set-sub" style={{ marginBottom: 12 }}>
        {mode === 'reset' && '가입한 이메일로 재설정 링크를 보내드려요.'}
        {mode === 'find' && '아이디는 가입할 때 쓴 이메일이에요. 쓸 만한 이메일을 넣으면 가입된 주소인지 알려드려요.'}
        {mode !== 'reset' && mode !== 'find' && '로그인하면 아이폰과 아이패드가 같은 진도를 봐요.'}
      </div>

      {/* 이 기기에서 로그인한 적이 있으면 그 이메일을 알려 준다 — 누르면 칸에 채운다 */}
      {known && mode !== 'signup' && email.trim() !== known && (
        <button className="acct-known" onClick={() => { setEmail(known); setNotice(''); setFound(''); if (mode === 'find') setMode('signin'); }}>
          <span>이 기기에서 쓰던 계정</span>
          <b>{maskEmail(known)}</b>
          <i>이 이메일 쓰기</i>
        </button>
      )}

      <input
        className="search-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setFound(''); }}
        onKeyDown={(e) => e.key === 'Enter' && (mode === 'reset' || mode === 'find') && submit()}
        style={{ marginBottom: 8 }}
      />
      {mode !== 'reset' && mode !== 'find' && (
        <input
          className="search-input"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder={mode === 'signup' ? '비밀번호 (8자 이상)' : '비밀번호'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ marginBottom: 10 }}
        />
      )}

      {notice && <div className="acct-notice" role="status">{notice}</div>}
      {mode === 'find' && found && (
        <button className="ghost-btn acct-usefound" onClick={() => { setEmail(found); setMode('signin'); setNotice(''); setFound(''); }}>이 이메일로 로그인</button>
      )}

      <button className="submit-btn" onClick={submit} disabled={busy} style={{ marginTop: 4 }}>
        {busy ? '처리 중…' : cfg.action}
      </button>

      <div className="acct-links">
        <button onClick={() => { setMode(cfg.other); setNotice(''); setFound(''); }}>{cfg.otherLabel}</button>
        {mode === 'signin' && (
          <button data-go="find" onClick={() => { setMode('find'); setNotice(''); }}>아이디를 잊었어요</button>
        )}
        {mode === 'signin' && (
          <button data-go="reset" onClick={() => { setMode('reset'); setNotice(''); }}>비밀번호를 잊었어요</button>
        )}
      </div>
    </div>
  );
}
