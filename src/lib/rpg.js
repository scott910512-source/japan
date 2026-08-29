/* 일본 생존 — 진행 규칙.
 *
 * 숙련도를 새로 만들지 않는다. 이 앱에는 이미 회독 엔진이 있고, 거기에
 * box·streak·wrongCount·다음 복습일이 다 들어 있다. RPG 표현도 같은
 * 저장소에 같은 모양으로 넣는다.
 *
 * 그래야 실전에서 틀린 「大丈夫です」가 다음 날 오늘의 학습에 약점으로
 * 올라온다 — 별도 코드 없이. 저장소를 따로 만들면 그 연결이 끊기고,
 * 두 벌이 된 숙련도는 반드시 어긋난다. */

import { stateOf, isWeak, shuffled, VERDICT } from './review.js';

/* 문제 형태. 같은 표현을 같은 모양으로 다섯 번 물으면 뜻이 아니라
   보기 자리를 외운다. */
export const FORM = {
  JP_KO: 'jp-ko',      // 일본어 → 뜻
  KO_JP: 'ko-jp',      // 뜻 → 일본어
  LISTEN: 'listen',    // 소리 → 일본어
  REPLY: 'reply',      // 점원 말에 어울리는 답 고르기
};

export const FORM_ASK = {
  [FORM.JP_KO]: '무슨 뜻일까요?',
  [FORM.KO_JP]: '일본어로 뭐라고 할까요?',
  [FORM.LISTEN]: '듣고 골라 보세요',
  [FORM.REPLY]: '뭐라고 답할까요?',
};

export const CHOICES = 3;

/* 체크포인트를 넘는 선. 열에 여덟이면 실전에 나가도 된다. */
export const PASS = 0.8;

/* 힌트를 쓴 만큼 점수가 준다. 쓰는 걸 막지는 않는다 —
   막으면 모르는 채로 찍고, 찍으면 아무것도 안 남는다. */
export const HINT_SCORE = [100, 70, 40];

export function scoreForHints(used) {
  return HINT_SCORE[Math.min(used, HINT_SCORE.length - 1)];
}

/* 숙련도 0~4. 회독의 streak을 그대로 쓴다 — 새 숫자를 만들면 두 벌이 된다. */
export function masteryOf(review, id) {
  const st = stateOf(review, id);
  if (!st.lastSeen) return 0;
  return Math.max(0, Math.min(4, st.streak));
}

export const MASTERY_LABEL = ['처음 봄', '배우는 중', '익숙함', '거의 외움', '외웠음'];

/* 이 표현을 몇 번 물을까.
 *
 * 다 똑같이 반복하면 아는 것에 시간을 버린다. 처음 보는 것과 자꾸 틀리는
 * 것을 더 자주 내고, 익숙해지면 줄인다. 셋에서 다섯 사이. */
export function repsFor(review, id) {
  const st = stateOf(review, id);
  if (isWeak(st)) return 5;
  const m = masteryOf(review, id);
  if (m === 0) return 4;
  if (m <= 2) return 3;
  return 2;
}

/* 오답 보기를 고른다. 같은 스테이지 안에서 뽑아야 헷갈릴 만한 것이 나온다 —
   엉뚱한 데서 가져오면 눈으로 골라내진다. */
function distractors(target, pool, key, want) {
  const out = [];
  for (const e of shuffled(pool)) {
    if (e.id === target.id) continue;
    if (e[key] === target[key]) continue;      // 같은 글자면 두 개가 정답이 된다
    if (out.some((x) => x[key] === e[key])) continue;
    out.push(e);
    if (out.length >= want) break;
  }
  return out;
}

/* 문제 하나. 화면은 이 모양만 그리면 된다. */
function question(form, target, pool, seed) {
  const key = form === FORM.KO_JP || form === FORM.LISTEN ? 'jp' : 'ko';
  const wrong = distractors(target, pool, key, CHOICES - 1);
  if (wrong.length < CHOICES - 1) return null;

  const options = [target, ...wrong].map((e) => ({
    id: e.id,
    text: form === FORM.KO_JP || form === FORM.LISTEN ? e.jp : e.ko,
  }));
  // 정답이 늘 첫 칸이면 그 자리만 외운다
  const at = ((seed % options.length) + options.length) % options.length;
  const rotated = [...options.slice(options.length - at), ...options.slice(0, options.length - at)];

  return {
    key: `${target.id}:${form}:${seed}`,
    form,
    exprId: target.id,
    ask: FORM_ASK[form],
    prompt: form === FORM.JP_KO ? target.jp : form === FORM.KO_JP ? target.ko : '',
    speak: target.kana || target.jp,
    answerId: target.id,
    options: rotated,
    expr: target,
  };
}

/* 점원 말에 답하는 문제. 실전과 같은 모양이라 여기서 익숙해져야 한다. */
function replyQuestion(scene, seed) {
  const ok = scene.choices.filter((c) => c.ok);
  const no = scene.choices.filter((c) => !c.ok);
  if (!ok.length || !no.length) return null;
  const options = shuffled(scene.choices).map((c) => ({ id: c.jp, text: c.jp, ok: c.ok, why: c.why }));
  return {
    key: `${scene.id}:reply:${seed}`,
    form: FORM.REPLY,
    exprId: ok[0].uses?.[0] || null,
    ask: FORM_ASK[FORM.REPLY],
    prompt: scene.npc.jp,
    speak: scene.npc.kana || scene.npc.jp,
    npc: scene.npc,
    options,
    scene,
  };
}

