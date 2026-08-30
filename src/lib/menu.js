/* 학습 탭에 무엇이 있고, 어디에 묶이는가.
 *
 * 열두 칸이 한 바둑판에 나란히 있었다. 「단어암기」 옆에 「단어 시험」이 있고
 * 그 옆에 「짝 맞추기」가 있으니, 무엇이 배우는 것이고 무엇이 확인하는 것인지
 * 눈으로 안 갈렸다. 칸이 늘 때마다 더 나빠지기만 했다.
 *
 * 세 묶음으로 가른다. 기준은 「지금 이 카드가 나에게 어떤 상태인가」다.
 *
 *   배우기  — 아직 모른다. 처음 넣는다
 *   연습하기 — 알기는 아는데 손에 안 붙는다. 다른 방식으로 굴려 본다
 *   반복하기 — 넣어 뒀는데 샌다. 다시 만난다
 *
 * 이 순서가 곧 한 카드가 지나가는 길이다. 그래서 새 메뉴가 생겨도 어디에
 * 넣을지 헷갈리지 않는다 — 「이 기능을 쓸 때 그 카드는 어떤 상태인가」만
 * 물으면 된다.
 *
 * 공부가 아닌 것(번역기·내 단어장)은 여기 없다. 더보기로 간다 — 학습 탭에
 * 두면 「오늘 뭘 공부하지」를 고르는 자리에 공부 아닌 것이 끼어든다. */

export const MENU_GROUPS = [
  { id: 'learn', label: '배우기', sub: '아직 모르는 것을 처음 넣어요' },
  { id: 'practice', label: '연습하기', sub: '아는 걸 다른 방식으로 굴려 봐요' },
  { id: 'repeat', label: '반복하기', sub: '샌 것을 다시 만나요' },
];

/* icon은 이름만 적는다. 이 파일은 화면이 아니라 짜임새를 적는 곳이라
   컴포넌트를 들이면 검사에서 이 파일 하나만 읽을 수가 없다.

   big: 큰 카드로 그린다. 묶음마다 무엇이 중심인지 하나는 커야, 처음 온
   사람이 어디부터 누를지 안다. */
export const MENUS = [
  // ── 배우기 ──
  { id: 'words', group: 'learn', label: '단어', sub: '회독으로 반복해서 외우기', icon: 'book', big: true },
  { id: 'grammar', group: 'learn', label: '문법', sub: '기초문법 · 일상문법', icon: 'grid', big: true },
  { id: 'sentences', group: 'learn', label: '상황회화', sub: '이동 · 식당 · 일상', icon: 'chat', big: true },
  { id: 'basics', group: 'learn', label: '완전기초', sub: '히라가나 · 숫자 · 인사', icon: 'sparkle' },

  // ── 연습하기 ──
  { id: 'quiz', group: 'practice', label: '단어 시험', sub: '객관식 · 주관식', icon: 'list' },
  { id: 'conjugate', group: 'practice', label: '동사 활용', sub: '기초 시제', icon: 'repeat' },
  { id: 'adverb', group: 'practice', label: '부사 연습', sub: '빈칸 채우기', icon: 'pencil' },
  { id: 'match', group: 'practice', label: '짝 맞추기', sub: '게임처럼', icon: 'grid' },
  { id: 'rpg', group: 'practice', label: '실전 연습', sub: '상황을 통째로', icon: 'person' },

  // ── 반복하기 ──
  { id: 'repeat', group: 'repeat', label: '회독 학습', sub: '배운 걸 등급별로 다시', icon: 'repeat', big: true },
  { id: 'weak', group: 'repeat', label: '약점 복습', sub: '세 번 넘게 틀린 것만', icon: 'flame', big: true },
];

/* 설정에서 켠 것만, 묶음 순서대로.
 *
 * 없어진 메뉴(jlpt·translate)가 설정에 남아 있어도 여기 없으면 안 뜬다 —
 * 목록이 이 파일 하나로 정해진다는 뜻이다. */
export function groupedMenus(menus = {}) {
  return MENU_GROUPS.map((g) => ({
    ...g,
    items: MENUS.filter((m) => m.group === g.id && menus[m.id]),
  })).filter((g) => g.items.length > 0);
}

/* 켤 수 있는 메뉴 id — 설정 화면이 이걸로 목록을 그린다 */
export const MENU_IDS = MENUS.map((m) => m.id);
