/* 삿포로 여행 목록 중 단어장에 없던 20개.
 *
 * ★ 왜 스무 개뿐인가 ★
 *
 * 여행 목록은 70개인데 쉰 개는 이미 단어장에 있다(寒い·部屋·薬·切符…).
 * 그 쉰 개는 여기서 다시 만들지 않는다 — 사용자의 회독 기록이 그 id에 붙어
 * 있어서, 같은 낱말을 새로 만들면 카드가 두 장이 되고 기록도 둘로 갈린다.
 * 없는 표기만 채운다(기출 words-kiju.js와 같은 방식).
 *
 * ★ 급수 밖 ★
 *
 * 札幌·小樽·大通·新千歳·時計台·市電·大浴場·雪まつり는 JLPT 급수가 없다.
 * 처음엔 비워 뒀는데(null) 그게 틀렸다 — 단어장에 실릴 때 N5로 메워져서
 * (allWords.js의 mergeUnique가 마지막에 `|| 'N5'`), 「N5 어휘 534개」가
 * 542개가 됐다. 札幌은 N5 어휘가 아니다. 공부할 범위를 세는 숫자에 여행
 * 낱말을 섞으면 그 숫자가 무슨 뜻인지 알 수 없게 된다.
 *
 * 그래서 다섯 급수 어디에도 안 드는 표시를 단다. 레벨을 고른 사람에게는
 * 안 보이고(wordFilters.js), JLPT 세트에도 안 들어간다(Jlpt.jsx가 N5~N1만
 * 그린다). 여행 듣기는 후보 목록을 통째로 바꿔 끼우니 그대로 나온다.
 *
 * 값이 무엇인지는 아무 데서도 안 쓴다 — 다섯 급수가 아니기만 하면 된다.
 * 그래서 여기서 정하고 여기서 끝낸다. */
