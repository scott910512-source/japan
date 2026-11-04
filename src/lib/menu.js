/* 학습 탭에 무엇이 있고, 어디에 묶이는가.
 *
 * ★ 탭은 넷이다 ★
 *
 *   오늘         — 오늘 할 공부를 바로 시작하는 자리
 *   학습         — 「무엇을」 공부할지 고르는 자리 (여기)
 *   복습&내기록  — 내가 한 것: 복습 · 퀴즈 · 오답노트 · 약점 · 진도
 *   설정         — 학습 설정 · 음성 · 계정 · 백업 · 도구 · 앱 정보
 *
 * 그래서 여기에는 콘텐츠 종류만 있다. 「복습하기」 같은 행동은 복습&내기록이 하고,
 * 「새로 배우기」는 오늘이 한다 — 행동을 콘텐츠와 같은 줄에 두면 「단어」를
 * 누를지 「새로 배우기」를 누를지부터 고민하게 된다.
 *
 *   추천 경로        N3 학습하기와 기출 단어. 이 앱의 목표라서 맨 위. N3 코스 입구는 여기 하나다
 *   원하는 것 골라   단어 · 문법 · 한자 · 문장 · 듣기. 모든 칸이 같은 크기
 *   자료 더 보기     여행 일본어 · 영상 · 완전기초 · 독일어
 *
 * ★ 퀴즈는 학습 탭에 줄을 서지 않는다 ★
 *
 * 단어 시험 · 짝 맞추기 · 부사 연습 · 동사 활용 · 상황 대화는 「배운 것을 굴려 보는」 퀴즈다.
 * 단어·문법 화면과 학습 탭 여기저기에 있던 것을 복습&내기록 › 퀴즈 한 곳에 모았다
 * (쭉 퀴즈·문장 만들기도 거기 있다). parent 'drill'이 그 화면이다. id·설정 열쇠·화면은 그대로 —
 * 자리만 옮겼고 저장된 것은 하나도 바뀌지 않는다. group이 'practice'인 칸은 학습 탭 바둑판에 안
 * 그리고(inline), 설정의 메뉴 켜기·끄기에는 그대로 나온다.
 *
 * 공부가 아닌 것(번역기·내 단어장)은 여기 없다. 설정 → 학습 도구에 있다. 회독 학습·약점 복습은
 * 복습&내기록으로 갔다 — 같은 곳으로 가는 길이 여러 개면 어느 길이 맞는지 매번 고르게 된다. */

export const MENU_GROUPS = [
  { id: 'course', label: '추천 경로', sub: 'N3까지 가는 대표 길 — N3 학습하기 하나면 돼요' },
  { id: 'pick', label: '원하는 것 골라 학습', sub: '무엇을 공부할지 골라요' },
  { id: 'more', label: '자료 더 보기', sub: '여행 · 영상 · 기초 · 독일어' },
  /* 학습 탭에는 안 그린다(inline). 단어·문법 화면 안에서 열리고, 설정에서만 켜고 끈다 */
  { id: 'practice', label: '퀴즈', sub: '복습&내기록 › 퀴즈에서 열려요', inline: true },
];

/* icon은 이름만 적는다. 이 파일은 화면이 아니라 짜임새를 적는 곳이라
   컴포넌트를 들이면 검사에서 이 파일 하나만 읽을 수가 없다.

   big: 큰 카드로 그린다. 지금은 쓰는 칸이 없다 — N3도 다른 칸과 같은 크기다.
   큰 칸이 자리를 많이 차지해서, 모든 칸을 같은 크기로 맞췄다(진도는 내 학습에서 본다).

   parent: 이 연습이 열리는 화면(sub id). 값이 있으면 그 화면 안 「연습」 줄에
   나온다. 뒤로 가면 그 화면으로 돌아온다. */
