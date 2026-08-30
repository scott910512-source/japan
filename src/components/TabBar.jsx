import { IconHome, IconBook, IconHeadphone, IconChart, IconDots } from './Icons.jsx';

/* 탭은 "행위"로 고정한다. 학습 메뉴는 학습 탭 안의 카드로 두어,
 * 설정에서 메뉴를 껐다 켜도 탭 구성이 흔들리지 않게 한다.
 *
 * 「오늘」이 맨 앞인 게 이 앱의 뼈대다. 앱을 켜면 메뉴를 고르는 게 아니라
 * 오늘 할 몫을 보고 바로 시작하는 자리여야 한다. 고르고 싶은 사람은 학습
 * 탭으로 가면 되고, 거기에 예전 메뉴가 하나도 안 빠지고 그대로 있다.
 *
 * 「복습」을 빼고 「듣기」를 넣었다.
 *
 *   복습은 이미 오늘 화면의 첫 번째 버튼이고 학습 탭 「반복하기」의 첫 칸이다.
 *   탭까지 차지하면 같은 곳으로 가는 길이 셋이 된다 — 길이 많은 게 친절한
 *   게 아니라, 어느 길이 맞는지 매번 고르게 만드는 것이다.
 *
 *   듣기는 쓰는 시간대가 아예 다르다. 앉아서 손으로 하는 공부가 아니라
 *   걸으면서 손 없이 하는 공부라, 지하철에서 꺼내려면 한 번에 닿아야 한다.
 *
 * 복습으로 가는 길은 없애지 않았다. 오늘 화면의 「복습하기」와 「복습이 더
 * 남았어요」, 학습 탭의 「약점 복습」이 그대로 그 화면을 연다. */
const TABS = [
  { id: 'today', label: '오늘', Icon: IconHome },
  { id: 'study', label: '학습', Icon: IconBook },
  { id: 'listen', label: '듣기', Icon: IconHeadphone },
  { id: 'log', label: '기록', Icon: IconChart },
  { id: 'more', label: '더보기', Icon: IconDots },
];

export default function TabBar({ active, onChange, reviewCount = 0 }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`tab${active === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          {/* 복습 탭이 없어졌으니 밀린 복습은 「오늘」에 표시한다 —
              안 그러면 며칠 밀린 걸 앱을 켜고도 모른다 */}
          {id === 'today' && reviewCount > 0 && (
            <span className="count">{reviewCount > 99 ? '99+' : reviewCount}</span>
          )}
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  );
}
