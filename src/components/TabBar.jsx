import { IconHome, IconBook, IconChat, IconGrid, IconPerson } from './Icons.jsx';

const TABS = [
  { id: 'home', label: '홈', Icon: IconHome },
  { id: 'vocab', label: '단어', Icon: IconBook },
  { id: 'sentence', label: '문장', Icon: IconChat, badge: true },
  { id: 'grammar', label: '문법', Icon: IconGrid },
  { id: 'my', label: '나', Icon: IconPerson },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, Icon, badge }) => (
        <button
          key={id}
          className={`tab${active === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
        >
          {badge && <span className="dot" />}
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  );
}