/* 반복 학습 한 판을 짠다.
 *
 * 형태를 돌려 가며 낸다. 그리고 앞쪽은 쉬운 것(일본어→뜻)으로 연다 —
 * 시작하자마자 모르는 게 나오면 그날은 거기서 끝난다. */
export function buildDrill(stage, review, { canListen = true, seed = 0 } = {}) {
  const pool = stage.expressions;
  if (pool.length < CHOICES) return [];

  const forms = [FORM.JP_KO, FORM.KO_JP, ...(canListen ? [FORM.LISTEN] : [])];
  const out = [];
  let n = seed;

  // 표현마다 정해진 횟수만큼, 형태를 바꿔 가며
  for (const e of pool) {
    const reps = repsFor(review, e.id);
    for (let i = 0; i < reps; i++) {
      const q = question(forms[(n + i) % forms.length], e, pool, n + i);
      if (q) out.push(q);
      n++;
    }
  }

  /* 점원 말에 답하는 문제도 섞는다. 실전이 그 모양이라, 여기서 한 번도
     안 해 보고 나가면 실전에서 처음 보는 형식을 만난다. */
  for (const sc of stage.scenes.slice(0, 3)) {
    const q = replyQuestion(sc, n++);
    if (q) out.push(q);
  }

  /* 섞되 앞 두 개는 「일본어 → 뜻」으로 연다 */
  const easy = out.filter((q) => q.form === FORM.JP_KO);
  const rest = shuffled(out.filter((q) => q.form !== FORM.JP_KO || !easy.slice(0, 2).includes(q)));
  const head = shuffled(easy).slice(0, 2);
  const body = shuffled([...easy.filter((q) => !head.includes(q)), ...rest.filter((q) => !head.includes(q))]);
  return [...head, ...body];
}

/* 틀린 문제를 다시 낸다 — 같은 모양으로는 안 낸다.
 * 그대로 또 물으면 답을 외우지 뜻을 외우지 않는다. */
export function reask(q, stage, review, seed = 0) {
  const forms = [FORM.JP_KO, FORM.KO_JP, FORM.LISTEN].filter((f) => f !== q.form);
  for (const f of shuffled(forms)) {
    const made = question(f, q.expr || stage.expressions.find((e) => e.id === q.exprId), stage.expressions, seed);
    if (made) return made;
  }
  return null;
}

/* 체크포인트 — 짧게. 다섯에서 열 문제. */
export function buildCheckpoint(stage, review, { only = null, seed = 0 } = {}) {
  const pool = only?.length
    ? stage.expressions.filter((e) => only.includes(e.id))
    : stage.expressions;
  /* 오답 보기는 스테이지 전체에서 가져오니, 다시 볼 표현이 한둘이어도 문제는
     만들어진다. 여기서 pool 크기로 막으면 체크포인트에 떨어져 「틀린 것만
     다시」로 들어갔을 때 문제가 0개가 되어 재학습이 빈 화면이 된다. */
  if (!pool.length || stage.expressions.length < CHOICES) return [];

  const forms = [FORM.JP_KO, FORM.KO_JP];
  const out = [];
  let n = seed;
  for (const e of shuffled(pool)) {
    const q = question(forms[n % forms.length], e, stage.expressions, n);
    if (q) out.push(q);
    n++;
    if (out.length >= 10) break;
  }
  return out;
}

export function passed(right, total) {
  if (!total) return false;
  return right / total >= PASS;
}

/* 실전 결과. 정답률·힌트·연속 정답을 등급으로 바꾼다 —
   숫자만 던지면 잘한 건지 모른다. */
export function gradeOf(rate) {
  if (rate >= 0.95) return 'S';
  if (rate >= 0.85) return 'A';
  if (rate >= 0.7) return 'B';
  if (rate >= 0.5) return 'C';
  return 'D';
}

export function expFor({ score, combo, hints }) {
  const base = Math.round(score);
  const bonus = combo >= 3 ? combo * 10 : 0;
  return Math.max(10, base + bonus - hints * 5);
}

/* 레벨. 100씩 올린다 — 계산이 눈에 보여야 속는 기분이 안 든다. */
export const EXP_PER_LEVEL = 300;
export function levelOf(exp = 0) {
  return Math.max(1, Math.floor(exp / EXP_PER_LEVEL) + 1);
}
export function levelProgress(exp = 0) {
  return Math.round(((exp % EXP_PER_LEVEL) / EXP_PER_LEVEL) * 100);
}

/* 실전에서 틀렸거나 힌트를 쓴 표현을 회독 기록으로 넘긴다.
 *
 * 잘한 것을 「알아요」로 올리지는 않는다. 셋 중에 고르는 건 알아본 것이지
 * 떠올린 게 아니다 — 그걸 알아요로 세면 복습 간격이 실력보다 빨리 벌어진다.
 * 못한 것만 넘긴다. 그게 이 기능이 회독에 보태는 값이다. */
export function verdictsFrom(result) {
  const out = {};
  for (const id of result.wrong || []) out[id] = VERDICT.UNKNOWN;
  for (const id of result.hinted || []) if (!out[id]) out[id] = VERDICT.VAGUE;
  return out;
}

export function stageOf(stages, id) {
  return stages.find((s) => s.id === id) || null;
}
