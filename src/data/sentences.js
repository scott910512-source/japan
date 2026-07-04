// 기초 문장 패턴 — 암기한 단어를 빈칸에 끼워 넣어 학습한다
export const ANIMATE_NOUNS = new Set(['n-neko', 'n-tomodachi']);

export const PATTERNS = [
  {
    id: 'kore-desu',
    jp: 'これは〇〇です',
    kr: '이것은 ~입니다',
    tags: ['지시대명사', 'です'],
    wordFilter: (w) => w.type === 'noun',
    build: (w) => ({
      jp: `これは${w.kanji}です`,
      kr: `이것은 ${w.mean}입니다`,
    }),
  },
  {
    id: 'ga-arimasu',
    jp: '〇〇があります／います',
    kr: '~가 있습니다 (존재)',
    tags: ['존재문', 'が'],
    wordFilter: (w) => w.type === 'noun',
    build: (w) => {
      const verb = ANIMATE_NOUNS.has(w.id) ? 'います' : 'あります';
      return {
        jp: `${w.kanji}が${verb}`,
        kr: `${w.mean}이/가 있습니다`,
      };
    },
  },
  {
    id: 'ga-suki',
    jp: '〇〇が好きです',
    kr: '~을 좋아합니다',
    tags: ['취향', 'が好き'],
    wordFilter: (w) => w.type === 'noun',
    build: (w) => ({
      jp: `${w.kanji}が好きです`,
      kr: `${w.mean}을/를 좋아합니다`,
    }),
  },
  {
    id: 'o-kudasai',
    jp: '〇〇をください',
    kr: '~을 주세요 (요청)',
    tags: ['요청', 'を'],
    wordFilter: (w) => w.type === 'noun',
    build: (w) => ({
      jp: `${w.kanji}をください`,
      kr: `${w.mean}을/를 주세요`,
    }),
  },
  {
    id: 'yori',
    jp: 'これは〇〇より〇〇です',
    kr: '~는 ~보다 ~합니다 (비교)',
    tags: ['비교', 'より'],
    wordFilter: (w) => w.type === 'adj',
    fixedCompare: 'あれ',
    build: (w) => ({
      jp: `これはあれより${w.kanji}です`,
      kr: `이것은 저것보다 더 ${w.casual}`,
    }),
  },
];
