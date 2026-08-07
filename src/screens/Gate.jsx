import { useEffect, useState } from 'react';
import Account from './Account.jsx';

/* 앱에 들어가기 전 로그인 관문.
 *
 * 한 번 로그인하면 세션이 기기에 남아 다음부터는 이 화면을 보지 않는다.
 * 다만 세션이 만료됐는데 마침 오프라인이면 갱신을 못 해 학습이 통째로 잠긴다.
 * 여행지에서 그러면 앱이 무용지물이 되므로, 전에 로그인한 적이 있고 지금
 * 네트워크가 없을 때는 이 기기에 남은 기록으로 계속할 수 있게 열어 둔다. */
export default function Gate({ onVaultKey, onToast, signedInOnce, onContinueOffline }) {
  const [online, setOnline] = useState(() => navigator.onLine);

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

  return (
    <div className="gate">
      <div className="gate-brand">
        <div className="gate-mark">あ</div>
        <h1>JS일본어</h1>
        <p>회독으로 반복해서 외우는 일본어</p>
      </div>

      <Account
        session={null}
        syncState={{ busy: false, at: null }}
        onSync={() => {}}
        onSignedOut={() => {}}
        onVaultKey={onVaultKey}
        onToast={onToast}
      />

      <div className="gate-note">
        학습 기록이 계정에 저장돼서 기기를 바꿔도 이어집니다.
      </div>

      {signedInOnce && !online && (
        <button className="ghost-btn gate-offline" onClick={onContinueOffline}>
          지금은 인터넷이 없어요 · 이 기기 기록으로 계속하기
        </button>
      )}
    </div>
  );
}
