import { useCallback, useEffect, useState } from 'react';
import { useLayerNavigation } from './useLayerNavigation.js';
import { markBusy } from '../lib/busy.js';

/* 어디에 있나 — 탭 · 밀어 넣은 화면 · 회독 판.
 *
 * ★ 왜 한 군데로 모았나 ★
 *
 * 이 앱에는 주소가 없다. 그래서 「지금 어느 화면인가」는 전부 상태값이고,
 * 그게 App 맨 위에 일곱 개로 흩어져 있었다 — activeTab · sub · deck ·
 * n3View · listenMode · quizSet · videosSeen. 거기에 뒤로가기 연동과
 * 「지금 새 버전으로 갈아끼우면 잃는 게 있나」 표시가 따로 네 개 붙어 있었다.
 *
 * 흩어져 있으니 한 자리를 열 때 함께 해야 할 일을 빼먹는다. 실제로 그랬다 —
 * 메뉴로 들어온 시험이 듣던 세트를 들고 가서, 듣기를 한 번 쓴 뒤로는
 * 「단어 시험」이 영영 그 스무 개만 물었다.
 *
 * ★ 갱신 보류 표시도 여기 있다 ★
 *
 * 그 표시는 「어디에 있나」의 그림자다. 새 버전으로 갈아끼우는 일은 곧
 * 새로고침이고, 주소가 없으니 새로고침하면 늘 홈이다 — 홈이 아닌 자리에
 * 있다는 것 자체가 「잃을 것이 있다」는 뜻이다. 그래서 자리를 정하는 쪽이
 * 같이 들고 있는 게 맞다.
 *
 * 키 이름은 남겨 둔다(sub · deck · tab). 하나로 합치면 줄긴 하는데,
 * busyKeys()는 「지금 왜 안 바뀌나」를 밖에서 들여다보는 창구라서 무엇
 * 때문인지가 보여야 한다. */
