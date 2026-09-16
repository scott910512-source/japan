import { IconHome, IconBook, IconRepeat, IconChart } from './Icons.jsx';

/* 탭은 넷이다. 다섯이었다(오늘·학습·듣기·기록·더보기).
 *
 *   홈      — 오늘 공부를 바로 시작한다. 앱을 켜면 여기다
 *   학습    — 무엇을 공부할지 고른다 (JLPT N3 · 단어 · 문법 · 한자 · 문장 · 듣기)
 *   복습    — 오늘 복습 · 틀린 문제 · 약점을 한 곳에서
 *   내 학습 — 진도 · 기록 · 설정
 *
 * 듣기는 학습 탭의 콘텐츠 한 칸으로 들어갔고, 기록과 더보기는 「내 학습」
 * 하나가 됐다. 사용자가 외워야 하는 것은 「공부한다 · 고른다 · 복습한다 ·
 * 내 것을 본다」 넷이면 된다.
 *
 * 탭은 「행위」로 고정한다. 학습 메뉴는 학습 탭 안의 칸으로 두어, 설정에서
 * 메뉴를 껐다 켜도 탭 구성이 흔들리지 않게 한다. */
const TABS = [
  { id: 'home', label: '홈', Icon: IconHome },
  { id: 'study', label: '학습', Icon: IconBook },
  { id: 'review', label: '복습', Icon: IconRepeat },
  { id: 'me', label: '내 학습', Icon: IconChart },
];

export default function TabBar({ active, onChange, reviewCount = 0 }) {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`tab${active === id ? ' active' : ''}`}
          data-tab={id}
          onClick={() => onChange(id)}
          aria-current={active === id ? 'page' : undefined}
        >
          {/* 오늘 복습이 남았으면 복습 탭에 적는다 — 안 그러면 며칠 밀린 걸
              앱을 켜고도 모른다. 숫자는 홈·복습 탭과 같은 계획(plan)에서 나온다. */}
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
