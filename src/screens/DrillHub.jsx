import { IconChevron } from '../components/Icons.jsx';
import { goalOf } from '../lib/goal.js';

/* 실전 연습 — 배운 것을 써 보는 자리.
 *
 * 학습 탭의 「실전 연습」 칸이 여는 허브다. 전에는 상황 대화 연습이 곧바로 열렸는데, 외운 것을
 * 이어서 평가하는 쭉 퀴즈가 생기면서 「실전」이 여럿이 됐다. 칸 수(학습 탭의 여섯 칸)는
 * 그대로 두고 안에서 고른다. 기존 상황 대화 연습(rpg)은 그대로이고 이름만 「상황 대화」다. */
const ROWS = [
  { id: 'stream', label: '쭉 퀴즈', sub: '외운 것을 끊지 않고 이어서 평가해요. 약한 것이 더 자주 나와요' },
  { id: 'compose', label: '문장 만들기', sub: '조립, 빈칸, 쓰기로 문장을 직접 만들고 AI가 고쳐 줘요' },
  { id: 'rpg', label: '상황 대화', sub: '식당·길 묻기 같은 상황을 통째로 연습해요' },
];

export default function DrillHub({ settings, onOpen }) {
  const goal = goalOf(settings);
  return (
    <div className="drillhub">
      <div className="card dh-goal">
        <span>목표 레벨</span>
        <b>{goal}</b>
        <small>내 학습 · 설정 · 학습 설정에서 바꿔요</small>
      </div>
      <div className="section-label">연습 고르기</div>
      <div className="card pr-list">
        {ROWS.map((r) => (
          <button key={r.id} className="listrow pr-row" data-menu={r.id} onClick={() => onOpen(r.id)}>
            <span className="pr-body"><b>{r.label}</b><span>{r.sub}</span></span>
            <IconChevron className="chev" />
          </button>
        ))}
      </div>
      <p className="set-note">쭉 퀴즈와 문장 만들기(조립·쓰기)에서 맞히고 틀린 것은 복습 간격에 반영돼요. 단어 시험·짝 맞추기·부사 연습은 단어 화면 안에 있어요.</p>
    </div>
  );
}
