import { useCallback, useState } from 'react';
import { addMore, remaining } from '../lib/plan.js';
import { buildPlannedStudyQueue } from '../lib/daily.js';
import { cardsForQueue } from '../lib/cards.js';
import { filterByLevel } from '../lib/wordFilters.js';
import { todayKey, weakCards } from '../lib/review.js';

/* 회독 판(덱)을 짜는 함수들 — App.jsx(900줄)에서 떼어 냈다. 동작은 그대로다.
 *
 * 무엇을 어떤 순서로 돌지는 오늘의 계획(plan)이 정하고, 여기는 그 계획을
 * 카드 묶음(덱)으로 바꿔 회독 화면에 넘길 뿐이다. */

/* 갈래마다 다른 판이다. 덱 id에 갈래를 넣어야 「새 단어」를 눌렀는데
   하다 만 복습 판이 열리는 일이 없다 — 둘은 서로 다른 일이다.

   덱 id는 그대로 둔다(today:fresh 등). 이름만 「단어 외우기 → 새 단어」로
   바뀌었는데 id까지 건드리면, 하다 만 판을 가진 사람이 업데이트하는 순간
   그 판을 못 찾는다. */
export function LANE_DECK(lanes) {
  if (!lanes?.length || lanes.length === 3) return 'today';
  return `today:${[...lanes].sort().join('+')}`;
}

/* 이 판이 끝나면 어디로 가나. 복습을 끝냈으면 새 단어, 새 단어까지 끝냈으면
   배운 걸 다시 도는 자리다 — 그날 할 것을 다 한 다음이니까. */
export function LANE_NEXT(lanes) {
  if (!lanes?.length || lanes.length === 3) return null;
  if (!lanes.includes('fresh')) return { to: 'fresh', label: '새 단어' };
  if (lanes.length === 1 && lanes[0] === 'fresh') return { to: 'repeat', label: '회독 학습' };
  return null;
}

/* 갈래에 따라 판 이름이 달라진다. 이어하기 줄에 그대로 뜨니
   「오늘의 학습」 하나로 두면 뭘 하다 말았는지 모른다. */
export function LANE_LABEL(lanes) {
  if (!lanes?.length || lanes.length === 3) return '오늘의 학습';
  if (lanes.length === 1 && lanes[0] === 'fresh') return '새 단어';
  if (!lanes.includes('fresh')) return '복습하기';
  return '오늘의 학습';
}

