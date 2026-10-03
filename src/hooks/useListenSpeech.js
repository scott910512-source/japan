import { useEffect } from 'react';
import { speakJapanese, speakKorean, stopSpeaking } from '../lib/tts.js';

/* 한 장이 흘러가는 동안 무슨 소리가 나는가.
 *
 * ★ 옮겨 왔을 뿐이다 ★
 *
 * 이 안의 타이밍은 하나하나 겪고 고친 값이다 — 「답은 두 번 읽어 준다」,
 * 「최소 1.6초는 둔다」, 「클라우드 음성은 응답이 늦게 올 수 있다」. 보기에
 * 지저분한 자리가 많지만 각각 이유가 있고, 그 이유는 줄 옆에 적혀 있다.
 * 그래서 이 리팩토링에서는 한 글자도 바꾸지 않고 자리만 옮겼다.
 *
 * ★ 말이 끝나는 신호를 안 믿는다 ★
 *
 * 끝났다는 신호(onend)가 안 오는 기기가 있다. 그걸 기다리면 그 기기에서는
 * 영영 다음 장으로 안 간다 — 손이 안 비는 시간에 쓰라고 만든 화면에서 그건
 * 치명적이다. 그래서 글자 수로 어림잡은 시간으로 넘긴다. 늦게 끝나면 조금
 * 겹치지만, 멈추는 것보다 낫다.
 *
 * 타이머와 「살아 있나」는 판(useListenSession)이 쥐고 있다. 타이머가 곧
 * 흐름이라, 넘기거나 접을 때 한 군데서 끊을 수 있어야 한다. */
export function useListenSpeech({
  card, phase, last, nudge, cardDir, paused,
  gap, rate, sayKo, sayAnswer, loop, reshuffle,
  timer, alive, onNextStep, onAdvance,
}) {
  useEffect(() => {
    if (!card) return undefined;
    clearTimeout(timer.current);
    /* 멈춰 둔 동안에는 다음을 예약하지 않는다. 풀면 이 효과가 다시 돌면서
       그 걸음부터 이어진다 — 끊긴 자리를 한 번 더 들려주는 셈이라,
       무슨 말을 듣다 말았는지 떠올릴 틈이 된다. */
    if (paused) { stopSpeaking(); return undefined; }
    const wait = gap * 1000;
    // 문장은 읽는 데 더 걸린다. 글자 수로 어림잡아 기다린다.
    const spoken = Math.min(6000, 900 + (card.kana?.length || 4) * 130);
    const koText = String(card.mean || '').split(';')[0].trim();
    const say = card.kana || card.kanji;

    /* 다음 걸음으로. 마지막 걸음이면 다음 장으로 넘어간다. */
    const go = (after) => {
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        if (!last) { onNextStep(); return; }
        /* 반복 설정은 그때그때 넘긴다. 예약된 함수가 쥐고 있는 값을 쓰면
           판이 도는 중에 설정을 바꿨을 때 묵은 값으로 넘어간다. */
        onAdvance({ loop, reshuffle });
      }, after);
    };

    if (phase === 'jp') {
      /* 「뜻 → 일본어」에서 이 걸음은 답이다. 안 읽어 주기로 했으면 소리 없이
         화면에만 띄운다 — 눈으로 확인할 길까지 막을 이유는 없다. */
      const mute = cardDir === 'ko-jp' && !sayAnswer;
      if (mute) { go(300 + wait); return () => clearTimeout(timer.current); }

      speakJapanese(say, rate);
      if (cardDir !== 'ko-jp') { go(spoken + wait); return () => clearTimeout(timer.current); }

      /* ★ 답은 두 번 읽어 준다 ★
         뒤집은 판에서 답은 긴 침묵 뒤에 딱 한 번 스치듯 지나갔다. 「나무」를
         듣고 3초를 말해 본 다음 「き」가 0.3초 나오고 끝이니, 안 읽어 준 것과
         구별이 안 됐다. 한 번은 확인하려고, 한 번은 내가 말한 것과 견주려고
         듣는다 — 「따라 말하기」가 반대 방향에서 하는 것과 같은 이치다.

         그리고 최소 시간을 둔다. 클라우드 음성은 「부르고 → 받고 → 튼다」라
         짧은 낱말은 어림잡은 시간보다 응답이 늦게 올 수 있는데, 그 사이에
         다음 장이 시작되면 그 소리는 취소된다 — 안 읽어 준 것처럼 보인다. */
      const heard = Math.max(1600, spoken);
      timer.current = setTimeout(() => {
        if (!alive.current) return;
        speakJapanese(say, rate);
        go(heard + wait);
      }, heard + 400);
    } else if (phase === 'jp2') {
      /* ★ 뜻까지 듣고 나서 한 번 더 ★
         처음 듣는 일본어는 그냥 소리다. 뜻을 알고 다시 들으면 소리와 뜻이
         붙는다. 마지막 걸음이라 이게 끝나면 다음 장으로 넘어간다. */
      speakJapanese(say, rate);
      go(spoken + wait);
    } else if (phase === 'say') {
      if (cardDir === 'ko-jp') {
        // 입으로 말해 볼 시간. 여기서는 아무 소리도 안 낸다 — 내가 말할 차례다
        go(spoken + wait);
      } else {
        // 따라 말할 시간을 준 뒤 한 번 더 들려준다
        timer.current = setTimeout(() => {
          if (!alive.current) return;
          speakJapanese(say, rate);
          go(spoken + 400);
        }, spoken + wait);
      }
    } else {
      /* 뜻을 읽어 준다.
         「뜻 → 일본어」에서는 이게 문제다 — 안 읽으면 물어보는 게 없다.
         「일본어 → 뜻」에서는 답이라, 끄고 싶으면 끌 수 있다. */
      const speak = cardDir === 'ko-jp' || sayKo;
      let koWait = 0;
      if (speak && koText) {
        speakKorean(koText, rate);
        koWait = Math.min(4000, 600 + koText.length * 120);
      }
      go(koWait + Math.max(600, wait));
    }
    return () => clearTimeout(timer.current);
    /* onNextStep·onAdvance는 그릴 때마다 새로 만들어지는데, 의존성에 넣으면
       한 장이 흘러가는 중에 효과가 다시 돌아 같은 말을 또 하게 된다. 옮기기
       전에도 이 둘(setStep·setRun)은 배열에 없었다 — 그대로 둔다.

       알림(onToast)만 배열에서 빠졌다. 옮기기 전에는 들어 있었는데, 그 값은
       useToast가 영구히 같은 함수를 돌려줘서(useCallback with []) 한 번도
       바뀐 적이 없다 — 넣어도 안 넣어도 같다. 바뀔 수 있는 값으로 착각해
       누가 다시 넣으면, 부모가 그려질 때마다 같은 말을 다시 하게 된다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, phase, last, nudge, cardDir, gap, rate, sayKo, sayAnswer, loop, reshuffle, paused]);
}
