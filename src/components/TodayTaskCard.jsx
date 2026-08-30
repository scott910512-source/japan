import { IconChevron } from './Icons.jsx';

/* 오늘 할 일 한 줄.
 *
 * 셋 다 같은 모양이라 눈이 한 번에 훑는다 — 모양이 제각각이면 매번 다시
 * 읽게 된다. 그리고 개수와 함께 「몇 분」을 적는다. 사람은 「25개 남았다」
 * 보다 「12분이면 끝난다」를 훨씬 빨리 받아들인다. */
export default function TodayTaskCard({
  icon, title, note, minutes, count, unit = '개', done, primary, onClick,
}) {
  return (
    <button
      className={`tdtask${done ? ' done' : ''}${primary ? ' primary' : ''}`}
      onClick={onClick}
    >
      <span className="tt-icon">{icon}</span>
      <span className="tt-body">
        <b>{title}</b>
        <span className="tt-note">{note}</span>
        {!done && minutes > 0 && <span className="tt-min">약 {minutes}분</span>}
      </span>
      {done
        ? <span className="tt-done">다 했어요</span>
        : <span className="tt-count"><b>{count}</b>{unit}</span>}
      <IconChevron className="chev" />
    </button>
  );
}
