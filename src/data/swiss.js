/* 독일어 여행 회화 코스 — 단원 → 레슨 → 낱말·문장.
 *
 * ★ 기본은 표준 독일어(Hochdeutsch)다 ★
 *
 * 처음엔 스위스 독일어로 만들었는데, 그건 독일·오스트리아에서는 안 통하고
 * 글로 배우거나 검색할 수도 없다. 처음 배우는 사람이 여행에서 바로 쓰려면
 * 표준 독일어여야 한다. 스위스에서 실제로 다르게 말하는 것만 팁(ch)으로 붙인다 —
 * 억양만 다른 것은 팁을 안 만든다. 팁은 전체의 열에 하나쯤이다.
 *
 * 항목 하나:
 *   ko    뜻 (맨 위에 온다 — 한국 사람이 보는 앱이다)
 *   de    표준 독일어 (소리 내는 쪽. 듣기가 가장 중요한 학습법이다)
 *   han   한글 도움말 — 짧은 낱말에만. 한글로 적으면 발음이 심하게 어긋나는
 *         것과 긴 문장에는 안 적는다. 듣기로 배우라고.
 *   ch    스위스 팁 { text, note? } — 실제로 다른 말일 때만
 *   kind  word | sentence — 문장은 조립 문제에 쓴다
 *
 * 스위스 팁의 소리는 de-CH 목소리가 있으면 그걸 쓰지만, 그건 스위스식 표준
 * 독일어 발음이지 방언 원어민 발음이 아니다. 화면에 그렇게 적지 않는다.
 *
 * 단원 순서는 여행에서 부딪히는 순서다 — 교과서 순서가 아니다. */

const W = (id, ko, de, han, extra = {}) => ({ id, kind: 'word', ko, de, ...(han ? { han } : {}), ...extra });
const S = (id, ko, de, han, extra = {}) => ({ id, kind: 'sentence', ko, de, ...(han ? { han } : {}), ...extra });
const CH = (text, note) => ({ ch: note ? { text, note } : { text } });

