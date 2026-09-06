/* 일본어 글자를 다루는 규칙 한 곳.
 *
 * 채점(quiz.js)과 말하기 인식(stt.js)이 각자 제 나름의 정규화를 갖고 있었고,
 * 둘 다 같은 실수를 했다 — 장음 기호 ー를 지운 것이다. 그래서 ビール의 답으로
 * ビル을 쳐도 정답이 됐다. 「맥주」와 「빌딩」이 같은 답이 된 것이다.
 *
 * ★ 이 파일이 지키는 것 ★
 *
 *   1. 단어를 가르는 것은 지운다 → 절대 안 된다
 *      장음(ー) · 촉음(っ) · 작은 가나(ゃゅょぁ…) · 탁음(゛) · 반탁음(゜)
 *      이 다섯은 하나만 달라도 다른 낱말이 된다.
 *        ビール(맥주) / ビル(빌딩)
 *        おばあさん(할머니) / おばさん(아주머니)
 *        きって(우표) / きて(와서)
 *        かがみ(거울) / かかみ(없는 말)
 *
 *   2. 표기 차이는 같게 본다
 *      가타카나 ↔ 히라가나, 전각 ↔ 반각. 소리가 같으니 같은 답이다.
 *
 *   3. 공백과 문장부호 정리는 일본어 정규화와 따로 한다
 *      「띄어쓰기를 틀렸다」로 시험을 떨어뜨리면 받아쓰기가 된다. 그건
 *      문장부호 문제지 일본어 문제가 아니라서, 함수를 갈라 둔다. */

/* ── 표기 맞추기 ── */

// 반각 가타카나 → 전각. ｱ는 ア로, ｶﾞ는 ガ로.
const HALF_KANA = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
const FULL_KANA = 'ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン';

export function widenKana(text) {
  let s = String(text ?? '');
  // 탁점·반탁점이 따로 오는 반각을 먼저 합친다 — ﾋﾞ는 ヒ + ﾞ 두 글자다
  s = s.replace(/([ｶ-ﾄﾊ-ﾎｳ])ﾞ/g, (_, c) => {
    const at = HALF_KANA.indexOf(c);
    return at < 0 ? c : String.fromCharCode(FULL_KANA.charCodeAt(at) + 1);
  });
  s = s.replace(/([ﾊ-ﾎ])ﾟ/g, (_, c) => {
    const at = HALF_KANA.indexOf(c);
    return at < 0 ? c : String.fromCharCode(FULL_KANA.charCodeAt(at) + 2);
  });
  return s.replace(/[ｦ-ﾝｰ]/g, (c) => {
    const at = HALF_KANA.indexOf(c);
    return at < 0 ? c : FULL_KANA[at];
  });
}

// 전각 영숫자·기호 → 반각. Ａ→A, １→1
export function narrowAscii(text) {
  return String(text ?? '').replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ');
}

/* 가타카나 → 히라가나.
   ヴ(U+30F4)와 ヶ·ヵ는 대응하는 히라가나가 없거나 쓰임이 달라 따로 둔다. */
