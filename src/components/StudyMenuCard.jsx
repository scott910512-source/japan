import {
  IconBook, IconGrid, IconChat, IconSparkle, IconRepeat, IconList,
  IconPerson, IconPencil, IconFlame, IconChevron,
} from './Icons.jsx';

const ICONS = {
  sparkle: IconSparkle,
  book: IconBook,
  grid: IconGrid,
  chat: IconChat,
  repeat: IconRepeat,
  list: IconList,
  pencil: IconPencil,
  person: IconPerson,
  flame: IconFlame,
};

/* 학습 메뉴 한 칸.
 *
 * 크기가 둘로 갈렸어도 이름(class)은 .menutile을 그대로 단다. 이건 여전히
 * 학습 메뉴 칸이고, .mbig·.mtile은 「어느 크기냐」일 뿐이다 — 정체가 안
 * 바뀌었는데 이름을 갈면 이 칸을 가리키던 곳이 열 군데 같이 깨진다.
 *
 * 큰 칸과 작은 칸 두 가지만 둔다. 묶음마다 무엇이 중심인지 하나는 커야
 * 처음 온 사람이 어디부터 누를지 안다 — 열한 칸이 전부 같은 크기면 그건
 * 목록이지 안내가 아니다.
 *
 * 작은 칸에는 설명을 안 적는다. 「짝 맞추기」와 「게임처럼」을 같이 적어야
 * 알아볼 만한 기능이면, 그건 이름을 잘못 지은 것이다. */
export default function StudyMenuCard({ item, note, onClick }) {
  const Icon = ICONS[item.icon] || IconGrid;
  if (!item.big) {
    return (
      <button className="menutile mtile" onClick={onClick}>
        <span className="mt-ic"><Icon /></span>
        <span className="mt-title">{item.label}</span>
      </button>
    );
  }
  return (
    <button className="menutile mbig" onClick={onClick}>
      <span className="mb-ic"><Icon /></span>
      <span className="mb-body">
        <b className="mt-title">{item.label}</b>
        <span className="mt-sub">{note || item.sub}</span>
      </span>
      <IconChevron className="chev" />
    </button>
  );
}
