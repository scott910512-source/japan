import { useEffect, useState } from 'react';
import {
  loadStreak, setStorageErrorHandler, setStorageOkHandler,
} from '../lib/storage.js';
import { audioUnlocked, configureTTS, setTTSErrorHandler, unlockAudio } from '../lib/tts.js';
import { configureSTT } from '../lib/stt.js';

/* 앱을 켤 때 한 번 해 두는 일들 — 브라우저와 맞추는 자리.
 *
 * ★ 왜 모았나 ★
 *
 * 저장 실패를 받는 손, 음성 오류를 받는 손, 「새 버전이 준비됐다」는 알림,
 * iOS 오디오 열기, 연속일 읽기, 테마 적용, 음성·음성인식 설정 — 전부
 * 「바깥 시스템과 맞추는 일」인데 App 가운데에 흩어져 있었다. 화면을 고치러
 * 들어온 사람이 매번 이걸 먼저 지나야 했다.
 *
 * 여기 모인 것들의 공통점은 「React 상태끼리 맞추는 일이 아니다」라는 것이다.
 * 효과는 이런 데 쓰는 게 맞다 — 상태가 바뀌면 다른 상태를 맞추는 용도로
 * 쓰기 시작하면 어느 게 먼저인지 알 수 없게 된다. */
export function useAppBoot({ settings, showToast }) {
  /* 저장이 막힌 상태. 해결될 때까지 남는다 — 토스트만으로는 못 알아챈다. */
  const [storeError, setStoreError] = useState(null);
  const [streak, setStreak] = useState({ count: 0, lastDate: null });

  useEffect(() => {
    /* ★ 저장 실패는 알려야 하는 실패다 ★
       토스트로 끝내면 두 걸음 걷고 나면 사라지는데, 그 사이 기록은 계속
       저장되지 않는다. 해결될 때까지 설정의 저장 상태에 남긴다.
       (비교: 화면 걸쇠를 못 잡는 것은 알릴 필요가 없는 실패다 — 듣기는
       그대로 돌아간다.) */
    setStorageErrorHandler((msg) => { showToast(msg); setStoreError(msg); });
    // 켜져 있을 때만 끈다 — write가 성공할 때마다 화면을 다시 그리지 않게
    setStorageOkHandler(() => setStoreError((cur) => (cur ? null : cur)));
    setTTSErrorHandler(showToast);

    /* 새 버전이 준비됐는데 학습 중이라 미뤄 둔 경우(main.jsx). 조용히 미루면
       왜 안 바뀌는지 알 수 없으니 한 번 알린다 — 판을 끝내면 적용된다. */
    const onWaiting = (e) => showToast(
      e?.detail?.label || '새 버전이 준비됐어요 · 앱을 내려놨다 열면 적용돼요',
    );
    window.addEventListener('jp:update-waiting', onWaiting);

    /* 연속일은 여기서 올리지 않는다 — 앱을 켠 것과 공부한 것은 다르다.
       올리는 자리는 오늘 첫 판정(applyReview)이다. */
    setStreak(loadStreak());

    /* 온보딩은 여기서 열지 않는다. 로그인한 사람은 계정에 이미 답이 있는데,
       동기화가 내려오기 전에 물어보면 기기를 바꿀 때마다 「가타카나 읽을 줄
       아세요?」를 다시 답하게 된다. App이 알 만해진 뒤에 정한다. */

    /* iOS는 첫 사용자 제스처에서만 오디오를 열어준다.
       한 번에 성공하지 못할 수 있어 열릴 때까지 계속 시도한다. */
    const unlock = () => {
      unlockAudio();
      if (audioUnlocked()) window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('jp:update-waiting', onWaiting);
    };
  }, [showToast]);

  // 음성 인식도 같은 Google API 키를 쓴다
  useEffect(() => {
    configureTTS({
      gttsKey: settings.gttsKey,
      useCloud: settings.useCloudTTS,
      voice: settings.gttsVoice,
      deviceVoiceURI: settings.deviceVoiceURI,
    });
    configureSTT({ gttsKey: settings.gttsKey, useCloud: settings.useCloudTTS });
  }, [settings.gttsKey, settings.useCloudTTS, settings.gttsVoice, settings.deviceVoiceURI]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  return { storeError, streak, setStreak };
}