export function toHiragana(text) {
  return String(text ?? '')
    .replace(/ヴ/g, 'ゔ')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/* ── 지워도 되는 것 ──
 *
 * 여기 ー는 없다. 있으면 안 된다. 이 목록에 무엇을 더할 때는 「그걸 지워도
 * 다른 낱말이 안 되는가」를 먼저 물어야 한다. */
const TRIM_PUNCT = /[\s.,!?'"“”‘’、。．，！？…「」『』（）()［］\[\]〜~・]/g;

export function stripPunct(text) {
  return String(text ?? '').replace(/[（(][^）)]*[）)]/g, '').replace(TRIM_PUNCT, '');
}

/* 채점에 쓰는 표준형. 표기만 맞추고 소리는 그대로 둔다. */
export function normalizeJp(text) {
  return toHiragana(widenKana(narrowAscii(stripPunct(text)))).toLowerCase();
}

/* ── 소리로 견주기 ──
 *
 * 「ビール」을 「びいる」로 적는 사람이 있다. 가타카나는 장음을 ー로, 히라가나는
 * 모음 글자로 늘이는 것뿐이라 소리는 같다 — 같은 답으로 봐야 한다.
 *
 * 그렇다고 ー를 지우면 안 된다. 지우면 びる(빌딩)까지 같아진다. 지우는 게
 * 아니라 앞 글자의 모음으로 펴는 것이다.
 *   びーる → びいる   (ビル → びる 와 여전히 다르다)
 *   おばあさん → 그대로 (모라 수가 애초에 다르다) */
const VOWEL_OF = {
  あ: 'あ', か: 'あ', が: 'あ', さ: 'あ', ざ: 'あ', た: 'あ', だ: 'あ', な: 'あ', は: 'あ', ば: 'あ', ぱ: 'あ', ま: 'あ', や: 'あ', ら: 'あ', わ: 'あ', ゃ: 'あ',
  い: 'い', き: 'い', ぎ: 'い', し: 'い', じ: 'い', ち: 'い', ぢ: 'い', に: 'い', ひ: 'い', び: 'い', ぴ: 'い', み: 'い', り: 'い',
  う: 'う', く: 'う', ぐ: 'う', す: 'う', ず: 'う', つ: 'う', づ: 'う', ぬ: 'う', ふ: 'う', ぶ: 'う', ぷ: 'う', む: 'う', ゆ: 'う', る: 'う', ゅ: 'う', ゔ: 'う',
  え: 'え', け: 'え', げ: 'え', せ: 'え', ぜ: 'え', て: 'え', で: 'え', ね: 'え', へ: 'え', べ: 'え', ぺ: 'え', め: 'え', れ: 'え',
  お: 'お', こ: 'お', ご: 'お', そ: 'お', ぞ: 'お', と: 'お', ど: 'お', の: 'お', ほ: 'お', ぼ: 'お', ぽ: 'お', も: 'お', よ: 'お', ろ: 'お', を: 'お', ょ: 'お',
};

export function expandLongVowels(hira) {
  let out = '';
  for (const ch of String(hira ?? '')) {
    if (ch === 'ー' && out) {
      const v = VOWEL_OF[out[out.length - 1]];
      out += v || 'ー';   // 모르는 글자 뒤면 그대로 둔다 — 함부로 지우지 않는다
      continue;
    }
    out += ch;
  }
  return out;
}

/* 소리가 같은가를 볼 때 쓰는 형태. 표기를 맞추고 장음만 편다. */
export function phoneticJp(text) {
  return expandLongVowels(normalizeJp(text));
}

/* ── 무엇이 달라서 틀렸는가 ──
 *
 * 「한 글자 차이니 오타겠지」로 넘기면 안 되는 자리가 있다. 그 한 글자가
 * 장음·촉음·작은 가나·탁음이면 다른 낱말이다. 틀렸다고만 하지 말고
 * 무엇이 다른지 말해 준다 — 그래야 다음에 안 틀린다. */
const DAKUTEN = 'がぎぐげござじずぜぞだぢづでどばびぶべぼゔ';
const HANDAKU = 'ぱぴぷぺぽ';
const SMALL = 'ぁぃぅぇぉゃゅょゎっ';

export function soundClassOf(ch) {
  if (ch === 'ー') return 'long';
  if (ch === 'っ') return 'sokuon';
  if (SMALL.includes(ch)) return 'small';
  if (DAKUTEN.includes(ch)) return 'dakuten';
  if (HANDAKU.includes(ch)) return 'handakuten';
  return null;
}

const CLASS_NOTE = {
  long: '장음(ー)이 다르면 다른 낱말이에요 — ビール(맥주)과 ビル(빌딩)처럼요.',
  sokuon: '촉음(っ)이 다르면 다른 낱말이에요 — きって(우표)와 きて(와서)처럼요.',
  small: '작은 가나가 다르면 다른 낱말이에요.',
  dakuten: '탁음(゛)이 다르면 다른 낱말이에요.',
  handakuten: '반탁음(゜)이 다르면 다른 낱말이에요.',
  mora: '길이가 다르면 다른 낱말이에요 — おばあさん(할머니)과 おばさん(아주머니)처럼요.',
};

/* 두 일본어가 「소리를 가르는 요소」 때문에 다른가.
   그렇다면 오타로 봐주면 안 되고, 무엇이 다른지 적어 준다. */
export function soundDiff(a, b) {
  const x = normalizeJp(a);
  const y = normalizeJp(b);
  if (x === y) return null;

  /* 길이가 다르면, 빠진 글자가 무엇인지 본다.
     한쪽에만 있는 글자 중 소리를 가르는 게 있으면 그것이 이유다. */
  const long = x.length >= y.length ? x : y;
  const short = x.length >= y.length ? y : x;
  let i = 0;
  for (const ch of long) {
    if (i < short.length && short[i] === ch) { i += 1; continue; }
    const cls = soundClassOf(ch);
    if (cls) return { kind: cls, note: CLASS_NOTE[cls] };
  }
  if (long.length !== short.length) return { kind: 'mora', note: CLASS_NOTE.mora };

  // 길이가 같다면 자리마다 견준다
  for (let k = 0; k < x.length; k += 1) {
    if (x[k] === y[k]) continue;
    const cls = soundClassOf(x[k]) || soundClassOf(y[k]);
    if (cls) return { kind: cls, note: CLASS_NOTE[cls] };
  }
  return null;
}
