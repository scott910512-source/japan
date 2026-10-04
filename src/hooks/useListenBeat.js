import { useEffect, useState } from 'react';
import { DEFAULT_BPM, beatShouldRun, nextBpm, startBeat, stopBeat, unlockBeat } from '../lib/metronome.js';

/* 달리기 박자를 켜고 끄는 자리 — 딱 한 군데.
 *
 * ★ 왜 화면에서 떼어 냈나 ★
 *
 * 듣기 화면이 직접 startBeat/stopBeat를 부르고 있었다. 그러면 「박자가 언제
 * 나야 하나」가 화면 렌더 차례에 섞여서, 효과의 의존성 배열을 한 줄 잘못
 * 쓰는 것만으로 박자가 통째로 어긋난다 — 실제로 한 번 그렇게 됐다.
 * 장이 넘어갈 때마다 멈췄다 다시 켜고 있었고, 그때마다 첫 박이 지금으로
 * 당겨졌다.
 *
 * 이제 화면은 「판이 도는가 · 멈췄는가」만 넘긴다. 오디오 시계에 예약을
 * 거는 일은 lib/metronome.js가, 언제 걸고 끊을지는 여기가 정한다. 화면은
 * WebAudio를 모른다.
 *
 * ★ 효과가 둘인 이유 ★
 *
 * 하나로 합치면 안 된다. 빠르기를 바꿀 때 「끄고 다시 켜기」가 되면 그
 * 순간 박자가 끊기고, 걸어 둔 옛 소리와 새 소리가 겹쳐 쏟아진다.
 *
 *   첫째  날지 말지 — 켜고 끄는 일만 한다. bpm은 안 본다.
 *   둘째  빠르기만 갈아 끼운다 — 돌고 있는 판을 끊지 않는다.
 *
 * startBeat은 같은 빠르기로 다시 불리면 아무것도 안 한다(「계속 돌아라」로
 * 읽는다). 그래서 둘이 겹쳐 불려도 판이 흔들리지 않는다. */
export function useListenBeat({ running, paused, settings, onSettingsChange }) {
  /* 기기에 남은 값으로 시작한다. 달리러 나가서 매번 다시 고르게 하면
     그 자체가 손이 필요한 일이 된다. */
  const [bpm, setBpm] = useState(
    () => (settings?.listenBeat ? (settings.listenBpm || DEFAULT_BPM) : null),
  );

  const save = (v) => {
    /* 켜는 손길은 제스처다 — 여기서 오디오를 깨워 둬야 iOS에서 소리가 난다.
       효과에서 켜는 startBeat은 제스처 밖이라 못 깨운다. */
    if (v != null) unlockBeat();
    setBpm(v);
    onSettingsChange?.({ listenBeat: v != null, ...(v != null ? { listenBpm: v } : {}) });
  };

  const on = beatShouldRun({ running, paused, bpm });

  useEffect(() => {
    if (!on) { stopBeat(); return undefined; }
    startBeat(bpm);
    return () => stopBeat();
    // bpm은 아래가 맡는다 — 여기서 받으면 빠르기를 바꿀 때 판이 끊긴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  useEffect(() => {
    if (on) startBeat(bpm);
    // on은 위가 맡는다 — 여기서 받으면 멈출 때 한 번 더 걸게 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  return {
    bpm,
    on,
    /* 달리면서 누르는 자리 — 한 손가락으로 160 → 170 → 180 → 끄기 */
    cycle: () => save(nextBpm(bpm)),
    /* 설정 화면의 켜고 끄기. 켜면 마지막에 쓰던 값이 아니라 기본값으로
       올린다 — 끈 뒤에 고른 값을 기억해 두면 「껐는데 왜 170이 뜨나」가 된다. */
    toggle: () => save(bpm == null ? DEFAULT_BPM : null),
    pick: (v) => save(v),
    /* 제스처가 있는 자리(재생 시작·잠깐 멈춤)에서 부른다 — 박자가 켜진 채로
       시작할 때 iOS가 소리를 내게. 꺼져 있으면 아무것도 안 한다. */
    arm: () => { if (bpm != null) unlockBeat(); },
  };
}
