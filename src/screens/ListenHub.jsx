import { IconHeadphone, IconRepeat, IconVideo, IconChevron } from '../components/Icons.jsx';

/* 듣기 — 화면을 안 보고 하는 공부.
 *
 * 학습 탭 「콘텐츠」의 한 칸이다. 최상위 탭이었지만, 탭이 다섯이면 사용자가
 * 외워야 하는 것이 다섯이다. 지하철에서 꺼내는 길은 학습 → 듣기 두 번이면
 * 되고, 자동 듣기는 들어가면 바로 흘러간다.
 *
 * 여기 세 가지는 다 「보거나 듣는」 일이다. 판정도 안 하고 손도 거의 안 쓴다. */

const WAYS = [
  {
    id: 'auto',
    Icon: IconHeadphone,
    title: '자동 듣기',
    sub: '단어와 문장이 저절로 흘러가요',
    note: '손을 안 대도 넘어가요. 일본어 → 뜻 · 뜻 → 일본어 둘 다 돼요',
  },
  {
    id: 'shadow',
    Icon: IconRepeat,
    title: '따라 말하기',
    sub: '듣고 · 따라 하고 · 한 번 더',
    note: '짧게 듣고 직접 말하면서 익혀요',
  },
  {
    id: 'videos',
    Icon: IconVideo,
    title: '영상으로 배우기',
    sub: '유튜브 · 넷플릭스 자막',
    note: '자막을 붙여 넣으면 그 문장으로 회독까지 이어져요',
  },
];

export default function ListenHub({ onOpen }) {
  return (
    <>
      <p className="vd-note" style={{ marginTop: 0 }}>
        자동 듣기는 화면을 보지 않고도 할 수 있어요. 들은 문장은 활동 기록에 남고,
        회독 진도는 직접 판정할 때 올라가요.
      </p>

      <div className="stack lh-ways">
        {WAYS.map(({ id, Icon, title, sub, note }) => (
          <button key={id} className="mbig lh-way" data-way={id} onClick={() => onOpen(id)}>
            <span className="mb-ic"><Icon /></span>
            <span className="mb-body">
              <b>{title}</b>
              <span>{sub}</span>
              <i className="lh-note">{note}</i>
            </span>
            <IconChevron className="chev" />
          </button>
        ))}
      </div>
    </>
  );
}
