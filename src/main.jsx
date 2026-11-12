import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import '@fontsource-variable/noto-sans-jp';
import './index.css';
import { isBusy } from './lib/busy.js';
import { updateGate, waitingLabel, WHY } from './lib/swgate.js';
import { installTapGuard } from './lib/tapguard.js';

/* 같은 자리를 0.2초 안에 또 누른 것은 한 번으로 본다 — 손이 튀어 두 번 눌린 것이 판정으로 적히지 않게 */
installTapGuard(window);

/* 새 버전이 올라와도 서비스워커가 옛 화면을 계속 내주면, 고쳐 놓은 게 안 보인다.
 * 홈 화면에 추가한 iOS 앱은 특히 오래 붙잡고 있다.
 *
 * ★ 그렇다고 보고 있는 화면을 갈아끼우면 안 된다 ★
 *
 * 갈아끼우기는 곧 새로고침이고, 이 앱은 주소가 없다 — 어느 화면에 있었든
 * 새로고침하면 홈이다. 배포를 올린 다음 앱을 열면 몇 초 뒤에 갱신이 잡히는데,
 * 그 사이 사람이 탭 하나를 눌렀으면 그 자리가 사라진다. 한 배포에 한 번씩 꼭
 * 일어나고, 쓰는 사람에게는 「처음 들어가면 한 번 홈으로 튕긴다」로 보인다.
 *
 * 그래서 「학습 중인가」가 아니라 「지금 이 새로고침이 보이는가」로 묻는다.
 * 규칙은 lib/swgate.js에 있다 — 이 파일은 registerSW를 부르는 자리라 검사에서
 * 통째로 불러올 수가 없어서, 규칙만 떼어 두었다. */
const SESSION_KEY = 'jp_manabu_session_v1';
function hasSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return Boolean(s?.queue?.length);
  } catch {
    /* 읽지 못하면 학습 중이 아니라고 본다. 영영 갱신 안 되는 쪽이 더 나쁘다 */
    return false;
  }
}

function stateNow() {
  return {
    pending,
    busy: isBusy(),
    hasSession: hasSession(),
    visible: document.visibilityState === 'visible',
  };
}

let pending = false;
let told = false;
let applying = false;
/* ★ 새 버전이 넘겨받으면 새로고침한다 — 우리가 갈아끼우기로 한 때만 ★
   라이브러리가 대신 새로고침해 주긴 하는데 그 조건(새로고침 가능 여부 표시)을 믿을 수 없어서, 어느 쪽이 되든 여기서도 한 번 확실히 한다.
   applying이 켜진 뒤(= 안전하다고 보고 갈아끼우기를 시작한 뒤)에만 움직인다 — 그 전에 넘겨받는 일은 없다(skipWaiting을 껐다). */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) window.location.reload(); });
}
const applyIfSafe = () => {
  const why = updateGate(stateNow());
  if (why === WHY.OK) { applying = true; updateSW(true); return; }
  if (why === WHY.NONE) return;
  /* 한 번만 알린다. 30분마다 같은 말을 띄우면 그게 더 방해다 */
  if (told) return;
  const label = waitingLabel(why);
  if (!label) return;
  told = true;
  window.dispatchEvent(new CustomEvent('jp:update-waiting', { detail: { label } }));
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
     * ★ 내려놓을 때가 갈아끼우기 제일 좋은 때다 ★
     * 안 보고 있는 동안 바꿔 두면, 돌아왔을 때 새 버전이 떠 있다 — 사람 눈에는
     * 「앱을 다시 켠 것」이라 잃는 자리가 없다. 그래서 숨을 때도 한 번 본다. */
    const check = () => {
      applyIfSafe();
      if (document.visibilityState !== 'visible') return;
      registration.update().catch(() => {});
    };
    /* ★ 여기는 정리하지 않는다 ★
       이 셋은 서비스워커가 등록될 때 한 번 붙고 탭이 사는 동안 살아 있어야
       한다 — 앱 전체가 곧 이 생애다. 떼어 낼 자리가 없고(이 콜백은 한 번만
       불린다), 떼면 그때부터 새 버전을 영영 안 확인한다. 화면 안의 타이머와
       다른 종류라, 「정리가 없다」는 이유로 지우면 안 된다. */
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    setInterval(check, 30 * 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
