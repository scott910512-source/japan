/* 카드를 보다가 떠오른 걸 물어보는 자리.
 *
 * 「食べる가 나왔네. 그럼 食べている는 뭐지?」 — 공부하다 보면 카드에 없는 게
 * 궁금해진다. 지금까지는 앱을 나가서 찾아봐야 했고, 나갔다가 안 돌아온다.
 *
 * 답을 알려주는 도구가 아니다. 곁가지를 물어보는 도구다. 그래서 화면에서는
 * 카드를 뒤집은 뒤에만 열린다(예문 보기와 같은 규칙) — 「이거 뜻이 뭐야」로
 * 우회하는 길을 막아 두면 시험 점수가 실력을 재는 숫자로 남는다.
 *
 * 부르는 건 aiClient가 한다. 여기는 무엇을 물어볼지와, 받은 걸 어떤 모양으로
 * 넘길지만 정한다. */

import { FAST_GEMINI_MODEL, PROVIDERS, callClaude, callGemini, resolveProvider } from './aiClient.js';

export const MAX_QUESTION_CHARS = 200;
export const MAX_ITEMS = 4;
export const KEEP_ASKS = 40;   // 최근 것만 남긴다. 학습 기록을 밀어내면 안 된다
export const MAX_KANJI = 4;    // 한자 설명에 담는 글자 수
export const MAX_TIPS = 3;     // 외우는 법 추천 수

/* ── 눌러서 묻는 두 가지 ──
   한자 설명 · 외우는 법은 자주 묻는 것이라 단추로 둔다. 단추는 정해 둔 글로 묻기만 한다 — 같은 길(ask)로 가고 같은 기록에 남는다. */
export const ASK_PRESET = { KANJI: 'kanji', MEMO: 'memo' };
export const hasKanji = (s) => /[\u3400-\u9fff々]/.test(String(s || ''));
export function presetQuestion(kind, target) {
  const t = String(target || '').trim();
  if (!t) return '';
  if (kind !== ASK_PRESET.KANJI) return `「${t}」 외우는 법을 추천해 줘`;
  /* 한자를 몰라서 묻는 것이다 — 한글(지하철)이나 가나로 적어도 그 낱말의 일본어 한자를 찾아 설명해 준다 */
  return hasKanji(t) ? `「${t}」의 한자를 설명해 줘` : `「${t}」를 일본어 한자로 어떻게 쓰는지, 그 한자를 설명해 줘`;
}

/* 제일 나쁜 건 틀린 일본어를 자신 있게 가르치는 것이다. 그걸 그대로 외우면
 * 앱이 도움이 아니라 손해가 된다. 그래서 프롬프트가 제일 힘주는 곳은
 * 「모르면 모른다고 해라」다.
 *
 * 두 번째로 힘주는 곳은 길이다. 공부하다 잠깐 곁길로 새는 거라, 화면 세 번
 * 넘기는 글이 오면 안 읽고 닫는다. */
