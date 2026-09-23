/* N3 기출 단어 중 앱에 없던 68개 — 한자읽기(問題1) 2010~2025
 *
 * ★ 왜 따로 파일을 두나 ★
 *
 * 기출은 「나온 적 있는 단어」라는 사실 하나로 우선순위가 정해진다. 그 사실은
 * lib/kiju.js가 표기(kanji)로 이어 붙이는데, 단어장에 그 표기가 아예 없으면
 * 이어 붙일 자리가 없다. 그래서 없던 것만 여기 채운다 — 기출 목록을 줄여
 * 맞추지 않는다. 시험에 나온 단어를 「우리 단어장에 없어서」 뺄 수는 없다.
 *
 * 레벨은 그 단어가 처음 나오는 급수로 단다(N3 시험에 나왔다고 전부 N3이
 * 아니다 — 卒業·計算은 N4다). 레벨을 좁혀 공부하는 사람의 범위를 여기서
 * 넓히지 않기 위해서다.
 *
 * 명사 꼴로 넣는다. 시험이 묻는 것이 그 표기의 읽기라서 「相談する」가 아니라
 * 「相談」이 나온다. する가 붙은 꼴이 이미 단어장에 있어도 둘은 다른 카드다. */
export const KIJU_WORDS = [
  // ── 2010 ──
  { id: 'kj-0001', kanji: '件', kana: 'けん', mean: '건;사항', type: 'noun', level: 'N3',
    example: 'その件は明日話しましょう。', exampleKana: 'そのけんはあしたはなしましょう。', exampleKo: '그 건은 내일 이야기합시다.', tags: ['일','추상'] },
  { id: 'kj-0002', kanji: '失業', kana: 'しつぎょう', mean: '실업;실직', type: 'noun', level: 'N3',
    example: '失業してから半年経ちました。', exampleKana: 'しつぎょうしてからはんとしたちました。', exampleKo: '실직하고 나서 반년이 지났습니다.', tags: ['일','사회'] },
  { id: 'kj-0003', kanji: '発見', kana: 'はっけん', mean: '발견', type: 'noun', level: 'N3',
    example: '新しい星が発見されました。', exampleKana: 'あたらしいほしがはっけんされました。', exampleKo: '새로운 별이 발견되었습니다.', tags: ['공부','추상'] },

  // ── 2011 ──
  { id: 'kj-0004', kanji: '応募', kana: 'おうぼ', mean: '응모', type: 'noun', level: 'N3',
    example: 'このコンテストに応募しました。', exampleKana: 'このこんてすとにおうぼしました。', exampleKo: '이 콘테스트에 응모했습니다.', tags: ['일','사회'] },
  { id: 'kj-0005', kanji: '発表', kana: 'はっぴょう', mean: '발표', type: 'noun', level: 'N4',
    example: '来週、研究の発表があります。', exampleKana: 'らいしゅう、けんきゅうのはっぴょうがあります。', exampleKo: '다음 주에 연구 발표가 있습니다.', tags: ['공부','일'] },
  { id: 'kj-0006', kanji: '表面', kana: 'ひょうめん', mean: '표면', type: 'noun', level: 'N3',
    example: '水の表面が凍っています。', exampleKana: 'みずのひょうめんがこおっています。', exampleKo: '물 표면이 얼어 있습니다.', tags: ['자연','추상'] },

  // ── 2012 ──
  { id: 'kj-0007', kanji: '汗', kana: 'あせ', mean: '땀', type: 'noun', level: 'N3',
    example: '走ったので汗をかきました。', exampleKana: 'はしったのであせをかきました。', exampleKo: '달렸더니 땀이 났습니다.', tags: ['신체','운동'] },
  { id: 'kj-0008', kanji: '以降', kana: 'いこう', mean: '이후', type: 'noun', level: 'N3',
    example: '三時以降なら空いています。', exampleKana: 'さんじいこうならあいています。', exampleKo: '세 시 이후라면 시간이 있습니다.', tags: ['시간'] },
  { id: 'kj-0009', kanji: '横断', kana: 'おうだん', mean: '횡단', type: 'noun', level: 'N3',
    example: 'ここで道路を横断しないでください。', exampleKana: 'ここでどうろをおうだんしないでください。', exampleKo: '여기서 도로를 횡단하지 마세요.', tags: ['이동','안전'] },
  { id: 'kj-0010', kanji: '固い', kana: 'かたい', mean: '단단하다;딱딱하다', type: 'adj-i', level: 'N3',
    example: 'このパンは固くて食べにくい。', exampleKana: 'このぱんはかたくてたべにくい。', exampleKo: '이 빵은 딱딱해서 먹기 힘들다.', tags: ['음식','일상'] },
  { id: 'kj-0011', kanji: '完成', kana: 'かんせい', mean: '완성', type: 'noun', level: 'N3',
    example: '新しい橋が完成しました。', exampleKana: 'あたらしいはしがかんせいしました。', exampleKo: '새 다리가 완성되었습니다.', tags: ['일','사회'] },
  { id: 'kj-0012', kanji: '外科', kana: 'げか', mean: '외과', type: 'noun', level: 'N3',
    example: '外科で手術を受けました。', exampleKana: 'げかでしゅじゅつをうけました。', exampleKo: '외과에서 수술을 받았습니다.', tags: ['건강'] },
  { id: 'kj-0013', kanji: '卒業', kana: 'そつぎょう', mean: '졸업', type: 'noun', level: 'N4',
    example: '来年、大学を卒業します。', exampleKana: 'らいねん、だいがくをそつぎょうします。', exampleKo: '내년에 대학을 졸업합니다.', tags: ['학교','공부'] },

  // ── 2013 ──
  { id: 'kj-0014', kanji: '事情', kana: 'じじょう', mean: '사정', type: 'noun', level: 'N3',
    example: '家庭の事情で引っ越します。', exampleKana: 'かていのじじょうでひっこします。', exampleKo: '가정 사정으로 이사합니다.', tags: ['사회','가족'] },
  { id: 'kj-0015', kanji: '通知', kana: 'つうち', mean: '통지;알림', type: 'noun', level: 'N3',
    example: '合格の通知が届きました。', exampleKana: 'ごうかくのつうちがとどきました。', exampleKo: '합격 통지가 도착했습니다.', tags: ['통신','사회'] },
  { id: 'kj-0016', kanji: '文章', kana: 'ぶんしょう', mean: '문장;글', type: 'noun', level: 'N3',
    example: '短い文章で説明してください。', exampleKana: 'みじかいぶんしょうでせつめいしてください。', exampleKo: '짧은 글로 설명해 주세요.', tags: ['공부','통신'] },

  // ── 2014 ──
  { id: 'kj-0017', kanji: '替える', kana: 'かえる', mean: '바꾸다;교환하다', type: 'verb', group: '2', level: 'N3',
    example: '円をドルに替えました。', exampleKana: 'えんをどるにかえました。', exampleKo: '엔을 달러로 바꿨습니다.', tags: ['돈','여행'] },
  { id: 'kj-0018', kanji: '集中', kana: 'しゅうちゅう', mean: '집중', type: 'noun', level: 'N3',
    example: '音がうるさくて集中できません。', exampleKana: 'おとがうるさくてしゅうちゅうできません。', exampleKo: '소리가 시끄러워서 집중할 수 없습니다.', tags: ['공부','추상'] },
  { id: 'kj-0019', kanji: '商業', kana: 'しょうぎょう', mean: '상업', type: 'noun', level: 'N3',
    example: 'この町は商業が盛んです。', exampleKana: 'このまちはしょうぎょうがさかんです。', exampleKo: '이 동네는 상업이 발달했습니다.', tags: ['사회','돈'] },
  { id: 'kj-0020', kanji: '食器', kana: 'しょっき', mean: '식기', type: 'noun', level: 'N3',
    example: '食器を洗ってから出かけます。', exampleKana: 'しょっきをあらってからでかけます。', exampleKo: '식기를 씻고 나서 나갑니다.', tags: ['식당','일상'] },

  // ── 2015 ──
  { id: 'kj-0021', kanji: '経営学', kana: 'けいえいがく', mean: '경영학', type: 'noun', level: 'N3',
    example: '大学で経営学を学んでいます。', exampleKana: 'だいがくでけいえいがくをまなんでいます。', exampleKo: '대학에서 경영학을 배우고 있습니다.', tags: ['학교','공부'] },
  { id: 'kj-0022', kanji: '血液型', kana: 'けつえきがた', mean: '혈액형', type: 'noun', level: 'N3',
    example: '血液型は何型ですか。', exampleKana: 'けつえきがたはなにがたですか。', exampleKo: '혈액형은 무슨 형입니까?', tags: ['건강','사람'] },
  { id: 'kj-0023', kanji: '想像', kana: 'そうぞう', mean: '상상', type: 'noun', level: 'N3',
    example: '想像していたより広い部屋でした。', exampleKana: 'そうぞうしていたよりひろいへやでした。', exampleKo: '상상했던 것보다 넓은 방이었습니다.', tags: ['추상','감정'] },
  { id: 'kj-0024', kanji: '朝食', kana: 'ちょうしょく', mean: '조식;아침 식사', type: 'noun', level: 'N4',
    example: '朝食はパンとコーヒーです。', exampleKana: 'ちょうしょくはぱんとこーひーです。', exampleKo: '아침 식사는 빵과 커피입니다.', tags: ['음식','일상'] },
  { id: 'kj-0025', kanji: '伝える', kana: 'つたえる', mean: '전하다', type: 'verb', group: '2', level: 'N4',
    example: 'この話を彼に伝えてください。', exampleKana: 'このはなしをかれにつたえてください。', exampleKo: '이 이야기를 그에게 전해 주세요.', tags: ['통신','사람'] },
  { id: 'kj-0026', kanji: '分類', kana: 'ぶんるい', mean: '분류', type: 'noun', level: 'N3',
    example: 'ごみを種類ごとに分類します。', exampleKana: 'ごみをしゅるいごとにぶんるいします。', exampleKo: '쓰레기를 종류별로 분류합니다.', tags: ['일상','사회'] },

  // ── 2016 ──
  { id: 'kj-0027', kanji: '共通', kana: 'きょうつう', mean: '공통', type: 'noun', level: 'N3',
    example: '二人には共通の趣味があります。', exampleKana: 'ふたりにはきょうつうのしゅみがあります。', exampleKo: '두 사람에게는 공통 취미가 있습니다.', tags: ['사람','취미'] },
  { id: 'kj-0028', kanji: '測る', kana: 'はかる', mean: '재다;측정하다', type: 'verb', group: '1', level: 'N3',
    example: '毎朝、体温を測っています。', exampleKana: 'まいあさ、たいおんをはかっています。', exampleKo: '매일 아침 체온을 재고 있습니다.', tags: ['건강','일상'] },
  { id: 'kj-0029', kanji: '豆', kana: 'まめ', mean: '콩', type: 'noun', level: 'N3',
    example: '朝ごはんに豆を食べます。', exampleKana: 'あさごはんにまめをたべます。', exampleKo: '아침밥에 콩을 먹습니다.', tags: ['음식'] },
  { id: 'kj-0030', kanji: '申し込み', kana: 'もうしこみ', mean: '신청', type: 'noun', level: 'N3',
    example: '申し込みは今日までです。', exampleKana: 'もうしこみはきょうまでです。', exampleKo: '신청은 오늘까지입니다.', tags: ['일','사회'] },

  // ── 2017 ──
  { id: 'kj-0031', kanji: '位置', kana: 'いち', mean: '위치', type: 'noun', level: 'N3',
    example: '机の位置を少し変えました。', exampleKana: 'つくえのいちをすこしかえました。', exampleKo: '책상 위치를 조금 바꿨습니다.', tags: ['일상','추상'] },
  { id: 'kj-0032', kanji: '下線', kana: 'かせん', mean: '밑줄', type: 'noun', level: 'N3',
    example: '大事な言葉に下線を引きます。', exampleKana: 'だいじなことばにかせんをひきます。', exampleKo: '중요한 말에 밑줄을 긋습니다.', tags: ['공부','학교'] },
  { id: 'kj-0033', kanji: '計算', kana: 'けいさん', mean: '계산', type: 'noun', level: 'N4',
    example: '計算が間違っていました。', exampleKana: 'けいさんがまちがっていました。', exampleKo: '계산이 틀려 있었습니다.', tags: ['돈','공부'] },

  // ── 2018 ──
  { id: 'kj-0034', kanji: '換える', kana: 'かえる', mean: '바꾸다;갈다', type: 'verb', group: '2', level: 'N3',
    example: '部屋の空気を換えましょう。', exampleKana: 'へやのくうきをかえましょう。', exampleKo: '방 공기를 바꿉시다.', tags: ['일상'] },
  { id: 'kj-0035', kanji: '血圧', kana: 'けつあつ', mean: '혈압', type: 'noun', level: 'N3',
    example: '最近、血圧が高いです。', exampleKana: 'さいきん、けつあつがたかいです。', exampleKo: '요즘 혈압이 높습니다.', tags: ['건강'] },
  { id: 'kj-0036', kanji: '制服', kana: 'せいふく', mean: '제복;교복', type: 'noun', level: 'N3',
    example: 'この学校は制服がありません。', exampleKana: 'このがっこうはせいふくがありません。', exampleKo: '이 학교는 교복이 없습니다.', tags: ['학교','쇼핑'] },
  { id: 'kj-0037', kanji: '相談', kana: 'そうだん', mean: '상담;상의', type: 'noun', level: 'N4',
    example: '進路について先生に相談しました。', exampleKana: 'しんろについてせんせいにそうだんしました。', exampleKo: '진로에 대해 선생님과 상의했습니다.', tags: ['학교','사람'] },
  { id: 'kj-0038', kanji: '命令', kana: 'めいれい', mean: '명령', type: 'noun', level: 'N3',
    example: '上司の命令に従いました。', exampleKana: 'じょうしのめいれいにしたがいました。', exampleKo: '상사의 명령에 따랐습니다.', tags: ['일','사회'] },

  // ── 2019 ──
  { id: 'kj-0039', kanji: '勝つ', kana: 'かつ', mean: '이기다', type: 'verb', group: '1', level: 'N4',
    example: '昨日の試合に勝ちました。', exampleKana: 'きのうのしあいにかちました。', exampleKo: '어제 시합에서 이겼습니다.', tags: ['운동'] },
  { id: 'kj-0040', kanji: '線', kana: 'せん', mean: '선;줄', type: 'noun', level: 'N4',
    example: '白い線の内側に立ってください。', exampleKana: 'しろいせんのうちがわにたってください。', exampleKo: '흰 선 안쪽에 서 주세요.', tags: ['이동','안전'] },
  { id: 'kj-0041', kanji: '昼食', kana: 'ちゅうしょく', mean: '중식;점심 식사', type: 'noun', level: 'N4',
    example: '昼食は会社の食堂で取ります。', exampleKana: 'ちゅうしょくはかいしゃのしょくどうでとります。', exampleKo: '점심은 회사 식당에서 먹습니다.', tags: ['음식','일'] },
  { id: 'kj-0042', kanji: '方角', kana: 'ほうがく', mean: '방위;방향', type: 'noun', level: 'N3',
    example: '駅はどちらの方角ですか。', exampleKana: 'えきはどちらのほうがくですか。', exampleKo: '역은 어느 방향입니까?', tags: ['이동','여행'] },
  { id: 'kj-0043', kanji: '郵便', kana: 'ゆうびん', mean: '우편', type: 'noun', level: 'N4',
    example: '郵便で書類を送りました。', exampleKana: 'ゆうびんでしょるいをおくりました。', exampleKo: '우편으로 서류를 보냈습니다.', tags: ['통신','일'] },

  // ── 2020 ──
  { id: 'kj-0044', kanji: '種類', kana: 'しゅるい', mean: '종류', type: 'noun', level: 'N4',
    example: 'この店はお茶の種類が多いです。', exampleKana: 'このみせはおちゃのしゅるいがおおいです。', exampleKo: '이 가게는 차 종류가 많습니다.', tags: ['쇼핑','음식'] },

  // ── 2021 ──
  { id: 'kj-0045', kanji: '裏', kana: 'うら', mean: '뒤;뒷면', type: 'noun', level: 'N3',
    example: '紙の裏にも書いてください。', exampleKana: 'かみのうらにもかいてください。', exampleKo: '종이 뒷면에도 써 주세요.', tags: ['일상','추상'] },
  { id: 'kj-0046', kanji: '増減', kana: 'ぞうげん', mean: '증감', type: 'noun', level: 'N3',
    example: '人口の増減を調べています。', exampleKana: 'じんこうのぞうげんをしらべています。', exampleKo: '인구 증감을 조사하고 있습니다.', tags: ['사회','추상'] },
  { id: 'kj-0047', kanji: '駐車', kana: 'ちゅうしゃ', mean: '주차', type: 'noun', level: 'N4',
    example: 'ここは駐車できません。', exampleKana: 'ここはちゅうしゃできません。', exampleKo: '여기는 주차할 수 없습니다.', tags: ['이동','안전'] },
  { id: 'kj-0048', kanji: '動作', kana: 'どうさ', mean: '동작', type: 'noun', level: 'N3',
    example: '先生の動作をよく見ましょう。', exampleKana: 'せんせいのどうさをよくみましょう。', exampleKo: '선생님의 동작을 잘 봅시다.', tags: ['신체','운동'] },
  { id: 'kj-0049', kanji: '残り', kana: 'のこり', mean: '나머지;남은 것', type: 'noun', level: 'N3',
    example: '残りは明日やります。', exampleKana: 'のこりはあしたやります。', exampleKo: '나머지는 내일 하겠습니다.', tags: ['일상','시간'] },
  { id: 'kj-0050', kanji: '秒', kana: 'びょう', mean: '초', type: 'noun', level: 'N4',
    example: '三十秒待ってください。', exampleKana: 'さんじゅうびょうまってください。', exampleKo: '30초 기다려 주세요.', tags: ['시간'] },
  { id: 'kj-0051', kanji: '郵送', kana: 'ゆうそう', mean: '우송', type: 'noun', level: 'N3',
    example: '結果は郵送でお知らせします。', exampleKana: 'けっかはゆうそうでおしらせします。', exampleKo: '결과는 우송으로 알려 드립니다.', tags: ['통신','일'] },

  // ── 2022 ──
  { id: 'kj-0052', kanji: '複数', kana: 'ふくすう', mean: '복수;여럿', type: 'noun', level: 'N3',
    example: '複数の人から同じ話を聞きました。', exampleKana: 'ふくすうのひとからおなじはなしをききました。', exampleKo: '여러 사람에게서 같은 이야기를 들었습니다.', tags: ['추상','사람'] },
  { id: 'kj-0053', kanji: '夕日', kana: 'ゆうひ', mean: '석양', type: 'noun', level: 'N3',
    example: '海に沈む夕日がきれいです。', exampleKana: 'うみにしずむゆうひがきれいです。', exampleKo: '바다로 지는 석양이 예쁩니다.', tags: ['자연','시간'] },

  // ── 2023 ──
  { id: 'kj-0054', kanji: '月末', kana: 'げつまつ', mean: '월말', type: 'noun', level: 'N3',
    example: '家賃は月末に払います。', exampleKana: 'やちんはげつまつにはらいます。', exampleKo: '집세는 월말에 냅니다.', tags: ['시간','돈'] },
  { id: 'kj-0055', kanji: '高価', kana: 'こうか', mean: '고가;값비쌈', type: 'adj-na', level: 'N3',
    example: 'これは高価な時計です。', exampleKana: 'これはこうかなとけいです。', exampleKo: '이것은 값비싼 시계입니다.', tags: ['돈','쇼핑'] },
  { id: 'kj-0056', kanji: '小型', kana: 'こがた', mean: '소형', type: 'noun', level: 'N3',
    example: '小型のカメラを買いました。', exampleKana: 'こがたのかめらをかいました。', exampleKo: '소형 카메라를 샀습니다.', tags: ['쇼핑'] },
  { id: 'kj-0057', kanji: '朝刊', kana: 'ちょうかん', mean: '조간', type: 'noun', level: 'N3',
    example: '毎朝、朝刊を読みます。', exampleKana: 'まいあさ、ちょうかんをよみます。', exampleKo: '매일 아침 조간을 읽습니다.', tags: ['통신','일상'] },
  { id: 'kj-0058', kanji: '広場', kana: 'ひろば', mean: '광장', type: 'noun', level: 'N3',
    example: '駅前の広場で待ち合わせました。', exampleKana: 'えきまえのひろばでまちあわせました。', exampleKo: '역 앞 광장에서 만나기로 했습니다.', tags: ['이동','여행'] },
  { id: 'kj-0059', kanji: '復習', kana: 'ふくしゅう', mean: '복습', type: 'noun', level: 'N4',
    example: '毎日、習った文法を復習します。', exampleKana: 'まいにち、ならったぶんぽうをふくしゅうします。', exampleKo: '매일 배운 문법을 복습합니다.', tags: ['공부','학교'] },

  // ── 2024 ──
  { id: 'kj-0060', kanji: '加熱', kana: 'かねつ', mean: '가열', type: 'noun', level: 'N3',
    example: '電子レンジで二分加熱します。', exampleKana: 'でんしれんじでにふんかねつします。', exampleKo: '전자레인지로 2분 가열합니다.', tags: ['음식','일상'] },
  { id: 'kj-0061', kanji: '感情的', kana: 'かんじょうてき', mean: '감정적', type: 'adj-na', level: 'N3',
    example: '感情的にならないで話しましょう。', exampleKana: 'かんじょうてきにならないではなしましょう。', exampleKo: '감정적으로 되지 말고 이야기합시다.', tags: ['감정','사람'] },
  { id: 'kj-0062', kanji: '基本', kana: 'きほん', mean: '기본', type: 'noun', level: 'N3',
    example: 'まず基本から練習しましょう。', exampleKana: 'まずきほんかられんしゅうしましょう。', exampleKo: '우선 기본부터 연습합시다.', tags: ['공부','추상'] },
  { id: 'kj-0063', kanji: '石油', kana: 'せきゆ', mean: '석유', type: 'noun', level: 'N3',
    example: 'この国は石油が取れます。', exampleKana: 'このくにはせきゆがとれます。', exampleKo: '이 나라는 석유가 납니다.', tags: ['사회','자연'] },
  { id: 'kj-0064', kanji: '父母', kana: 'ふぼ', mean: '부모', type: 'noun', level: 'N3',
    example: '父母に手紙を書きました。', exampleKana: 'ふぼにてがみをかきました。', exampleKo: '부모님께 편지를 썼습니다.', tags: ['가족'] },

  // ── 2025 ──
  { id: 'kj-0065', kanji: '帯', kana: 'おび', mean: '허리띠;띠', type: 'noun', level: 'N3',
    example: '着物の帯を結んでもらいました。', exampleKana: 'きもののおびをむすんでもらいました。', exampleKo: '기모노의 띠를 매어 주셨습니다.', tags: ['문화','쇼핑'] },
  { id: 'kj-0066', kanji: '地面', kana: 'じめん', mean: '지면;땅바닥', type: 'noun', level: 'N3',
    example: '雨で地面がぬれています。', exampleKana: 'あめでじめんがぬれています。', exampleKo: '비로 땅바닥이 젖어 있습니다.', tags: ['자연','날씨'] },
  { id: 'kj-0067', kanji: '終点', kana: 'しゅうてん', mean: '종점', type: 'noun', level: 'N3',
    example: 'この電車の終点はどこですか。', exampleKana: 'このでんしゃのしゅうてんはどこですか。', exampleKo: '이 전철의 종점은 어디입니까?', tags: ['이동','여행'] },
  { id: 'kj-0068', kanji: '西洋', kana: 'せいよう', mean: '서양', type: 'noun', level: 'N3',
    example: '西洋の文化に興味があります。', exampleKana: 'せいようのぶんかにきょうみがあります。', exampleKo: '서양 문화에 관심이 있습니다.', tags: ['문화','사회'] },
];
