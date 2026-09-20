/* 줄 전체가 눌린다. 44×26짜리 스위치만 받으면 폰에서 헛누름이 잦다 —
   글씨를 눌렀는데 아무 일도 안 일어나면 고장 난 걸로 읽힌다. */
export default function Toggle({ label, sub, on, onClick }) {
  return (
    <button className="toggle-row setrow" onClick={onClick} aria-pressed={on}>
      <span>
        <span className="set-title">{label}</span>
        {sub && <span className="set-sub">{sub}</span>}
      </span>
      <span className={`toggle${on ? ' on' : ''}`} aria-hidden="true" />
    </button>
  );
}
