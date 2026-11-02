/* 독일어 기초 단어 코스 — 초등학생이 제일 먼저 배우는 말.
 *
 * 여행 회화(swiss.js)는 「식당에서 주문하기」처럼 문장부터 나온다. 그런데 숫자·색깔·동물 같은 쉬운
 * 낱말도 아직 모르는 사람에게는 그게 너무 높다. 이 코스는 같은 독일어 메뉴 안에서 그 아래 계단이다.
 *
 * 만드는 규칙
 *  - 명사는 관사를 붙여 한 덩어리로 외운다(der Hund). 독일어는 낱말마다 성이 있어서 관사 없이 외우면
 *    나중에 다시 외워야 한다. 뜻 칸은 관사 없이 뜻만.
 *  - 한글 도움말(han)은 짧은 낱말에만, 명사는 관사 없이. 소리가 크게 어긋나지 않는 것만 적는다.
 *  - 그림(emoji)·색(swatch)이 있으면 낱말 카드에 같이 보여 준다 — 그림이 있으면 뜻이 더 빨리 붙는다.
 *  - 문장은 아주 짧고 쉬운 것만. 현재형, 일상에서 바로 쓰는 말.
 *  - 한 레슨은 네~일곱 개. 많이 외우게 하지 않고, 대신 복습(swissMemory)이 여러 번 돌려 준다. */

const W = (id, ko, de, han, extra = {}) => ({ id, kind: 'word', ko, de, ...(han ? { han } : {}), ...extra });
const S = (id, ko, de, han, extra = {}) => ({ id, kind: 'sentence', ko, de, ...(han ? { han } : {}), ...extra });

