import { useCallback, useEffect, useRef, useState } from 'react';
import { stopSpeaking } from '../lib/tts.js';
import { countsAsStuck, nextAt } from '../lib/listen.js';
import { markBusy } from '../lib/busy.js';
import { WEAK_KIND } from '../lib/weak.js';

/* 듣는 판 하나 — 어디까지 들었나, 멈춰 있나, 무엇을 뺐나.
 *
 * ★ 무엇이 여기 있고 무엇이 없나 ★
 *
 * 여기 있는 것: 판(run)과 그 안의 자리, 한 장의 몇 번째 걸음(step), 멈춤,
 * 넘기기, 빼기, 그리고 「들었다」를 기록에 적는 일.
 *
 * 여기 없는 것: 무슨 소리가 나는가(hooks/useListenSpeech.js), 박자
 * (hooks/useListenBeat.js), 무엇을 들을지 고르는 일(화면). 판을 짜는 것도
 * 화면이 한다 — 어떤 낱말을 뽑을지는 단어 자료를 아는 쪽이 정해야 한다.
 * 여기는 짜 온 카드 묶음을 받아서 돌린다.
 *
 * ★ 흐름 타이머를 여기서 쥔다 ★
 *
 * 다음 걸음을 예약하는 타이머(timer)와 「이 화면이 아직 살아 있나」(alive)를
 * 이 판이 쥐고, 소리 쪽이 빌려 쓴다. 타이머가 곧 흐름이라서, 흐름을 가진
 * 쪽이 들고 있어야 넘기거나 멈출 때 한 군데서 끊을 수 있다. */
