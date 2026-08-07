// 완전기초 학습 데이터 — 히라가나/가타카나(청음·탁음·요음), 숫자, 기본 인사
export const HIRAGANA_ROWS = [
  {
    id: 'h-a',
    label: 'あ행',
    chars: [
      { kana: 'あ', romaji: 'a', ko: '아' },
      { kana: 'い', romaji: 'i', ko: '이' },
      { kana: 'う', romaji: 'u', ko: '우' },
      { kana: 'え', romaji: 'e', ko: '에' },
      { kana: 'お', romaji: 'o', ko: '오' },
    ],
  },
  {
    id: 'h-ka',
    label: 'か행',
    chars: [
      { kana: 'か', romaji: 'ka', ko: '카' },
      { kana: 'き', romaji: 'ki', ko: '키' },
      { kana: 'く', romaji: 'ku', ko: '쿠' },
      { kana: 'け', romaji: 'ke', ko: '케' },
      { kana: 'こ', romaji: 'ko', ko: '코' },
    ],
  },
  {
    id: 'h-sa',
    label: 'さ행',
    chars: [
      { kana: 'さ', romaji: 'sa', ko: '사' },
      { kana: 'し', romaji: 'shi', ko: '시' },
      { kana: 'す', romaji: 'su', ko: '스' },
      { kana: 'せ', romaji: 'se', ko: '세' },
      { kana: 'そ', romaji: 'so', ko: '소' },
    ],
  },
  {
    id: 'h-ta',
    label: 'た행',
    chars: [
      { kana: 'た', romaji: 'ta', ko: '타' },
      { kana: 'ち', romaji: 'chi', ko: '치' },
      { kana: 'つ', romaji: 'tsu', ko: '츠' },
      { kana: 'て', romaji: 'te', ko: '테' },
      { kana: 'と', romaji: 'to', ko: '토' },
    ],
  },
  {
    id: 'h-na',
    label: 'な행',
    chars: [
      { kana: 'な', romaji: 'na', ko: '나' },
      { kana: 'に', romaji: 'ni', ko: '니' },
      { kana: 'ぬ', romaji: 'nu', ko: '누' },
      { kana: 'ね', romaji: 'ne', ko: '네' },
      { kana: 'の', romaji: 'no', ko: '노' },
    ],
  },
  {
    id: 'h-ha',
    label: 'は행',
    chars: [
      { kana: 'は', romaji: 'ha', ko: '하' },
      { kana: 'ひ', romaji: 'hi', ko: '히' },
      { kana: 'ふ', romaji: 'fu', ko: '후' },
      { kana: 'へ', romaji: 'he', ko: '헤' },
      { kana: 'ほ', romaji: 'ho', ko: '호' },
    ],
  },
  {
    id: 'h-ma',
    label: 'ま행',
    chars: [
      { kana: 'ま', romaji: 'ma', ko: '마' },
      { kana: 'み', romaji: 'mi', ko: '미' },
      { kana: 'む', romaji: 'mu', ko: '무' },
      { kana: 'め', romaji: 'me', ko: '메' },
      { kana: 'も', romaji: 'mo', ko: '모' },
    ],
  },
  {
    id: 'h-ya',
    label: 'や행',
    chars: [
      { kana: 'や', romaji: 'ya', ko: '야' },
      { kana: 'ゆ', romaji: 'yu', ko: '유' },
      { kana: 'よ', romaji: 'yo', ko: '요' },
    ],
  },
  {
    id: 'h-ra',
    label: 'ら행',
    chars: [
      { kana: 'ら', romaji: 'ra', ko: '라' },
      { kana: 'り', romaji: 'ri', ko: '리' },
      { kana: 'る', romaji: 'ru', ko: '루' },
      { kana: 'れ', romaji: 're', ko: '레' },
      { kana: 'ろ', romaji: 'ro', ko: '로' },
    ],
  },
  {
    id: 'h-wa',
    label: 'わ행',
    chars: [
      { kana: 'わ', romaji: 'wa', ko: '와' },
      { kana: 'を', romaji: 'wo', ko: '오' },
    ],
  },
  {
    id: 'h-n',
    label: 'ん',
    chars: [
      { kana: 'ん', romaji: 'n', ko: 'ㄴ/ㅁ/ㅇ 받침' },
    ],
  },
];

