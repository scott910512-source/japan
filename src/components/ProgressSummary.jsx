/* 오늘 얼마나 남았나 — 한 덩이로.
 *
 * 여기 숫자를 잘게 늘어놓지 않는다. 예전에는 위에 「새 단어 · 복습 · 약점」을
 * 세 칸으로 보여 주고, 바로 아래 버튼 셋에 같은 숫자를 또 적었다. 같은 것을
 * 두 번 읽게 하면 3초 안에 못 정한다.
 *
 * 그래서 위에는 두 가지만 둔다 — 얼마나 왔나, 얼마나 남았나.
 * 갈래별 숫자는 각 버튼이 알아서 적는다.
 *
 * 남은 시간을 적는 게 이 칸의 핵심이다. 「25개 남음」은 결심이 필요한 말이고,
 * 「12분 남음」은 그냥 하면 되는 말이다. */
export default function ProgressSummary({ done, goal, minutes }) {
  const pct = goal ? Math.min(100, (done / goal) * 100) : 0;
  const left = Math.max(0, goal - done);
  return (
    <div className="today">
      <div className="td-head">
        <span className="td-label">오늘 학습</span>
        <span className="td-count"><b>{done}</b> / {goal} 완료</span>
      </div>
      <div className="td-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="td-left">
        {left === 0
          ? '오늘 몫을 다 했어요'
          : minutes > 0 ? `약 ${minutes}분 남음` : `${left}개 남음`}
      </div>
    </div>
  );
}
