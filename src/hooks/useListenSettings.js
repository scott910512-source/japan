import { useState } from 'react';
import {
  listenBlocksPatch, listenPatch, readListenAll, readListenBlocks, readListenDropped,
} from '../lib/listenSettings.js';

/* 듣기 설정을 쥐는 자리. 규칙은 lib/listenSettings.js의 표에 있다.
 *
 * ★ 상태 하나로 모았다 ★
 *
 * 열두 개의 useState와 열두 개의 손잡이가 화면 맨 위를 채우고 있었다.
 * 하나로 모으면 「바뀌면 기기에도 적는다」를 한 군데서만 지키면 된다 —
 * 전에는 칸마다 onSettingsChange를 따로 불렀고, 한 번 빼먹으면 켠 것이
 * 다음에 들어올 때 꺼져 있었다.
 *
 * 구간과 뺀 낱말은 따로 둔다. 둘 다 목록이고, 고르는 규칙이 참거짓 한 칸과
 * 다르다 — 구간은 번호 차례로 정리해야 하고, 뺀 낱말은 Set으로 다룬다. */
export function useListenSettings({ settings, onSettingsChange }) {
  const [values, setValues] = useState(() => readListenAll(settings));
  const [blocks, setBlocks] = useState(() => readListenBlocks(settings));
  const [dropped, setDropped] = useState(() => new Set(readListenDropped(settings)));

  /* 한 칸을 바꾼다 — 화면과 기기에 같이 적는다. */
  const set = (name, value) => {
    setValues((v) => (v[name] === value ? v : { ...v, [name]: value }));
    onSettingsChange?.(listenPatch(name, value));
  };

  /* 참거짓 칸을 뒤집는다. 「지금 값의 반대」를 부르는 쪽에서 계산하면
     두 군데서 틀릴 수 있다 — 화면에 쓴 값과 저장한 값이 어긋난다. */
  const flip = (name) => set(name, !values[name]);

  const saveBlocks = (list) => {
    setBlocks(list);
    onSettingsChange?.(listenBlocksPatch(list));
  };

  const saveDropped = (next) => {
    setDropped(next);
    onSettingsChange?.({ listenDropped: [...next] });
  };

  return { values, set, flip, blocks, saveBlocks, dropped, saveDropped };
}
