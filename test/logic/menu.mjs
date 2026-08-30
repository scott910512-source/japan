/* 학습 탭의 짜임새.
 *
 * 열두 칸이 한 바둑판에 나란히 있었다. 「단어암기」 옆에 「단어 시험」이 있고
 * 그 옆에 「짝 맞추기」가 있으니, 무엇이 배우는 것이고 무엇이 확인하는
 * 것인지 눈으로 안 갈렸다.
 *
 * 여기서 지키는 것은 하나다 — 목록이 한 곳에만 있어야 한다. 학습 탭과
 * 설정에 따로 적어 두면, 없앤 메뉴가 설정에는 남아서 켜도 아무 데도 안 뜨는
 * 칸이 생긴다. 「JLPT 단어」를 단어암기에 합칠 때 실제로 그럴 뻔했다. */
import { MENUS, MENU_GROUPS, MENU_IDS, groupedMenus } from '../../src/lib/menu.js';
import { DEFAULT_SETTINGS } from '../../src/lib/storage.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

console.log('\n[ 세 묶음 ]');
ok('묶음은 셋', MENU_GROUPS.length === 3, MENU_GROUPS.map((g) => g.label).join(' / '));
/* 이 순서가 곧 한 카드가 지나가는 길이다 — 모른다 → 안다 → 샌다 */
ok('배우기 · 연습하기 · 반복하기',
  MENU_GROUPS.map((g) => g.label).join() === '배우기,연습하기,반복하기');
/* 이름만 적으면 「학습」과 「퀴즈」의 경계가 사람마다 다르게 읽힌다 */
ok('묶음마다 왜 여기 있는지 적혀 있다', MENU_GROUPS.every((g) => g.sub?.length > 4));

console.log('\n[ 칸마다 ]');
const ids = new Set(MENU_GROUPS.map((g) => g.id));
ok('모든 칸이 어딘가에 속한다', MENUS.every((m) => ids.has(m.group)),
  MENUS.filter((m) => !ids.has(m.group)).map((m) => m.id).join() || '전부 속함');
ok('id가 안 겹친다', new Set(MENU_IDS).size === MENU_IDS.length);
ok('이름과 설명이 다 있다', MENUS.every((m) => m.label && m.sub && m.icon));

/* ★ 목록은 한 곳에만 ★ 설정에 켜는 칸이 있는데 학습 탭에 없으면,
   켜도 아무 데도 안 뜨는 유령 칸이 된다 */
const defaults = Object.keys(DEFAULT_SETTINGS.menus);
ok('설정에 있는 칸은 학습 탭에도 있다',
  defaults.every((id) => MENU_IDS.includes(id)),
  defaults.filter((id) => !MENU_IDS.includes(id)).join() || '유령 없음');
ok('학습 탭에 있는 칸은 설정에도 있다',
  MENU_IDS.every((id) => defaults.includes(id)),
  MENU_IDS.filter((id) => !defaults.includes(id)).join() || '빠짐 없음');

/* JLPT 단어는 단어암기 안으로 들어갔다 — 같은 단어를 다른 방식으로 끊어 주는
   것이었지 다른 공부가 아니었다 */
ok('JLPT 단어는 더 이상 따로 없다', !MENU_IDS.includes('jlpt'));
ok('단어는 남아 있다', MENU_IDS.includes('words'));
ok('문법은 하나로 열린다', MENUS.find((m) => m.id === 'grammar')?.label === '문법');

/* 공부가 아닌 것은 학습 탭에 없다 — 「오늘 뭘 공부하지」를 고르는 자리에
   현지에서 쓰는 도구가 끼면 고를 것이 하나 더 늘 뿐이다. 더보기로 갔다. */
ok('번역기는 학습 탭에 없다', !MENU_IDS.includes('translate'));
/* 회독과 약점은 다른 연습과 갈라 둔다 — 이 앱의 뼈대라서 */
const rep = MENUS.filter((m) => m.group === 'repeat').map((m) => m.id);
ok('반복하기는 회독과 약점', rep.join() === 'repeat,weak', rep.join());
ok('둘 다 큰 칸', MENUS.filter((m) => m.group === 'repeat').every((m) => m.big));
/* 배우기와 반복하기에는 중심이 하나는 커야 어디부터 누를지 안다.
   연습하기는 반대다 — 다섯 개가 다 곁가지라, 하나를 크게 두면 나머지 넷이
   덜 중요한 것처럼 보인다. 전부 작은 칸으로 한 줄에 담는다. */
ok('배우기에 큰 칸이 있다', MENUS.some((m) => m.group === 'learn' && m.big));
ok('반복하기는 전부 큰 칸', MENUS.filter((m) => m.group === 'repeat').every((m) => m.big));
ok('연습하기는 전부 작은 칸', MENUS.filter((m) => m.group === 'practice').every((m) => !m.big),
  MENUS.filter((m) => m.group === 'practice' && m.big).map((m) => m.id).join() || '전부 작음');

console.log('\n[ 켠 것만 묶어서 ]');
const all = Object.fromEntries(MENU_IDS.map((id) => [id, true]));
const g = groupedMenus(all);
ok('다 켜면 세 묶음이 다 나온다', g.length === 3);
ok('묶음 순서가 지켜진다', g.map((x) => x.id).join() === 'learn,practice,repeat');
ok('칸 수가 맞는다', g.reduce((a, x) => a + x.items.length, 0) === MENUS.length);

const some = groupedMenus({ weak: true });
ok('빈 묶음은 안 그린다', some.length === 1 && some[0].id === 'repeat',
  some.map((x) => x.id).join());
ok('아무것도 안 켜면 빈손', groupedMenus({}).length === 0);
/* 없어진 메뉴가 설정에 남아 있어도 안 뜬다 — 목록이 이 파일 하나로 정해진다 */
ok('없는 메뉴는 켜져 있어도 안 뜬다',
  groupedMenus({ jlpt: true }).length === 0);

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
