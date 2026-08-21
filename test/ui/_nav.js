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

/* 학습 시작. 오늘 큐가 비어 있으면(다 봤거나 자료가 없으면) 시작 버튼이
   아예 없다 — 그때는 조용히 아무것도 안 한 채로 돌아온다. */
export async function startStudy(page) {
  await goTab(page, '오늘');
  const go = page.locator('.today .bigstart');
  if (await go.count() === 0) return false;
  await go.click();
  await page.waitForTimeout(900);
  const intro = page.locator('.study.intro .bigstart');
  if (await intro.count()) { await intro.click(); await page.waitForTimeout(900); }
  return true;
}

export async function openMenu(page, label) {
  await goTab(page, '학습');
  await page.locator('.menutile', { hasText: label }).first().click();
  await page.waitForTimeout(800);
}

export async function openVideos(page) {
  await goTab(page, '학습');
  await page.locator('.hubcard', { hasText: '영상' }).click();
  await page.waitForTimeout(900);
}

/* 메뉴 바둑판을 세거나 훑기 전에 학습 탭에 가 있어야 한다 */
export async function goMenus(page) {
  await goTab(page, '학습');
}
