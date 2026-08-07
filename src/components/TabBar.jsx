import { IconHome, IconBook, IconRepeat, IconGear } from './Icons.jsx';

// 탭은 "행위" 4개로 고정한다. 학습 메뉴는 홈 허브의 카드로 두어,
// 설정에서 메뉴를 껐다 켜도 탭 구성이 흔들리지 않게 한다.
const TABS = [
  { id: 'home', label: '홈', Icon: IconHome },
  { id: 'study', label: '학습', Icon: IconBook },
  { id: 'review', label: '복습', Icon: IconRepeat },
  { id: 'settings', label: '설정', Icon: IconGear },
];

export default function TabBar({ active, onChange, reviewCount = 0 }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`tab${active === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
        >
          {id === 'review' && reviewCount > 0 && <span className="count">{reviewCount > 99 ? '99+' : reviewCount}</span>}
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  );
}