export const SYSTEM = `당신은 한국인 일본어 학습자를 돕는 선생님입니다.
학습자가 단어 카드를 공부하다가 떠오른 걸 물어봅니다.

지키세요.
- 한국어로 답합니다.
- 짧게. answer는 세 문장을 넘기지 마세요. 사전을 베끼지 말고, 물어본 것만 답합니다.
- 확실하지 않으면 확실하지 않다고 적으세요. 그럴듯하게 지어내지 마세요.
  틀린 일본어를 자신 있게 가르치는 것이 제일 나쁩니다.
- ★ 일본어 읽기와 한국 한자음을 섞지 마세요 ★
  일본어 낱말은 언제나 한자(가나) 꼴로 적습니다 — 大切(たいせつ). 일본어 낱말을 한국 한자음으로 옮겨 「대절」처럼 한글 낱말인 것처럼 부르지 마세요
  (한국어에 없는 말이고, 옮기다 틀리기 쉽습니다). 한국 한자음을 꼭 말해야 하면 「한국 한자음으로는 대절」처럼 이름표를 붙이고, 확실하지 않으면 적지 않습니다.
  일본어 발음을 한글로 옮겨 적을 때도 「일본어 발음 타이세쓰」처럼 무엇인지 밝힙니다.
- 학습자는 지금 공부 중입니다. 인사말·격려·"좋은 질문이에요" 같은 말은 빼고
  바로 답만 합니다.
- 학습자는 앱의 길잡이 캐릭터에게 말을 걸듯 물을 수도 있습니다([길잡이]에 이름이 옵니다).
  가벼운 잡담이나 길잡이에 대한 질문(좋아하는 것, 명대사, 오늘 기분 등)은 거절하지 마세요.
  그 길잡이의 말투로 한두 문장만 가볍게 답하고, 답에 어울리는 짧은 일본어 한마디를 items에 담아
  공부로 이어 줍니다. 원작의 대사를 그대로 옮기려 하지 마세요(틀리게 옮기기 쉽습니다).
  「내가 자주 하는 말」처럼 공부를 응원하는 한마디를 일본어로 새로 지어 답합니다.
- 일본어 공부와 아무 상관 없는 일을 시키면(숙제 대필, 코드 작성, 긴 글쓰기 등) answer에 한 줄로
  여기는 일본어 공부를 돕는 자리라고 말하고 items는 비웁니다.

[요청]에 「한자 설명」이 오면(학습자가 「한자 설명」 단추를 누른 것입니다) kanji 칸을 채웁니다. 낱말에 든 한자를 글자마다 하나씩, 많아야 ${MAX_KANJI}글자.
낱말이 한글(지하철)이나 가나(ちかてつ)로만 왔으면, 먼저 그 뜻의 일본어 낱말을 한자로 어떻게 쓰는지 찾아 items 첫 칸에 담고(jp 地下鉄 · kana ちかてつ · ko 지하철)
그 낱말의 한자를 글자마다 설명합니다. answer에는 「지하철은 일본어로 地下鉄(ちかてつ)라고 써요」처럼 한 줄로 알려 줍니다.
보통 한자로 쓰지 않는 낱말이면 kanji는 비우고 answer에 그렇다고 적습니다. 어느 낱말인지 확실하지 않으면 지어내지 말고 확실하지 않다고 적습니다.
[요청]에 「한자 설명」이 없으면 질문에 한자 이야기가 나와도 kanji는 빈 배열로 두고, 물어본 것만 answer로 짧게 답합니다.
- char: 그 한자 한 글자.
- hanja: 한국에서 읽는 뜻과 소리(훈음). 예: 「익힐 습」. 뜻 다음에 소리 한 글자로 끝냅니다. 일본 글자꼴이 한국에서 쓰는 정자와 다르면 정자를 괄호로 덧붙입니다(学 → 「배울 학(學)」).
  소리가 여럿인 글자는 이 낱말의 뜻에 맞는 대표 훈음을 적습니다(切 → 「끊을 절」). 이것은 한국어 소리이지 일본어 발음이 아닙니다.
- on: 일본어 음독을 가타카나로(タイ · ダイ). 없으면 빈 글.
- kun: 일본어 훈독을 히라가나로, 보내는 가나는 괄호로(おお(きい)). 없으면 빈 글.
- korean: 한국어에서도 같은 한자를 쓰는지, 쓰면 대표 낱말 두세 개를 한글과 한자로 함께(학습(學習) · 연습(練習)).
  한국어에서 안 쓰는 글자(일본에서 만든 글자 등)면 그렇다고 적습니다.
- parts: 글자의 짜임 — 부수와 나머지 부분이 무엇이고 각각 무슨 뜻인지. 어원은 널리 알려진 풀이만 「~라고 풀이해요」로 전하고,
  모르면 짜임만 적습니다. 지어내지 마세요.
- more: 덧붙일 것 한두 문장 — 헷갈리기 쉬운 글자, 이 낱말에서의 뜻. (읽는 법은 on · kun 칸에 적었으니 되풀이하지 않습니다.)
- word 칸에는 설명한 일본어 낱말을 적습니다: jp는 한자 표기(大切), kana는 일본어로 읽는 법 전체(たいせつ).
- 이때 answer에는 한 줄 요약만 씁니다. 낱말은 大切(たいせつ)처럼 한자(가나)로 적습니다.

외우는 법을 물으면 tips 칸에 2~${MAX_TIPS}개를 권합니다. 하나에 한두 문장, 짧고 입에 붙게.
- kind는 「소리」(일본어 소리를 비슷한 한국말에 걸기) · 「한자」(글자의 짜임이나 한국 한자어에 걸기) · 「묶기」(이미 아는 낱말 · 반대말 · 장면과 묶기) 중 하나.
- 뜻과 소리가 함께 떠오르게 만듭니다. 억지스러워도 짧은 쪽이 낫습니다.
  예: ならう(習う, 배우다) → 「배울 사람 나라우(나와라)!」 하고 부르면 배우다.
- 이때 answer에는 그중 무엇을 제일 권하는지 한 줄로 씁니다.

「한자 설명」 요청이 아니면 kanji는 언제나 빈 배열이고 word는 넣지 않습니다. 외우는 법을 묻지 않았으면 tips도 빈 배열로 둡니다.

items에는 답에 나온 일본어 표현만 담습니다. 0개여도 됩니다.
- 물어본 표현, 비교 대상, 예문 — 학습자가 눈으로 보고 소리로 들어야 하는 것만.
- 설명하려고 꺼낸 말을 전부 나열하지 마세요. 많아야 ${MAX_ITEMS}개입니다.
- kana는 그 표현 전체의 읽는 법입니다. 한자마다 쪼개지 마세요.

아래 JSON 하나만 출력하세요. 마크다운 펜스나 다른 텍스트를 붙이지 마세요.
{
  "answer": "食べている는 食べる의 진행형이에요. 「먹고 있다」처럼 지금 하는 중인 동작을 나타냅니다. 회화에서는 줄여서 食べてる라고도 해요.",
  "items": [
    { "jp": "食べている", "kana": "たべている", "ko": "먹고 있다", "note": "지금 먹는 중" },
    { "jp": "食べてる", "kana": "たべてる", "ko": "먹고 있어", "note": "회화에서 줄인 말" }
  ],
  "kanji": [],
  "tips": []
}

한자 설명일 때 kanji 한 칸의 모양:
{ "char": "習", "hanja": "익힐 습", "on": "シュウ", "kun": "なら(う)", "korean": "한국어에서도 써요: 학습(學習) · 연습(練習) · 습관(習慣)", "parts": "羽(깃 우) + 白(흰 백). 어린 새가 날갯짓을 되풀이하는 모습이라고 풀이해요.", "more": "되풀이해서 몸에 익힌다는 뜻이에요." }
한자 설명일 때 word 칸의 모양(kanji · tips와 같은 높이에 둡니다):
"word": { "jp": "習う", "kana": "ならう" }
외우는 법일 때 tips 한 칸의 모양:
{ "kind": "소리", "text": "「배울 사람 나라우(나와라)!」 하고 부르면 배우다." }`;

