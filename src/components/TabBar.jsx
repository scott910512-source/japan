import { IconHome, IconBook, IconRepeat, IconChart, IconDots } from './Icons.jsx';

/* 탭은 "행위"로 고정한다. 학습 메뉴는 학습 탭 안의 카드로 두어,
 * 설정에서 메뉴를 껐다 켜도 탭 구성이 흔들리지 않게 한다.
 *
 * 「오늘」이 맨 앞인 게 이번 개편의 핵심이다. 앱을 켜면 메뉴를 고르는 게 아니라
 * 오늘 할 몫을 보고 바로 시작하는 자리여야 한다. 고르고 싶은 사람은 학습 탭으로
 * 가면 되고, 거기에 예전 메뉴가 하나도 안 빠지고 그대로 있다.
 *
 * 영상은 학습 탭 위쪽에 따로 뒀다. 탭 다섯 자리에 넣기엔 매일 쓰는 게 아니고,
 * 그렇다고 메뉴 바둑판에 섞으면 결이 다른 게 묻힌다. */
const TABS = [
  { id: 'today', label: '오늘', Icon: IconHome },
  { id: 'study', label: '학습', Icon: IconBook },
  { id: 'review', label: '복습', Icon: IconRepeat },
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
          {id === 'review' && reviewCount > 0 && (
            <span className="count">{reviewCount > 99 ? '99+' : reviewCount}</span>
          )}
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  );
}
