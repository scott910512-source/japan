import { useCallback, useEffect, useRef } from 'react';
import { markStudied, noteFreeStudy, unmarkStudied } from '../lib/plan.js';
import { addToDay, removeFromDay, noteActivity as noteActivityIn } from '../lib/stats.js';
import { applyVerdict, isSessionClear, stateOf, todayKey } from '../lib/review.js';
import { noteWeak, relapseNotes } from '../lib/weak.js';
import { touchStreak } from '../lib/storage.js';

/* 판정이 들어올 때 무엇을 적는가.
 *
 * ★ 한 번 누른 것이 네 군데에 적힌다 ★
 *
 *   회독 기록(review)  다음에 언제 다시 볼까
 *   계획(plan)         오늘 할 것에서 하나 지운다
 *   활동 통계(stats)   오늘 몇 번 눌렀나
 *   약점 장부(weak)    외웠던 것이 무너졌나
 *
 * 네 개가 각자 다른 셈법을 쓴다. 「몇 번 눌렀나」와 「무엇을 끝냈나」는 다른
 * 숫자다 — 한 카드를 세 번 만나면 통계는 3이 오르고 계획은 1이 오른다.
 * 그 차이를 한 군데 모아 두지 않으면 화면마다 다른 숫자가 뜬다.
 *
 * 되돌리기도 여기 있다. 되돌릴 때 활동 수를 안 빼던 때가 있었는데, 그러면
 * 잘못 눌러 되돌리고 다시 누른 카드 하나가 활동 둘로 세어졌다 — 고칠 데를
 * 찾으려고 기록을 보는 사람에게 기록이 거짓말을 하면 볼 이유가 없다. */
