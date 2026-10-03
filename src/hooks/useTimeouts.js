import { useCallback, useEffect, useRef } from 'react';

/* 화면이 꺼지면 같이 꺼지는 setTimeout.
 *
 * ★ 왜 필요한가 ★
 *
 * 여기저기 이런 줄이 있었다.
 *
 *   setTimeout(() => setPicked(null), 800);
 *   setTimeout(() => advance(next), 250);
 *
 * 그 사이에 화면을 나가면 꺼진 화면의 상태를 건드린다. React 18에서는
 * 조용히 아무 일도 안 일어나니 당장 눈에 띄지 않는데, 문제는 「조용히 아무
 * 일도 안 일어나는 것」이 전부가 아니라는 점이다. 그 안에서 부모에게 결과를
 * 넘기거나(한 판을 기록하거나) 다음 문제로 넘기면, 나간 뒤에 한 판이 적히고
 * 한 문제가 넘어간다. 어디서 온 기록인지 알 수 없는 한 줄이 남는다.
 *
 * ★ 왜 손으로 clearTimeout을 안 쓰나 ★
 *
 * 쓸 수는 있다. 다만 ref를 하나 두고, 효과에서 정리하고, 여러 개가 겹칠 때
 * 각각 따로 들고 있어야 한다 — 그 되풀이가 화면마다 네 줄씩 붙는다. 그리고
 * 그 네 줄 중 하나를 빼먹는 것이 바로 위의 문제다.
 *
 * 쓰는 법은 setTimeout과 같다. 돌려주는 값으로 미리 끊을 수도 있다. */
export function useTimeouts() {
  const live = useRef(new Set());

  useEffect(() => () => {
    for (const id of live.current) clearTimeout(id);
    live.current.clear();
  }, []);

  /* 화면이 살아 있는 동안만 도는 타이머 */
  const after = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      live.current.delete(id);
      fn();
    }, ms);
    live.current.add(id);
    return id;
  }, []);

  /* 하나만 끊는다 */
  const cancel = useCallback((id) => {
    clearTimeout(id);
    live.current.delete(id);
  }, []);

  return { after, cancel };
}
