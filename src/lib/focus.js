/* 초점을 함부로 뺏지 않는다.
 *
 * 퀴즈는 문제가 바뀔 때마다 입력칸에 초점을 준다(바로 칠 수 있게). 그런데 「곤에게 물어보기」 창에서 질문을
 * 치는 중에 문제가 저절로 넘어가면(맞히면 잠깐 뒤 다음 문제) 그 초점 주기가 질문 칸의 초점을 가져가서,
 * 치던 글이 끊기고 글자가 퀴즈 칸으로 들어갔다. 창 안에서 글을 치는 중이면 초점을 안 가져간다. */
export function focusUnlessTyping(el) {
  if (!el) return;
  try {
    const a = document.activeElement;
    if (a && a !== el && a.matches?.('input, textarea, [contenteditable]:not([contenteditable="false"])') && a.closest?.('.sheet, [role="dialog"], .wordmemo')) return;
  } catch { /* 초점을 읽지 못하면 그냥 준다 */ }
  el.focus();
}

/* 질문 창 같은 시트가 열려 있나. 열려 있으면 퀴즈는 저절로 다음 문제로 넘기지 않는다 —
   창에서 이 문제를 물어보는 중에 문제가 사라지면 묻던 것이 무엇인지 모르게 된다. */
export function sheetOpen() {
  /* 외우는 법 메모를 쓰는 중에도 저절로 넘어가지 않는다 */
  try { return Boolean(document.querySelector('.sheet.open, .wordmemo .memo.editing')); } catch { return false; }
}
