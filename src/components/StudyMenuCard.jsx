import {
  IconBook, IconGrid, IconChat, IconSparkle, IconRepeat, IconList,
  IconPerson, IconPencil, IconFlame, IconChevron, IconMap, IconChart, IconHeadphone, IconVideo,
} from './Icons.jsx';

const ICONS = {
  chart: IconChart,
  sparkle: IconSparkle,
  book: IconBook,
  grid: IconGrid,
  chat: IconChat,
  repeat: IconRepeat,
  list: IconList,
  pencil: IconPencil,
  person: IconPerson,
  flame: IconFlame,
  map: IconMap,
  headphone: IconHeadphone,
  video: IconVideo,
};

/* 한자 칸은 아이콘 대신 글자 하나 — 「漢」보다 한자를 잘 나타내는 그림이 없다 */
const GLYPHS = { kanji: '漢' };

/* 학습 메뉴 한 칸.
 *
 * 크기가 둘로 갈렸어도 이름(class)은 .menutile을 그대로 단다. 이건 여전히
 * 학습 메뉴 칸이고, .mbig·.mtile은 「어느 크기냐」일 뿐이다 — 정체가 안
 * 바뀌었는데 이름을 갈면 이 칸을 가리키던 곳이 열 군데 같이 깨진다.
 *
 * 작은 칸에는 설명을 안 적는다. 「짝 맞추기」와 「게임처럼」을 같이 적어야
 * 알아볼 만한 기능이면, 그건 이름을 잘못 지은 것이다. */
/* star — 바로가기 고르는 중일 때만 준다. true면 이미 고른 것.
 *
 * 평소에는 별을 안 띄운다. 칸마다 별이 붙어 있으면 누를 자리가 둘이 되고,
 * 작은 칸에서는 열려던 메뉴 대신 별이 눌린다. 고치는 동안에만 보여 주고,
 * 그동안에는 누르는 곳이 한 자리다(별이 아니라 칸 전체). */
export default function StudyMenuCard({ item, note, onClick, star = null, big = null }) {
  const Icon = ICONS[item.icon] || null;
  const glyph = GLYPHS[item.icon] || null;
  const pic = glyph ? <span className="mt-glyph" lang="ja">{glyph}</span> : (Icon ? <Icon /> : <IconGrid />);
  const wide = big == null ? item.big : big;
  if (!wide) {
    return (
      <button
        className={`menutile mtile${star ? ' faved' : ''}`}
        data-menu={item.id}
        data-fav={star === null ? undefined : String(Boolean(star))}
        aria-pressed={star === null ? undefined : Boolean(star)}
        onClick={onClick}
      >
        {star !== null && (
          <span className={`mt-star${star ? ' on' : ''}`} aria-hidden="true"><IconSparkle /></span>
        )}
        <span className="mt-ic">{pic}</span>
        <span className="mt-title">{item.label}</span>
      </button>
    );
  }
  return (
    <button className="menutile mbig" data-menu={item.id} onClick={onClick}>
      <span className="mb-ic">{pic}</span>
      <span className="mb-body">
        <b className="mt-title">{item.label}</b>
        <span className="mt-sub">{note || item.sub}</span>
      </span>
      <IconChevron className="chev" />
    </button>
  );
}
