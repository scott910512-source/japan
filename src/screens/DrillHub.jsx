import { IconChevron } from '../components/Icons.jsx';
import { goalOf } from '../lib/goal.js';
import { practiceOf } from '../lib/menu.js';

/* 퀴즈 — 배운 것을 굴려 보는 자리. 복습&내기록의 「퀴즈」 줄이 여는 화면이다.
 *
 * 퀴즈가 여기저기 있었다. 단어·문법 화면 안의 연습 줄(단어 시험 · 짝 맞추기 · 부사 연습 · 동사 활용),
 * 학습 탭의 실전 연습 칸(쭉 퀴즈 · 문장 만들기 · 상황 대화). 같은 「퀴즈」를 찾으러 두 군데를
 * 열어 봐야 해서 한 곳에 모았다. 메뉴로 켜고 끄는 것(단어 시험 등)은 설정의 메뉴 켜기를 따른다.
 *
 * id가 drill인 것은 처음 이름(실전 연습 허브)을 그대로 둔 것이다 — 바꾸면 이 화면을 가리키던 곳이
 * 같이 깨진다. */
const EXTRA = {
  stream: { label: '쭉 퀴즈', sub: '외운 것을 끊지 않고 이어서 평가해요. 약한 것이 더 자주 나와요' },
  compose: { label: '문장 만들기', sub: '조립, 빈칸, 쓰기로 문장을 직접 만들고 AI가 고쳐 줘요' },
};

export default function DrillHub({ settings, onOpen }) {
  const goal = goalOf(settings);
  const menuRows = practiceOf('drill', settings.menus);
  const byId = Object.fromEntries(menuRows.map((m) => [m.id, m]));
  /* 단어 → 문법 → 실전 차례. 꺼 둔 것은 빠진다 */
  const order = [
    ['단어', ['quiz', 'match', 'adverb']],
    ['문법', ['conjugate']],
    ['실전', ['stream', 'compose', 'rpg']],
  ];
  const label = (id) => byId[id] || (EXTRA[id] ? { id, ...EXTRA[id] } : null);
  return (
    <div className="drillhub">
      <div className="card dh-goal">
        <span>목표 레벨</span>
        <b>{goal}</b>
        <small>설정 · 학습 설정에서 바꿔요</small>
      </div>
      {order.map(([title, ids]) => {
        const rows = ids.map(label).filter(Boolean);
        if (!rows.length) return null;
        return (
          <div key={title} data-group={title}>
            <div className="section-label">{title}</div>
            <div className="card pr-list">
              {rows.map((r) => (
                <button key={r.id} className="listrow pr-row" data-menu={r.id} onClick={() => onOpen(r.id)}>
                  <span className="pr-body"><b>{r.label}</b><span>{r.sub}</span></span>
                  <IconChevron className="chev" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="set-note">퀴즈에서 맞히고 틀린 것은 오답노트와 약점에 쌓여요. 쭉 퀴즈와 문장 만들기(조립·쓰기)는 복습 간격에도 반영돼요.</p>
    </div>
  );
}