export function useVerdicts({
  review, setReview, setPlan, setProgress, setStats, setStreak, setMemos,
}) {
  /* 회독 기록을 그릴 때마다 담아 둔다. 판정을 받는 함수(applyVerdicts)는
     의존성이 빈 배열이라 지금 상태를 모르는데, 「외웠던 낱말인가」를 알려면
     판정 직전의 기록이 필요하다. 의존성에 review를 넣으면 판정마다 함수가
     새로 생기고, 그걸 의존성으로 쓰는 효과(N3 코스)가 같이 다시 돈다. */
  const reviewRef = useRef(review);
  useEffect(() => { reviewRef.current = review; }, [review]);

  const applyReview = useCallback((nextReview, verdict, cardId, opts) => {
    setReview(nextReview);

    /* ★ 「몇 번 눌렀나」와 「무엇을 끝냈나」는 다른 숫자다 ★
       아래 stats는 앞엣것(활동 통계), plan은 뒤엣것(고유 학습 완료)이다.
       한 카드를 세 번 만나면 stats는 3이 오르고 plan은 1이 오른다. */
    if (cardId) {
      /* ★ 「만났다」와 「끝냈다」는 다르다 ★
         몰라요를 누른 카드는 이번 판에서 다시 나온다. 그걸 완료로 세면
         「남은 0개」인데 화면에는 카드가 계속 나오는 꼴이 된다.
         이번 판에서 정리된 것(isSessionClear)만 완료로 센다. */
      const clear = isSessionClear(stateOf(nextReview, cardId));
      setPlan((prev) => (opts?.undo || !clear
        ? unmarkStudied(prev, cardId)
        : markStudied(prev, cardId)));
    }

    if (!verdict) return;

    /* 되돌릴 때는 그 판정이 적힌 날에서 뺀다. 오늘로 잡으면 자정을 넘겨
       되돌렸을 때 어제 올린 것을 오늘에서 빼게 된다. */
    const day = opts?.day || todayKey();

    /* ★ 되돌리면 활동 수도 물러야 한다 ★
       여태 판정은 올리고 되돌리기는 안 뺐다. 그래서 잘못 눌러 되돌리고 다시
       누르면 카드 하나를 한 번 판정했는데 활동이 둘로 셌다. 화면에 「오늘
       40개」가 뜨는데 실제로 본 카드는 스무 장인 식이다. */
    if (opts?.undo) {
      setStats((prev) => removeFromDay(prev, day, [verdict]));
      /* 연속일은 되돌리지 않는다. 「오늘 공부했나」는 판정 하나에 달린 게 아니고,
         한 장을 물렀다고 그 날 안 한 것이 되지도 않는다. 되돌릴 근거가 없다. */
      return;
    }

    // 오늘 처음 판정한 순간에 연속일이 오른다. 같은 날 두 번째부터는 그대로 둔다.
    setStreak((prev) => (prev.lastDate === day ? prev : touchStreak()));
    setStats((prev) => addToDay(prev, day, [verdict]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 회독 화면 밖에서 판정이 들어올 때 — 지금은 실전 연습이 유일하다.
   *
   * { 표현id: 판정 } 여러 개를 한꺼번에 받는다. 실전 한 판이 끝나야 결과가
   * 나오니 낱장으로 부를 자리가 없다. 여기를 거치면 그 표현은 회독 저장소에
   * 들어가고, 다음 날 오늘의 학습이 약점으로 집어 간다 — 별도 배선 없이.
   *
   * 연속일은 여기서 올린다. 실전도 공부다. 통계의 studied도 같이 센다. */
  const applyVerdicts = useCallback((map) => {
    const ids = Object.keys(map || {});
    if (!ids.length) return;
    const day = todayKey();
    /* ★ 잊어버림은 판정을 적용하기 전에 센다 ★
       적용하고 나면 기억 단계가 0으로 내려가서, 「외웠던 낱말이 무너졌다」는
       사실이 사라진다. 판정 뒤에 세면 전부 「그냥 모르는 낱말」로 보인다.

       ★ setReview 안에서 세지 않는다 ★
       그 안이 판정 직전의 상태를 쥐고 있어서 처음엔 거기서 셌는데, 갱신
       함수는 React가 두 번 부를 수 있다(StrictMode). 세는 일은 더하기라
       두 번 불리면 한 번 틀린 것이 두 번으로 적힌다. 그래서 바깥에서, 그릴
       때 담아 둔 회독 기록(reviewRef)으로 센다. */
    const relapses = relapseNotes(reviewRef.current, map, day);
    if (relapses.length) {
      setProgress((p) => ({ ...p, weak: noteWeak(p.weak, relapses) }));
    }
    setReview((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = applyVerdict(next[id], map[id], day);
      return next;
    });
    setStreak((prev) => (prev.lastDate === day ? prev : touchStreak()));
    /* 계획 밖 자유 학습이라도 계획의 같은 항목을 채웠으면 한 번만 반영한다.
       계획에 없는 카드면 여기서 계획 수를 늘리지 않는다 — 자유 학습으로
       오늘 목표가 저절로 커지면 「오늘 할 것」이 무슨 뜻인지 알 수 없게 된다. */
    setPlan((prev) => ids.reduce((pl, id) => noteFreeStudy(pl, id), prev));
    /* 여기도 같은 표를 쓴다. 손으로 세던 때는 known을 빼먹어서, 실전에서
       맞힌 것이 어느 칸에도 안 남았다. */
    setStats((prev) => addToDay(prev, day, ids.map((id) => map[id])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 판정이 아닌 활동(듣기·시험). 회독 진도는 올리지 않고 활동 칸에만 적는다 —
     들으면서 흘려보낸 것과 떠올려서 맞힌 것은 다른 일이다. 그래도 아무 데도
     안 남으면 한 시간 듣고도 기록이 그대로라, 노력한 내역은 보여 준다. */
  const noteActivity = useCallback((patch) => {
    setStats((prev) => noteActivityIn(prev, todayKey(), patch));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 약점 장부에 한 줄 적는다 — 시험과 듣기가 부른다.
     회독 저장소는 안 건드린다. 시험 때문에 복습 간격이 흔들리면 시험을
     마음 편히 못 보고, 듣기는 흘려들은 것까지 외운 것으로 세게 된다. */
  const noteWeakness = useCallback((notes) => {
    if (!notes?.length) return;
    setProgress((p) => {
      const weak = noteWeak(p.weak, notes);
      return weak === p.weak ? p : { ...p, weak };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMemo = useCallback((id, text) => {
    setMemos((prev) => {
      if (!text) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { text, at: new Date().toISOString() } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleBookmark = useCallback((id) => {
    setProgress((p) => {
      const list = p.bookmarks || [];
      return {
        ...p,
        bookmarks: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    applyReview, applyVerdicts, noteActivity, noteWeakness, saveMemo, toggleBookmark,
  };
}
