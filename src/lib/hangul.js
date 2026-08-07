/* 가나 → 한글 근사 발음 변환.
 * 히라가나를 아직 못 읽는 초보가 카드를 그림처럼 보고 넘기는 것을 막기 위한 보조 표기다.
 * 장음·촉음은 한글로 정확히 옮길 수 없으므로 어디까지나 근사값이며, 음성 재생과 함께 써야 한다. */

const BASE = {
  あ: '아', い: '이', う: '우', え: '에', お: '오',
  か: '카', き: '키', く: '쿠', け: '케', こ: '코',
  さ: '사', し: '시', す: '스', せ: '세', そ: '소',
  た: '타', ち: '치', つ: '츠', て: '테', と: '토',
  な: '나', に: '니', ぬ: '누', ね: '네', の: '노',
  は: '하', ひ: '히', ふ: '후', へ: '헤', ほ: '호',
  ま: '마', み: '미', む: '무', め: '메', も: '모',
  や: '야', ゆ: '유', よ: '요',
  ら: '라', り: '리', る: '루', れ: '레', ろ: '로',
  わ: '와', を: '오',
  が: '가', ぎ: '기', ぐ: '구', げ: '게', ご: '고',
  ざ: '자', じ: '지', ず: '즈', ぜ: '제', ぞ: '조',
  だ: '다', ぢ: '지', づ: '즈', で: '데', ど: '도',
  ば: '바', び: '비', ぶ: '부', べ: '베', ぼ: '보',
  ぱ: '파', ぴ: '피', ぷ: '푸', ぺ: '페', ぽ: '포',
  ぁ: '아', ぃ: '이', ぅ: '우', ぇ: '에', ぉ: '오',
};

// 요음 — 앞 글자와 묶어서 한 음절로 읽는다
const YOUON = {
  きゃ: '캬', きゅ: '큐', きょ: '쿄',
  しゃ: '샤', しゅ: '슈', しょ: '쇼',
  ちゃ: '차', ちゅ: '츄', ちょ: '초',
  にゃ: '냐', にゅ: '뉴', にょ: '뇨',
  ひゃ: '햐', ひゅ: '휴', ひょ: '효',
  みゃ: '먀', みゅ: '뮤', みょ: '묘',
  りゃ: '랴', りゅ: '류', りょ: '료',
  ぎゃ: '갸', ぎゅ: '규', ぎょ: '교',
  じゃ: '자', じゅ: '주', じょ: '조',
  ぢゃ: '자', ぢゅ: '주', ぢょ: '조',
  びゃ: '뱌', びゅ: '뷰', びょ: '뵤',
  ぴゃ: '퍄', ぴゅ: '퓨', ぴょ: '표',
  てぃ: '티', でぃ: '디', ふぁ: '파', ふぃ: '피', ふぇ: '페', ふぉ: '포',
  うぃ: '위', うぇ: '웨', うぉ: '워', ヴぁ: '바',
};

const HANGUL_BASE = 0xac00;
const JONG = { ㄴ: 4, ㅅ: 19, ㅇ: 21, ㅁ: 16 };

// 이미 만들어진 음절에 받침을 붙인다. 받침이 이미 있으면 그대로 둔다.
function addBatchim(syllable, jong) {
  if (!syllable) return syllable;
  const code = syllable.charCodeAt(syllable.length - 1) - HANGUL_BASE;
  if (code < 0 || code > 11171 || code % 28 !== 0) return syllable;
  return syllable.slice(0, -1) + String.fromCharCode(HANGUL_BASE + code + jong);
}

// 가타카나를 히라가나로 옮겨 같은 표를 쓴다
function toHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function kanaToHangul(input) {
  if (!input) return '';
  const kana = toHiragana(input);
  let out = '';

  for (let i = 0; i < kana.length; i++) {
    const pair = kana.slice(i, i + 2);
    if (YOUON[pair]) {
      out += YOUON[pair];
      i++;
      continue;
    }

    const ch = kana[i];

    if (ch === 'ん') {
      // ㅁ 받침이 더 가까운 자리(ば·ぱ·ま행 앞)는 따로 처리
      const next = kana[i + 1] || '';
      const jong = /[ばびぶべぼぱぴぷぺぽまみむめも]/.test(next) ? JONG.ㅁ : JONG.ㄴ;
      out = addBatchim(out, jong) === out && out ? out + '응' : addBatchim(out, jong);
      continue;
    }
    if (ch === 'っ') {
      out = addBatchim(out, JONG.ㅅ);
      continue;
    }
    if (ch === 'ー') {
      continue; // 장음은 표기로 살리지 않고 음성으로 듣게 한다
    }

    out += BASE[ch] ?? ch;
  }
  return out;
}
