import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

/* 새 버전이 올라와도 서비스워커가 옛 화면을 계속 내주면, 고쳐 놓은 게 안 보인다.
 * 홈 화면에 추가한 iOS 앱은 특히 오래 붙잡고 있다.
 *
 * ★ 그렇다고 학습 중에 갈아끼우면 안 된다 ★
 *
 * 「이 시점은 앱을 막 연 직후라 끊길 게 없다」고 적어 두고 바로 새로고침했다.
 * 그런데 갱신 확인은 앱을 다시 앞으로 꺼낼 때마다, 30분마다도 돈다 — 카드를
 * 판정하던 중에 배포가 올라오면 그 자리에서 화면이 새로 뜬다. 회독 기록과
 * 세션은 저장돼 있어 이어하기로 돌아갈 수 있지만, 열어 둔 답과 하던 자리는
 * 사라진다. 공부하다 갑자기 처음 화면으로 튕기는 것을 고친 것으로 볼 사람은
 * 없다.
 *
 * 그래서 미룬다. 진행 중인 판이 없을 때 갈아끼운다. */
const SESSION_KEY = 'jp_manabu_session_v1';
function studying() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return Boolean(s?.queue?.length);
  } catch {
    /* 읽지 못하면 학습 중이 아니라고 본다. 영영 갱신 안 되는 쪽이 더 나쁘다 */
    return false;
  }
}

let pending = false;
let told = false;
const applyIfSafe = () => {
  if (!pending) return;
  if (studying()) {
    /* 한 번만 알린다. 30분마다 같은 말을 띄우면 그게 더 방해다 */
    if (!told) {
      told = true;
      window.dispatchEvent(new CustomEvent('jp:update-waiting'));
    }
    return;
  }
  updateSW(true);
};

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    pending = true;
    applyIfSafe();
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    /* 홈 화면 앱은 사실상 안 닫힌다. 앱을 처음 열 때 한 번만 확인하면
     * 며칠 전 화면을 계속 보게 된다. 앱을 다시 앞으로 꺼낼 때마다 새 버전을 확인한다.
     *
     * 미뤄 둔 갱신이 있으면 여기서 다시 살펴본다 — 판을 끝낸 뒤 앱을 한 번
     * 앞으로 꺼내면 그때 적용된다. */
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      applyIfSafe();
      registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    setInterval(check, 30 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
