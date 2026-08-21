/* 회독마다 방식이 달라진다.
 *
 * 같은 카드를 다섯 번 똑같이 보면 다섯 번째에는 카드 생김새를 외운다. 뜻을
 * 아는 게 아니라 "이 그림 다음엔 저 글자"를 아는 것이다. 그래서 회를 거듭할수록
 * 단서를 하나씩 뺀다.
 *
 *   1  읽기      한자와 읽는 법을 같이 보고 뜻 확인
 *   2  떠올리기   한자만 보고 뜻 떠올리기
 *   3  듣기      글자 없이 소리만 듣고 맞히기
 *   4  말하기     한국어를 보고 일본어를 떠올리기 (회화에 제일 가깝다)
 *   5+ 소리내기   일본어를 보고 소리 내어 말하기
 *
 * 몇 회째인지는 rounds가 아니라 streak(연속으로 맞힌 횟수)으로 센다.
 * rounds는 한 판 안에서 「몰라요」로 다시 나올 때마다 올라가서, 방금 틀린
 * 카드가 갑자기 4단계로 뛰어 버린다. streak을 쓰면 맞힐수록 어려워지고
 * 틀리면 처음으로 돌아간다 — 그게 원래 노리던 것이다. */

export const STEP = {
  READ: 'read',
  RECALL: 'recall',
  LISTEN: 'listen',
  PRODUCE: 'produce',
  SPEAK: 'speak',
};

export const STEP_LABEL = {
  [STEP.READ]: '읽기',
  [STEP.RECALL]: '떠올리기',
  [STEP.LISTEN]: '듣기',
  [STEP.PRODUCE]: '한국어 → 일본어',
  [STEP.SPEAK]: '소리 내어',
};

export const STEP_HINT = {
  [STEP.READ]: '읽는 법까지 같이 봐요',
  [STEP.RECALL]: '읽는 법 없이 뜻을 떠올려 보세요',
  [STEP.LISTEN]: '소리만 듣고 맞혀 보세요',
  [STEP.PRODUCE]: '일본어로 어떻게 말할까요?',
  [STEP.SPEAK]: '소리 내어 말해 보세요',
};

const ORDER = [STEP.READ, STEP.RECALL, STEP.LISTEN, STEP.PRODUCE, STEP.SPEAK];

/* 연속 정답 수 → 단계.
 *
 * canListen이 거짓이면 듣기를 건너뛴다. 자동 읽기를 꺼 둔 사람에게 소리를
 * 억지로 트는 건 무례하고, 소리가 안 나오면 글자 없는 화면만 남아서 아무것도
 * 못 한다 — 그때는 떠올리기로 대신한다. */
export function stepFor(streak = 0, { canListen = true } = {}) {
  const n = Math.max(0, Math.floor(Number(streak) || 0));
  const step = ORDER[Math.min(n, ORDER.length - 1)];
  if (step === STEP.LISTEN && !canListen) return STEP.RECALL;
  return step;
}

/* 단계를 기존 설정 모양으로 바꾼다.
 *
 * 방향(direction)과 「히라가나 같이 보기」는 이미 있는 설정이라, 단계는 그
 * 값을 잠깐 덮어쓰는 것으로 충분하다. 새 갈래를 만들지 않는 게 안전하다 —
 * 화면이 이미 그 설정들을 다 다루고 있다. */
export function settingsForStep(settings, step) {
  if (!step) return settings;
  if (step === STEP.READ) return { ...settings, direction: 'kanji-mean', showKana: true };
  if (step === STEP.RECALL) return { ...settings, direction: 'kanji-mean', showKana: false };
  if (step === STEP.LISTEN) return { ...settings, direction: 'kanji-mean', showKana: false };
  if (step === STEP.PRODUCE) return { ...settings, direction: 'mean-kanji' };
  return { ...settings, direction: 'kanji-mean', showKana: false };
}

/* 앞면 글자를 가리는 단계인가 — 듣기뿐이다 */
export function hidesFront(step) {
  return step === STEP.LISTEN;
}

/* 소리를 꼭 내야 하는 단계인가. 듣기는 소리가 전부라, 자동 읽기 설정과
   상관없이 들려줘야 한다. */
export function needsSound(step) {
  return step === STEP.LISTEN;
}