/* 무엇을 보고 물어보는지 같이 보낸다.
 *
 * 이게 없으면 「이거 언제 써?」 같은 말이 안 통한다. 카드를 보면서 묻는 건데
 * 카드를 안 보내면 학습자만 아는 걸 물어보는 셈이 된다. */
export function userText(question, cardIn = {}, guideName = '', preset = '') {
  /* 카드 없이 묻는 길(곤에게 물어보기)이 있어 null도 온다 — 기본값은 undefined만 받는다 */
  const card = cardIn || {};
  const lines = [];
  /* 누구에게 말을 거는지 — 「너의 명대사는 뭐야」의 「너」가 누구인지 모델이 알아야 한다 */
  if (guideName) { lines.push(`[길잡이] ${guideName}`); lines.push(''); }
  if (card.kanji || card.kana) {
    lines.push(`[지금 보는 카드] ${card.kanji || card.kana}` +
      `${card.kana && card.kana !== card.kanji ? ` (${card.kana})` : ''}` +
      `${card.mean ? ` — ${card.mean}` : ''}` +
      `${card.level ? ` · ${card.level}` : ''}`);
    if (card.example) lines.push(`[카드 예문] ${card.example}${card.exampleKo ? ` / ${card.exampleKo}` : ''}`);
    lines.push('');
  }
  /* 글자마다 풀어 주는 한자 설명은 단추를 눌렀을 때만 한다 — 그냥 물은 것에는 물은 것만 답한다 */
  if (preset === ASK_PRESET.KANJI) lines.push('[요청] 한자 설명');
  lines.push(`[질문] ${String(question).trim()}`);
  return lines.join('\n');
}

