/* 듣기 화면의 설정 — 기기에 남는 값과 화면 상태를 잇는 표.
 *
 * ★ 왜 표로 모았나 ★
 *
 * 열두 개가 각자 이렇게 적혀 있었다.
 *
 *   const [loop, setLoop] = useState(settings.listenLoop !== false);
 *   const [recap, setRecap] = useState(settings.listenRecap === true);
 *   const [gap, setGap] = useState(settings.listenGap || 2);
 *
 * 읽는 규칙이 셋이다 — 「기본 켬」은 !== false, 「기본 끔」은 === true,
 * 숫자는 || 기본값. 같은 모양이 아니라서 새 칸을 더할 때마다 어느 쪽으로
 * 써야 하는지 다시 생각해야 했고, 한 번 틀리면 기본값이 뒤집힌다 — 「끝에
 * 한 번 더」가 저절로 켜져 있는 식이다. 그러면 한 장에 드는 시간이 늘어난
 * 이유를 아무도 모른다.
 *
 * 그리고 바뀔 때마다 두 곳에 써야 한다(화면 상태 + 기기 저장). 한쪽을
 * 빼먹으면 켠 것이 다음에 들어올 때 꺼져 있다.
 *
 * 그래서 「무엇이 어느 키에 어떤 기본값으로 붙는가」를 여기 한 장에 적고,
 * 읽기·쓰기는 한 길로 지나가게 한다.
 *
 * ★ 저장 키는 바꾸지 않는다 ★
 *
 * listenDir·listenSayKo 같은 이름이 예쁘지 않아도 그대로 둔다. 쓰던 사람의
 * 기기에 그 이름으로 적혀 있고, 바꾸면 그 사람이 고른 것이 전부 기본값으로
 * 돌아간다. 안쪽 이름(direction·sayKo)만 읽기 좋게 둔다. */

export const LISTEN_SETTINGS = {
  /* 방향 — 듣고 알아듣기(jp-ko) · 듣고 말해 보기(ko-jp) · 랜덤(mix) */
  direction: { key: 'listenDir', def: 'jp-ko' },
  /* 무엇을 들을까 — 오늘 · 기출 · 여행 · 배운 것 · 약점 · 전체 */
  scope: { key: 'listenScope', def: 'today' },
  /* 구간별 / 섞어서 */
  order: { key: 'listenOrder', def: 'block' },
  /* 한 번에 몇 장 */
  count: { key: 'listenCount', def: 20 },
  /* 장 사이 몇 초 */
  gap: { key: 'listenGap', def: 2 },
  /* 뜻도 소리로 — 화면을 못 보는 자리라 기본은 켬 */
  sayKo: { key: 'listenSayKo', def: true },
  /* 뒤집은 판에서 답(일본어)도 읽어 줄지 — 끄면 말하기 연습이 된다 */
  sayAnswer: { key: 'listenSayAnswer', def: true },
  /* 뜻까지 듣고 일본어를 한 번 더 — 한 장이 길어지니 기본은 끔 */
  recap: { key: 'listenRecap', def: false },
  /* 읽는 법을 처음부터 띄울지 — 띄우면 듣는 게 아니라 읽는 것이 된다 */
  showYomi: { key: 'listenShowYomi', def: false },
  /* 다 외운 낱말은 빼기 — 눈으로 아는 것이 귀로는 낯설어서 기본은 끔 */
  skipDone: { key: 'listenSkipDone', def: false },
  /* 정지할 때까지 한 세트를 돈다 */
  loop: { key: 'listenLoop', def: true },
  /* 바퀴마다 순서 섞기 — 차례를 외우는 것을 막는다 */
  reshuffle: { key: 'listenReshuffle', def: true },
};

/* 한 칸을 읽는다. 기본값의 생김새가 규칙을 정한다 —
   참/거짓이면 「기본 켬은 명시적으로 끈 것만 끔」, 숫자·글자면 빈 값일 때 기본값. */
export function readListen(settings, name) {
  const spec = LISTEN_SETTINGS[name];
  if (!spec) return undefined;
  const v = (settings || {})[spec.key];
  if (typeof spec.def === 'boolean') return spec.def ? v !== false : v === true;
  return v || spec.def;
}

export function readListenAll(settings) {
  const out = {};
  for (const name of Object.keys(LISTEN_SETTINGS)) out[name] = readListen(settings, name);
  return out;
}

/* 한 칸을 기기에 적을 모양으로. 바뀔 때마다 이 한 줄이 저장 쪽으로 간다. */
export function listenPatch(name, value) {
  const spec = LISTEN_SETTINGS[name];
  return spec ? { [spec.key]: value } : {};
}

/* ★ 고른 구간 ★
 *
 * 옛 설정은 구간이 하나뿐이었다(listenBlock). 여러 개를 고를 수 있게 된 뒤로
 * listenBlocks를 쓰는데, 쓰던 사람이 업데이트하는 순간 고른 자리가 사라지면
 * 안 된다 — 그래서 새 키가 비어 있으면 옛 키를 한 칸짜리로 읽는다.
 *
 * 둘 다 쓴다. 옛 버전으로 돌아가거나 다른 기기가 아직 안 올라갔을 때, 적어도
 * 첫 구간은 맞게 읽히게 한다. */
export function readListenBlocks(settings) {
  const saved = (settings || {}).listenBlocks;
  if (Array.isArray(saved) && saved.length) return saved;
  return [(settings || {}).listenBlock || 0];
}

export function listenBlocksPatch(blocks) {
  const list = Array.isArray(blocks) && blocks.length ? blocks : [0];
  return { listenBlocks: list, listenBlock: list[0] };
}

/* 「다 외웠어요」로 뺀 낱말. 기기에 남는다 — 화면이 열려 있는 동안만
   기억하던 때는 어제 뺀 서른 개가 오늘 그대로 다시 나왔다. */
export function readListenDropped(settings) {
  const saved = (settings || {}).listenDropped;
  return Array.isArray(saved) ? saved : [];
}
