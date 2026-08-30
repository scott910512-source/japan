import { IconHeadphone, IconRepeat, IconVideo, IconChevron } from '../components/Icons.jsx';

/* 듣기 탭 — 화면을 안 보고 하는 공부.
 *
 * 여태 학습 탭 위쪽 카드였다. 그런데 이건 결이 다르다. 단어를 외우는 일은
 * 앉아서 손으로 하는 것이고, 듣기는 걸으면서 손 없이 하는 것이다. 쓰는
 * 시간대가 아예 다른데 같은 서랍에 있으면, 지하철에서 꺼내 쓰려고 두 번
 * 들어가야 한다.
 *
 * 그래서 최상위 탭으로 올렸다. 대신 「복습」 탭을 뺐다 — 복습은 오늘 화면의
 * 첫 번째 버튼이자 학습 탭 「반복하기」의 첫 칸이라, 탭까지 차지하면 같은
 * 곳으로 가는 길이 셋이 된다.
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
    note: '입이 안 떨어지는 건 연습을 한쪽만 해서예요',
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
      <div className="navtitle">
        <small>화면 안 보고</small>
        듣기
      </div>
      <p className="vd-note" style={{ marginTop: 0 }}>
        이동 중에도 화면을 보지 않고 공부하세요. 회독 기록은 건드리지 않아요 —
        귀에 넣는 것만 해요.
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
