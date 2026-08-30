/* 빈칸 채우기 — 부사 연습과 일상문법이 같이 쓰는 규칙.
 *
 * 두 화면이 똑같은 일을 한다. 문장 하나에 구멍을 뚫고, 보기 셋을 주고,
 * 틀리면 왜 틀렸는지 적어 준다. 다른 건 자료뿐이다.
 *
 * 그래서 규칙은 여기 한 번만 적는다. 두 벌로 두면 한쪽만 고쳐지고 —
 * 「틀리면 자동으로 안 넘어간다」 같은 규칙은 한쪽에서만 살아 있게 된다. */

import { shuffled } from './review.js';

export const BLANK = '【　】';

/* 빈칸을 앞뒤로 쪼갠다. 화면이 「앞 [칸] 뒤」로 그린다 —
   문장을 통째로 두고 밑줄만 치면 어디가 빈칸인지 눈에 안 들어온다. */
export function splitBlank(text) {
  const at = String(text || '').indexOf(BLANK);
  if (at < 0) return { head: String(text || ''), tail: '' };
  return { head: text.slice(0, at), tail: text.slice(at + BLANK.length) };
}

/* 답을 넣은 완성 문장. 맞힌 뒤에 보여 준다 — 빈칸인 채로 넘어가면
   방금 배운 문장이 머리에 통째로 안 남는다. */
export function filled(item) {
  return String(item.jp || '').replace(BLANK, item.answer);
}
export function filledKana(item) {
  return String(item.kana || '').replace(BLANK, item.answer);
}

/* 한 판을 짠다.
 *
 * 묶음 하나를 통째로 돈다. 부정 호응을 배우는 중에 시간 부사가 섞여 나오면
 * 무엇을 배우는 판인지 흐려진다.
 *
 * 보기 순서는 섞되 문제 순서는 안 섞는다 — 자료를 쉬운 것부터 적어 뒀다. */
export function buildSetFrom(sets, setId, { shuffle = true } = {}) {
  const set = sets.find((s) => s.id === setId);
  if (!set) return [];
  return set.items.map((it) => ({
    ...it,
    options: shuffle ? shuffled(it.options) : [...it.options],
  }));
}

/* 틀린 것만 다시. 같은 판 안에서 두 번째로 만나는 자리다 —
   틀린 채로 넘어가면 그건 오늘 배운 게 없다. */
export function retryOf(items, wrongIds) {
  const set = new Set(wrongIds);
  return items.filter((it) => set.has(it.id)).map((it) => ({
    ...it,
    options: shuffled(it.options),
  }));
}

/* 몇 개 맞혔나 */
export function scoreOf(answers, items) {
  const right = items.filter((it) => answers[it.id]?.good).length;
  return { right, total: items.length, rate: items.length ? right / items.length : 0 };
}

/* 자료가 성한지. ★ 답이 하나만 되게 문장을 짠다 ★가 이 두 화면의 전부라,
   그게 깨진 자리를 검사가 찾을 수 있어야 한다. */
export function auditSets(sets) {
  const bad = [];
  const seen = new Set();
  for (const s of sets) {
    for (const it of s.items) {
      const at = `${s.id}/${it.id}`;
      if (seen.has(it.id)) bad.push(`${at} id가 두 번`);
      seen.add(it.id);
      if (!String(it.jp || '').includes(BLANK)) bad.push(`${at} 빈칸이 없음`);
      if (!String(it.kana || '').includes(BLANK)) bad.push(`${at} 읽는 법에 빈칸이 없음`);
      if (!it.options?.includes(it.answer)) bad.push(`${at} 보기에 답이 없음`);
      if (new Set(it.options || []).size !== (it.options || []).length) bad.push(`${at} 보기가 겹침`);
      if (!it.note) bad.push(`${at} 답을 왜 그렇게 쓰는지 안 적음`);
      if (!it.ko) bad.push(`${at} 한국어 뜻이 없음`);
      /* ★ 틀린 보기마다 왜 틀렸는지 ★ 정답만 알려 주면 다음에 또 틀린다 */
      for (const o of it.options || []) {
        if (o !== it.answer && !it.why?.[o]) bad.push(`${at} 「${o}」가 왜 틀렸는지 안 적음`);
      }
    }
  }
  return bad;
}
