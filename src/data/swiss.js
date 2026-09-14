/* 스위스 독일어 코스 — 단원 → 레슨 → 낱말·문장.
 *
 * 일본어 회독과는 다른 길이다. 회독 기록·통계·오늘 계획에 안 붙고, 진도는
 * 따로 적는다(storage의 swiss). 듀오링고처럼 단원 안의 레슨을 차례로 열어
 * 가고, 레슨 하나는 열 문제쯤 — 듣고 고르기 · 뜻 고르기 · 문장 조립 · 짝 맞추기.
 *
 * 스위스 독일어(Schwiizerdütsch)는 정해진 철자가 없다. 지역마다 사람마다
 * 다르게 적는다. 취리히 근처에서 흔히 쓰는 꼴로 적고 표준 독일어(hd)를 옆에
 * 둔다 — 글로 배우거나 검색할 때는 표준 독일어가 잡힌다.
 *
 *   sw    스위스 독일어 (소리 내는 쪽)
 *   hd    표준 독일어 (참고)
 *   ko    뜻
 *   han   한글로 적은 소리 — 정확한 발음이 아니라 입을 여는 첫 실마리
 *   kind  word | sentence — 문장은 조립 문제에 쓴다
 *
 * 「ch」는 목 깊은 데서 긁는 소리라 한글로는 ㅎ/ㅋ 사이 어디쯤이다. */

const W = (id, sw, hd, ko, han, extra = {}) => ({ id, kind: 'word', sw, hd, ko, han, ...extra });
const S = (id, sw, hd, ko, han, extra = {}) => ({ id, kind: 'sentence', sw, hd, ko, han, ...extra });

