import { dotsOf, roundLabel } from '../lib/rounds.js';

/* 회독 진행 — 「● ● ○ ○」.
 *
 * 이 앱이 하는 일은 결국 한 카드를 네 번 맞힐 때까지 간격을 벌려 가며 다시
 * 만나게 하는 것이다. 그런데 그 뼈대가 화면 어디에도 안 보여서, 사용자
 * 눈에는 메뉴 열두 개짜리 앱으로 보였다.
 *
 * 숫자만 적지 않고 점으로도 그린다 — 「2회독」만 있으면 4가 끝인지 10이
 * 끝인지 모른다. 점은 끝이 어디인지도 같이 말한다.
 *
 * 게임처럼 꾸미지 않는다. 채운 점과 빈 점, 그게 전부다. */
export default function RoundProgress({ state, label = true, className = '' }) {
  const dots = dotsOf(state);
  const text = roundLabel(state);
  return (
    <span className={`rounddots ${className}`} title={text}>
      <span className="rd-dots" aria-hidden="true">
        {dots.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}
      </span>
      {label && <span className="rd-text">{text}</span>}
    </span>
  );
}
