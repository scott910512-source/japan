/* 화면 사이를 다니는 길.
 *
 * 정보구조를 갈아엎으면서 탭 이름과 들어가는 길이 다 바뀌었다. 검사마다 그
 * 길을 각자 적어 두었더니 스무 군데를 고쳐야 했다. 다음에 또 바꿀 테니
 * 한 곳에 모아 둔다 — 그러면 다음엔 여기만 고치면 된다.
 *
 * 예전 → 지금
 *   홈 탭            → 오늘 탭
 *   학습 탭(바로 회독) → 오늘 탭에서 시작 (한 장 보고 들어간다)
 *   영상 탭           → 학습 탭 위쪽 카드
 *   설정 탭           → 더보기 탭
 *   홈의 메뉴 바둑판   → 학습 탭의 메뉴 바둑판 */

/* 탭으로 간다.
 *
 * 밀어 넣는 화면(메뉴·복습·번역기…)이 열려 있으면 먼저 닫는다. 그 화면은
 * 탭 바를 덮는 통짜 화면이라, 열어 둔 채로 탭을 누르면 30초를 기다리다
 * 검사가 통째로 멈춘다. 사람도 뒤로를 누르고 탭을 누른다 — 같은 순서다. */
export async function goTab(page, label, wait = 700) {
  const back = page.locator('.subscreen.open .sub-back');
  if (await back.count()) { await back.first().click(); await page.waitForTimeout(500); }
  await page.locator('.tabbar .tab', { hasText: label }).first().click();
  await page.waitForTimeout(wait);
}

/* 학습 시작.
 *
 * 오늘 화면의 모양이 두 번 바뀌었다. 처음엔 「오늘의 학습 시작」 버튼 하나,
 * 다음엔 「복습하기 · 새 단어 · 오늘의 문법」 셋, 이제는 주요 버튼 하나에
 * 배정 내역이 아래 붙는 꼴이다. 그때마다 검사 열 곳이 한꺼번에 30초씩
 * 멈췄다 — 그래서 어디를 누를지는 여기서만 정한다.
 *
 * 갈래를 안 주면 주요 버튼을 누른다. 그게 지금 상황에 맞는 행동(이어하기든
 * 오늘 학습 시작이든)이라 사람이 누르는 것과 같다.
 *
 * 갈래를 주면 그 줄을 찾아 누른다. 검사마다 심어 두는 기록이 달라서(어떤 건
 * 전부 복습일, 어떤 건 전부 신규) 갈래를 못 박으면 그쪽이 0인 검사가 빈손으로
 * 돌아온다. 다 했으면 아무것도 안 한 채로 false를 돌려준다. */
export async function startStudy(page, want = null) {
  await goTab(page, '오늘');

  /* 주요 버튼 하나가 「지금 할 것」이다. 하던 게 있으면 이어하기가 되고,
     없으면 오늘 학습 시작이 된다 — 갈래를 안 물었으면 이걸 누르면 된다. */
  if (!want) {
    const cta = page.locator('.bigcta');
    if (await cta.count()) {
      await cta.click();
      await page.waitForTimeout(900);
      /* 이어하기면 바로 카드가 뜨고, 새로 시작이면 무슨 판인지 먼저 알려 준다 */
      const intro0 = page.locator('.study.intro .bigstart');
      if (await intro0.count()) { await intro0.click(); await page.waitForTimeout(900); }
      return true;
    }
  }

  const rows = page.locator('.tdtask').filter({ hasNotText: '오늘의 문법' });
  const n = await rows.count();
  if (n === 0) return false;

  let go = null;
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const label = await row.innerText();
    if (want && !label.includes(want)) continue;
    if ((await row.getAttribute('class'))?.includes('done')) continue;
    go = row;
    break;
  }
  if (!go) return false;

  await go.click();
  await page.waitForTimeout(700);
  /* 다른 갈래로 넘어가면 하던 판을 접을지 물어본다. 검사에서는 접고 간다 */
  const swap = page.locator('.swapask .submit-btn');
  if (await swap.count()) { await swap.click(); await page.waitForTimeout(700); }
  await page.waitForTimeout(300);
  const intro = page.locator('.study.intro .bigstart');
  if (await intro.count()) { await intro.click(); await page.waitForTimeout(900); }
  return true;
}

/* 카드 한 장을 판정한다.
 *
 * ★ 이제 답을 보고 나서 판정한다 ★
 *
 * 여태 판정 버튼이 앞면에서도 눌렸다. 자기평가의 기준은 「답을 보기 전에
 * 떠올렸는지」인데, 앞면에서 누르면 「떠올린 것 같나」를 적게 된다.
 * 그래서 앞면에는 「답 보기」만 있고, 판정은 뒤집은 뒤에 나온다.
 *
 * 검사 여덟 곳이 판정 버튼을 바로 눌렀다. 사람이 하는 순서(뒤집고 → 고른다)를
 * 여기 한 번만 적어 둔다 — 화면이 또 바뀌어도 여기만 고치면 된다.
 * 판정이 안 나오면 false를 준다(판이 끝났거나 카드가 없다). */
export async function judgeCard(page, label = '알아요', wait = 500) {
  const card = page.locator('.studycard');
  if (await card.count() === 0) return false;
  // 뒤집는다. 이미 뒤집혀 있으면 카드를 눌러도 아무 일 없다.
  await card.first().click();
  await page.waitForTimeout(180);
  const btn = page.locator('.judgerow button', { hasText: label });
  if (await btn.count() === 0) return false;
  await btn.first().click();
  await page.waitForTimeout(wait);
  return true;
}

/* 갈래를 못 박고 싶은 검사용.
   「새 단어」는 문장도 같이 배정되니 「새로 배우기」로, 「복습하기」는
   배정 내역 줄 이름이 「복습」으로 바뀌었다. */
export const startWords = (page) => startStudy(page, '새로 배우기');
export const startReview = (page) => startStudy(page, '복습');

export async function openMenu(page, label) {
  await goTab(page, '학습');
  /* 이름이 딱 맞는 칸을 고른다. hasText는 부분 일치라 「단어」로 찾으면
     「단어 시험」이 먼저 잡힌다 — 실제로 그렇게 엉뚱한 화면이 열렸다. */
  const exact = page.locator('.menutile').filter({
    has: page.locator('.mt-title', { hasText: new RegExp(`^${label}$`) }),
  });
  const target = await exact.count() ? exact.first()
    : page.locator('.menutile', { hasText: label }).first();
  await target.click();
  await page.waitForTimeout(800);
}

/* 듣기와 영상은 「듣기」 탭으로 올라갔다. 앉아서 손으로 하는 공부와 걸으면서
   손 없이 하는 공부는 쓰는 시간대가 달라서, 지하철에서 한 번에 닿아야 한다. */
export async function openListen(page, way = 'auto') {
  await goTab(page, '듣기');
  await page.locator(`.lh-way[data-way="${way}"]`).click();
  await page.waitForTimeout(900);
}

/* 복습 화면. 탭에서 내려왔지만 화면은 그대로다 —
   오늘 화면의 「복습이 더 남았어요」와 기록 탭에서 여기로 온다. */
export async function openReview(page) {
  await goTab(page, '기록');
  await page.locator('.rowcard', { hasText: '복습으로 가기' }).click();
  await page.waitForTimeout(900);
}

export async function openVideos(page) {
  await openListen(page, 'videos');
}

/* 메뉴 바둑판을 세거나 훑기 전에 학습 탭에 가 있어야 한다 */
export async function goMenus(page) {
  await goTab(page, '학습');
}