export const SWISS_UNITS = [
  {
    id: 'u1', title: '인사', emoji: '👋', sub: '만나고 헤어질 때',
    lessons: [
      {
        id: 'u1l1', title: '안녕하세요',
        items: [
          W('gruezi', 'Grüezi', 'Guten Tag', '안녕하세요', '그뤼에치', { note: '낮에 아무한테나 — 스위스 인사의 대표' }),
          W('hoi', 'Hoi', 'Hallo', '안녕 (친구에게)', '호이'),
          W('gmorge', 'Guete Morge', 'Guten Morgen', '좋은 아침', '구에테 모르게'),
          W('gabig', 'Guete Abig', 'Guten Abend', '좋은 저녁', '구에테 아비그'),
          W('gnacht', 'Guet Nacht', 'Gute Nacht', '잘 자요', '구엣 나흐트'),
          W('ade', 'Ade', 'Auf Wiedersehen', '안녕히 가세요', '아데'),
          W('tschau', 'Tschau', 'Tschüss', '잘 가 (친구에게)', '차우'),
        ],
      },
      {
        id: 'u1l2', title: '고마워요 · 미안해요',
        items: [
          W('merci', 'Merci', 'Danke', '고마워요', '메르시', { note: '프랑스어에서 왔지만 스위스에서는 다 이렇게 말해요' }),
          W('mercivil', 'Merci vilmal', 'Vielen Dank', '정말 고마워요', '메르시 필말'),
          W('bitte', 'Bitte', 'Bitte', '부탁해요 · 천만에요', '비테'),
          W('gaern', 'Gärn gscheh', 'Gern geschehen', '천만에요', '게른 크셰'),
          W('exgusi', 'Exgüsi', 'Entschuldigung', '미안해요 · 실례해요', '엑스귀지'),
          W('ja', 'Ja', 'Ja', '네', '야'),
          W('nei', 'Nei', 'Nein', '아니요', '나이'),
        ],
      },
    ],
  },
  {
    id: 'u2', title: '나는요', emoji: '🙋', sub: '이름 · 어디서 왔는지 · 기분',
    lessons: [
      {
        id: 'u2l1', title: '이름이 뭐예요?',
        items: [
          S('heisse', 'Ich heisse Mina.', 'Ich heiße Mina.', '제 이름은 미나예요.', '이히 하이세 미나'),
          S('wieheiss', 'Wie heissisch du?', 'Wie heißt du?', '이름이 뭐예요?', '비 하이시슈 두'),
          S('uskorea', 'Ich chume us Korea.', 'Ich komme aus Korea.', '저는 한국에서 왔어요.', '이히 후메 우스 코레아'),
          S('wiegahts', "Wie gaht's?", "Wie geht's?", '잘 지내요?', '비 가츠'),
          S('guetmerci', 'Guet, merci.', 'Gut, danke.', '좋아요, 고마워요.', '구엣 메르시'),
          W('ich', 'ich', 'ich', '나', '이히'),
          W('du', 'du', 'du', '너', '두'),
        ],
      },
      {
        id: 'u2l2', title: '배고파요 · 모르겠어요',
        items: [
          S('hunger', 'Ich ha Hunger.', 'Ich habe Hunger.', '배고파요.', '이히 하 훙거'),
          S('durscht', 'Ich ha Durscht.', 'Ich habe Durst.', '목말라요.', '이히 하 두르슈트'),
          S('mued', 'Ich bi müed.', 'Ich bin müde.', '피곤해요.', '이히 비 뮈에트'),
          S('verstah', 'Ich verstah nöd.', 'Ich verstehe nicht.', '이해 못 했어요.', '이히 페르슈타 뇌트'),
          S('weiss', 'Ich weiss nöd.', 'Ich weiß nicht.', '모르겠어요.', '이히 바이스 뇌트'),
          S('langsam', 'Langsam, bitte.', 'Langsam, bitte.', '천천히 말해 주세요.', '랑잠 비테'),
          S('allesklar', 'Alles klar.', 'Alles klar.', '알겠어요.', '알레스 클라르'),
        ],
      },
    ],
  },
  {
    id: 'u3', title: '숫자', emoji: '🔢', sub: '하나부터 천까지',
    lessons: [
      {
        id: 'u3l1', title: '1부터 10까지',
        items: [
          W('n1', 'eis', 'eins', '1 하나', '아이스'),
          W('n2', 'zwei', 'zwei', '2 둘', '츠바이'),
          W('n3', 'drü', 'drei', '3 셋', '드뤼'),
          W('n4', 'vier', 'vier', '4 넷', '피어'),
          W('n5', 'föif', 'fünf', '5 다섯', '푀이프'),
          W('n6', 'sächs', 'sechs', '6 여섯', '잭스'),
          W('n7', 'sibe', 'sieben', '7 일곱', '지베'),
          W('n8', 'acht', 'acht', '8 여덟', '아흐트'),
          W('n9', 'nün', 'neun', '9 아홉', '뉜'),
          W('n10', 'zäh', 'zehn', '10 열', '채'),
        ],
      },
      {
        id: 'u3l2', title: '11부터 천까지',
        items: [
          W('n11', 'elf', 'elf', '11', '엘프'),
          W('n12', 'zwölf', 'zwölf', '12', '츠뵐프'),
          W('n13', 'drizäh', 'dreizehn', '13', '드리채'),
          W('n15', 'füfzäh', 'fünfzehn', '15', '퓌프채'),
          W('n20', 'zwänzg', 'zwanzig', '20', '츠밴츠그'),
          W('n30', 'driissg', 'dreißig', '30', '드리스그'),
          W('n100', 'hundert', 'hundert', '100 백', '훈데르트'),
          W('n1000', 'tuusig', 'tausend', '1000 천', '투지그'),
        ],
      },
    ],
  },
  {
    id: 'u4', title: '색깔', emoji: '🎨', sub: '이건 빨강이에요',
    lessons: [
      {
        id: 'u4l1', title: '색 이름',
        items: [
          W('rot', 'rot', 'rot', '빨강', '롯', { swatch: '#e5484d' }),
          W('blau', 'blau', 'blau', '파랑', '블라우', { swatch: '#3b82f6' }),
          W('gael', 'gäl', 'gelb', '노랑', '갤', { swatch: '#facc15' }),
          W('grueen', 'grüen', 'grün', '초록', '그뤼엔', { swatch: '#22c55e' }),
          W('schwarz', 'schwarz', 'schwarz', '검정', '슈바르츠', { swatch: '#111111' }),
          W('wiss', 'wiss', 'weiß', '하양', '비스', { swatch: '#f5f5f5' }),
          W('brun', 'brun', 'braun', '갈색', '브룬', { swatch: '#8b5a2b' }),
          S('daschrot', 'Das isch rot.', 'Das ist rot.', '이건 빨강이에요.', '다스 이슈 롯'),
        ],
      },
    ],
  },
  {
    id: 'u5', title: '동물', emoji: '🐾', sub: '소에는 종이 달려 있어요',
    lessons: [
      {
        id: 'u5l1', title: '동물 친구들',
        items: [
          W('hund', 'Hund', 'Hund', '개', '훈트', { emoji: '🐶' }),
          W('chatz', 'Chatz', 'Katze', '고양이', '하츠', { emoji: '🐱' }),
          W('chue', 'Chue', 'Kuh', '소', '후에', { emoji: '🐮', note: '스위스 하면 소 — 목에 종을 달고 다녀요' }),
          W('vogel', 'Vogel', 'Vogel', '새', '포겔', { emoji: '🐦' }),
          W('fisch', 'Fisch', 'Fisch', '물고기', '피슈', { emoji: '🐟' }),
          W('ross', 'Ross', 'Pferd', '말', '로스', { emoji: '🐴' }),
          W('hase', 'Hase', 'Hase', '토끼', '하제', { emoji: '🐰' }),
          W('baer', 'Bär', 'Bär', '곰', '베어', { emoji: '🐻', note: '베른(Bern)이라는 도시 이름이 곰에서 왔어요' }),
          W('schaf', 'Schaf', 'Schaf', '양', '샤프', { emoji: '🐑' }),
          W('muus', 'Muus', 'Maus', '쥐', '무스', { emoji: '🐭' }),
        ],
      },
    ],
  },
  {
    id: 'u6', title: '먹을 것', emoji: '🍫', sub: '물 주세요 · 계산이요',
    lessons: [
      {
        id: 'u6l1', title: '먹고 마시기',
        items: [
          W('brot', 'Brot', 'Brot', '빵', '브롯', { emoji: '🍞' }),
          W('chaes', 'Chäs', 'Käse', '치즈', '해스', { emoji: '🧀' }),
          W('milch', 'Milch', 'Milch', '우유', '밀히', { emoji: '🥛' }),
          W('wasser', 'Wasser', 'Wasser', '물', '바서', { emoji: '💧' }),
          W('oepfel', 'Öpfel', 'Apfel', '사과', '외프펠', { emoji: '🍎' }),
          W('schoggi', 'Schoggi', 'Schokolade', '초콜릿', '쇼기', { emoji: '🍫', note: '스위스에서 제일 중요한 단어일지도' }),
          W('roesti', 'Rösti', 'Rösti', '뢰스티 (감자전)', '뢰슈티', { emoji: '🥔' }),
          W('kafi', 'Kafi', 'Kaffee', '커피', '카피', { emoji: '☕' }),
          W('tee', 'Tee', 'Tee', '차', '테', { emoji: '🍵' }),
        ],
      },
      {
        id: 'u6l2', title: '식당에서',
        items: [
          S('hettgaern', 'Ich hett gärn es Wasser.', 'Ich hätte gern ein Wasser.', '물 하나 주세요.', '이히 헷 게른 에스 바서'),
          S('ekafi', 'E Kafi, bitte.', 'Einen Kaffee, bitte.', '커피 하나 부탁해요.', '에 카피 비테'),
          S('fein', 'Es isch fein!', 'Es ist lecker!', '맛있어요!', '에스 이슈 파인'),
          S('zahle', 'Zahle, bitte.', 'Zahlen, bitte.', '계산이요.', '찰레 비테'),
          S('keihunger', 'Ich ha kei Hunger.', 'Ich habe keinen Hunger.', '배 안 고파요.', '이히 하 카이 훙거'),
          W('fein_w', 'fein', 'lecker', '맛있는', '파인'),
        ],
      },
    ],
  },
  {
    id: 'u7', title: '가족과 집', emoji: '🏠', sub: '엄마 · 아빠 · 친구',
    lessons: [
      {
        id: 'u7l1', title: '우리 가족',
        items: [
          W('mami', 'Mami', 'Mama', '엄마', '마미', { emoji: '👩' }),
          W('papi', 'Papi', 'Papa', '아빠', '파피', { emoji: '👨' }),
          W('brueder', 'Brüeder', 'Bruder', '남자 형제', '브뤼에더', { emoji: '👦' }),
          W('schwoeschter', 'Schwöschter', 'Schwester', '여자 형제', '슈뵈슈터', { emoji: '👧' }),
          W('grosi', 'Grosi', 'Oma', '할머니', '그로지', { emoji: '👵' }),
          W('grosspapi', 'Grosspapi', 'Opa', '할아버지', '그로스파피', { emoji: '👴' }),
          W('chind', 'Chind', 'Kind', '아이', '힌트', { emoji: '🧒' }),
          W('fruend', 'Fründ', 'Freund', '친구', '프륀트', { emoji: '🤝' }),
          W('huus', 'Huus', 'Haus', '집', '후스', { emoji: '🏠' }),
          S('dasischmami', 'Das isch mis Mami.', 'Das ist meine Mama.', '이분은 우리 엄마예요.', '다스 이슈 미스 마미'),
        ],
      },
    ],
  },
  {
    id: 'u8', title: '날씨와 하루', emoji: '☀️', sub: '오늘 · 내일 · 비가 와요',
    lessons: [
      {
        id: 'u8l1', title: '날씨',
        items: [
          W('sunne', 'Sunne', 'Sonne', '해', '주네', { emoji: '☀️' }),
          W('raege', 'Räge', 'Regen', '비', '래게', { emoji: '🌧️' }),
          W('schnee', 'Schnee', 'Schnee', '눈', '슈네', { emoji: '❄️' }),
          W('wind', 'Wind', 'Wind', '바람', '빈트', { emoji: '🌬️' }),
          W('chalt', 'chalt', 'kalt', '춥다', '할트', { emoji: '🥶' }),
          W('warm', 'warm', 'warm', '따뜻하다', '바름', { emoji: '🌡️' }),
          S('esraegnet', 'Es rägnet.', 'Es regnet.', '비가 와요.', '에스 래그넷'),
          S('eschalt', 'Es isch chalt.', 'Es ist kalt.', '추워요.', '에스 이슈 할트'),
        ],
      },
      {
        id: 'u8l2', title: '오늘 · 내일',
        items: [
          W('huet', 'hüt', 'heute', '오늘', '휘트'),
          W('morn', 'morn', 'morgen', '내일', '모른'),
          W('geschter', 'geschter', 'gestern', '어제', '게슈터'),
          W('mond', 'Mond', 'Mond', '달', '몬트', { emoji: '🌙' }),
          W('ziit', 'Ziit', 'Zeit', '시간', '치트', { emoji: '⏰' }),
          S('huetschoen', 'Hüt isch es schön.', 'Heute ist es schön.', '오늘은 날씨가 좋아요.', '휘트 이슈 에스 쇤'),
          S('bismorn', 'Bis morn!', 'Bis morgen!', '내일 봐요!', '비스 모른'),
        ],
      },
    ],
  },
  {
    id: 'u9', title: '길에서', emoji: '🚆', sub: '역이 어디예요? · 얼마예요?',
    lessons: [
      {
        id: 'u9l1', title: '타고 가기',
        items: [
          W('bahnhof', 'Bahnhof', 'Bahnhof', '기차역', '반호프', { emoji: '🚉' }),
          W('zug', 'Zug', 'Zug', '기차', '추그', { emoji: '🚆' }),
          W('bus', 'Bus', 'Bus', '버스', '부스', { emoji: '🚌' }),
          W('tram', 'Tram', 'Straßenbahn', '트램', '트람', { emoji: '🚋' }),
          W('stadt', 'Stadt', 'Stadt', '도시', '슈타트', { emoji: '🏙️' }),
          W('baerg', 'Bärg', 'Berg', '산', '베르그', { emoji: '⛰️' }),
          W('see', 'See', 'See', '호수', '제', { emoji: '🏞️' }),
          W('links', 'links', 'links', '왼쪽', '링크스', { emoji: '⬅️' }),
          W('raechts', 'rächts', 'rechts', '오른쪽', '래히츠', { emoji: '➡️' }),
          W('graduus', 'graduus', 'geradeaus', '직진', '그라두스', { emoji: '⬆️' }),
        ],
      },
      {
        id: 'u9l2', title: '물어보기',
        items: [
          S('wobahnhof', 'Wo isch de Bahnhof?', 'Wo ist der Bahnhof?', '기차역이 어디예요?', '보 이슈 데 반호프'),
          S('wowc', 'Wo isch s WC?', 'Wo ist die Toilette?', '화장실이 어디예요?', '보 이슈 스 베체'),
          S('wieviel', 'Wie viel choschtet das?', 'Wie viel kostet das?', '이거 얼마예요?', '비 필 코슈텟 다스'),
          S('haelfe', 'Chönd Sie mir hälfe?', 'Können Sie mir helfen?', '도와주실 수 있어요?', '횐트 지 미어 핼페'),
          S('bruuche', 'Ich bruuche Hilf.', 'Ich brauche Hilfe.', '도움이 필요해요.', '이히 브루헤 힐프'),
          S('reddesie', 'Rede Sie Änglisch?', 'Sprechen Sie Englisch?', '영어 하세요?', '레데 지 앵글리슈'),
        ],
      },
    ],
  },
];

/* 문장을 조립 문제에 쓰려면 낱말로 쪼개야 한다. 띄어쓰기로 자르고 문장부호는
   마지막 낱말에 붙여 둔다 — 듀오링고도 그렇게 한다. 「Wie gaht's?」처럼
   따옴표가 든 것도 그대로 한 덩이다. */
export function tokensOf(item) {
  return String(item.sw).split(/\s+/).filter(Boolean);
}

export const SWISS_LESSONS = SWISS_UNITS.flatMap((u) => u.lessons.map((l) => ({ ...l, unitId: u.id })));
export const SWISS_ITEMS = SWISS_LESSONS.flatMap((l) => l.items.map((it) => ({ ...it, lessonId: l.id, unitId: l.unitId })));

export function lessonById(id) {
  return SWISS_LESSONS.find((l) => l.id === id) || null;
}
export function unitById(id) {
  return SWISS_UNITS.find((u) => u.id === id) || null;
}
export function itemsOfLesson(id) {
  return SWISS_ITEMS.filter((it) => it.lessonId === id);
}
export function itemsOfUnit(id) {
  return SWISS_ITEMS.filter((it) => it.unitId === id);
}
