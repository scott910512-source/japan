/* 실전 연습 — 스테이지 자료.
 *
 * 화면에는 대사를 한 줄도 박지 않는다. 스테이지를 늘리는 일이 여기 배열
 * 하나를 더 쓰는 것으로 끝나야 한다.
 *
 * 대사는 실제로 편의점에서 오가는 말로 적었다. 「자연스러워 보이는 일본어」와
 * 「실제로 쓰는 일본어」는 다르고, 틀린 말을 자신 있게 가르치는 게 제일 나쁘다.
 * 확신이 안 서는 표현은 아예 뺐다.
 *
 * 표현 id는 회독 저장소에 그대로 들어간다(rpg-…). 실전에서 틀린 표현이
 * 오늘의 학습 큐에 약점으로 올라오는 게 이 기능의 핵심이라, id 규칙을
 * 바꾸면 그 연결이 끊긴다. */

export const STAGES = [
  {
    id: 'conbini',
    label: '편의점',
    icon: '🏪',
    place: 'コンビニ',
    intro: '늦은 밤. 도시락 하나와 음료를 계산대에 올렸다.',
    goal: '계산을 끝내고 나오기',

    /* 이 스테이지에서 익힐 말. 다섯에서 여덟 개.
       더 넣으면 한 판이 길어져서 끝까지 안 간다. */
    expressions: [
      { id: 'rpg-conbini-irasshai', jp: 'いらっしゃいませ', kana: 'いらっしゃいませ', ko: '어서 오세요', note: '가게에 들어가면 늘 듣는 말. 대답은 안 해도 된다' },
      { id: 'rpg-conbini-fukuro', jp: '袋', kana: 'ふくろ', ko: '봉투' },
      { id: 'rpg-conbini-onegai', jp: 'お願いします', kana: 'おねがいします', ko: '부탁합니다', note: '뭘 해 달라고 할 때 제일 많이 쓰는 말' },
      { id: 'rpg-conbini-daijobu', jp: '大丈夫です', kana: 'だいじょうぶです', ko: '괜찮습니다', note: '「괜찮다」가 아니라 「됐다·필요 없다」는 뜻으로 더 자주 쓴다' },
      { id: 'rpg-conbini-atatame', jp: '温めますか', kana: 'あたためますか', ko: '데워 드릴까요?', note: '도시락을 사면 거의 반드시 듣는다' },
      { id: 'rpg-conbini-ohashi', jp: 'お箸', kana: 'おはし', ko: '젓가락' },
      { id: 'rpg-conbini-genkin', jp: '現金', kana: 'げんきん', ko: '현금' },
      { id: 'rpg-conbini-otsuri', jp: 'お釣り', kana: 'おつり', ko: '거스름돈' },
    ],

    /* 실전 — 점원이 묻고 내가 답한다.
     *
     * 답이 둘일 수 있게 뒀다. 「봉투 필요하세요?」에 「네」도 「됐어요」도 맞는
     * 답이다. 하나만 정답으로 치면 맞는데 틀렸다고 나온다. */
    scenes: [
      {
        id: 'conbini-1',
        npc: { jp: 'いらっしゃいませ。', kana: 'いらっしゃいませ。', ko: '어서 오세요.' },
        ask: '점원이 인사했다. 어떻게 할까?',
        choices: [
          { jp: '（軽く会釈する）', ko: '(가볍게 목례한다)', ok: true, uses: ['rpg-conbini-irasshai'], note: '대답 안 해도 된다. 목례면 충분하다' },
          { jp: 'こんにちは。', ko: '안녕하세요.', ok: true, uses: ['rpg-conbini-irasshai'], note: '이렇게 해도 이상하지 않다' },
          { jp: 'いらっしゃいませ。', ko: '어서 오세요.', ok: false, why: '이건 손님을 맞는 쪽이 하는 말이에요' },
        ],
        hints: ['가게 사람이 손님에게 하는 인사예요', '손님은 굳이 답하지 않아도 됩니다'],
        reaction: { ok: '점원이 계산을 시작한다', no: '점원이 잠깐 갸웃한다' },
      },
      {
        id: 'conbini-2',
        npc: { jp: 'お弁当、温めますか。', kana: 'おべんとう、あたためますか。', ko: '도시락 데워 드릴까요?' },
        ask: '뭐라고 답할까?',
        choices: [
          { jp: 'はい、お願いします。', ko: '네, 부탁합니다.', ok: true, uses: ['rpg-conbini-atatame', 'rpg-conbini-onegai'] },
          { jp: '大丈夫です。', ko: '괜찮습니다. (안 데워도 돼요)', ok: true, uses: ['rpg-conbini-atatame', 'rpg-conbini-daijobu'] },
          { jp: 'いただきます。', ko: '잘 먹겠습니다.', ok: false, why: '먹기 직전에 하는 말이에요' },
        ],
        hints: ['温める = 데우다', '「해 주세요」면 お願いします, 「됐어요」면 大丈夫です'],
        reaction: { ok: '점원이 도시락을 전자레인지에 넣는다', no: '점원이 잠깐 멈칫한다' },
      },
      {
        id: 'conbini-3',
        npc: { jp: 'お箸はお付けしますか。', kana: 'おはしはおつけしますか。', ko: '젓가락 넣어 드릴까요?' },
        ask: '뭐라고 답할까?',
        choices: [
          { jp: 'はい、お願いします。', ko: '네, 부탁합니다.', ok: true, uses: ['rpg-conbini-ohashi', 'rpg-conbini-onegai'] },
          { jp: '大丈夫です。', ko: '괜찮습니다.', ok: true, uses: ['rpg-conbini-ohashi', 'rpg-conbini-daijobu'] },
          { jp: 'ごちそうさまでした。', ko: '잘 먹었습니다.', ok: false, why: '다 먹고 나서 하는 말이에요' },
        ],
        hints: ['お箸 = ?', '밥 먹을 때 쓰는 것을 묻고 있어요'],
        reaction: { ok: '점원이 젓가락을 봉투에 넣는다', no: '점원이 젓가락을 든 채 기다린다' },
      },
      {
        id: 'conbini-4',
        npc: { jp: '袋はご利用ですか。', kana: 'ふくろはごりようですか。', ko: '봉투 필요하세요?' },
        ask: '뭐라고 답할까?',
        choices: [
          { jp: 'はい、お願いします。', ko: '네, 부탁합니다.', ok: true, uses: ['rpg-conbini-fukuro', 'rpg-conbini-onegai'] },
          { jp: '大丈夫です。', ko: '괜찮습니다. (안 주셔도 돼요)', ok: true, uses: ['rpg-conbini-fukuro', 'rpg-conbini-daijobu'] },
          { jp: 'そうですね。', ko: '그렇네요.', ok: false, why: '맞장구치는 말이라 답이 안 돼요' },
        ],
        hints: ['袋 = ?', '물건을 담는 것을 묻고 있어요'],
        reaction: { ok: '점원이 손을 멈추고 다음으로 넘어간다', no: '점원이 다시 묻는다' },
      },
      {
        id: 'conbini-5',
        npc: { jp: 'お支払いは現金ですか、カードですか。', kana: 'おしはらいはげんきんですか、カードですか。', ko: '결제는 현금인가요, 카드인가요?' },
        ask: '현금으로 내려고 한다',
        choices: [
          { jp: '現金でお願いします。', ko: '현금으로 부탁합니다.', ok: true, uses: ['rpg-conbini-genkin', 'rpg-conbini-onegai'] },
          { jp: '現金です。', ko: '현금입니다.', ok: true, uses: ['rpg-conbini-genkin'], note: '짧게 이렇게만 해도 통한다' },
          { jp: '大丈夫です。', ko: '괜찮습니다.', ok: false, why: '둘 중에 고르는 질문이라 「됐어요」는 답이 안 돼요' },
        ],
        hints: ['現金 = ?', '둘 중 하나를 고르고 「〜でお願いします」를 붙이면 돼요'],
        reaction: { ok: '점원이 금액을 알려 준다', no: '점원이 다시 묻는다' },
      },
      {
        id: 'conbini-6',
        npc: { jp: 'お釣りとレシートです。ありがとうございました。', kana: 'おつりとレシートです。ありがとうございました。', ko: '거스름돈과 영수증입니다. 감사합니다.' },
        ask: '받고 나가면 된다',
        choices: [
          { jp: 'ありがとうございます。', ko: '감사합니다.', ok: true, uses: ['rpg-conbini-otsuri'] },
          { jp: 'どうも。', ko: '고마워요.', ok: true, uses: ['rpg-conbini-otsuri'], note: '짧게 이렇게도 많이 한다' },
          { jp: 'お願いします。', ko: '부탁합니다.', ok: false, why: '이미 다 끝났어요' },
        ],
        hints: ['お釣り = ?', '받았으면 인사하고 나가면 됩니다'],
        reaction: { ok: '문이 열리고 밤공기가 들어온다', no: '점원이 기다린다' },
      },
    ],
  },
];

/* 아직 안 만든 곳. 잠긴 채로 보여 준다 — 다음에 뭐가 있는지 보이는 것과
   아무것도 없는 것은 다르다. 만들면 위 STAGES로 옮긴다. */
export const COMING = [
  { id: 'ramen', label: '라멘집', icon: '🍜' },
  { id: 'train', label: '전철', icon: '🚃' },
  { id: 'hotel', label: '호텔', icon: '🏨' },
  { id: 'izakaya', label: '이자카야', icon: '🍺' },
];