export const KATAKANA_ROWS = [
  {
    id: 'k-a',
    label: 'ア행',
    chars: [
      { kana: 'ア', romaji: 'a', ko: '아' },
      { kana: 'イ', romaji: 'i', ko: '이' },
      { kana: 'ウ', romaji: 'u', ko: '우' },
      { kana: 'エ', romaji: 'e', ko: '에' },
      { kana: 'オ', romaji: 'o', ko: '오' },
    ],
  },
  {
    id: 'k-ka',
    label: 'カ행',
    chars: [
      { kana: 'カ', romaji: 'ka', ko: '카' },
      { kana: 'キ', romaji: 'ki', ko: '키' },
      { kana: 'ク', romaji: 'ku', ko: '쿠' },
      { kana: 'ケ', romaji: 'ke', ko: '케' },
      { kana: 'コ', romaji: 'ko', ko: '코' },
    ],
  },
  {
    id: 'k-sa',
    label: 'サ행',
    chars: [
      { kana: 'サ', romaji: 'sa', ko: '사' },
      { kana: 'シ', romaji: 'shi', ko: '시' },
      { kana: 'ス', romaji: 'su', ko: '스' },
      { kana: 'セ', romaji: 'se', ko: '세' },
      { kana: 'ソ', romaji: 'so', ko: '소' },
    ],
  },
  {
    id: 'k-ta',
    label: 'タ행',
    chars: [
      { kana: 'タ', romaji: 'ta', ko: '타' },
      { kana: 'チ', romaji: 'chi', ko: '치' },
      { kana: 'ツ', romaji: 'tsu', ko: '츠' },
      { kana: 'テ', romaji: 'te', ko: '테' },
      { kana: 'ト', romaji: 'to', ko: '토' },
    ],
  },
  {
    id: 'k-na',
    label: 'ナ행',
    chars: [
      { kana: 'ナ', romaji: 'na', ko: '나' },
      { kana: 'ニ', romaji: 'ni', ko: '니' },
      { kana: 'ヌ', romaji: 'nu', ko: '누' },
      { kana: 'ネ', romaji: 'ne', ko: '네' },
      { kana: 'ノ', romaji: 'no', ko: '노' },
    ],
  },
  {
    id: 'k-ha',
    label: 'ハ행',
    chars: [
      { kana: 'ハ', romaji: 'ha', ko: '하' },
      { kana: 'ヒ', romaji: 'hi', ko: '히' },
      { kana: 'フ', romaji: 'fu', ko: '후' },
      { kana: 'ヘ', romaji: 'he', ko: '헤' },
      { kana: 'ホ', romaji: 'ho', ko: '호' },
    ],
  },
  {
    id: 'k-ma',
    label: 'マ행',
    chars: [
      { kana: 'マ', romaji: 'ma', ko: '마' },
      { kana: 'ミ', romaji: 'mi', ko: '미' },
      { kana: 'ム', romaji: 'mu', ko: '무' },
      { kana: 'メ', romaji: 'me', ko: '메' },
      { kana: 'モ', romaji: 'mo', ko: '모' },
    ],
  },
  {
    id: 'k-ya',
    label: 'ヤ행',
    chars: [
      { kana: 'ヤ', romaji: 'ya', ko: '야' },
      { kana: 'ユ', romaji: 'yu', ko: '유' },
      { kana: 'ヨ', romaji: 'yo', ko: '요' },
    ],
  },
  {
    id: 'k-ra',
    label: 'ラ행',
    chars: [
      { kana: 'ラ', romaji: 'ra', ko: '라' },
      { kana: 'リ', romaji: 'ri', ko: '리' },
      { kana: 'ル', romaji: 'ru', ko: '루' },
      { kana: 'レ', romaji: 're', ko: '레' },
      { kana: 'ロ', romaji: 'ro', ko: '로' },
    ],
  },
  {
    id: 'k-wa',
    label: 'ワ행',
    chars: [
      { kana: 'ワ', romaji: 'wa', ko: '와' },
      { kana: 'ヲ', romaji: 'wo', ko: '오' },
    ],
  },
  {
    id: 'k-n',
    label: 'ン',
    chars: [
      { kana: 'ン', romaji: 'n', ko: 'ㄴ/ㅁ/ㅇ 받침' },
    ],
  },
];

