/* 음성 API 키가 계정에 어떻게 보관돼 있는지 알려주는 칸.
 *
 * 잠그고 푸는 건 로그인할 때 만든 금고 열쇠로 앱이 알아서 한다.
 * 사용자가 누를 게 있으면 안 누른다 — 그래서 여기는 상태만 보여준다. */
import VaultUnlock from './VaultUnlock.jsx';

export default function KeyVault({ session, localKey, remoteEnvelope, vaultReady, onVaultKey, onToast }) {
  if (!session) {
    return (
      <div className="set-note" style={{ marginTop: 12 }}>
        로그인하면 이 키를 계정에 암호화해 두고 다른 기기에서도 그대로 쓸 수 있어요.
      </div>
    );
  }

  /* 로그인은 돼 있는데 금고 열쇠가 없는 기기 — 비밀번호를 한 번 넣어 켠다(VaultUnlock) */
  if (!vaultReady) {
    return <div className="vault"><VaultUnlock session={session} onVaultKey={onVaultKey} onToast={onToast} /></div>;
  }
  let state;
  if (remoteEnvelope && localKey) {
    state = { cls: 'ok', text: '계정에 암호화해서 보관 중' };
  } else if (remoteEnvelope) {
    state = { cls: 'ok', text: '계정에 보관된 키를 가져오는 중…' };
  } else if (localKey) {
    state = { cls: '', text: '계정에 올리는 중…' };
  } else {
    state = { cls: '', text: '아직 보관된 키가 없어요' };
  }

  return (
    <div className="vault">
      <div className={`vault-state ${state.cls}`}>
        {state.cls === 'ok' ? <b>{state.text}</b> : state.text}
      </div>
      <div className="set-note">
        키는 이 기기에서 잠근 뒤 올라가요. 잠그는 열쇠는 로그인 비밀번호로 만들고
        어디에도 저장하지 않아서, 데이터베이스를 통째로 열어봐도 키를 읽을 수 없어요.
        다른 기기에서 같은 계정으로 로그인하면 알아서 풀려요.
      </div>
    </div>
  );
}
