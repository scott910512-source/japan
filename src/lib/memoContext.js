import { createContext, useContext } from 'react';

/* 단어 암기 메모를 어느 화면에서든 쓰게 하는 통로.
 * 메모 저장소(memos)와 저장 함수는 앱이 한 군데(App)에서 쥐고 있고, 퀴즈 · 회독 같은 화면이
 * 각자 props로 받아 오면 화면마다 배선이 늘어난다. 여기서 한 번 열어 두면 화면은 단어 id만 넘긴다. */
export const MemoContext = createContext({ memos: {}, saveMemo: () => {} });
export const useMemos = () => useContext(MemoContext);