// 탁음·반탁음 (히라가나)
export const DAKUON_ROWS = [
  {
    id: 'h-ga',
    label: 'が행 (탁음)',
    chars: [
      { kana: 'が', romaji: 'ga', ko: '가' },
      { kana: 'ぎ', romaji: 'gi', ko: '기' },
      { kana: 'ぐ', romaji: 'gu', ko: '구' },
      { kana: 'げ', romaji: 'ge', ko: '게' },
      { kana: 'ご', romaji: 'go', ko: '고' },
    ],
  },
  {
    id: 'h-za',
    label: 'ざ행 (탁음)',
    chars: [
      { kana: 'ざ', romaji: 'za', ko: '자' },
      { kana: 'じ', romaji: 'ji', ko: '지' },
      { kana: 'ず', romaji: 'zu', ko: '즈' },
      { kana: 'ぜ', romaji: 'ze', ko: '제' },
      { kana: 'ぞ', romaji: 'zo', ko: '조' },
    ],
  },
  {
    id: 'h-da',
    label: 'だ행 (탁음)',
    chars: [
      { kana: 'だ', romaji: 'da', ko: '다' },
      { kana: 'ぢ', romaji: 'ji', ko: '지' },
      { kana: 'づ', romaji: 'zu', ko: '즈' },
      { kana: 'で', romaji: 'de', ko: '데' },
      { kana: 'ど', romaji: 'do', ko: '도' },
    ],
  },
  {
    id: 'h-ba',
    label: 'ば행 (탁음)',
    chars: [
      { kana: 'ば', romaji: 'ba', ko: '바' },
      { kana: 'び', romaji: 'bi', ko: '비' },
      { kana: 'ぶ', romaji: 'bu', ko: '부' },
      { kana: 'べ', romaji: 'be', ko: '베' },
      { kana: 'ぼ', romaji: 'bo', ko: '보' },
    ],
  },
  {
    id: 'h-pa',
    label: 'ぱ행 (반탁음)',
    chars: [
      { kana: 'ぱ', romaji: 'pa', ko: '파' },
      { kana: 'ぴ', romaji: 'pi', ko: '피' },
      { kana: 'ぷ', romaji: 'pu', ko: '푸' },
      { kana: 'ぺ', romaji: 'pe', ko: '페' },
      { kana: 'ぽ', romaji: 'po', ko: '포' },
    ],
  },
];

// 탁음·반탁음 (가타카나)
export const KATAKANA_DAKUON_ROWS = [
  {
    id: 'k-ga',
    label: 'ガ행 (탁음)',
    chars: [
      { kana: 'ガ', romaji: 'ga', ko: '가' },
      { kana: 'ギ', romaji: 'gi', ko: '기' },
      { kana: 'グ', romaji: 'gu', ko: '구' },
      { kana: 'ゲ', romaji: 'ge', ko: '게' },
      { kana: 'ゴ', romaji: 'go', ko: '고' },
    ],
  },
  {
    id: 'k-za',
    label: 'ザ행 (탁음)',
    chars: [
      { kana: 'ザ', romaji: 'za', ko: '자' },
      { kana: 'ジ', romaji: 'ji', ko: '지' },
      { kana: 'ズ', romaji: 'zu', ko: '즈' },
      { kana: 'ゼ', romaji: 'ze', ko: '제' },
      { kana: 'ゾ', romaji: 'zo', ko: '조' },
    ],
  },
  {
    id: 'k-da',
    label: 'ダ행 (탁음)',
    chars: [
      { kana: 'ダ', romaji: 'da', ko: '다' },
      { kana: 'ヂ', romaji: 'ji', ko: '지' },
      { kana: 'ヅ', romaji: 'zu', ko: '즈' },
      { kana: 'デ', romaji: 'de', ko: '데' },
      { kana: 'ド', romaji: 'do', ko: '도' },
    ],
  },
  {
    id: 'k-ba',
    label: 'バ행 (탁음)',
    chars: [
      { kana: 'バ', romaji: 'ba', ko: '바' },
      { kana: 'ビ', romaji: 'bi', ko: '비' },
      { kana: 'ブ', romaji: 'bu', ko: '부' },
      { kana: 'ベ', romaji: 'be', ko: '베' },
      { kana: 'ボ', romaji: 'bo', ko: '보' },
    ],
  },
  {
    id: 'k-pa',
    label: 'パ행 (반탁음)',
    chars: [
      { kana: 'パ', romaji: 'pa', ko: '파' },
      { kana: 'ピ', romaji: 'pi', ko: '피' },
      { kana: 'プ', romaji: 'pu', ko: '푸' },
      { kana: 'ペ', romaji: 'pe', ko: '페' },
      { kana: 'ポ', romaji: 'po', ko: '포' },
    ],
  },
];