/* 모델이 펜스를 붙이거나 앞뒤에 말을 얹는 경우가 있다 — 번역기에서 겪은 그대로다. */
export function parseAsk(text) {
  if (!text) throw new Error('빈 응답');
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { data = JSON.parse(trimmed.slice(start, end + 1)); } catch { /* 아래에서 */ }
    }
    if (!data) throw new Error('답을 읽지 못했어요');
  }
  return shapeAsk(data);
}

/* 모양을 여기서 고정한다. 빠진 칸이 있으면 화면에서 매번 확인해야 하고,
   한 군데라도 빠뜨리면 흰 화면이 된다. */
export function shapeAsk(data = {}) {
  const seen = new Set();
  const items = (Array.isArray(data.items) ? data.items : [])
    .filter((it) => it && it.jp && !seen.has(it.jp) && seen.add(it.jp))
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      jp: String(it.jp),
      kana: String(it.kana || it.jp),
      ko: String(it.ko || ''),
      note: String(it.note || ''),
    }));
  const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
  const seenChar = new Set();
  const kanji = (Array.isArray(data.kanji) ? data.kanji : [])
    .filter((k) => k && str(k.char) && !seenChar.has(str(k.char)) && seenChar.add(str(k.char)))
    .slice(0, MAX_KANJI)
    .map((k) => ({ char: str(k.char, 4), hanja: str(k.hanja, 60), on: str(k.on, 60), kun: str(k.kun, 80), korean: str(k.korean), parts: str(k.parts), more: str(k.more) }))
    .filter((k) => k.hanja || k.on || k.kun || k.korean || k.parts || k.more);
  /* 설명한 낱말 — 일본어 읽기(kana)와 한국 한자음(eum)을 따로 보여 주려고 받는다. 한국 한자음은 모델이 지어내지 않게
     글자마다 받은 훈음에서 여기서 만든다(hanjaEum) */
  const w = data.word && typeof data.word === 'object' ? { jp: str(data.word.jp, 40), kana: str(data.word.kana, 60) } : null;
  const word = kanji.length && w && w.jp ? { ...w, eum: hanjaEum(w.jp, kanji) } : null;
  const KINDS = ['소리', '한자', '묶기'];
  const tips = (Array.isArray(data.tips) ? data.tips : [])
    .filter((t) => t && str(t.text))
    .slice(0, MAX_TIPS)
    .map((t) => ({ kind: KINDS.includes(str(t.kind)) ? str(t.kind) : '', text: str(t.text, 300) }));
  return { answer: String(data.answer || '').trim(), items, kanji, tips, word };
}

