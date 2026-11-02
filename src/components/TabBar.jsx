import { IconHome, IconBook, IconChart, IconGear } from './Icons.jsx';

/* 탭은 넷이다. 오늘 · 학습 · 내 학습 · 설정.
 *
 *   오늘    — 오늘 공부를 바로 시작한다. 앱을 켜면 여기다(내부 id는 home 그대로)
 *   학습    — 무엇을 공부할지 고른다 (N3 학습하기 · 단어 · 문법 · 한자 · 문장 · 듣기 · 자료 더 보기)
 *   내 학습 — 내가 한 것을 본다: 복습 · 퀴즈 · 오답 · 약점 · 진도
 *   설정    — 학습 설정 · 음성 · 계정 · 백업 · 도구 · 앱 정보
 *
 * 복습 탭은 없어졌다. 복습·오답·약점은 「내가 한 것」이라 내 학습 안으로 모았다 —
 * 같은 곳으로 가는 길이 탭 하나, 오늘 하나, N3 하나로 흩어져 있었다.
 * 설정은 내 학습 안에 묻혀 있던 것을 탭으로 꺼냈다.
 *
 * 탭은 「행위」로 고정한다. 학습 메뉴는 학습 탭 안의 칸으로 두어, 설정에서
 * 메뉴를 껐다 켜도 탭 구성이 흔들리지 않게 한다. */
const TABS = [
  { id: 'home', label: '오늘', Icon: IconHome },
  { id: 'study', label: '학습', Icon: IconBook },
  { id: 'me', label: '내 학습', Icon: IconChart },
  { id: 'settings', label: '설정', Icon: IconGear },
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
          {/* 오늘 복습이 남았으면 내 학습 탭에 적는다 — 안 그러면 며칠 밀린 걸
              앱을 켜고도 모른다. 숫자는 오늘·복습 탭과 같은 계획(plan)에서 나온다. */}
          {id === 'me' && reviewCount > 0 && (
            <span className="count">{reviewCount > 99 ? '99+' : reviewCount}</span>
          )}
          <Icon />
          {label}
        </button>
      ))}
    </nav>
  );
}