export function useListenSession({ onToast, onActivity, onWeakness, onDrop }) {
  const [run, setRun] = useState(null);   // { cards, at, lap, seed }
  const [step, setStep] = useState(0);
  /* 손으로 건너뛴 횟수. 마지막 장에서 「다음」을 누르면 장도 걸음도 그대로라
     흐름이 다시 안 걸리고 조용히 멈춘다 — 이 숫자를 올려서 다시 걸어 준다. */
  const [nudge, setNudge] = useState(0);
  /* 일시중지. 「그만」은 판을 접지만 이건 자리를 지킨다 — 말 한마디 하려고
     끊었다가 처음부터 다시 듣는 건 이 화면을 쓰는 이유를 없앤다. */
  const [paused, setPaused] = useState(false);
  /* 방금 들은 세트. 다 듣고 나서 「그대로 시험」으로 넘어가는 자리다 —
     귀로 들은 것과 답할 수 있는 것은 다르고, 그 차이는 물어봐야 안다. */
  const [lastSet, setLastSet] = useState(null);

  const timer = useRef(null);
  const alive = useRef(true);

  const card = run?.cards[run.at];

  /* 지금 나는 소리와 걸려 있는 예약을 끊는다. 넘기거나 접을 때 부른다 —
     안 끊으면 방금 장의 말이 다음 장 위로 겹쳐서 난다. */
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    stopSpeaking();
  }, []);

  useEffect(() => () => {
    alive.current = false;
    clearTimeout(timer.current);
    stopSpeaking();
  }, []);

  /* ★ 듣는 중에는 새 버전으로 안 갈아끼운다 ★
     어디까지 들었는지는 화면 안에만 있어서, 배포가 올라온 뒤 앱을 다시 앞으로
     꺼내는 순간 판이 통째로 사라졌다. 판을 닫으면 표시를 내린다. */
  useEffect(() => {
    markBusy('listen', Boolean(run));
    return () => markBusy('listen', false);
  }, [run]);

  /* ★ 들은 것도 기록에 남는다 ★
   *
   * 듣기는 회독 진도를 올리지 않는다. 들으면서 흘려보낸 것과 떠올려서 맞힌
   * 것은 다른 일이라 그 판단은 그대로 둔다. 그런데 아무 데도 안 남으니
   * 한 시간 듣고도 기록이 그대로였다 — 노력한 내역은 보여야 한다.
   *
   * 낱말마다도 센다. 일별 활동(listened)은 「오늘 몇 장 들었나」라서, 쉰 번
   * 들은 낱말과 한 번도 안 들은 낱말을 구별하지 못한다. 「쉰 번 들었는데
   * 아직 틀린다」는 약점의 정도를 말해 주는 몇 안 되는 신호다(lib/weak.js).
   *
   * 자리(at)가 앞으로 갈 때만 센다 — 바퀴를 넘기면 0으로 돌아오니 바퀴
   * 번호까지 같이 보고 판단한다. 안 그러면 두 바퀴째 첫 장이 안 세어진다. */
  const countedAt = useRef(-1);
  const countedLap = useRef(-1);
  useEffect(() => {
    if (!run) { countedAt.current = -1; countedLap.current = -1; return; }
    const lap = run.lap || 0;
    if (lap === countedLap.current && run.at <= countedAt.current) return;
    countedAt.current = run.at;
    countedLap.current = lap;
    onActivity?.({ listened: 1 });
    const id = run.cards[run.at]?.id;
    if (!id) return;
    const notes = [{ id, kind: WEAK_KIND.LISTEN }];
    /* ★ 세 바퀴째에도 안 뗀 낱말을 센다 ★
       들은 횟수만으로는 약점이 안 쌓인다 — 「얼마나 만났나」지 「되나
       안 되나」가 아니라서, 쉰 번 들은 멀쩡한 낱말까지 약점이 될까 봐
       신호로 안 세고 있었다. 그래서 달리면서 듣기만 하면 약점이 0이었다.
       세 바퀴째까지 「다 외웠어요」에 손이 안 간 낱말은 다르다. 그건
       사람이 직접 낸 신호다. 뺀 낱말은 판에서 아예 빠지니 저절로 안 센다. */
    if (countsAsStuck(lap)) notes.push({ id, kind: WEAK_KIND.STUCK });
    onWeakness?.(notes);
  }, [run, onActivity, onWeakness]);

  /* 판을 짜서 돌린다. 카드는 화면이 뽑아서 넘긴다. */
  const begin = (cards) => {
    /* 씨앗은 판마다 새로 뽑는다. 「랜덤」 방향이 이것과 자리·바퀴로 정해져서,
       같은 자리는 한 판 안에서 늘 같은 방향이고 판이 바뀌면 패턴도 바뀐다. */
    setRun({ cards, at: 0, lap: 0, seed: Math.floor(Math.random() * 2 ** 31) });
    setLastSet(cards);
    setStep(0);
    setPaused(false);
  };

  const stop = useCallback(() => {
    cancel();
    setRun(null);
    setPaused(false);
  }, [cancel]);

  const skip = (n) => {
    cancel();
    setRun((r) => {
      if (!r) return r;
      const at = Math.min(r.cards.length - 1, Math.max(0, r.at + n));
      return { ...r, at };
    });
    setStep(0);
    setNudge((v) => v + 1);
  };

  const togglePause = () => setPaused((v) => !v);

  /* 「다 외웠어요」 — 이번 판에서 이 낱말을 뺀다.
     빼고 나면 그 자리에 다음 낱말이 온다. 자리(at)는 그대로 두는 게 맞다 —
     한 칸 물러나면 방금 들은 것을 다시 듣게 된다. */
  const dropCurrent = () => {
    if (!run || !card) return;
    const id = card.id;
    onDrop?.(id);
    /* 쌓아 둔 바퀴 수를 되돌린다. 그 수의 뜻이 「아직 안 뗀 채로」라서,
       뗀 순간 더는 참이 아니다 — 안 되돌리면 방금 외운 낱말이 약점 목록
       맨 위에 그대로 남는다. 회독에서 실제로 틀린 기록은 안 건드린다. */
    onWeakness?.([{ id, kind: WEAK_KIND.CLEARED }]);
    setStep(0);
    setRun((r) => {
      if (!r) return r;
      const cards = r.cards.filter((c) => c.id !== id);
      if (!cards.length) { onToast?.('다 뺐어요 — 이 구간은 끝'); return null; }
      return { ...r, cards, at: Math.min(r.at, cards.length - 1) };
    });
    setNudge((v) => v + 1);
    onToast?.(`${card.kanji} 빼요 — 설정에서 되돌릴 수 있어요`);
  };

  /* 한 장 안에서 다음 걸음으로 */
  const nextStep = () => setStep((s) => s + 1);

  /* 다음 장으로. 한 바퀴를 다 돌았으면 반복 설정에 따라 다시 돌거나 끝낸다. */
  const advance = ({ loop, reshuffle }) => {
    setStep(0);
    setRun((r) => {
      if (!r) return r;
      const next = nextAt(r, loop, { reshuffle });
      if (!next) { onToast?.('다 들었어요 — 시험으로 확인해 볼까요'); return null; }
      // 한 바퀴를 넘겼으면 알린다. 화면을 안 보고 있어도 어디쯤인지는 알아야 한다
      if (next.lap > r.lap) onToast?.(`${next.lap}바퀴 돌았어요${reshuffle ? ' — 순서를 섞었어요' : ''}`);
      return { ...r, ...next };
    });
  };

  return {
    run, card, step, nudge, paused, lastSet,
    timer, alive,
    begin, stop, skip, togglePause, dropCurrent, nextStep, advance, cancel,
  };
}