// 요음 (히라가나)
export const YOUON = [
  { kana: 'きゃ', romaji: 'kya', ko: '캬' },
  { kana: 'きゅ', romaji: 'kyu', ko: '큐' },
  { kana: 'きょ', romaji: 'kyo', ko: '쿄' },
  { kana: 'しゃ', romaji: 'sha', ko: '샤' },
  { kana: 'しゅ', romaji: 'shu', ko: '슈' },
  { kana: 'しょ', romaji: 'sho', ko: '쇼' },
  { kana: 'ちゃ', romaji: 'cha', ko: '차' },
  { kana: 'ちゅ', romaji: 'chu', ko: '츄' },
  { kana: 'ちょ', romaji: 'cho', ko: '초' },
  { kana: 'にゃ', romaji: 'nya', ko: '냐' },
  { kana: 'にゅ', romaji: 'nyu', ko: '뉴' },
  { kana: 'にょ', romaji: 'nyo', ko: '뇨' },
  { kana: 'ひゃ', romaji: 'hya', ko: '햐' },
  { kana: 'ひゅ', romaji: 'hyu', ko: '휴' },
  { kana: 'ひょ', romaji: 'hyo', ko: '효' },
  { kana: 'みゃ', romaji: 'mya', ko: '먀' },
  { kana: 'みゅ', romaji: 'myu', ko: '뮤' },
  { kana: 'みょ', romaji: 'myo', ko: '묘' },
  { kana: 'りゃ', romaji: 'rya', ko: '랴' },
  { kana: 'りゅ', romaji: 'ryu', ko: '류' },
  { kana: 'りょ', romaji: 'ryo', ko: '료' },
  { kana: 'ぎゃ', romaji: 'gya', ko: '갸' },
  { kana: 'ぎゅ', romaji: 'gyu', ko: '규' },
  { kana: 'ぎょ', romaji: 'gyo', ko: '교' },
  { kana: 'じゃ', romaji: 'ja', ko: '자' },
  { kana: 'じゅ', romaji: 'ju', ko: '주' },
  { kana: 'じょ', romaji: 'jo', ko: '조' },
  { kana: 'びゃ', romaji: 'bya', ko: '뱌' },
  { kana: 'びゅ', romaji: 'byu', ko: '뷰' },
  { kana: 'びょ', romaji: 'byo', ko: '뵤' },
  { kana: 'ぴゃ', romaji: 'pya', ko: '퍄' },
  { kana: 'ぴゅ', romaji: 'pyu', ko: '퓨' },
  { kana: 'ぴょ', romaji: 'pyo', ko: '표' },
];

