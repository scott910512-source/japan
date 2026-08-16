import { IconHome, IconBook, IconVideo, IconRepeat, IconGear } from './Icons.jsx';

// 탭은 "행위"로 고정한다. 학습 메뉴는 홈 허브의 카드로 두어,
// 설정에서 메뉴를 껐다 켜도 탭 구성이 흔들리지 않게 한다.
//
// 영상은 단어를 외우는 일과 결이 다르다 — 보고, 듣고, 따라 말하는 쪽이라
// 들어가는 길도 따로 둔다. 그래서 홈 카드가 아니라 탭이다.
const TABS = [
  { id: 'home', label: '홈', Icon: IconHome },
  { id: 'study', label: '학습', Icon: IconBook },
  { id: 'videos', label: '영상', Icon: IconVideo },
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
