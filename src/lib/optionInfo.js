/* 객관식 보기 하나하나의 읽기 · 뜻 · 듣기.
 *
 * 정답은 아는데 「다른 보기는 뭐였지」가 궁금한 때가 있다. 답을 내기 전에 보여 주면
 * 답이 새니, 답을 낸 뒤에 보기마다 일본어 · 읽기 · 뜻 · 소리를 한 줄씩 붙인다.
 *
 * 줄 하나의 모양: { jp, kana, ko, tone }
 *   jp    일본어 표기 (없을 수 있다)
 *   kana  읽기 (표기와 같으면 비운다)
 *   mute  true면 소리를 내지 않는다(실제로 없는 말)
 *   say   소리로 낼 말 (읽기와 달리 보일 때만. 없으면 kana → jp 순)
 *   ko    한국어 뜻 (없을 수 있다)
 *   tone  'correct' 정답 · 'mine' 내가 고른 틀린 답 · '' 그 밖의 보기
 *
 * 문제를 만드는 쪽이 보기마다 정확한 정보를 알면 그대로 넘기고(wordInfo/sentenceInfo),
 * 모르는 문법·독해 보기는 글자만 보고 일본어면 소리만, 한국어면 뜻으로 둔다(textInfo). */

const JA = /[぀-ヿ㐀-鿿]/;
export const hasJapanese = (s) => JA.test(String(s || ''));

const clean = (v) => (v == null ? '' : String(v)).trim();

export function wordInfo(w) {
  if (!w) return null;
  const jp = clean(w.kanji);
  const kana = clean(w.kana);
  return { jp, kana: kana && kana !== jp ? kana : '', ko: clean(w.mean) };
}

export function sentenceInfo(s) {
  if (!s) return null;
  const jp = clean(s.kanji);
  const kana = clean(s.kana);
  return { jp, kana: kana && kana !== jp ? kana : '', ko: clean(s.mean) };
}

/* 정보가 따로 없는 보기 — 글자만 보고 나눈다. */
export function textInfo(text) {
  const t = clean(text);
  if (!t) return null;
  return hasJapanese(t) ? { jp: t, kana: '', ko: '' } : { jp: '', kana: '', ko: t };
}

/* 보기 목록과 (있으면) 같은 순서의 정보를 합쳐 화면에 그릴 줄로 만든다.
 * isCorrect(i) / isMine(i)로 어느 줄이 정답이고 내가 고른 것인지 표시한다. */
export function reviewRows(options, infos, { isCorrect, isMine } = {}) {
  return (options || []).map((o, i) => {
    const raw = (Array.isArray(infos) ? infos[i] : null) || textInfo(typeof o === 'string' ? o : o?.label);
    if (!raw) return null;
    const tone = isCorrect?.(i) ? 'correct' : (isMine?.(i) ? 'mine' : '');
    return { ...raw, tone, n: i + 1 };
  }).filter((r) => r && (r.jp || r.ko));
}

/* i번째 보기(0부터)의 줄. reviewRows는 정보가 없는 보기를 빼서 순서가 어긋날 수 있으니 번호(n)로 찾는다. */
export const rowOf = (rows, i) => (rows || []).find((r) => r.n === i + 1) || null;

/* 소리로 낼 말 — 읽기가 있으면 읽기, 없으면 표기. 한자를 그대로 넘기면 엔진이 제멋대로 읽는다. */
export const speakText = (row) => (row?.mute ? '' : (clean(row?.say) || clean(row?.kana) || clean(row?.jp)));