export function useAppNavigation() {
  /* 탭은 넷 — 홈 · 학습 · 복습 · 내 학습. 영상(videos)은 탭이 아니라 학습 탭
     안의 화면인데, 유튜브 플레이어를 품고 있어서 밀어 넣는 화면(sub)이 아니라
     탭 자리(ScreenSlot)에 산다 — 그래서 activeTab 값으로 남아 있다. */
  const [activeTab, setActiveTab] = useState('home');
  const [videosSeen, setVideosSeen] = useState(false); // 영상 화면에 한 번이라도 들어갔는지
  const [sub, setSub] = useState(null);
  const [deck, setDeck] = useState(null); // 학습 중인 덱 (있으면 회독 화면이 전체를 덮는다)
  /* N3 코스를 어느 자리에서 열지 — 학습 탭 「한자」는 한자 과정, 복습 탭
     「틀린 문제」는 오답노트. 코스가 열릴 때 한 번 읽는다. */
  const [n3View, setN3View] = useState(null);
  // 듣기에 어떤 방식으로 들어왔는지 — 자동 듣기냐 따라 말하기냐
  const [listenMode, setListenMode] = useState('listen');
  /* 듣기에서 시험으로 넘어갈 때 들고 가는 세트. 비어 있으면 시험은 평소대로
     제 설정(범위·개수)으로 문제를 짠다. */
  const [quizSet, setQuizSet] = useState(null);

  useLayerNavigation({ deck, sub, setDeck, setSub });

  /* ★ 밀어 넣은 화면이 열려 있으면 새 버전으로 안 갈아끼운다 ★
   *
   * 화면마다 따로 알리게 해 두었더니 구멍이 남았다 — N3 코스는 문제를 푸는
   * 중에만 표시를 세웠고, 코스를 열어 놓고 무엇을 할지 고르는 동안(허브)은
   * 「끊길 게 없다」로 읽혔다. 거기가 바로 「N3 들어가서 공부하려고 할 때」다.
   *
   * 화면을 하나씩 세는 방식이 틀렸다. 밀어 넣은 화면이 열려 있다는 것은 곧
   * 새로고침하면 그 화면이 닫히고 탭으로 돌아간다는 뜻이고, 그게 쓰는 사람에게
   * 「튕겼다」이다. 무엇을 하던 중인지는 따질 필요가 없다. */
  useEffect(() => {
    markBusy('sub', Boolean(sub));
    return () => markBusy('sub', false);
  }, [sub]);

  /* 회독 판도 같이 본다. 판은 저장소에도 남지만 여기서 보면 저장되기 전의
     한 걸음까지 덮인다. */
  useEffect(() => {
    markBusy('deck', Boolean(deck));
    return () => markBusy('deck', false);
  }, [deck]);

  /* ★ 홈이 아닌 자리도 「하던 중」이다 ★
   *
   * 여태 이 표시는 판정하는 자리(듣기·시험·코스·회독)만 세웠다. 그런데
   * 갈아끼우기는 곧 새로고침이고, 이 앱은 주소가 없다 — 어느 탭에 있었든
   * 새로고침하면 홈이다. 학습 탭을 열어 둔 사람에게 그건 그냥 튕김이다.
   *
   * 홈에 그대로 있을 때는 세우지 않는다. 그 자리에서는 새로고침해도 다시
   * 홈이라 잃는 게 없고, 그 틈이 있어야 새 버전이 실제로 적용된다.
   *
   * 영상 탭을 따로 세던 줄은 뺐다. 영상도 탭이라 이 줄에 이미 들어온다 —
   * 두 번 세면 한쪽을 지울 때 다른 쪽이 남아서, 영영 안 바뀌는 날이 온다. */
  useEffect(() => {
    markBusy('tab', activeTab !== 'home');
    return () => markBusy('tab', false);
  }, [activeTab]);

  /* 학습 메뉴를 연다.
     한자는 N3 코스의 한자 과정을, 듣기는 듣기 고르기(자동·따라·영상)를 연다.
     같은 자료·화면을 두 벌 두지 않는다 — 길만 여기서 정한다. */
  const openMenu = useCallback((id, opts = {}) => {
    /* 메뉴로 들어온 시험은 평소 시험이다 — 듣던 세트를 들고 가지 않는다.
       안 비우면 듣기를 한 번 쓴 뒤로 「단어 시험」이 영영 그 스무 개만 묻는다. */
    if (id !== 'quiz') setQuizSet(null);
    if (id === 'words') { setSub('worddeck'); return; }
    if (id === 'videos') { setVideosSeen(true); setSub(null); setActiveTab('videos'); return; }
    if (id === 'listen') { setSub('listenhub'); return; }
    if (id === 'kanji') { setN3View({ kind: 'curriculum', chapter: 'ch4' }); setSub('n3'); return; }
    if (id === 'n3') { setN3View(opts.view || null); setSub('n3'); return; }
    setSub(id);
  }, []);

  /* 듣기에서 무엇을 여는가. 자동 듣기와 따라 말하기는 같은 화면이고
     방식만 다르다 — 화면을 두 벌로 만들면 고친 게 한쪽에만 남는다. */
  const openListen = useCallback((id) => {
    if (id === 'videos') { setVideosSeen(true); setSub(null); setActiveTab('videos'); return; }
    setListenMode(id === 'shadow' ? 'shadow' : 'listen');
    setSub('listen');
  }, []);

  /* 학습 탭은 예전엔 화면이 아니라 바로 회독으로 들어가는 통로였다.
     이제 「오늘」이 그 자리를 맡으니, 학습은 골라 들어가는 목록으로 돌린다. */
  const selectTab = useCallback((id) => {
    setSub(null);
    setActiveTab(id);
  }, []);

  return {
    activeTab, sub, deck, n3View, listenMode, quizSet, videosSeen,
    setActiveTab, setSub, setDeck, setN3View, setQuizSet,
    openMenu, openListen, selectTab,
  };
}
