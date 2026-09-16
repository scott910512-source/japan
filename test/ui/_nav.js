/* 화면 사이를 다니는 길.
 *
 * 정보구조를 갈아엎으면서 탭 이름과 들어가는 길이 다 바뀌었다. 검사마다 그
 * 길을 각자 적어 두었더니 스무 군데를 고쳐야 했다. 다음에 또 바꿀 테니
 * 한 곳에 모아 둔다 — 그러면 다음엔 여기만 고치면 된다.
 *
 * 예전 → 지금 (탭 다섯 → 넷)
 *   오늘 탭            → 홈 탭
 *   학습 탭            → 학습 탭 (JLPT N3 · 콘텐츠 · 연습 · 그 밖에)
 *   듣기 탭            → 학습 탭 「듣기」 칸 (자동 · 따라 · 영상)
 *   기록 탭            → 내 학습 탭
 *   더보기 탭          → 내 학습 탭 → 「설정」 줄
 *   밀어 넣는 복습 화면 → 복습 탭 */

/* 탭으로 간다.
 *
 * 밀어 넣는 화면(메뉴·설정·번역기…)이 열려 있으면 먼저 닫는다. 그 화면은
 * 탭 바를 덮는 통짜 화면이라, 열어 둔 채로 탭을 누르면 30초를 기다리다
 * 검사가 통째로 멈춘다. 사람도 뒤로를 누르고 탭을 누른다 — 같은 순서다.
 *
 * 학습(회독) 중에는 탭바가 없다 — 집중하는 자리라서. 그때는 화면의 닫기를
 * 먼저 누른다. */
export async function goTab(page, label, wait = 700) {
  const close = page.locator('.study .sh-close, .study .si-back');
  if (await close.count()) { await close.first().click(); await page.waitForTimeout(500); }
  const back = page.locator('.subscreen.open .sub-header:not(.inline) .sub-back');
  if (await back.count()) { await back.first().click(); await page.waitForTimeout(500); }
  /* 「학습」은 「내 학습」에도 들어 있다 — 이름이 아니라 id로 누른다 */
  const id = { '홈': 'home', '학습': 'study', '복습': 'review', '내 학습': 'me' }[label];
  const tab = id ? page.locator(`.tabbar .tab[data-tab="${id}"]`) : page.locator('.tabbar .tab', { hasText: label }).first();
  await tab.click();
  await page.waitForTimeout(wait);
}

/* 학습 시작.
 *
 * 홈의 주요 버튼 하나가 「지금 할 것」이다. 하던 게 있으면 이어하기가 되고,
 * 없으면 오늘 학습 시작이 된다 — 갈래를 안 물었으면 이걸 누르면 된다.
 *
 * 갈래를 주면 홈 「오늘」 목록에서 그 줄을 찾아 누른다. 검사마다 심어 두는
 * 기록이 달라서(어떤 건 전부 복습일, 어떤 건 전부 신규) 갈래를 못 박으면
 * 그쪽이 0인 검사가 빈손으로 돌아온다. 다 했으면 아무것도 안 한 채로 false. */
export async function startStudy(page, want = null) {
  await goTab(page, '홈');

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

  /* 「오늘」 목록의 줄. 이어서 공부하기의 N3·복습 줄도 같은 모양(.tdtask)이라
     이름으로 고른다 — 문법과 N3는 카드 판이 아니다. */
  const rows = page.locator('.tdlist .tdtask').filter({ hasNotText: '오늘의 문법' }).filter({ hasNotText: '오늘의 N3' });
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

/* 설정을 연다 — 내 학습 탭 → 「설정」 줄. 이미 설정 안이면 그대로. */
export async function openSettings(page) {
  if (await page.locator('.moregroup').count() || await page.locator('.moreback').count()) return true;
  await goTab(page, '내 학습');
  await page.locator('.me-settings').click();
  await page.waitForTimeout(600);
  return Boolean(await page.locator('.moregroup').count());
}

/* 설정의 한 묶음을 연다.
 *
 * ★ 더보기 탭이 없어졌다 ★ 설정은 내 학습 탭에서 밀어 넣는 화면이고, 그 안은
 * 예전처럼 여섯 묶음 목록이다. 검사 여덟 곳이 탭만 누르고 내용을 찾고
 * 있었으니, 어디를 눌러 들어가는지는 여기서만 정한다.
 *
 * group: study · voice · account · backup · tools · about
 * 이미 그 묶음에 들어와 있으면 아무것도 안 한다. */
export async function openMore(page, group = 'study') {
  const label = {
    study: '학습 설정',
    voice: '음성',
    account: '계정과 동기화',
    backup: '기록 백업',
    tools: '학습 도구',
    about: '앱 정보',
  }[group] || group;
  /* 어느 묶음 안에 있으면 목록으로 나온다 */
  if (!(await page.locator('.moregroup').count())) {
    const back = page.locator('.moreback');
    if (await back.count()) { await back.click(); await page.waitForTimeout(400); }
  }
  if (!(await page.locator('.moregroup').count())) await openSettings(page);
  const row = page.locator('.moregroup', { hasText: label });
  if (await row.count()) {
    await row.first().click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

/* 카드 한 장을 판정한다.
 *
 * 앞면에는 「답 보기」만 있고, 판정은 뒤집은 뒤에 나온다. 사람이 하는 순서
 * (뒤집고 → 고른다)를 여기 한 번만 적어 둔다. 판정이 안 나오면 false. */
export async function judgeCard(page, label = '알아요', wait = 500) {
  const card = page.locator('.studycard');
  if (await card.count() === 0) return false;
  await card.first().click();
  await page.waitForTimeout(180);
  const btn = page.locator('.judgerow button', { hasText: label });
  if (await btn.count() === 0) return false;
  await btn.first().click();
  await page.waitForTimeout(wait);
  return true;
}

/* 갈래를 못 박고 싶은 검사용. 홈 「오늘」 목록의 줄 이름이다. */
export const startWords = (page) => startStudy(page, '새로 배우기');
export const startReview = (page) => startStudy(page, '복습');

/* 학습 탭의 칸을 연다. 이름이 딱 맞는 칸을 고른다 — hasText는 부분 일치라
   「단어」로 찾으면 「단어 시험」이 먼저 잡힌다. */
export async function openMenu(page, label) {
  await goTab(page, '학습');
  const exact = page.locator('.menutile').filter({
    has: page.locator('.mt-title', { hasText: new RegExp(`^${label}$`) }),
  });
  const target = await exact.count() ? exact.first()
    : page.locator('.menutile', { hasText: label }).first();
  await target.click();
  await page.waitForTimeout(800);
}

/* 듣기 — 학습 탭 「듣기」 칸 → 자동 · 따라 말하기 · 영상 */
export async function openListen(page, way = 'auto') {
  await openMenu(page, '듣기');
  await page.locator(`.lh-way[data-way="${way}"]`).click();
  await page.waitForTimeout(900);
}

/* 복습 탭. 오늘 복습·틀린 문제·약점·전체 복습이 여기 하나에 있다. */
export async function openReview(page) {
  await goTab(page, '복습');
}

export async function openVideos(page) {
  await openListen(page, 'videos');
}

/* 메뉴 바둑판을 세거나 훑기 전에 학습 탭에 가 있어야 한다 */
export async function goMenus(page) {
  await goTab(page, '학습');
}