// 숫자 — 1~10, 100, 1000, 10000 및 엔(円) 표현
export const NUMBERS = [
  { jp: '一', kana: 'いち', ko: '1, 하나' },
  { jp: '二', kana: 'に', ko: '2, 둘' },
  { jp: '三', kana: 'さん', ko: '3, 셋' },
  { jp: '四', kana: 'よん / し', ko: '4, 넷' },
  { jp: '五', kana: 'ご', ko: '5, 다섯' },
  { jp: '六', kana: 'ろく', ko: '6, 여섯' },
  { jp: '七', kana: 'なな / しち', ko: '7, 일곱' },
  { jp: '八', kana: 'はち', ko: '8, 여덟' },
  { jp: '九', kana: 'きゅう / く', ko: '9, 아홉' },
  { jp: '十', kana: 'じゅう', ko: '10, 열' },
  { jp: '百', kana: 'ひゃく', ko: '100, 백' },
  { jp: '千', kana: 'せん', ko: '1000, 천' },
  { jp: '一万', kana: 'いちまん', ko: '10000, 만' },
  { jp: '百円', kana: 'ひゃくえん', ko: '100엔' },
  { jp: '三百円', kana: 'さんびゃくえん', ko: '300엔 (발음 주의)' },
  { jp: '五百円', kana: 'ごひゃくえん', ko: '500엔' },
  { jp: '六百円', kana: 'ろっぴゃくえん', ko: '600엔 (발음 주의)' },
  { jp: '八百円', kana: 'はっぴゃくえん', ko: '800엔 (발음 주의)' },
  { jp: '千円', kana: 'せんえん', ko: '1000엔' },
  { jp: '三千円', kana: 'さんぜんえん', ko: '3000엔 (발음 주의)' },
  { jp: '五千円', kana: 'ごせんえん', ko: '5000엔' },
  { jp: '一万円', kana: 'いちまんえん', ko: '10000엔' },
];

// 여행에서 바로 쓰는 기본 인사·표현
export const GREETINGS = [
  { jp: 'おはようございます', kana: 'おはようございます', ko: '좋은 아침입니다', note: '아침 인사' },
  { jp: 'こんにちは', kana: 'こんにちは', ko: '안녕하세요', note: '낮 인사' },
  { jp: 'こんばんは', kana: 'こんばんは', ko: '안녕하세요', note: '저녁 인사' },
  { jp: 'ありがとうございます', kana: 'ありがとうございます', ko: '감사합니다', note: '가장 많이 쓰는 감사 표현' },
  { jp: 'すみません', kana: 'すみません', ko: '실례합니다 / 죄송합니다', note: '사과 + 사람을 부를 때 모두 사용' },
  { jp: 'ごめんなさい', kana: 'ごめんなさい', ko: '미안합니다', note: '가벼운 사과' },
  { jp: 'お願いします', kana: 'おねがいします', ko: '부탁합니다', note: '주문·요청할 때' },
  { jp: '大丈夫です', kana: 'だいじょうぶです', ko: '괜찮습니다', note: '거절할 때도 사용' },
  { jp: 'はい / いいえ', kana: 'はい / いいえ', ko: '네 / 아니요', note: '기본 대답' },
  { jp: '分かりました', kana: 'わかりました', ko: '알겠습니다', note: '이해했을 때' },
  { jp: '分かりません', kana: 'わかりません', ko: '모르겠습니다', note: '못 알아들었을 때' },
  { jp: 'いただきます', kana: 'いただきます', ko: '잘 먹겠습니다', note: '식사 전' },
  { jp: 'ごちそうさまでした', kana: 'ごちそうさまでした', ko: '잘 먹었습니다', note: '식사 후' },
  { jp: 'いくらですか', kana: 'いくらですか', ko: '얼마예요?', note: '가격 물을 때' },
  { jp: 'これをください', kana: 'これをください', ko: '이거 주세요', note: '주문·구매의 만능 표현' },
  { jp: 'トイレはどこですか', kana: 'トイレはどこですか', ko: '화장실은 어디예요?', note: '장소를 물을 때' },
  { jp: '日本語が話せません', kana: 'にほんごがはなせません', ko: '일본어를 못 합니다', note: '곤란할 때' },
  { jp: 'もう一度お願いします', kana: 'もういちどおねがいします', ko: '한 번 더 말씀해 주세요', note: '다시 들을 때' },
  { jp: '失礼します', kana: 'しつれいします', ko: '실례하겠습니다', note: '들어가거나 나갈 때' },
  { jp: 'さようなら', kana: 'さようなら', ko: '안녕히 가세요', note: '헤어질 때' },
  { jp: 'また明日', kana: 'またあした', ko: '내일 봐요', note: '가벼운 작별' },
  { jp: 'はじめまして', kana: 'はじめまして', ko: '처음 뵙겠습니다', note: '첫인사' },
];
