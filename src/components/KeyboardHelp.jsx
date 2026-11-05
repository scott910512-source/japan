import { useHasKeyboard } from '../lib/useHotkeys.js';
import '../styles/keyboard.css';

export default function KeyboardHelp({ kind = 'quiz' }) {
  const show = useHasKeyboard();
  if (!show) return null;
  return <details className="keyboard-help"><summary>키보드 안내 · <kbd>Enter</kbd> {kind === 'listen' ? '다음' : '확인·다음'} · <kbd>Space</kbd> 듣기</summary>
    <p>{kind === 'listen' ? 'Space 재생·일시정지 / ← → 이전·다음 / ↓ 처음부터 다시 듣기' : kind === 'study' ? 'Enter 답 보기·알아요 / 1 몰라요 · 2 애매해요 · 3 알아요 / Space 듣기 / Shift+Space 천천히 / ← 되돌리기' : kind === 'build' ? '1–9 화면의 조각 순서로 선택 / ← 마지막 조각 취소 / Enter 다음 문장 / Space 완성 후 듣기' : '1–9 화면의 보기 번호로 답 선택 (답한 뒤에는 해당 보기 듣기) / Enter 제출·다음 / Space 듣기 (정답이 드러나는 문제는 답한 뒤)'} · Esc 나가기</p>
    <p>숫자키로 푸는 퀴즈는 답을 확인한 뒤 Enter로 넘겨요. 글을 쓰는 칸에서는 입력을 우선해요. Vimium을 쓰면 이 사이트를 제외 URL에 추가해 주세요. Z·X·C는 사용하지 않아요.</p>
  </details>;
}