export function useStudyQueue({
  session, plan, planNow, setPlan, words, wordIds, byId, sentenceCards, review, settings, due, todayPool, today,
  setDeck, setSub, showToast,
}) {
  /* 「10개 더 배우기」 — 계획을 다 하고도 더 하고 싶을 때만 명시적으로 늘린다.
     저절로 다음 20개가 따라 나오면 끝냈다는 느낌을 영영 못 받는다. */
  const learnMore = useCallback((count) => {
    setPlan((prev) => {
      const next = addMore(prev, todayPool, review, { count, today });
      if (next === prev) showToast('더 배울 게 없어요');
      return next;
    });
  }, [todayPool, review, today, showToast, setPlan]);

  /* 세션 저장소가 한 칸이라, 새 판을 열면 하던 판이 말없이 사라진다.
     한 번 묻고 연다 — 「조용히 삼키지 말고」가 이 저장소가 정한 원칙이다.
     칸을 늘리지는 않는다. 그러면 완주 지점이 여러 개가 되어 더 나빠진다. */
  const [askSwap, setAskSwap] = useState(null);   // { run, from, left }

  const guardDeck = useCallback((run, deckId) => {
    const live = session?.deckId && session.queue?.length > 0 && session.date === todayKey();
    if (live && session.deckId !== deckId) {
      setAskSwap({ run, from: session.label || '하던 학습', left: session.queue.length });
      return;
    }
    run();
  }, [session]);

  /* 오늘의 학습을 갈래별로 연다.
   *
   * 홈에서 「단어 외우기」와 「복습하기」를 따로 누른다. 큐를 갈래로 갈라
   * 짜야 그 둘이 서로 다른 판이 된다 — 한 판에 다 섞으면 「복습만 하고 싶다」가
   * 안 된다. 갈래를 안 주면 예전처럼 셋 다 담는다. */
  const startToday = useCallback((lanes = null) => {
    /* 하던 판이 남아 있으면 그걸 잇는다.
       예전엔 여기서 큐를 새로 짰다. 그러면 카드는 새로 뽑히는데 세션은 옛것을
       그대로 써서, 남은 카드를 새 덱이 못 찾고 「학습할 카드가 없어요」에서
       나갈 수도 없었다. */
    const deckId = LANE_DECK(lanes);
    if (session?.deckId === deckId && session.date === todayKey() && session.queue?.length) {
      setSub(null);
      setDeck({
        id: deckId,
        label: session.label || '오늘의 학습',
        cards: [...words, ...sentenceCards],
        stepped: true,
      });
      return;
    }

    /* ★ 큐는 오늘의 계획에서 짠다 ★
     *
     * 예전엔 여기서 매번 새로 뽑았다. 그래서 신규 20개를 끝내고 다시 누르면
     * 아직 안 본 다음 20개가 또 나왔다 — 끝이 없었다. 이제 계획에 배정된 것
     * 중 아직 안 끝낸 것만 담는다. 다 했으면 다 했다고 말한다. */
    const left = remaining(plan, lanes);
    if (!left.length) {
      showToast(planNow.assigned > 0
        ? '오늘 몫을 다 했어요 — 더 하려면 「10개 더 배우기」를 눌러요'
        : (lanes?.length === 1 && lanes[0] === 'fresh'
          ? '새로 배울 단어가 없어요 — 설정에서 레벨을 넓혀 보세요'
          : '지금 볼 게 없어요 — 학습 탭에서 골라 보세요'));
      return;
    }
    /* 무엇을 할지는 계획이 이미 정했다. 현재 회독 상태로 다시 분류하면, 오늘
       한 번 봤지만 아직 끝내지 못한 신규 카드가 어느 갈래에도 들지 않아
       「2개 남음」인데 빈 큐가 될 수 있다. 여기서는 순서만 정한다. */
    const built = buildPlannedStudyQueue(left);
    if (!built.queue.length) {
      showToast('지금 볼 게 없어요 — 학습 탭에서 골라 보세요');
      return;
    }
    /* 계획을 만든 뒤 레벨 설정을 바꿔도 이미 배정된 카드는 사라지면 안 된다. */
    const cards = cardsForQueue(built.queue, words, sentenceCards);
    setSub(null);
    /* daily를 켜지 않는다 — 큐를 여기서 이미 짰다. 회독 화면이 또 짜면
       복습·약점 비율이 통째로 어긋난다. */
    setDeck({
      id: deckId,
      label: LANE_LABEL(lanes),
      cards,
      queue: built.queue.map((q) => q.id),
      /* 한 판이 끝나면 다음으로 이어 준다. 복습 → 단어 외우기 → 회독 학습.
         끝날 때마다 홈으로 돌려보내면 매번 「다음에 뭐 하지」를 다시 정해야 한다. */
      next: LANE_NEXT(lanes),
      /* 앱이 짜 준 판이니 방식도 앱이 정한다 — 맞힐수록 단서를 하나씩 뺀다.
         골라 들어간 판에서는 사용자가 정한 방향을 그대로 지킨다. */
      stepped: true,
      intro: { total: cards.length, review: built.review, weak: built.weak, fresh: built.fresh, minutes: built.minutes },
    });
  }, [session, plan, planNow, words, sentenceCards, showToast, setDeck, setSub]);

  /* 하다 만 걸 이어서. 세션은 카드 id만 들고 있으니, 덱에는 단어와 문장을
     전부 실어 준다 — 어느 쪽에서 온 카드든 찾을 수 있어야 한다. */
  const resumeSession = useCallback(() => {
    if (!session?.deckId || !session.queue?.length) return;
    setSub(null);
    setDeck({
      id: session.deckId,
      label: session.label || '이어서 학습',
      cards: [...words, ...sentenceCards],
      /* 오늘의 학습은 회독마다 방식이 달라진다. 이어하기에 이 칸을 안 실어서,
         나갔다 들어온 순간부터 읽기·떠올리기·듣기 단계가 통째로 사라졌었다.
         갈래별로 id가 갈렸으니 앞머리로 본다 — today:fresh도 앱이 짜 준 판이다. */
      stepped: String(session.deckId || '').startsWith('today'),
    });
  }, [session, words, sentenceCards, setDeck, setSub]);

  const startWordDeck = useCallback(() => {
    const pool = filterByLevel(words, settings.levels);
    if (pool.length === 0) {
      showToast('고른 레벨에 단어가 없어요');
      return;
    }
    setSub(null);
    setDeck({ id: 'words', label: '오늘 학습', cards: pool, daily: true });
  }, [words, settings.levels, showToast, setDeck, setSub]);

  const startDueDeck = useCallback(() => {
    if (due.length === 0) {
      showToast('오늘 복습할 단어가 없어요');
      return;
    }
    setDeck({ id: 'due', label: '오늘 복습', cards: due.map((id) => byId.get(id)).filter(Boolean) });
  }, [due, byId, showToast, setDeck]);

  const startWeakDeck = useCallback(() => {
    const weak = weakCards(wordIds, review);
    if (weak.length === 0) {
      showToast('취약 단어가 아직 없어요');
      return;
    }
    setDeck({ id: 'weak', label: '취약 단어', cards: weak.map((id) => byId.get(id)).filter(Boolean) });
  }, [wordIds, review, byId, showToast, setDeck]);

  // JLPT 세트는 고른 100개만 도는 덱이다 — 오늘 학습 세션과 섞지 않는다.
  const startJlptSet = useCallback((cards, label, id) => {
    if (!cards?.length) return;
    setSub(null);
    setDeck({ id, label, cards });
  }, [setDeck, setSub]);

  // 시험에서 틀린 단어를 바로 회독으로 넘긴다. 틀린 걸 확인만 하고 닫으면 남는 게 없다.
  const startQuizWrongDeck = useCallback((ids) => {
    const cards = ids.map((id) => byId.get(id)).filter(Boolean);
    if (!cards.length) return;
    setSub(null);
    setDeck({ id: `quizwrong-${ids.length}`, label: '시험 오답', cards });
  }, [byId, setDeck, setSub]);

  return {
    askSwap, setAskSwap, guardDeck, learnMore,
    startToday, resumeSession, startWordDeck, startDueDeck, startWeakDeck, startJlptSet, startQuizWrongDeck,
  };
}
