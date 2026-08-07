import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

/* 새 버전이 올라와도 서비스워커가 옛 화면을 계속 내주면, 고쳐 놓은 게 안 보인다.
 * 홈 화면에 추가한 iOS 앱은 특히 오래 붙잡고 있다.
 * 새 버전이 준비되면 바로 갈아끼운다 — 이 시점은 앱을 막 연 직후라 끊길 게 없다. */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    /* 홈 화면 앱은 사실상 안 닫힌다. 앱을 처음 열 때 한 번만 확인하면
     * 며칠 전 화면을 계속 보게 된다. 앱을 다시 앞으로 꺼낼 때마다 새 버전을 확인한다. */
    const check = () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {});
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
