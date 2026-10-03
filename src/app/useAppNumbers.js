import { useMemo } from 'react';
import { planStatus, reviewLeftOf } from '../lib/plan.js';
import { dueCards, summarize } from '../lib/review.js';
import { forgetSpeed, weakReasons, weakSummary } from '../lib/weak.js';
import { roundSummary } from '../lib/rounds.js';
import { GRAMMAR_MODULES } from '../data/grammar.js';

/* 화면들이 보여 주는 숫자 — 한 군데서만 센다.
 *
 * ★ 같은 정보가 다른 숫자로 뜨면 안 본다 ★
 *
 * 이게 모아 둔 이유 전부다. 복습 탭 배지는 「99+」인데 복습 탭을 열면
 * 「11개」인 적이 있었다. 배지는 밀린 복습까지 더했고 화면은 안 더했다 —
 * 둘 다 틀린 건 아니지만 같은 화면에서 숫자가 다르면 쓰는 사람은 둘 다
 * 안 믿는다.
 *
 * 그래서 홈·학습 탭·복습 탭·내 학습이 같은 셈을 두 번 하지 않게, 세는 자리를
 * 하나로 둔다. 각 숫자가 무슨 뜻인지는 줄 옆에 적어 둔다 — 뜻이 안 적혀
 * 있으면 다음 사람이 「비슷한 것」을 하나 더 만든다.
 *
 * ★ 전부 파생값이다 ★
 *
 * 여기 있는 것은 하나도 상태가 아니다. 회독 기록·계획·진도에서 계산된다.
 * 상태로 들고 있으면 한쪽만 갱신되는 날이 오고, 그게 바로 위의 「99+ 대 11」
 * 같은 일이다. */
export function useAppNumbers({
  words, wordIds, byId, review, progress, plan, sentenceIds, today,
}) {
  /* 오늘 볼 때가 된 낱말 */
  const due = useMemo(() => dueCards(wordIds, review, today), [wordIds, review, today]);

  /* 문장 쪽 복습 — 복습 탭의 「문장」 줄 */
  const sentenceDue = useMemo(
    () => dueCards(sentenceIds, review, today).length,
    [sentenceIds, review, today],
  );

  /* 화면·큐·통계가 모두 이 하나를 본다 — 같은 정보를 여러 곳에서 다른
     숫자로 보여 주지 않으려면 셈하는 자리가 하나여야 한다. */
  const planNow = useMemo(() => planStatus(plan), [plan]);

  /* ★ 복습 탭 배지 · 홈 · 복습 탭이 같은 수를 본다 ★
     오늘 계획의 복습·약점 갈래에서 남은 것 — reviewLeftOf 한 곳에서. 밀린
     복습(backlog)은 배지에 더하지 않는다. 더했더니 배지는 「99+」인데 복습 탭은
     「11개」라 같은 화면에서 숫자가 달랐다. 밀린 것은 복습 탭 안에서만 말한다. */
  const reviewLeft = useMemo(() => reviewLeftOf(planNow).left, [planNow]);

  /* 약점 — 복습 탭·내 학습·취약 단어 덱이 한 군데를 본다.
   *
   * 여기서 보는 것은 회독 기록(review)과 약점 장부(progress.weak) 둘이다.
   * 회독만 보던 때는 시험에서 열 번 틀린 낱말이 약점 0이었다 — 시험·듣기가
   * 회독에 아무것도 안 쓰기 때문이다(그 판단은 그대로 둔다). 장부가 그
   * 빈자리를 채운다. 규칙은 lib/weak.js 한 군데에 있다. */
  const weakBook = useMemo(
    () => weakSummary(wordIds, review, progress.weak),
    [wordIds, review, progress.weak],
  );

  /* 복습 탭이 그릴 줄 — 제일 약한 다섯 개와 왜 약한지.
     숫자만 보여 주면 무엇을 할지가 안 정해진다. 「시험에서 세 번 틀렸어요」와
     「쉰 번 들었어요」는 다음에 할 일이 다른 낱말이다. */
  const weakRows = useMemo(() => weakBook.top.map(({ id, st, rec }) => {
    const card = byId.get(id);
    return {
      id,
      kanji: card?.kanji || id,
      kana: card?.kana || '',
      mean: (card?.mean || '').split(';')[0].trim(),
      reasons: weakReasons(st, rec).slice(0, 3),
      speed: forgetSpeed(rec),
    };
  }), [weakBook, byId]);

  /* 단어 회독 현황과 기억 단계 — 학습 탭·내 학습이 각자 세던 것을 한 번만 센다.
     review가 바뀔 때만 다시 센다(판정 한 번에 한 번). */
  const wordStat = useMemo(() => summarize(wordIds, review), [wordIds, review]);
  const rounds = useMemo(() => roundSummary(wordIds, review), [wordIds, review]);

  /* N3 오답노트 수 — 코스 자료를 안 불러오고 progress.n3.wrong만 센다.
     취약 문법은 같은 꼭지를 두 번 넘게 틀린 것. */
  const n3Wrong = useMemo(() => {
    const w = progress.n3?.wrong || {};
    let all = 0; const refs = {};
    for (const e of Object.values(w)) {
      all += 1;
      if ((e.cat === 'grammar' || e.cat === 'particle') && e.ref) refs[e.ref] = (refs[e.ref] || 0) + (e.c || 1);
    }
    return { all, grammar: Object.values(refs).filter((c) => c >= 2).length };
  }, [progress.n3?.wrong]);

  /* 아직 한 번도 안 본 문법 꼭지 수. 홈이 「오늘의 문법」에 적는다 —
     숫자가 없으면 눌러 보고 나서야 할 게 있는지 알게 된다. */
  const grammarLeft = useMemo(
    () => GRAMMAR_MODULES.filter((m) => !(progress.grammarDone?.[m.id] > 0)).length,
    [progress.grammarDone],
  );

  /* 오늘 볼 문법 꼭지 이름. 개수만 적으면 무엇을 배우는지 모른 채로 누른다 —
     「아직 안 본 것 3개」와 「て형」은 같은 정보가 아니다. */
  const grammarNext = useMemo(() => {
    const m = GRAMMAR_MODULES.find((x) => !(progress.grammarDone?.[x.id] > 0));
    return m ? `${m.title} · 짧은 테스트까지` : null;
  }, [progress.grammarDone]);

  return {
    due, sentenceDue, planNow, reviewLeft,
    weakBook, weakWords: weakBook.total, weakRows,
    wordStat, rounds, n3Wrong, grammarLeft, grammarNext,
    words,
  };
}