export const MENUS = [
  // ── 추천 경로 ──
  /* 코스 하나로 N3까지. 진도는 회독 기록(단어·문법·한자 id)에 그대로 붙고,
     코스만의 것은 progress.n3에 적힌다. 오늘의 「이어서 공부하기」에서도 바로 연다. */
  { id: 'n3', group: 'course', label: 'N3 학습하기', sub: 'N4 복습부터 모의고사까지 한 권으로', icon: 'chart' },

  /* 기출은 코스 옆에 둔다 — 「무엇부터 외우나」의 답이라 콘텐츠 고르기가 아니라
     N3로 가는 길에 속한다. 단어 칸에 묻어 두면 3,000개 안에서 다시 찾아야 한다. */
  { id: 'kiju', group: 'course', label: '기출 단어', sub: '16년치 · 많이 나온 순', icon: 'list' },

  // ── 원하는 것 골라 학습 ──
  { id: 'words', group: 'pick', label: '단어', sub: '회독으로 외우기', icon: 'book' },
  { id: 'grammar', group: 'pick', label: '문법', sub: '기초 · 일상 · 문형', icon: 'grid' },
  /* 한자는 N3 코스의 한자 과정을 그대로 연다 — 같은 자료를 두 벌 두지 않는다 */
  { id: 'kanji', group: 'pick', label: '한자', sub: 'N3 한자 500자', icon: 'kanji' },
  { id: 'sentences', group: 'pick', label: '문장', sub: '상황별 회화', icon: 'chat' },
  { id: 'listen', group: 'pick', label: '듣기', sub: '자동 듣기 · 따라 말하기', icon: 'headphone' },

  // ── 퀴즈 (학습 탭에는 안 그린다 — 복습&내기록 › 퀴즈 한 곳에 모였다) ──
  { id: 'rpg', group: 'practice', parent: 'drill', label: '상황 대화', sub: '상황을 통째로', icon: 'person' },
  { id: 'quiz', group: 'practice', parent: 'drill', label: '단어 시험', sub: '객관식 · 주관식', icon: 'list' },
  { id: 'match', group: 'practice', parent: 'drill', label: '짝 맞추기', sub: '게임처럼', icon: 'grid' },
  { id: 'adverb', group: 'practice', parent: 'drill', label: '부사 연습', sub: '빈칸 채우기', icon: 'pencil' },
  { id: 'conjugate', group: 'practice', parent: 'drill', label: '동사 활용', sub: '기초 시제', icon: 'repeat' },

  // ── 자료 더 보기 ──
  /* 여행 일본어 — 공항·택시·호텔·식당에서 직원이 먼저 하는 말을 알아듣는 코스.
     문장(상황별 회화)은 내가 할 말이 앞이고, 여기는 상대 말이 앞이다. */
  { id: 'travel', group: 'more', label: '여행 일본어', sub: '공항 · 택시 · 호텔 · 온천 · 식당', icon: 'map' },
  { id: 'videos', group: 'more', label: '영상', sub: '유튜브 · 자막', icon: 'video' },
  { id: 'basics', group: 'more', label: '완전기초', sub: '히라가나 · 숫자 · 인사', icon: 'sparkle' },
  /* 곁가지 — 일본어가 아니다. 회독 기록에 안 붙는다.
     id는 처음 만들 때 이름(swiss)을 그대로 둔다 — 설정·진도 열쇠가 이 이름이다 */
  { id: 'swiss', group: 'more', label: '독일어', sub: '기초 단어 · 여행 회화', icon: 'map' },
];

/* 설정에서 켠 것만, 묶음 순서대로(학습 탭에 그리는 묶음만).
 *
 * 없어진 메뉴(jlpt·translate·repeat·weak)가 설정에 남아 있어도 여기 없으면 안
 * 뜬다 — 목록이 이 파일 하나로 정해진다는 뜻이다. */
export function groupedMenus(menus = {}) {
  return MENU_GROUPS.filter((g) => !g.inline).map((g) => ({
    ...g,
    items: MENUS.filter((m) => m.group === g.id && menus[m.id]),
  })).filter((g) => g.items.length > 0);
}

