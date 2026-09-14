/* 스위스 독일어 맛보기 — 유치원 수준.
 *
 * 이 앱의 본업(일본어 회독)과는 아무 상관이 없는 곁가지다. 회독 기록·통계·
 * 오늘 계획 어디에도 안 붙는다. 그냥 눌러서 듣고 따라 하는 자리.
 *
 * 스위스 독일어(Schwiizerdütsch)는 정해진 철자가 없다. 지역마다, 사람마다
 * 다르게 적는다. 여기서는 취리히 근처에서 흔히 쓰는 꼴로 적고, 옆에 표준
 * 독일어(hd)를 같이 둔다 — 글로 배우거나 검색할 때는 표준 독일어가 잡힌다.
 *
 *   sw   스위스 독일어 (소리 내는 쪽)
 *   hd   표준 독일어 (참고)
 *   ko   뜻
 *   han  한글로 적은 소리 — 정확한 발음은 아니다. 입을 여는 첫 실마리일 뿐.
 *
 * 「ch」는 목 깊은 데서 긁는 소리라 한글로는 ㅎ/ㅋ 사이 어디쯤이다. */

export const SWISS_GROUPS = [
  { id: 'hello', label: '인사', emoji: '👋' },
  { id: 'num', label: '숫자', emoji: '🔢' },
  { id: 'color', label: '색깔', emoji: '🎨' },
  { id: 'animal', label: '동물', emoji: '🐾' },
  { id: 'daily', label: '우리 집', emoji: '🏠' },
];

