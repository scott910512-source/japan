import { IconChevron } from './Icons.jsx';
import { practiceOf } from '../lib/menu.js';

/* 단어·문법 화면 맨 아래 「연습」 줄.
 *
 * 시험·짝 맞추기·부사 연습은 단어를, 동사 활용은 문법을 굴려 보는 연습이다.
 * 학습 탭 맨 위에 따로 서 있으면 「단어」와 「단어 시험」 중 무엇을 누를지부터
 * 고르게 되어서 배우던 화면 안으로 들였다. 어느 연습이 여기 나오는지는
 * lib/menu.js의 parent가 정한다 — 여기에 또 적지 않는다. 설정에서 끈 연습은
 * 줄에서도 빠진다(기록은 그대로).
 *
 * parent는 이 화면의 sub id(worddeck · grammar). 열면 뒤로가기가 이 화면으로
 * 돌아온다. */
export default function PracticeRows({ parent, menus, onOpen }) {
  const rows = practiceOf(parent, menus);
  if (!onOpen || rows.length === 0) return null;
  return (
    <>
      <div className="section-label">연습</div>
      <div className="card pr-list">
        {rows.map((m) => (
          <button key={m.id} className="listrow pr-row" data-menu={m.id} onClick={() => onOpen(m.id)}>
            <span className="pr-body"><b>{m.label}</b><span>{m.sub}</span></span>
            <IconChevron className="chev" />
          </button>
        ))}
      </div>
    </>
  );
}