/* ★ 「아직 못 읽어요」를 고른 사람에게만 완전기초를 맨 위로 ★
 *
 * 학습 탭 첫 줄이 N3 코스라서, 히라가나도 못 읽는 초보가 처음 열었을 때 갈 곳을 못 찾았다(초보 50명 시험).
 * 완전기초는 「자료 더 보기」 맨 아래에 있었다.
 *
 * 온보딩에서 「읽을 수 있어요」를 골랐거나 안 물어본 사람의 화면은 그대로다.
 * 설정에서 완전기초를 껐거나 이미 바로가기로 올린 사람에게는 또 만들지 않는다. */
export function starterMenu(settings = {}) {
  if (settings.canReadKana !== false) return null;
  const m = MENUS.find((x) => x.id === 'basics');
  if (!m || !settings.menus?.[m.id]) return null;
  if ((settings.favs || []).includes(m.id)) return null;
  return m;
}

/* 어떤 화면 안 「연습」 줄에 무엇이 나오나. 설정에서 끈 것은 뺀다.
   parent는 sub id(worddeck · grammar)다. */
export function practiceOf(parent, menus = {}) {
  return MENUS.filter((m) => m.parent === parent && menus[m.id]);
}

/* 켤 수 있는 메뉴 id — 설정 화면이 이걸로 목록을 그린다 */
export const MENU_IDS = MENUS.map((m) => m.id);

/* ── 바로가기 ──
 *
 * ★ 왜 묶음이 있는데 또 앞에 두나 ★
 *
 * 묶음(추천 경로·골라 학습·자료 더 보기)은 「처음 오는 사람이 무엇이 있는지 알아보는」
 * 차례다. 그건 그대로 맞는데, 매일 쓰는 사람에게는 맞지 않는다 — 날마다
 * 듣기와 기출만 쓰는 사람이 날마다 그 두 칸을 찾아 내려가야 한다.
 *
 * 묶음을 흔들어서 풀 문제가 아니다. 자주 쓰는 것이 위로 저절로 올라오게
 * 하면(쓴 횟수 같은 것으로) 자리가 계속 바뀌어서, 눈 감고 누르던 자리가
 * 매번 달라진다. 그건 더 나쁘다.
 *
 * 그래서 사람이 고른 것만 맨 앞에 둔다. 고른 차례 그대로 — 앱이 다시
 * 정렬하지 않는다.
 *
 * ★ 여섯 개까지 ★
 *
 * 더 두면 바로가기가 아니라 목록을 한 벌 더 만드는 것이다. 그러면 위에서도
 * 찾고 아래에서도 찾게 된다. */
export const FAV_MAX = 6;

/* 즐겨찾기한 메뉴. 꺼 둔 메뉴는 빼고, 고른 차례대로. */
export function favMenus(favs = [], menus = {}) {
  const byId = new Map(MENUS.map((m) => [m.id, m]));
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(favs) ? favs : []) {
    const m = byId.get(id);
    /* 설정에서 끈 메뉴는 바로가기에서도 안 보인다 — 껐는데 위에 남아 있으면
       끈 게 아니다. 즐겨찾기 자체는 안 지운다(다시 켜면 돌아온다). */
    if (!m || seen.has(id) || !menus[id]) continue;
    seen.add(id);
    out.push(m);
  }
  return out;
}

/* 켜고 끄기. 꽉 찼으면 받은 그대로 돌려준다 —
   부르는 쪽이 같은 배열이 오면 「자리가 없다」로 읽고 알린다. */
export function toggleFav(favs = [], id, max = FAV_MAX) {
  const cur = (Array.isArray(favs) ? favs : []).filter((x) => MENU_IDS.includes(x));
  if (cur.includes(id)) return cur.filter((x) => x !== id);
  if (!MENU_IDS.includes(id)) return favs;
  if (cur.length >= max) return favs;
  return [...cur, id];
}

export function isFav(favs = [], id) {
  return Array.isArray(favs) && favs.includes(id);
}
