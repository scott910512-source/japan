// 기본 수록 단어 — 동사 18 / 명사 7 / 형용사 6
export const DEFAULT_WORDS = [
  // 동사
  { id: 'v-taberu', kanji: '食べる', kana: 'たべる', mean: '먹다', type: 'verb', group: '2' },
  { id: 'v-nomu', kanji: '飲む', kana: 'のむ', mean: '마시다', type: 'verb', group: '1' },
  { id: 'v-hashiru', kanji: '走る', kana: 'はしる', mean: '달리다', type: 'verb', group: '1' },
  { id: 'v-kaeru', kanji: '帰る', kana: 'かえる', mean: '돌아가다', type: 'verb', group: '1' },
  { id: 'v-iku', kanji: '行く', kana: 'いく', mean: '가다', type: 'verb', group: '1' },
  { id: 'v-kuru', kanji: '来る', kana: 'くる', mean: '오다', type: 'verb', group: '3' },
  { id: 'v-suru', kanji: 'する', kana: 'する', mean: '하다', type: 'verb', group: '3' },
  { id: 'v-miru', kanji: '見る', kana: 'みる', mean: '보다', type: 'verb', group: '2' },
  { id: 'v-okiru', kanji: '起きる', kana: 'おきる', mean: '일어나다', type: 'verb', group: '2' },
  { id: 'v-neru', kanji: '寝る', kana: 'ねる', mean: '자다', type: 'verb', group: '2' },
  { id: 'v-hanasu', kanji: '話す', kana: 'はなす', mean: '이야기하다', type: 'verb', group: '1' },
  { id: 'v-yomu', kanji: '読む', kana: 'よむ', mean: '읽다', type: 'verb', group: '1' },
  { id: 'v-kaku', kanji: '書く', kana: 'かく', mean: '쓰다', type: 'verb', group: '1' },
  { id: 'v-kiku', kanji: '聞く', kana: 'きく', mean: '듣다/묻다', type: 'verb', group: '1' },
  { id: 'v-kau', kanji: '買う', kana: 'かう', mean: '사다', type: 'verb', group: '1' },
  { id: 'v-matsu', kanji: '待つ', kana: 'まつ', mean: '기다리다', type: 'verb', group: '1' },
  { id: 'v-oyogu', kanji: '泳ぐ', kana: 'およぐ', mean: '수영하다', type: 'verb', group: '1' },
  { id: 'v-asobu', kanji: '遊ぶ', kana: 'あそぶ', mean: '놀다', type: 'verb', group: '1' },

  // 명사
  { id: 'n-sora', kanji: '空', kana: 'そら', mean: '하늘', type: 'noun' },
  { id: 'n-umi', kanji: '海', kana: 'うみ', mean: '바다', type: 'noun' },
  { id: 'n-hana', kanji: '花', kana: 'はな', mean: '꽃', type: 'noun' },
  { id: 'n-neko', kanji: '猫', kana: 'ねこ', mean: '고양이', type: 'noun' },
  { id: 'n-tomodachi', kanji: '友達', kana: 'ともだち', mean: '친구', type: 'noun' },
  { id: 'n-mizu', kanji: '水', kana: 'みず', mean: '물', type: 'noun' },
  { id: 'n-hon', kanji: '本', kana: 'ほん', mean: '책', type: 'noun' },

  // 형용사 — casual: 비교 문장 등에서 쓰는 "~요"체 (자연스러운 활용형을 데이터로 고정)
  { id: 'a-utsukushii', kanji: '美しい', kana: 'うつくしい', mean: '아름답다', casual: '아름다워요', type: 'adj' },
  { id: 'a-tanoshii', kanji: '楽しい', kana: 'たのしい', mean: '즐겁다', casual: '즐거워요', type: 'adj' },
  { id: 'a-muzukashii', kanji: '難しい', kana: 'むずかしい', mean: '어렵다', casual: '어려워요', type: 'adj' },
  { id: 'a-ookii', kanji: '大きい', kana: 'おおきい', mean: '크다', casual: '커요', type: 'adj' },
  { id: 'a-chiisai', kanji: '小さい', kana: 'ちいさい', mean: '작다', casual: '작아요', type: 'adj' },
  { id: 'a-isogashii', kanji: '忙しい', kana: 'いそがしい', mean: '바쁘다', casual: '바빠요', type: 'adj' },
];