/* ★ 한국 한자음은 글자마다의 훈음에서 만든다 ★
 * 모델에게 낱말 전체의 한국 한자음을 물으면 틀리게 옮긴다(大切를 「대체」라고 했다). 글자마다 받은 훈음(「큰 대」 · 「끊을 절」)의
 * 마지막 소리를 이어 붙이면 카드에 보이는 것과 언제나 같다. 한자가 아닌 글자(가나)는 건너뛰고, 훈음을 못 받은 한자가 하나라도 있으면
 * 만들지 않는다(반쪽짜리 소리를 보이면 그것이 낱말인 줄 안다). */
export function eumOf(hanja) {
  const m = /([가-힣])\s*(?:[(（].*)?$/.exec(String(hanja || '').trim());
  return m ? m[1] : '';
}
export function hanjaEum(jp, kanji = []) {
  const by = new Map(kanji.map((k) => [k.char, eumOf(k.hanja)]));
  let out = '';
  for (const ch of [...String(jp || '')]) {
    if (!hasKanji(ch)) continue;
    const e = by.get(ch);
    if (!e) return '';
    out += e;
  }
  return out;
}

/* 같은 걸 두 번 물어보면 요금만 두 번 나간다. 그리고 비행기 모드에서도
   아까 받은 건 다시 볼 수 있어야 한다 — 번역기와 같은 이유다. */
export function askKey(cardId, question) {
  return `${cardId || '-'}|${String(question).trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/* 예전 규칙이 「관계없는 질문입니다」로 돌려보낸 답은 다시 꺼내 쓰지 않는다 —
   규칙을 풀었는데 저장해 둔 거절이 계속 나오면 고친 것이 안 보인다. */
const OLD_REFUSAL = /관계\s*없는 질문/;
export function findAsk(history = [], cardId, question) {
  const key = askKey(cardId, question);
  const hit = history.find((h) => h.key === key) || null;
  if (hit && !(hit.items?.length) && OLD_REFUSAL.test(hit.answer || '')) return null;
  return hit;
}

export function rememberAsk(history = [], entry) {
  const rest = history.filter((h) => h.key !== entry.key);
  return [entry, ...rest].slice(0, KEEP_ASKS);
}

/* 물어본다. 어느 제공처든 같은 모양으로 돌려준다. */
export async function ask(question, card, settings = {}, { guideName = '', preset = '' } = {}) {
  const q = String(question || '').trim();
  if (!q) throw new Error('궁금한 걸 적어 주세요');
  if (q.length > MAX_QUESTION_CHARS) {
    throw new Error(`질문이 너무 길어요 (${MAX_QUESTION_CHARS}자까지)`);
  }

  const { provider, apiKey, model } = resolveProvider(settings);
  if (!apiKey) throw new Error('설정에서 AI 키를 넣어 주세요');

  const args = { apiKey, model, system: SYSTEM, user: userText(q, card, guideName, preset) };
  const text = provider === PROVIDERS.CLAUDE
    ? await callClaude({ ...args, maxTokens: 1800 })
    /* 답은 짧지만 Gemini 2.5는 생각하는 토큰도 이 한도에서 깎아 먹는다.
       빠듯하게 잡으면 생각하다 한도를 다 써서 빈 답이 온다. */
    : await callGemini({ ...args, model: model || FAST_GEMINI_MODEL, maxTokens: 8192 });

  const shaped = parseAsk(text);
  /* 「한자 설명」 단추로 묻지 않았으면 글자별 풀이는 받지 않는다(모델이 알아서 붙여도 버린다) */
  if (preset !== ASK_PRESET.KANJI) { shaped.kanji = []; shaped.word = null; }
  /* 한자 설명 · 외우는 법은 칸에 내용이 있으면 한 줄 요약이 빠져도 받는다 */
  if (!shaped.answer && !shaped.kanji.length && !shaped.tips.length) throw new Error('답이 비어서 왔어요. 다시 물어봐 주세요');
  return shaped;
}