export const BASIC_UNITS = [
  {
    id: 'b1', title: '숫자 0~10', emoji: '🔢', sub: '하나 둘 셋부터',
    lessons: [
      {
        id: 'b1l1', title: '0 ~ 5',
        items: [
          W('b-null', '0 (영)', 'null', '눌'),
          W('b-eins', '1 (하나)', 'eins', '아인스'),
          W('b-zwei', '2 (둘)', 'zwei', '츠바이'),
          W('b-drei', '3 (셋)', 'drei', '드라이'),
          W('b-vier', '4 (넷)', 'vier', '피어'),
          W('b-fuenf', '5 (다섯)', 'fünf', '퓐프'),
        ],
      },
      {
        id: 'b1l2', title: '6 ~ 10',
        items: [
          W('b-sechs', '6 (여섯)', 'sechs', '젝스'),
          W('b-sieben', '7 (일곱)', 'sieben', '지벤'),
          W('b-acht', '8 (여덟)', 'acht', '아흐트'),
          W('b-neun', '9 (아홉)', 'neun', '노인'),
          W('b-zehn', '10 (열)', 'zehn', '첸'),
        ],
      },
    ],
  },
  {
    id: 'b2', title: '숫자 11~20과 큰 수', emoji: '🔟', sub: '열하나부터 백까지',
    lessons: [
      {
        id: 'b2l1', title: '11 ~ 15',
        items: [
          W('b-elf', '11 (열하나)', 'elf', '엘프'),
          W('b-zwoelf', '12 (열둘)', 'zwölf', '츠뵐프'),
          W('b-dreizehn', '13 (열셋)', 'dreizehn', '드라이첸'),
          W('b-vierzehn', '14 (열넷)', 'vierzehn', '피어첸'),
          W('b-fuenfzehn', '15 (열다섯)', 'fünfzehn', '퓐프첸'),
        ],
      },
      {
        id: 'b2l2', title: '16 ~ 20 · 백',
        items: [
          W('b-sechzehn', '16 (열여섯)', 'sechzehn', '젝히첸'),
          W('b-siebzehn', '17 (열일곱)', 'siebzehn', '집첸'),
          W('b-achtzehn', '18 (열여덟)', 'achtzehn', '아흐첸'),
          W('b-neunzehn', '19 (열아홉)', 'neunzehn', '노인첸'),
          W('b-zwanzig', '20 (스물)', 'zwanzig', '츠반치히'),
          W('b-hundert', '100 (백)', 'hundert', '훈더트'),
        ],
      },
    ],
  },
  {
    id: 'b3', title: '색깔', emoji: '🎨', sub: '빨강 파랑 노랑',
    lessons: [
      {
        id: 'b3l1', title: '기본 색',
        items: [
          W('b-rot', '빨간색', 'rot', '로트', { swatch: '#e53935' }),
          W('b-blau', '파란색', 'blau', '블라우', { swatch: '#1e66d0' }),
          W('b-gelb', '노란색', 'gelb', '겔프', { swatch: '#f6c90e' }),
          W('b-gruen', '초록색', 'grün', '그륀', { swatch: '#2e9d4a' }),
          W('b-schwarz', '검은색', 'schwarz', '슈바르츠', { swatch: '#111111' }),
          W('b-weiss', '흰색', 'weiß', '바이스', { swatch: '#ffffff' }),
        ],
      },
      {
        id: 'b3l2', title: '더 많은 색',
        items: [
          W('b-orange', '주황색', 'orange', null, { swatch: '#f28c1b' }),
          W('b-rosa', '분홍색', 'rosa', '로자', { swatch: '#f7a8c4' }),
          W('b-braun', '갈색', 'braun', '브라운', { swatch: '#7a4a24' }),
          W('b-grau', '회색', 'grau', '그라우', { swatch: '#8a8a8a' }),
          W('b-lila', '보라색', 'lila', '릴라', { swatch: '#8e4fc4' }),
        ],
      },
    ],
  },
  {
    id: 'b4', title: '동물', emoji: '🐶', sub: '강아지 고양이 코끼리',
    lessons: [
      {
        id: 'b4l1', title: '집과 농장 동물',
        items: [
          W('b-hund', '개 · 강아지', 'der Hund', '훈트', { emoji: '🐶' }),
          W('b-katze', '고양이', 'die Katze', '캇체', { emoji: '🐱' }),
          W('b-vogel', '새', 'der Vogel', '포겔', { emoji: '🐦' }),
          W('b-fisch', '물고기', 'der Fisch', '피슈', { emoji: '🐟' }),
          W('b-pferd', '말', 'das Pferd', '페어트', { emoji: '🐴' }),
          W('b-kuh', '소 · 젖소', 'die Kuh', '쿠', { emoji: '🐮' }),
        ],
      },
      {
        id: 'b4l2', title: '더 많은 동물',
        items: [
          W('b-schwein', '돼지', 'das Schwein', '슈바인', { emoji: '🐷' }),
          W('b-hase', '토끼', 'der Hase', '하제', { emoji: '🐰' }),
          W('b-maus', '쥐', 'die Maus', '마우스', { emoji: '🐭' }),
          W('b-baer', '곰', 'der Bär', '베어', { emoji: '🐻' }),
          W('b-loewe', '사자', 'der Löwe', '뢰베', { emoji: '🦁' }),
          W('b-elefant', '코끼리', 'der Elefant', '엘레판트', { emoji: '🐘' }),
        ],
      },
    ],
  },
  {
    id: 'b5', title: '가족과 사람', emoji: '👨‍👩‍👧', sub: '엄마 아빠 친구',
    lessons: [
      {
        id: 'b5l1', title: '우리 가족',
        items: [
          W('b-mutter', '엄마 · 어머니', 'die Mutter', '무터', { emoji: '👩' }),
          W('b-vater', '아빠 · 아버지', 'der Vater', '파터', { emoji: '👨' }),
          W('b-schwester', '언니 · 누나 · 여동생', 'die Schwester', '슈베스터', { emoji: '👧' }),
          W('b-bruder', '형 · 오빠 · 남동생', 'der Bruder', '브루더', { emoji: '👦' }),
          W('b-oma', '할머니', 'die Oma', '오마', { emoji: '👵' }),
          W('b-opa', '할아버지', 'der Opa', '오파', { emoji: '👴' }),
        ],
      },
      {
        id: 'b5l2', title: '사람들',
        items: [
          W('b-eltern', '부모님', 'die Eltern', '엘턴', { note: '항상 복수로만 써요' }),
          W('b-kind', '아이', 'das Kind', '킨트', { emoji: '🧒' }),
          W('b-junge', '남자아이', 'der Junge', '융에', { emoji: '👦' }),
          W('b-maedchen', '여자아이', 'das Mädchen', null, { emoji: '👧' }),
          W('b-freund', '친구 (남자)', 'der Freund', '프로인트'),
          W('b-freundin', '친구 (여자)', 'die Freundin', '프로인딘'),
        ],
      },
    ],
  },
  {
    id: 'b6', title: '내 몸', emoji: '🖐️', sub: '머리 손 발',
    lessons: [
      {
        id: 'b6l1', title: '얼굴과 손',
        items: [
          W('b-kopf', '머리', 'der Kopf', '코프', { emoji: '🙂' }),
          W('b-auge', '눈 (보는 눈)', 'das Auge', '아우게', { emoji: '👁️' }),
          W('b-nase', '코', 'die Nase', '나제', { emoji: '👃' }),
          W('b-mund', '입', 'der Mund', '문트', { emoji: '👄' }),
          W('b-ohr', '귀', 'das Ohr', '오어', { emoji: '👂' }),
          W('b-hand', '손', 'die Hand', '한트', { emoji: '✋' }),
        ],
      },
      {
        id: 'b6l2', title: '팔다리와 배',
        items: [
          W('b-arm', '팔', 'der Arm', '아름', { emoji: '💪' }),
          W('b-bein', '다리', 'das Bein', '바인', { emoji: '🦵' }),
          W('b-fuss', '발', 'der Fuß', '푸스', { emoji: '🦶' }),
          W('b-haar', '머리카락', 'das Haar', '하르'),
          W('b-bauch', '배 (몸의 배)', 'der Bauch', '바우흐'),
          W('b-herz', '심장 · 마음', 'das Herz', '헤르츠', { emoji: '❤️' }),
        ],
      },
    ],
  },
  {
    id: 'b7', title: '먹을 것', emoji: '🍎', sub: '물 빵 사과',
    lessons: [
      {
        id: 'b7l1', title: '매일 먹는 것',
        items: [
          W('b-wasser', '물', 'das Wasser', '바써', { emoji: '💧' }),
          W('b-milch', '우유', 'die Milch', '밀히', { emoji: '🥛' }),
          W('b-brot', '빵', 'das Brot', '브로트', { emoji: '🍞' }),
          W('b-apfel', '사과', 'der Apfel', '아펠', { emoji: '🍎' }),
          W('b-banane', '바나나', 'die Banane', '바나네', { emoji: '🍌' }),
          W('b-ei', '달걀', 'das Ei', '아이', { emoji: '🥚' }),
        ],
      },
      {
        id: 'b7l2', title: '더 많은 먹을 것',
        items: [
          W('b-kaese', '치즈', 'der Käse', '케제', { emoji: '🧀' }),
          W('b-saft', '주스', 'der Saft', '자프트', { emoji: '🧃' }),
          W('b-reis', '쌀 · 밥', 'der Reis', '라이스', { emoji: '🍚' }),
          W('b-kuchen', '케이크', 'der Kuchen', '쿠헨', { emoji: '🍰' }),
          W('b-kartoffel', '감자', 'die Kartoffel', '카르토펠', { emoji: '🥔' }),
          W('b-tomate', '토마토', 'die Tomate', '토마테', { emoji: '🍅' }),
        ],
      },
    ],
  },
  {
    id: 'b8', title: '학교', emoji: '🏫', sub: '책 연필 선생님',
    lessons: [
      {
        id: 'b8l1', title: '학교 물건',
        items: [
          W('b-schule', '학교', 'die Schule', '슐레', { emoji: '🏫' }),
          W('b-buch', '책', 'das Buch', '부흐', { emoji: '📖' }),
          W('b-stift', '연필 · 펜', 'der Stift', '슈티프트', { emoji: '✏️' }),
          W('b-tasche', '가방', 'die Tasche', '타셰', { emoji: '🎒' }),
          W('b-tisch', '책상 · 탁자', 'der Tisch', '티슈'),
          W('b-stuhl', '의자', 'der Stuhl', '슈툴', { emoji: '🪑' }),
        ],
      },
      {
        id: 'b8l2', title: '교실',
        items: [
          W('b-lehrer', '선생님 (남자)', 'der Lehrer', '레러'),
          W('b-lehrerin', '선생님 (여자)', 'die Lehrerin', '레러린'),
          W('b-heft', '공책', 'das Heft', '헤프트', { emoji: '📓' }),
          W('b-tafel', '칠판', 'die Tafel', '타펠'),
          W('b-fenster', '창문', 'das Fenster', '펜스터'),
          W('b-tuer', '문', 'die Tür', '튀어', { emoji: '🚪' }),
        ],
      },
    ],
  },
  {
    id: 'b9', title: '집과 탈것', emoji: '🏠', sub: '집 방 자동차',
    lessons: [
      {
        id: 'b9l1', title: '우리 집',
        items: [
          W('b-haus', '집', 'das Haus', '하우스', { emoji: '🏠' }),
          W('b-zimmer', '방', 'das Zimmer', '침머'),
          W('b-bett', '침대', 'das Bett', '베트', { emoji: '🛏️' }),
          W('b-kueche', '부엌', 'die Küche', '퀴헤'),
          W('b-auto', '자동차', 'das Auto', '아우토', { emoji: '🚗' }),
          W('b-bus', '버스', 'der Bus', '부스', { emoji: '🚌' }),
        ],
      },
      {
        id: 'b9l2', title: '타는 것',
        items: [
          W('b-fahrrad', '자전거', 'das Fahrrad', '파르라트', { emoji: '🚲' }),
          W('b-zug', '기차', 'der Zug', '축', { emoji: '🚆' }),
          W('b-schiff', '배 (타는 배)', 'das Schiff', '쉬프', { emoji: '🚢' }),
          W('b-flugzeug', '비행기', 'das Flugzeug', '플룩초이크', { emoji: '✈️' }),
          W('b-strasse', '길 · 도로', 'die Straße', '슈트라세'),
        ],
      },
    ],
  },
  {
    id: 'b10', title: '하늘과 날씨', emoji: '☀️', sub: '해 달 비 눈',
    lessons: [
      {
        id: 'b10l1', title: '하늘과 자연',
        items: [
          W('b-sonne', '해 · 태양', 'die Sonne', '조네', { emoji: '☀️' }),
          W('b-mond', '달', 'der Mond', '몬트', { emoji: '🌙' }),
          W('b-stern', '별', 'der Stern', '슈테른', { emoji: '⭐' }),
          W('b-baum', '나무', 'der Baum', '바움', { emoji: '🌳' }),
          W('b-blume', '꽃', 'die Blume', '블루메', { emoji: '🌸' }),
          W('b-berg', '산', 'der Berg', '베르크', { emoji: '⛰️' }),
        ],
      },
      {
        id: 'b10l2', title: '날씨',
        items: [
          W('b-regen', '비', 'der Regen', '레겐', { emoji: '🌧️' }),
          W('b-schnee', '눈 (내리는 눈)', 'der Schnee', '슈네', { emoji: '❄️' }),
          W('b-wind', '바람', 'der Wind', '빈트', { emoji: '💨' }),
          W('b-wetter', '날씨', 'das Wetter', '베터'),
          W('b-wolke', '구름', 'die Wolke', '볼케', { emoji: '☁️' }),
          W('b-himmel', '하늘', 'der Himmel', '힘멜'),
        ],
      },
    ],
  },
  {
    id: 'b11', title: '요일과 때', emoji: '📅', sub: '월요일 오늘 내일',
    lessons: [
      {
        id: 'b11l1', title: '요일',
        items: [
          W('b-montag', '월요일', 'Montag', '몬탁'),
          W('b-dienstag', '화요일', 'Dienstag', '딘스탁'),
          W('b-mittwoch', '수요일', 'Mittwoch', '미트보흐'),
          W('b-donnerstag', '목요일', 'Donnerstag', '도너스탁'),
          W('b-freitag', '금요일', 'Freitag', '프라이탁'),
          W('b-samstag', '토요일', 'Samstag', '잠스탁'),
          W('b-sonntag', '일요일', 'Sonntag', '존탁'),
        ],
      },
      {
        id: 'b11l2', title: '오늘 · 내일 · 어제',
        items: [
          W('b-heute', '오늘', 'heute', '호이테'),
          W('b-morgen', '내일', 'morgen', '모르겐', { note: '「아침」은 der Morgen — 같은 글자지만 뜻이 달라요' }),
          W('b-gestern', '어제', 'gestern', '게스턴'),
          W('b-tag', '하루 · 낮', 'der Tag', '탁'),
          W('b-woche', '주 (일주일)', 'die Woche', '보헤'),
          W('b-nacht', '밤', 'die Nacht', '나흐트', { emoji: '🌃' }),
        ],
      },
    ],
  },
  {
    id: 'b12', title: '반대말과 느낌', emoji: '🔁', sub: '크다 작다 뜨겁다 차갑다',
    lessons: [
      {
        id: 'b12l1', title: '크기 · 속도',
        items: [
          W('b-gross', '크다', 'groß', '그로스'),
          W('b-klein', '작다', 'klein', '클라인'),
          W('b-neu', '새롭다', 'neu', '노이'),
          W('b-alt', '낡았다 · 나이가 많다', 'alt', '알트'),
          W('b-schnell', '빠르다', 'schnell', '슈넬'),
          W('b-langsam', '느리다', 'langsam', '랑잠'),
        ],
      },
      {
        id: 'b12l2', title: '온도 · 느낌',
        items: [
          W('b-gut', '좋다', 'gut', '구트'),
          W('b-schlecht', '나쁘다', 'schlecht', '슐레히트'),
          W('b-heiss', '뜨겁다 · 덥다', 'heiß', '하이스'),
          W('b-kalt', '차갑다 · 춥다', 'kalt', '칼트'),
          W('b-warm', '따뜻하다', 'warm', '바름'),
          W('b-schoen', '예쁘다 · 아름답다', 'schön', '쇤'),
        ],
      },
    ],
  },
  {
    id: 'b13', title: '쉬운 동사', emoji: '🏃', sub: '먹다 마시다 가다',
    lessons: [
      {
        id: 'b13l1', title: '날마다 하는 일',
        items: [
          W('b-essen', '먹다', 'essen', '에쎈'),
          W('b-trinken', '마시다', 'trinken', '트링켄'),
          W('b-schlafen', '자다', 'schlafen', '슐라펜'),
          W('b-spielen', '놀다 · 게임하다', 'spielen', '슈필렌'),
          W('b-lesen', '읽다', 'lesen', '레젠'),
          W('b-schreiben', '쓰다', 'schreiben', '슈라이벤'),
        ],
      },
      {
        id: 'b13l2', title: '움직이고 느끼기',
        items: [
          W('b-gehen', '가다', 'gehen', '게엔'),
          W('b-kommen', '오다', 'kommen', '코멘'),
          W('b-laufen', '달리다', 'laufen', '라우펜'),
          W('b-sehen', '보다', 'sehen', '제엔'),
          W('b-hoeren', '듣다', 'hören', '회렌'),
          W('b-lernen', '배우다 · 공부하다', 'lernen', '레르넨'),
        ],
      },
    ],
  },
  {
    id: 'b14', title: '나와 너', emoji: '🙋', sub: '나는 너는 내 이름은',
    lessons: [
      {
        id: 'b14l1', title: '나 · 너 · 우리',
        items: [
          W('b-ich', '나', 'ich', '이히'),
          W('b-du', '너 (친구에게)', 'du', '두'),
          W('b-er', '그 (남자)', 'er', '에어'),
          W('b-sie', '그녀 (여자)', 'sie', '지'),
          W('b-wir', '우리', 'wir', '비어'),
        ],
      },
      {
        id: 'b14l2', title: '자기소개',
        items: [
          S('b-ichheisse', '내 이름은 안나예요.', 'Ich heiße Anna.', null),
          S('b-wieheisstdu', '이름이 뭐예요?', 'Wie heißt du?', null),
          S('b-ichbinzehn', '나는 열 살이에요.', 'Ich bin zehn Jahre alt.', null),
          S('b-wiealt', '몇 살이에요?', 'Wie alt bist du?', null),
          S('b-wiegehts', '잘 지내요?', 'Wie geht es dir?', null),
          S('b-mirgehtgut', '나는 잘 지내요.', 'Mir geht es gut.', null),
          S('b-ichkomme', '나는 한국에서 왔어요.', 'Ich komme aus Korea.', null),
        ],
      },
    ],
  },
  {
    id: 'b15', title: '쉬운 문장과 질문', emoji: '💬', sub: '이것은 무엇이에요?',
    lessons: [
      {
        id: 'b15l1', title: '이것은 ~예요',
        items: [
          S('b-dasisteinhund', '이것은 개예요.', 'Das ist ein Hund.', null),
          S('b-dasisteinekatze', '이것은 고양이예요.', 'Das ist eine Katze.', null),
          S('b-dasistmeinvater', '이분은 우리 아빠예요.', 'Das ist mein Vater.', null),
          S('b-dasistmeinemutter', '이분은 우리 엄마예요.', 'Das ist meine Mutter.', null),
          S('b-diesonnescheint', '해가 비쳐요.', 'Die Sonne scheint.', null),
          S('b-daswasserkalt', '물이 차가워요.', 'Das Wasser ist kalt.', null),
        ],
      },
      {
        id: 'b15l2', title: '나는 ~해요',
        items: [
          S('b-ichhabebruder', '나는 남자 형제가 한 명 있어요.', 'Ich habe einen Bruder.', null),
          S('b-ichmagbananen', '나는 바나나를 좋아해요.', 'Ich mag Bananen.', null),
          S('b-ichesseapfel', '나는 사과를 먹어요.', 'Ich esse einen Apfel.', null),
          S('b-ichtrinkewasser', '나는 물을 마셔요.', 'Ich trinke Wasser.', null),
          S('b-ichhabehunger', '배고파요.', 'Ich habe Hunger.', null),
          S('b-ichhabedurst', '목말라요.', 'Ich habe Durst.', null),
        ],
      },
      {
        id: 'b15l3', title: '묻는 말',
        items: [
          W('b-was', '무엇', 'was', '바스'),
          W('b-wer', '누구', 'wer', null),
          W('b-wo', '어디', 'wo', '보'),
          W('b-wann', '언제', 'wann', '반'),
          W('b-wie', '어떻게', 'wie', null),
          S('b-wasistdas', '이것은 무엇이에요?', 'Was ist das?', null),
          S('b-woistdieschule', '학교는 어디예요?', 'Wo ist die Schule?', null),
          S('b-wersistdas', '이 사람은 누구예요?', 'Wer ist das?', null),
        ],
      },
    ],
  },
];