export const NO_JLPT = '급수밖';
export const SAPPORO_WORDS = [
  // ── 공항 · 입국 ──
  { id: 'sp-0001', kanji: '乗り場', kana: 'のりば', mean: '타는 곳', type: 'noun', level: 'N4',
    example: 'バス乗り場はあちらです。', exampleKana: 'バスのりばはあちらです。', exampleKo: '버스 타는 곳은 저쪽입니다.', tags: ['여행', '이동'] },
  { id: 'sp-0002', kanji: '案内', kana: 'あんない', mean: '안내', type: 'noun', level: 'N4',
    example: '駅まで案内しましょうか。', exampleKana: 'えきまであんないしましょうか。', exampleKo: '역까지 안내해 드릴까요?', tags: ['여행', '이동'] },
  { id: 'sp-0003', kanji: '新千歳', kana: 'しんちとせ', mean: '신치토세;삿포로의 공항', type: 'noun', level: NO_JLPT,
    example: '新千歳空港に着きました。', exampleKana: 'しんちとせくうこうにつきました。', exampleKo: '신치토세 공항에 도착했습니다.', tags: ['여행', '삿포로', '지명'] },
  { id: 'sp-0004', kanji: '札幌', kana: 'さっぽろ', mean: '삿포로', type: 'noun', level: NO_JLPT,
    example: '札幌まで切符を二枚ください。', exampleKana: 'さっぽろまできっぷをにまいください。', exampleKo: '삿포로까지 표 두 장 주세요.', tags: ['여행', '삿포로', '지명'] },

  // ── 이동 ──
  { id: 'sp-0005', kanji: '快速', kana: 'かいそく', mean: '쾌속;빠른 열차', type: 'noun', level: 'N3',
    example: '快速に乗れば速いです。', exampleKana: 'かいそくにのればはやいです。', exampleKo: '쾌속을 타면 빠릅니다.', tags: ['여행', '이동'] },
  { id: 'sp-0006', kanji: '市電', kana: 'しでん', mean: '시전;노면전차', type: 'noun', level: NO_JLPT,
    example: '市電で行けますか。', exampleKana: 'しでんでいけますか。', exampleKo: '노면전차로 갈 수 있나요?', tags: ['여행', '삿포로', '이동'] },
  { id: 'sp-0007', kanji: '地下街', kana: 'ちかがい', mean: '지하상가', type: 'noun', level: 'N3',
    example: '寒いので地下街を歩きます。', exampleKana: 'さむいのでちかがいをあるきます。', exampleKo: '추우니까 지하상가로 걷습니다.', tags: ['여행', '삿포로', '이동'] },
  { id: 'sp-0008', kanji: '大通', kana: 'おおどおり', mean: '오도리;삿포로의 역·공원', type: 'noun', level: NO_JLPT,
    example: '大通で地下鉄に乗り換えます。', exampleKana: 'おおどおりでちかてつにのりかえます。', exampleKo: '오도리에서 지하철로 갈아탑니다.', tags: ['여행', '삿포로', '지명'] },
  { id: 'sp-0009', kanji: '小樽', kana: 'おたる', mean: '오타루', type: 'noun', level: NO_JLPT,
    example: '小樽までは一時間ぐらいです。', exampleKana: 'おたるまではいちじかんぐらいです。', exampleKo: '오타루까지는 한 시간 정도입니다.', tags: ['여행', '삿포로', '지명'] },

  // ── 숙소 ──
  { id: 'sp-0010', kanji: '大浴場', kana: 'だいよくじょう', mean: '대욕장;호텔의 공동 목욕탕', type: 'noun', level: NO_JLPT,
    example: '大浴場は何時までですか。', exampleKana: 'だいよくじょうはなんじまでですか。', exampleKo: '대욕장은 몇 시까지인가요?', tags: ['여행', '숙소'] },

  // ── 먹기 ──
  { id: 'sp-0011', kanji: '海鮮', kana: 'かいせん', mean: '해산물', type: 'noun', level: 'N3',
    example: '朝市で海鮮丼を食べました。', exampleKana: 'あさいちでかいせんどんをたべました。', exampleKo: '아침 시장에서 해산물 덮밥을 먹었습니다.', tags: ['여행', '음식'] },
  { id: 'sp-0012', kanji: '相席', kana: 'あいせき', mean: '합석', type: 'noun', level: 'N3',
    example: '相席でもいいですか。', exampleKana: 'あいせきでもいいですか。', exampleKo: '합석해도 괜찮나요?', tags: ['여행', '음식'] },

  // ── 가게 · 계산 ──
  { id: 'sp-0013', kanji: '試着', kana: 'しちゃく', mean: '입어 봄', type: 'noun', level: 'N3',
    example: '試着してもいいですか。', exampleKana: 'しちゃくしてもいいですか。', exampleKo: '입어 봐도 되나요?', tags: ['여행', '쇼핑'] },
  { id: 'sp-0014', kanji: '土産', kana: 'みやげ', mean: '선물;기념품', type: 'noun', level: 'N4',
    example: '友達にお土産を買います。', exampleKana: 'ともだちにおみやげをかいます。', exampleKo: '친구에게 줄 선물을 삽니다.', tags: ['여행', '쇼핑'] },
  { id: 'sp-0015', kanji: '配送', kana: 'はいそう', mean: '배송', type: 'noun', level: 'N3',
    example: 'ホテルまで配送できますか。', exampleKana: 'ホテルまではいそうできますか。', exampleKo: '호텔까지 배송 되나요?', tags: ['여행', '쇼핑'] },

  // ── 눈 · 길 ──
  { id: 'sp-0016', kanji: '吹雪', kana: 'ふぶき', mean: '눈보라', type: 'noun', level: 'N3',
    example: '吹雪で電車が止まりました。', exampleKana: 'ふぶきででんしゃがとまりました。', exampleKo: '눈보라로 전철이 멈췄습니다.', tags: ['여행', '날씨'] },
  { id: 'sp-0017', kanji: '長靴', kana: 'ながぐつ', mean: '장화', type: 'noun', level: 'N3',
    example: '雪の日は長靴が要ります。', exampleKana: 'ゆきのひはながぐつがいります。', exampleKo: '눈 오는 날은 장화가 필요합니다.', tags: ['여행', '날씨'] },
  { id: 'sp-0018', kanji: '時計台', kana: 'とけいだい', mean: '시계탑', type: 'noun', level: NO_JLPT,
    example: '時計台はここから近いです。', exampleKana: 'とけいだいはここからちかいです。', exampleKo: '시계탑은 여기서 가깝습니다.', tags: ['여행', '삿포로', '지명'] },
  { id: 'sp-0019', kanji: '雪まつり', kana: 'ゆきまつり', mean: '눈 축제', type: 'noun', level: NO_JLPT,
    example: '雪まつりは二月にあります。', exampleKana: 'ゆきまつりはにがつにあります。', exampleKo: '눈 축제는 2월에 있습니다.', tags: ['여행', '삿포로'] },

  // ── 곤란할 때 ──
  { id: 'sp-0020', kanji: '具合', kana: 'ぐあい', mean: '몸 상태;형편', type: 'noun', level: 'N3',
    example: '少し具合が悪いです。', exampleKana: 'すこしぐあいがわるいです。', exampleKo: '조금 몸이 안 좋습니다.', tags: ['여행', '건강'] },
];