export const SWISS_UNITS = [
  {
    id: 'u1', title: '인사와 기본 표현', emoji: '👋', sub: '만나고 · 고맙고 · 미안하고',
    lessons: [
      {
        id: 'u1l1', title: '인사',
        items: [
          W('hallo', '안녕 (누구에게나)', 'Hallo', '할로', CH('Hoi', '친구끼리 — 스위스에서 흔히 들려요')),
          W('gutentag', '안녕하세요 (낮)', 'Guten Tag', '구텐 탁', CH('Grüezi', '스위스 인사의 대표 — 가게·거리 어디서나')),
          W('gutenmorgen', '좋은 아침', 'Guten Morgen', '구텐 모르겐'),
          W('gutenabend', '좋은 저녁', 'Guten Abend', '구텐 아벤트'),
          W('gutenacht', '잘 자요', 'Gute Nacht', '구테 나흐트'),
          W('tschuess', '잘 가 · 안녕 (헤어질 때, 편하게)', 'Tschüss', '취스', CH('Ade', '스위스에서는 이렇게도 많이 해요')),
          W('aufwiedersehen', '안녕히 가세요 (정중하게)', 'Auf Wiedersehen', '아우프 비더제엔'),
          W('bisspaeter', '이따 봐요', 'Bis später', '비스 슈페터'),
        ],
      },
      {
        id: 'u1l2', title: '고마워요 · 미안해요 · 네/아니요',
        items: [
          W('danke', '고마워요', 'Danke', '당케', CH('Merci', '프랑스어지만 스위스 독일어권에서 다들 이렇게 말해요')),
          W('dankeschoen', '정말 고마워요', 'Vielen Dank', '필렌 당크', CH('Merci vilmal')),
          W('bitte', '부탁해요 · 천만에요', 'Bitte', '비테'),
          W('bitteschoen', '천만에요 · 여기 있어요', 'Bitte schön', '비테 쇤'),
          W('entschuldigung', '실례해요 · 미안해요', 'Entschuldigung', null, CH('Exgüsi', '가볍게 「실례해요」')),
          S('tutmirleid', '죄송해요.', 'Es tut mir leid.', null),
          W('ja', '네', 'Ja', '야'),
          W('nein', '아니요', 'Nein', '나인'),
          W('keinproblem', '괜찮아요 · 문제없어요', 'Kein Problem', '카인 프로블렘'),
        ],
      },
    ],
  },
  {
    id: 'u2', title: '숫자와 시간', emoji: '🔢', sub: '값을 듣고 · 시간을 묻고',
    lessons: [
      {
        id: 'u2l1', title: '1부터 10까지',
        items: [
          W('n1', '1 하나', 'eins', '아인스'),
          W('n2', '2 둘', 'zwei', '츠바이'),
          W('n3', '3 셋', 'drei', '드라이'),
          W('n4', '4 넷', 'vier', '피어'),
          W('n5', '5 다섯', 'fünf', '퓐프'),
          W('n6', '6 여섯', 'sechs', '젝스'),
          W('n7', '7 일곱', 'sieben', '지벤'),
          W('n8', '8 여덟', 'acht', '아흐트'),
          W('n9', '9 아홉', 'neun', '노인'),
          W('n10', '10 열', 'zehn', '첸'),
        ],
      },
      {
        id: 'u2l2', title: '11부터 천까지',
        items: [
          W('n11', '11', 'elf', '엘프'),
          W('n12', '12', 'zwölf', null),
          W('n15', '15', 'fünfzehn', '퓐프첸'),
          W('n20', '20', 'zwanzig', '츠반치히'),
          W('n30', '30', 'dreißig', '드라이시히'),
          W('n50', '50', 'fünfzig', '퓐프치히'),
          W('n100', '100 백', 'hundert', '훈데르트'),
          W('n1000', '1000 천', 'tausend', '타우젠트'),
        ],
      },
      {
        id: 'u2l3', title: '시간 · 오늘 · 내일',
        items: [
          S('wiespaet', '지금 몇 시예요?', 'Wie spät ist es?', null),
          S('umdrei', '세 시에요.', 'Um drei Uhr.', null),
          W('wann', '언제요?', 'Wann?', '반'),
          W('jetzt', '지금', 'jetzt', '옛츠트'),
          W('heute', '오늘', 'heute', '호이테'),
          W('morgen', '내일', 'morgen', '모르겐'),
          W('gestern', '어제', 'gestern', '게스턴'),
          W('minute', '분', 'Minute', '미누테'),
          W('stunde', '시간 (한 시간)', 'Stunde', '슈툰데'),
        ],
      },
    ],
  },
  {
    id: 'u3', title: '식당과 카페', emoji: '🍽️', sub: '자리 · 주문 · 계산',
    lessons: [
      {
        id: 'u3l1', title: '식당에서',
        items: [
          S('tischfuerzwei', '두 명 자리 부탁해요.', 'Einen Tisch für zwei, bitte.', null),
          S('speisekarte', '메뉴판 주세요.', 'Die Speisekarte, bitte.', null),
          S('haettegern', '물 한 잔 주세요.', 'Ich hätte gern ein Wasser.', null),
          S('empfehlen', '뭐가 맛있어요?', 'Was empfehlen Sie?', null),
          S('lecker', '맛있었어요.', 'Das war lecker.', null),
          S('rechnung', '계산서 주세요.', 'Die Rechnung, bitte.', null),
          S('zusammen', '(점원이) 같이 계산하세요, 따로 하세요?', 'Zusammen oder getrennt?', null),
          W('wasser', '물', 'Wasser', '바서'),
          W('brot', '빵', 'Brot', '브로트'),
          W('eis', '아이스크림', 'Eis', '아이스', CH('Glacé', '스위스 메뉴판에는 이렇게 적혀 있어요')),
        ],
      },
      {
        id: 'u3l2', title: '카페에서',
        items: [
          S('einenkaffee', '커피 한 잔 주세요.', 'Einen Kaffee, bitte.', null, CH('E Kafi, bitte', '스위스 카페에서는 「Café crème」라는 메뉴가 흔해요')),
          W('mitmilch', '우유 넣어서', 'mit Milch', '밋 밀히'),
          W('ohnezucker', '설탕 빼고', 'ohne Zucker', '오네 추커'),
          W('zummitnehmen', '포장이요', 'zum Mitnehmen', '춤 밋네멘'),
          S('kuchen', '케이크 한 조각 주세요.', 'Ein Stück Kuchen, bitte.', null),
          S('wlan', '와이파이 있어요?', 'Haben Sie WLAN?', null),
          W('tee', '차', 'Tee', '테'),
          W('bier', '맥주', 'Bier', '비어', CH('Stange', '스위스에서 생맥주 한 잔을 이렇게 시켜요')),
        ],
      },
    ],
  },
  {
    id: 'u4', title: '호텔', emoji: '🏨', sub: '체크인 · 방 · 아침',
    lessons: [
      {
        id: 'u4l1', title: '체크인',
        items: [
          S('reservierung', '예약했어요.', 'Ich habe eine Reservierung.', null),
          S('aufdennamen', '「김」 이름으로요.', 'Auf den Namen Kim.', null),
          S('zweinaechte', '이틀 밤 묵을 방이요.', 'Ein Zimmer für zwei Nächte.', null),
          S('fruehstueck', '아침 식사는 언제예요?', 'Wann gibt es Frühstück?', null),
          S('schluessel', '열쇠 주세요.', 'Den Schlüssel, bitte.', null),
          S('taxi', '택시 불러 주실 수 있어요?', 'Können Sie mir ein Taxi rufen?', null),
          W('aufzug', '엘리베이터', 'Aufzug', '아우프축', CH('Lift')),
          W('zimmer', '방', 'Zimmer', '침머'),
        ],
      },
    ],
  },
  {
    id: 'u5', title: '공항과 기차', emoji: '🚆', sub: '표 · 승강장 · 갈아타기',
    lessons: [
      {
        id: 'u5l1', title: '공항에서',
        items: [
          S('checkin', '체크인 어디서 해요?', 'Wo ist der Check-in?', null),
          S('meinpass', '여기 제 여권이요.', 'Hier ist mein Pass.', null),
          W('handgepaeck', '기내 수하물', 'Handgepäck', null),
          S('boarding', '탑승은 언제예요?', 'Wann ist das Boarding?', null),
          S('gepaeckausgabe', '수하물 찾는 곳이 어디예요?', 'Wo ist die Gepäckausgabe?', null),
          S('verzollen', '신고할 게 없어요.', 'Ich habe nichts zu verzollen.', null),
          W('flug', '비행기 편', 'Flug', '플룩'),
          W('ausgang', '출구', 'Ausgang', '아우스강'),
        ],
      },
      {
        id: 'u5l2', title: '기차와 대중교통',
        items: [
          S('fahrkarte', '취리히 가는 표 한 장이요.', 'Eine Fahrkarte nach Zürich, bitte.', null, CH('Es Billett nach Zürich, bitte', '스위스에서 표는 「Billett」이에요')),
          S('hinundzurueck', '(점원이) 편도예요, 왕복이에요?', 'Einfach oder hin und zurück?', null),
          S('gleis', '몇 번 승강장이에요?', 'Von welchem Gleis?', null),
          S('zugnachbern', '이게 베른 가는 기차예요?', 'Ist das der Zug nach Bern?', null),
          S('umsteigen', '어디서 갈아타요?', 'Wo muss ich umsteigen?', null),
          W('bahnhof', '기차역', 'Bahnhof', '반호프'),
          W('bus', '버스', 'Bus', '부스'),
          W('strassenbahn', '트램 (노면전차)', 'Straßenbahn', null, CH('Tram', '스위스·남부 독일에서는 이렇게 불러요')),
          W('fahrrad', '자전거', 'Fahrrad', '파라트', CH('Velo', '표지판·대여소에 이렇게 적혀 있어요')),
        ],
      },
    ],
  },
  {
    id: 'u6', title: '길 찾기', emoji: '🧭', sub: '어디예요? · 화장실 · 표지판',
    lessons: [
      {
        id: 'u6l1', title: '어디예요?',
        items: [
          S('woist', '실례합니다, 기차역이 어디예요?', 'Entschuldigung, wo ist der Bahnhof?', null),
          S('wiekommeich', '중앙역에 어떻게 가요?', 'Wie komme ich zum Hauptbahnhof?', null),
          S('istesweit', '멀어요?', 'Ist es weit?', null),
          S('aufderkarte', '지도에서 보여 주실 수 있어요?', 'Können Sie mir das auf der Karte zeigen?', null),
          W('geradeaus', '직진', 'geradeaus', null),
          W('links', '왼쪽', 'links', '링크스'),
          W('rechts', '오른쪽', 'rechts', null),
          W('hier', '여기', 'hier', '히어'),
          W('dort', '저기', 'dort', '도르트'),
        ],
      },
      {
        id: 'u6l2', title: '화장실과 표지판',
        items: [
          S('toilette', '화장실이 어디예요?', 'Wo ist die Toilette?', null),
          S('mussbezahlen', '돈 내야 해요?', 'Muss ich bezahlen?', null),
          W('damen', '여자 (화장실 표시)', 'Damen', '다멘'),
          W('herren', '남자 (화장실 표시)', 'Herren', '헤렌'),
          W('eingang', '입구', 'Eingang', '아인강'),
          W('geoeffnet', '영업 중 · 열림', 'geöffnet', null),
          W('geschlossen', '닫힘 · 휴무', 'geschlossen', null),
          W('drucken', '미시오', 'Drücken', null),
          W('ziehen', '당기시오', 'Ziehen', '치엔'),
        ],
      },
    ],
  },
  {
    id: 'u7', title: '쇼핑과 결제', emoji: '🛍️', sub: '얼마예요? · 카드 돼요?',
    lessons: [
      {
        id: 'u7l1', title: '얼마예요?',
        items: [
          S('wieviel', '이거 얼마예요?', 'Wie viel kostet das?', null),
          S('zuteuer', '너무 비싸요.', 'Das ist zu teuer.', null),
          S('ichnehme', '이걸로 할게요.', 'Ich nehme das.', null),
          S('schauenur', '그냥 구경만 해요.', 'Ich schaue nur.', null),
          S('mitkarte', '카드로 계산할 수 있어요?', 'Kann ich mit Karte zahlen?', null),
          W('bar', '현금으로', 'bar', '바르'),
          S('quittung', '영수증 주세요.', 'Die Quittung, bitte.', null),
          W('kasse', '계산대', 'Kasse', '카세'),
          W('euro', '유로', 'Euro', '오이로', CH('Franken (CHF)', '스위스 돈은 유로가 아니라 프랑이에요')),
        ],
      },
    ],
  },
  {
    id: 'u8', title: '도움과 응급', emoji: '🆘', sub: '이해 못 했어요 · 의사가 필요해요',
    lessons: [
      {
        id: 'u8l1', title: '도움 요청',
        items: [
          S('helfen', '도와주실 수 있어요?', 'Können Sie mir helfen?', null),
          S('verstehenicht', '이해 못 했어요.', 'Ich verstehe nicht.', null),
          S('englisch', '영어 하세요?', 'Sprechen Sie Englisch?', null),
          S('langsam', '천천히 말해 주세요.', 'Langsam, bitte.', null),
          S('nocheinmal', '한 번 더 말해 주세요.', 'Noch einmal, bitte.', null),
          S('wasbedeutet', '이게 무슨 뜻이에요?', 'Was bedeutet das?', null),
          S('passverloren', '여권을 잃어버렸어요.', 'Ich habe meinen Pass verloren.', null),
        ],
      },
      {
        id: 'u8l2', title: '응급상황',
        items: [
          W('hilfe', '도와주세요!', 'Hilfe!', '힐페'),
          S('braucheinenarzt', '의사가 필요해요.', 'Ich brauche einen Arzt.', null),
          S('rufensie', '구급차를 불러 주세요.', 'Rufen Sie einen Krankenwagen.', null),
          W('krankenhaus', '병원', 'Krankenhaus', null, CH('Spital', '스위스 표지판은 이렇게 적혀 있어요')),
          W('apotheke', '약국', 'Apotheke', '아포테케'),
          W('polizei', '경찰', 'Polizei', '폴리차이'),
          S('tutweh', '여기가 아파요.', 'Es tut hier weh.', null),
          W('notruf', '긴급 전화 112', 'Notruf 112', null, { note: '유럽 어디서나 112 — 스위스도 통해요' }),
        ],
      },
    ],
  },
  {
    id: 'u9', title: '간단한 일상대화', emoji: '💬', sub: '이름 · 어디서 왔는지 · 날씨',
    lessons: [
      {
        id: 'u9l1', title: '처음 만났을 때',
        items: [
          S('wiegehts', '잘 지내요?', "Wie geht's?", null),
          S('gutdanke', '잘 지내요, 고마워요.', 'Gut, danke.', null),
          S('ichheisse', '제 이름은 미나예요.', 'Ich heiße Mina.', null),
          S('auskorea', '한국에서 왔어요.', 'Ich komme aus Korea.', null),
          S('freutmich', '만나서 반가워요.', 'Freut mich.', null),
          S('bisschendeutsch', '독일어 조금 해요.', 'Ich spreche ein bisschen Deutsch.', null),
          S('schoeneswetter', '오늘 날씨 좋네요.', 'Schönes Wetter heute.', null),
          S('bismorgen', '내일 봐요!', 'Bis morgen!', null),
        ],
      },
    ],
  },
];

/* 문장을 조립 문제에 쓰려면 낱말로 쪼개야 한다. 띄어쓰기로 자르고 문장부호는
   마지막 낱말에 붙여 둔다 — 듀오링고도 그렇게 한다. */
export function tokensOf(item) {
  return String(item.de).split(/\s+/).filter(Boolean);
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