export const SWISS_ITEMS = [
  // 인사
  { id: 'gruezi', g: 'hello', sw: 'Grüezi', hd: 'Guten Tag', ko: '안녕하세요', han: '그뤼에치', note: '낮에 아무한테나 — 스위스 인사의 대표' },
  { id: 'hoi', g: 'hello', sw: 'Hoi', hd: 'Hallo', ko: '안녕 (친구에게)', han: '호이' },
  { id: 'gmorge', g: 'hello', sw: 'Guete Morge', hd: 'Guten Morgen', ko: '좋은 아침', han: '구에테 모르게' },
  { id: 'gabig', g: 'hello', sw: 'Guete Abig', hd: 'Guten Abend', ko: '좋은 저녁', han: '구에테 아비그' },
  { id: 'gnacht', g: 'hello', sw: 'Guet Nacht', hd: 'Gute Nacht', ko: '잘 자요', han: '구엣 나흐트' },
  { id: 'ade', g: 'hello', sw: 'Ade', hd: 'Auf Wiedersehen', ko: '안녕히 가세요', han: '아데' },
  { id: 'tschau', g: 'hello', sw: 'Tschau', hd: 'Tschüss', ko: '잘 가 (친구에게)', han: '차우' },
  { id: 'merci', g: 'hello', sw: 'Merci', hd: 'Danke', ko: '고마워요', han: '메르시', note: '프랑스어에서 왔지만 스위스에서는 다 이렇게 말해요' },
  { id: 'mercivil', g: 'hello', sw: 'Merci vilmal', hd: 'Vielen Dank', ko: '정말 고마워요', han: '메르시 필말' },
  { id: 'bitte', g: 'hello', sw: 'Bitte', hd: 'Bitte', ko: '부탁해요 · 천만에요', han: '비테' },
  { id: 'exgusi', g: 'hello', sw: 'Exgüsi', hd: 'Entschuldigung', ko: '미안해요 · 실례해요', han: '엑스귀지' },
  { id: 'ja', g: 'hello', sw: 'Ja', hd: 'Ja', ko: '네', han: '야' },
  { id: 'nei', g: 'hello', sw: 'Nei', hd: 'Nein', ko: '아니요', han: '나이' },
  { id: 'wiegahts', g: 'hello', sw: "Wie gaht's?", hd: "Wie geht's?", ko: '잘 지내요?', han: '비 가츠' },
  { id: 'guet', g: 'hello', sw: 'Guet', hd: 'Gut', ko: '좋아요', han: '구엣' },

  // 숫자 1~10
  { id: 'n1', g: 'num', sw: 'eis', hd: 'eins', ko: '1 하나', han: '아이스' },
  { id: 'n2', g: 'num', sw: 'zwei', hd: 'zwei', ko: '2 둘', han: '츠바이' },
  { id: 'n3', g: 'num', sw: 'drü', hd: 'drei', ko: '3 셋', han: '드뤼' },
  { id: 'n4', g: 'num', sw: 'vier', hd: 'vier', ko: '4 넷', han: '피어' },
  { id: 'n5', g: 'num', sw: 'föif', hd: 'fünf', ko: '5 다섯', han: '푀이프' },
  { id: 'n6', g: 'num', sw: 'sächs', hd: 'sechs', ko: '6 여섯', han: '잭스' },
  { id: 'n7', g: 'num', sw: 'sibe', hd: 'sieben', ko: '7 일곱', han: '지베' },
  { id: 'n8', g: 'num', sw: 'acht', hd: 'acht', ko: '8 여덟', han: '아흐트' },
  { id: 'n9', g: 'num', sw: 'nün', hd: 'neun', ko: '9 아홉', han: '뉜' },
  { id: 'n10', g: 'num', sw: 'zäh', hd: 'zehn', ko: '10 열', han: '채' },

  // 색깔
  { id: 'rot', g: 'color', sw: 'rot', hd: 'rot', ko: '빨강', han: '롯', swatch: '#e5484d' },
  { id: 'blau', g: 'color', sw: 'blau', hd: 'blau', ko: '파랑', han: '블라우', swatch: '#3b82f6' },
  { id: 'gael', g: 'color', sw: 'gäl', hd: 'gelb', ko: '노랑', han: '갤', swatch: '#facc15' },
  { id: 'grueen', g: 'color', sw: 'grüen', hd: 'grün', ko: '초록', han: '그뤼엔', swatch: '#22c55e' },
  { id: 'schwarz', g: 'color', sw: 'schwarz', hd: 'schwarz', ko: '검정', han: '슈바르츠', swatch: '#111111' },
  { id: 'wiss', g: 'color', sw: 'wiss', hd: 'weiß', ko: '하양', han: '비스', swatch: '#f5f5f5' },
  { id: 'orange', g: 'color', sw: 'orange', hd: 'orange', ko: '주황', han: '오랑쥬', swatch: '#f97316' },

  // 동물
  { id: 'hund', g: 'animal', sw: 'Hund', hd: 'Hund', ko: '개', han: '훈트', emoji: '🐶' },
  { id: 'chatz', g: 'animal', sw: 'Chatz', hd: 'Katze', ko: '고양이', han: '하츠', emoji: '🐱' },
  { id: 'chue', g: 'animal', sw: 'Chue', hd: 'Kuh', ko: '소', han: '후에', emoji: '🐮', note: '스위스 하면 소 — 목에 종을 달고 다녀요' },
  { id: 'vogel', g: 'animal', sw: 'Vogel', hd: 'Vogel', ko: '새', han: '포겔', emoji: '🐦' },
  { id: 'fisch', g: 'animal', sw: 'Fisch', hd: 'Fisch', ko: '물고기', han: '피슈', emoji: '🐟' },
  { id: 'ross', g: 'animal', sw: 'Ross', hd: 'Pferd', ko: '말', han: '로스', emoji: '🐴' },
  { id: 'hase', g: 'animal', sw: 'Hase', hd: 'Hase', ko: '토끼', han: '하제', emoji: '🐰' },
  { id: 'baer', g: 'animal', sw: 'Bär', hd: 'Bär', ko: '곰', han: '베어', emoji: '🐻', note: '베른(Bern)이라는 도시 이름이 곰에서 왔어요' },
  { id: 'schaf', g: 'animal', sw: 'Schaf', hd: 'Schaf', ko: '양', han: '샤프', emoji: '🐑' },

  // 우리 집
  { id: 'mami', g: 'daily', sw: 'Mami', hd: 'Mama', ko: '엄마', han: '마미', emoji: '👩' },
  { id: 'papi', g: 'daily', sw: 'Papi', hd: 'Papa', ko: '아빠', han: '파피', emoji: '👨' },
  { id: 'chind', g: 'daily', sw: 'Chind', hd: 'Kind', ko: '아이', han: '힌트', emoji: '🧒' },
  { id: 'fruend', g: 'daily', sw: 'Fründ', hd: 'Freund', ko: '친구', han: '프륀트', emoji: '🤝' },
  { id: 'hus', g: 'daily', sw: 'Huus', hd: 'Haus', ko: '집', han: '후스', emoji: '🏠' },
  { id: 'wasser', g: 'daily', sw: 'Wasser', hd: 'Wasser', ko: '물', han: '바서', emoji: '💧' },
  { id: 'milch', g: 'daily', sw: 'Milch', hd: 'Milch', ko: '우유', han: '밀히', emoji: '🥛' },
  { id: 'brot', g: 'daily', sw: 'Brot', hd: 'Brot', ko: '빵', han: '브롯', emoji: '🍞' },
  { id: 'oepfel', g: 'daily', sw: 'Öpfel', hd: 'Apfel', ko: '사과', han: '외프펠', emoji: '🍎' },
  { id: 'schoggi', g: 'daily', sw: 'Schoggi', hd: 'Schokolade', ko: '초콜릿', han: '쇼기', emoji: '🍫', note: '스위스에서 제일 중요한 단어일지도' },
  { id: 'sunne', g: 'daily', sw: 'Sunne', hd: 'Sonne', ko: '해', han: '주네', emoji: '☀️' },
  { id: 'mond', g: 'daily', sw: 'Mond', hd: 'Mond', ko: '달', han: '몬트', emoji: '🌙' },
  { id: 'gross', g: 'daily', sw: 'gross', hd: 'groß', ko: '크다', han: '그로스', emoji: '🐘' },
  { id: 'chli', g: 'daily', sw: 'chli', hd: 'klein', ko: '작다', han: '흘리', emoji: '🐜' },
  { id: 'schoen', g: 'daily', sw: 'schön', hd: 'schön', ko: '예쁘다 · 좋다', han: '쇤', emoji: '🌸' },
];

export function swissByGroup(groupId) {
  return SWISS_ITEMS.filter((it) => it.g === groupId);
}

/* 맞혀 보기 한 문제. 같은 묶음에서 다른 둘을 섞어 셋을 만든다.
   셋이 안 되는 묶음은 없지만, 혹시 몰라 있는 만큼만 낸다. */
export function swissQuiz(groupId, pickIndex, rnd = Math.random) {
  const pool = swissByGroup(groupId);
  if (!pool.length) return null;
  const answer = pool[pickIndex % pool.length];
  const others = pool.filter((it) => it.id !== answer.id);
  // 섞어서 앞의 둘
  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const options = [answer, ...others.slice(0, 2)];
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { answer, options };
}
