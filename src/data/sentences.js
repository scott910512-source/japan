// 기초 문장 패턴 — 암기한 단어를 빈칸에 끼워 넣어 학습한다
export const ANIMATE_NOUNS = new Set(['n-neko', 'n-tomodachi']);

/* ★ 패턴에 맞는 낱말만 · 한국어 조사도 받침대로 ★ (2026-11-17 QA B03)
 * 전에는 명사면 아무거나 넣어서 「店員があります」 「今日があります」 「友達をください」 「これは駅です」가 나왔고,
 * 한국어는 「메뉴이/가」 「바다을/를」 「가격; 값이/가」처럼 조사와 뜻 구분자가 그대로 보였다.
 *   사람 · 가족 · 동물        → います (あります ×), 「をください」 「これは」에는 안 넣는다
 *   물건 · 음식 · 옷 · 돈 …    → あります · をください · これは
 *   장소                      → あります(「近くに駅があります」), 「ここは〇〇です」가 맞아서 「これは」에는 안 넣는다
 *   시간 · 추상 · 숫자 · 감정  → 존재문 · 요청에 안 넣는다 */
const tagsOf = (w) => w.tags || [];
const ANIMAL_KANJI = new Set(['犬', '猫', '鳥', '魚', '馬', '牛', '豚', '虫', '動物', 'ペット', '金魚', 'うさぎ']);
const ABSTRACT = ['시간', '추상', '숫자', '감정', '인사', '관계', '의문사', '날씨', '지명'];
/* 「사람」 갈래여도 시간 · 추상이 붙은 것(誕生日 · 待ち合わせ)은 사람이 아니다 */
export const isAnimate = (w) => ANIMATE_NOUNS.has(w.id) || ANIMAL_KANJI.has(w.kanji)
  || (tagsOf(w).some((t) => t === '사람' || t === '가족') && !tagsOf(w).some((t) => ABSTRACT.includes(t)));
/* 손에 들고 「주세요 · 이것은」이라 할 수 있는 것 — 음식 · 옷 갈래와 자주 쓰는 물건만(값 · 시장 · 배(신체)는 아니다) */
const THING_TAGS = ['음식', '옷'];
const THING_KANJI = new Set(['本', '傘', '鍵', '財布', '鞄', 'かばん', '切符', '地図', '時計', '眼鏡', 'めがね', '机', '椅子', 'いす', '箱', '紙',
  '鉛筆', 'ペン', 'ノート', '辞書', '新聞', '雑誌', '写真', 'カメラ', '電話', '携帯', 'スマホ', 'パソコン', 'テレビ', '袋', '箸', '皿', 'コップ',
  '薬', '水', 'お茶', '花', '手紙', '切手', '帽子', '靴', 'シャツ', '荷物', 'レシート', 'メニュー', 'タオル', '石鹸', 'ハンカチ', 'チケット',
  '充電器', 'イヤホン', 'カード', '封筒', '消しゴム', '時刻表', 'お土産', '名刺', '鉛筆削り', 'はさみ', 'おもちゃ', '人形', '自転車', '車']);
const isAbstract = (w) => tagsOf(w).some((t) => ABSTRACT.includes(t));
export const isThing = (w) => w.type === 'noun' && !w.grammar && !isAnimate(w) && !isAbstract(w) && !tagsOf(w).includes('장소')
  && !tagsOf(w).includes('신체') && (THING_KANJI.has(w.kanji) || tagsOf(w).some((t) => THING_TAGS.includes(t)));
/* 사람 대명사(私 · 彼 …)는 존재문에 안 넣는다 — 「私がいます / 나가 있습니다」 */
const PRONOUN = new Set(['私', '僕', '俺', 'あなた', '彼', '彼女', '私たち', '自分', 'わたし', 'ぼく']);
/* 「〇〇が好きです」 — 좋아할 만한 것: 음식 · 취미 · 운동 · 색 · 자연 · 문화 · 날씨 · 동물 */
const LIKE_TAGS = ['음식', '취미', '운동', '색', '자연', '문화', '날씨', '옷'];
const isLikable = (w) => w.type === 'noun' && !w.grammar && !PRONOUN.has(w.kanji)
  && (ANIMAL_KANJI.has(w.kanji) || tagsOf(w).some((t) => LIKE_TAGS.includes(t)));
const isPlace = (w) => w.type === 'noun' && !w.grammar && tagsOf(w).includes('장소') && !isAbstract(w);

/* 뜻 하나만(「가격; 값」 → 「가격」), 괄호 설명은 뺀다 */
export const firstMean = (mean) => String(mean || '').split(/[;,·/]/)[0].replace(/\([^)]*\)/g, '').trim();
/* 받침이 있으면 앞 조사(이 · 을 · 은), 없으면 뒤 조사(가 · 를 · 는). 한글로 안 끝나면 둘 다 적는다 */
export function withJosa(word, pair) {
  const [a, b] = pair.split('/');
  const last = String(word).trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}${pair}`;
  return `${word}${code % 28 ? a : b}`;
}

export const PATTERNS = [
  {
    id: 'kore-desu',
    jp: 'これは〇〇です',
    kr: '이것은 ~입니다',
    tags: ['지시대명사', 'です'],
    wordFilter: isThing,
    build: (w) => ({
      jp: `これは${w.kanji}です`,
      kr: `이것은 ${firstMean(w.mean)}입니다`,
    }),
  },
  {
    id: 'ga-arimasu',
    jp: '〇〇があります／います',
    kr: '~가 있습니다 (존재)',
    tags: ['존재문', 'が'],
    wordFilter: (w) => w.type === 'noun' && !w.grammar && !PRONOUN.has(w.kanji) && (isAnimate(w) || isThing(w) || isPlace(w)),
    build: (w) => {
      const verb = isAnimate(w) ? 'います' : 'あります';
      return {
        jp: `${w.kanji}が${verb}`,
        kr: `${withJosa(firstMean(w.mean), '이/가')} 있습니다`,
      };
    },
  },
  {
    id: 'ga-suki',
    jp: '〇〇が好きです',
    kr: '~을 좋아합니다',
    tags: ['취향', 'が好き'],
    wordFilter: isLikable,
    build: (w) => ({
      jp: `${w.kanji}が好きです`,
      kr: `${withJosa(firstMean(w.mean), '을/를')} 좋아합니다`,
    }),
  },
  {
    id: 'o-kudasai',
    jp: '〇〇をください',
    kr: '~을 주세요 (요청)',
    tags: ['요청', 'を'],
    wordFilter: isThing,
    build: (w) => ({
      jp: `${w.kanji}をください`,
      kr: `${withJosa(firstMean(w.mean), '을/를')} 주세요`,
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
