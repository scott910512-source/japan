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

export async function goTab(page, label, wait = 700) {
  await page.locator('.tabbar .tab', { hasText: label }).first().click();
  await page.waitForTimeout(wait);
}

/* 학습 시작.
 *
 * 오늘 화면이 「복습하기 · 새 단어 · 오늘의 문법」 셋으로 갈렸다. 예전에는
 * 「오늘의 학습 시작」 버튼 하나였고, 검사 열 곳이 그 버튼을 직접 눌렀다 —
 * 화면이 바뀌자 열 곳이 한꺼번에 30초씩 멈췄다. 그래서 어느 줄을 누를지는
 * 여기서만 정한다.
 *
 * 할 게 남은 첫 줄을 누른다. 검사마다 심어 두는 기록이 달라서(어떤 건 전부
 * 복습일, 어떤 건 전부 신규) 갈래를 못 박으면 그쪽이 0인 검사가 빈손으로
 * 돌아온다. 다 했으면 아무것도 안 한 채로 false를 돌려준다. */
export async function startStudy(page, want = null) {
  await goTab(page, '오늘');

  /* 하던 게 있으면 그게 먼저다 — 앱이 「이어하기」를 맨 위에 두는 이유고,
     사람도 그걸 누른다. 갈래가 갈린 뒤로는 이걸 건너뛰면 다른 갈래를 눌러
     「하던 학습을 접을까요?」 창에 막힌다. */
  if (!want) {
    const resume = page.locator('.rowcard', { hasText: '이어하기' });
    if (await resume.count()) {
      await resume.click();
      await page.waitForTimeout(900);
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

// 갈래를 못 박고 싶은 검사용
export const startWords = (page) => startStudy(page, '새 단어');
export const startReview = (page) => startStudy(page, '복습하기');

export async function openMenu(page, label) {
  /* 열려 있는 화면을 먼저 닫는다. 안 닫으면 그 화면이 탭 바를 덮고 있어서
     탭을 눌러도 안 눌린다 — 30초를 기다리다 검사가 통째로 멈춘다. */
  const back = page.locator('.subscreen.open .sub-back');
  if (await back.count()) { await back.first().click(); await page.waitForTimeout(600); }
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
  const back = page.locator('.subscreen.open .sub-back');
  if (await back.count()) { await back.first().click(); await page.waitForTimeout(600); }
  await goTab(page, '듣기');
  await page.locator(`.lh-way[data-way="${way}"]`).click();
  await page.waitForTimeout(900);
}

/* 복습 화면. 탭에서 내려왔지만 화면은 그대로다 —
   오늘 화면의 「복습이 더 남았어요」와 기록 탭에서 여기로 온다. */
export async function openReview(page) {
  const back = page.locator('.subscreen.open .sub-back');
  if (await back.count()) { await back.first().click(); await page.waitForTimeout(600); }
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
