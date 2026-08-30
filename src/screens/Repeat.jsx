import { useMemo } from 'react';
import { IconRepeat, IconChevron } from '../components/Icons.jsx';
import { MASTER_STREAK, stateOf, isMastered, dueDate, todayKey } from '../lib/review.js';

/* 회독 학습 — 배운 걸 등급별로 다시 돈다.
 *
 * 오늘의 학습과 다른 자리다. 오늘은 앱이 「지금 해야 할 것」을 골라 주고,
 * 여기는 사람이 「N5를 통째로 한 번 더」를 고른다. 복습일이 됐는지는 안 본다 —
 * 시험 앞두고 싹 훑고 싶은 날이 있고, 그건 복습 규칙이 막을 일이 아니다.
 *
 * 한 번도 안 본 카드는 안 넣는다. 그건 새로 배우는 것이고, 그 길은 오늘의
 * 학습과 단어암기에 이미 있다. 여기서까지 섞으면 「다시 보기」가 아니게 된다. */

const LEVELS = ['N5', 'N4', 'N3'];

const NOTE = {
  N5: '기초 — 히라가나를 뗀 직후',
  N4: '초급 — 일상 회화의 뼈대',
  N3: '중급 — 여행·생활이 되는 수준',
};

/* 이 등급에서 한 번이라도 본 카드. 많이 틀린 것과 오래된 것을 앞에 둔다 —
   다시 도는 판이라 「어느 게 위태로운가」가 순서의 기준이다. */
export function seenAt(words, review, level) {
  return words
    .filter((w) => (w.level || 'N5') === level && stateOf(review, w.id).lastSeen)
    .sort((a, b) => {
      const sa = stateOf(review, a.id);
      const sb = stateOf(review, b.id);
      const wa = (sa.wrongCount || 0) + (sa.vagueCount || 0);
      const wb = (sb.wrongCount || 0) + (sb.vagueCount || 0);
      if (wa !== wb) return wb - wa;
      return dueDate(sa) < dueDate(sb) ? -1 : 1;
    });
}

export default function Repeat({ words, review, onStartSet, onToast }) {
  const today = todayKey();

  const rows = useMemo(() => LEVELS.map((lv) => {
    const seen = seenAt(words, review, lv);
    const total = words.filter((w) => (w.level || 'N5') === lv).length;
    const mastered = seen.filter((w) => isMastered(stateOf(review, w.id))).length;
    const shaky = seen.filter((w) => {
      const st = stateOf(review, w.id);
      return (st.wrongCount || 0) + (st.vagueCount || 0) > 0 && !isMastered(st);
    }).length;
    return { lv, seen, total, mastered, shaky };
  }), [words, review, today]);

  const anySeen = rows.some((r) => r.seen.length > 0);

  return (
    <>
      <p className="set-note" style={{ marginTop: 0 }}>
        배운 걸 등급별로 다시 돕니다. 복습일이 됐는지는 안 봐요 —
        시험 앞두고 통째로 훑고 싶을 때 쓰는 자리예요.
      </p>

      <div className="section-label">등급 고르기</div>
      <div className="stack">
        {rows.map(({ lv, seen, total, mastered, shaky }) => (
          <div key={lv} className="card rp-lvcard">
            <div className="rl-head">
              <span className="rl-badge">{lv}</span>
              <span className="rl-body">
                <b>{seen.length}개 배웠어요</b>
                <span>{NOTE[lv]} · 전체 {total}개</span>
              </span>
            </div>
            <div className="td-mix">
              <div className="td-cell"><b>{mastered}</b><span>외웠음</span></div>
              <div className="td-cell"><b>{shaky}</b><span>흔들림</span></div>
              <div className="td-cell"><b>{seen.length - mastered - shaky}</b><span>보통</span></div>
            </div>
            <button
              className="submit-btn"
              disabled={seen.length === 0}
              onClick={() => {
                if (!seen.length) { onToast('이 등급은 아직 배운 게 없어요'); return; }
                onStartSet(seen, `${lv} 회독`, `repeat-${lv}`);
              }}
            >
              <IconRepeat /> {lv} 다시 돌기 {seen.length > 0 && `(${seen.length}개)`}
            </button>
            {seen.length === 0 && (
              <p className="set-note">아직 배운 게 없어요 — 오늘의 학습부터 해 보세요</p>
            )}
            {/* 흔들리는 게 많으면 그것만 도는 쪽이 빠르다 */}
            {shaky > 0 && (
              <button
                className="ghost-btn"
                onClick={() => {
                  const only = seen.filter((w) => {
                    const st = stateOf(review, w.id);
                    return (st.wrongCount || 0) + (st.vagueCount || 0) > 0 && !isMastered(st);
                  });
                  onStartSet(only, `${lv} 흔들리는 것`, `repeat-${lv}-shaky`);
                }}
              >
                흔들리는 {shaky}개만 <IconChevron className="chev" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!anySeen && (
        <div className="empty-state" style={{ marginTop: 14 }}>
          아직 배운 게 없어요. 오늘의 학습을 한 판 하면 여기가 채워집니다.
        </div>
      )}

      <p className="set-note">
        {MASTER_STREAK}번 이어서 맞히면 「외웠음」이 돼요. 외운 것도 같이 돌아요 —
        다시 보는 게 목적이라 빼지 않습니다.
      </p>
    </>
  );
}
