/* 학습 탭에 무엇이 있고, 어디에 묶이는가.
 *
 * 열두 칸이 한 바둑판에 나란히 있었다. 「단어암기」 옆에 「단어 시험」이 있고
 * 그 옆에 「짝 맞추기」가 있으니, 무엇이 배우는 것이고 무엇이 확인하는 것인지
 * 눈으로 안 갈렸다. 칸이 늘 때마다 더 나빠지기만 했다.
 *
 * 그래서 세 묶음으로 가른다. 기준은 「무엇을 하러 들어가는가」다.
 *
 *   학습 — 모르는 걸 새로 넣는다
 *   퀴즈 — 아는지 확인하고 굳힌다
 *   기타 — 공부가 아니라 쓰는 것
 *
 * 이 기준이면 새 메뉴가 생겨도 어디에 넣을지 헷갈리지 않는다. 「이걸로 뭘
 * 배우나」가 아니라 「이걸 왜 여나」로 묻기 때문이다. */

export const MENU_GROUPS = [
  { id: 'learn', label: '학습', sub: '모르는 걸 새로 넣어요' },
  { id: 'quiz', label: '퀴즈', sub: '아는지 확인하고 굳혀요' },
  { id: 'etc', label: '기타', sub: '공부 말고, 쓰는 것' },
];

/* icon은 이름만 적는다. 이 파일은 화면이 아니라 짜임새를 적는 곳이라
   컴포넌트를 들이면 검사에서 이 파일 하나만 읽을 수가 없다. */
export const MENUS = [
  // ── 학습 — 모르는 걸 새로 넣는다 ──
  { id: 'basics', group: 'learn', label: '완전기초', sub: '히라가나 · 숫자 · 인사', icon: 'sparkle' },
  { id: 'words', group: 'learn', label: '단어암기', sub: '회독으로 반복해서 외우기', icon: 'book', primary: true },
  { id: 'grammar', group: 'learn', label: '문법', sub: '기초문법 · 일상문법', icon: 'grid' },
  { id: 'sentences', group: 'learn', label: '상황별 문장암기', sub: '이동 · 식당 · 일상', icon: 'chat' },
  { id: 'repeat', group: 'learn', label: '회독 학습', sub: '배운 걸 등급별로 다시', icon: 'repeat' },

  // ── 퀴즈 — 아는지 확인하고 굳힌다 ──
  { id: 'quiz', group: 'quiz', label: '단어 시험', sub: '객관식 · 주관식으로 확인', icon: 'list' },
  { id: 'conjugate', group: 'quiz', label: '동사 활용', sub: '기초 시제 · 1형 2형 3형', icon: 'repeat' },
  { id: 'adverb', group: 'quiz', label: '부사 연습', sub: '빈칸 채우기로 자리 익히기', icon: 'pencil' },
  { id: 'match', group: 'quiz', label: '짝 맞추기', sub: '게임처럼 · 글자와 소리로', icon: 'grid' },
  { id: 'rpg', group: 'quiz', label: '실전 연습', sub: '편의점부터 — 상황을 통째로', icon: 'person' },

  // ── 기타 ──
  { id: 'translate', group: 'etc', label: '번역기', sub: '현지에서 바로 — 발음까지', icon: 'map' },
];

/* 설정에서 켠 것만, 묶음 순서대로.
 *
 * 없어진 메뉴(jlpt)가 설정에 남아 있어도 여기 없으면 안 뜬다 — 목록이
 * 이 파일 하나로 정해진다는 뜻이다. */
export function groupedMenus(menus = {}) {
  return MENU_GROUPS.map((g) => ({
    ...g,
    items: MENUS.filter((m) => m.group === g.id && menus[m.id]),
  })).filter((g) => g.items.length > 0);
}

/* 켤 수 있는 메뉴 id — 설정 화면이 이걸로 목록을 그린다 */
export const MENU_IDS = MENUS.map((m) => m.id);
