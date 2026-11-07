/* 학습 탭의 짜임새 — 화면에서.
 *
 * 열두 칸이 한 바둑판에 나란히 있었다. 「단어암기」 옆에 「단어 시험」이 있고
 * 그 옆에 「짝 맞추기」가 있으니, 무엇이 배우는 것이고 무엇이 확인하는
 * 것인지 눈으로 안 갈렸다. 칸이 늘 때마다 더 나빠지기만 했다.
 *
 * 여기서 세 가지를 본다.
 *   · 학습 · 퀴즈 · 기타로 갈려서 보이는가
 *   · JLPT가 단어암기 안에서 열리는가 — 따로 있던 게 사실은 같은 것이었다
 *   · 문법 안에 셋(기초 · 일상 · 문형)이 다 있는가 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu, openMore } from './_nav.js';
import { DAILY_GRAMMAR_SETS } from '../../src/data/grammar-daily.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser, settings = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((s) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const cur = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    cur.onboarded = true; cur.canReadKana = true; cur.autoTTS = false;
    Object.assign(cur, s);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(cur));
  }, settings);
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  /* 껍데기가 뜰 때까지 기다린다 — 안 기다리면 느린 기기에서 아직
     안 그려진 화면을 누르게 된다. 끝내 안 뜨면 뒤따르는 검사가
     제 말로 실패하는 쪽이 읽기 쉽다. */
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(e.message));

  console.log('\n[ 내 바로가기 · 전체 학습 · 추가 자료 ]');
  await goTab(page, '학습');
  const labels = await page.locator('.menugroup .mg-label').allTextContents();
  ok('세 영역으로 정리된다', await page.locator('.menugroup').count() === 3);
  ok('바로가기가 먼저', labels[0].includes('내 바로가기'));
  ok('그다음 전체 학습', labels[1].includes('전체 학습'));
  ok('마지막 추가 자료', labels[2].includes('추가 자료'));
  const catalog = await page.locator('[data-group="catalog"] .mt-title').allTextContents();
  const more = await page.locator('[data-group="more"] .mt-title').allTextContents();
  ok('전체 학습 일곱 과정의 위치가 고정된다', catalog.join() === 'N3 코스,JLPT 기출 단어,단어 암기,문법,한자,회화 문장,듣기', catalog.join());
  ok('퀴즈와 오답 복습의 위치를 안내한다', (await page.locator('.sh-quiz-note').innerText()).includes('복습&내기록'));
  ok('추가 자료 네 메뉴를 보존한다', more.join() === '여행 일본어,영상,완전기초,독일어', more.join());
  ok('추가 자료는 처음에 접혀 있다', !(await page.locator('.sh-more').evaluate((el) => el.open)));
  await page.locator('.sh-more summary').click();
  ok('요약을 누르면 자료를 펼친다', await page.locator('.sh-more').evaluate((el) => el.open));
  await page.locator('.sh-more summary').click();
  ok('다시 누르면 접는다', !(await page.locator('.sh-more').evaluate((el) => el.open)));
  const everything = [...catalog, ...more];
  ok('퀴즈 메뉴는 복습&내기록에 유지한다', !['단어 시험', '짝 맞추기', '부사 연습', '동사 활용'].some((t) => everything.includes(t)));
  ok('회독 학습·약점 복습은 학습 탭에 없다', !everything.some((t) => t === '회독 학습' || t === '약점 복습'));
  ok('번역기는 학습 탭에 없다', !everything.includes('번역기'));

  console.log('\n[ 퀴즈는 복습&내기록 › 퀴즈 한 곳으로 ]');
  await openMenu(page, '단어');
  ok('★ 단어 화면에는 연습 줄이 없다 ★', await page.locator('.pr-row').count() === 0);
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);
  await openMenu(page, '문법');
  ok('★ 문법 화면에도 연습 줄이 없다 ★', await page.locator('.pr-row').count() === 0);
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(500);

  await openMenu(page, '퀴즈');
  ok('퀴즈 화면: 일곱 줄(단어 시험 · 짝 맞추기 · 부사 연습 · 동사 활용 · 쭉 퀴즈 · 문장 만들기 · 상황 대화)',
    (await page.locator('.pr-row b').allTextContents()).join() === '단어 시험,짝 맞추기,부사 연습,동사 활용,쭉 퀴즈,문장 만들기,상황 대화',
    (await page.locator('.pr-row b').allTextContents()).join());
  ok('제목이 퀴즈', (await page.locator('.subscreen.open .sub-title').innerText()).includes('퀴즈'));
  await page.locator('.pr-row[data-menu="quiz"]').click();
  await page.waitForTimeout(700);
  ok('★ 단어 시험을 열면 시험 화면 ★', (await page.locator('.sub-title').innerText()).includes('단어 시험'));
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(600);
  ok('★ 뒤로 가면 퀴즈 화면으로 돌아온다 ★',
    await page.locator('.pr-row').count() === 7 && (await page.locator('.sub-title').innerText()).includes('퀴즈'),
    await page.locator('.sub-title').innerText());
  await page.locator('.subscreen .sub-back').first().click();
  await page.waitForTimeout(600);
  ok('한 번 더 뒤로 가면 복습&내기록 탭', await page.locator('.tabbar .tab.active[data-tab="me"]').count() === 1);
  /* ★ 기기의 뒤로가기도 한 층씩 ★ 짝 맞추기 → 퀴즈 → 탭. 앱 밖으로 튕기면 안 된다 */
  await openMenu(page, '퀴즈');
  await page.locator('.pr-row[data-menu="match"]').click();
  await page.waitForTimeout(700);
  await page.goBack();
  await page.waitForTimeout(700);
  ok('★ 기기 뒤로가기: 짝 맞추기 → 퀴즈 화면 ★',
    await page.locator('.pr-row').count() === 7 && (await page.locator('.sub-title').innerText()).includes('퀴즈'),
    page.url());
  await page.goBack();
  await page.waitForTimeout(700);
  ok('★ 한 번 더: 퀴즈 → 탭(앱 안에 머문다) ★',
    await page.locator('.tabbar').count() === 1 && page.url().includes('localhost'), page.url());
  await goTab(page, '학습');

  console.log('\n[ JLPT는 단어암기 안으로 ]');
  /* 따로 둔 메뉴였는데 그건 다른 공부가 아니라 같은 단어를 다른 방식으로
     끊어 주는 것이었다 — 「거의 같은 것 아니냐」는 말이 맞았다 */
  ok('단어 암기와 중복되는 옛 JLPT 단어 칸이 없다',
    await page.locator('.menutile[data-menu="jlpt"]').count() === 0);
  await openMenu(page, '단어');
  ok('끊는 방법이 둘', await page.locator('.wd-how button').count() === 2,
    (await page.locator('.wd-how button').allTextContents()).join(' / '));
  ok('처음엔 이어서 외우기', await page.locator('.wd-how button.active').innerText() === '이어서 외우기');
  ok('레벨을 고를 수 있다', await page.locator('.chiprow .chip').count() === 3);

  await page.locator('.wd-how button', { hasText: '세트로' }).click();
  await page.waitForTimeout(600);
  ok('세트로 끊으면 레벨 목록', await page.locator('.jl-level').count() === 5);
  await page.locator('.jl-level').first().click();
  await page.waitForTimeout(500);
  ok('세트가 보인다', await page.locator('.jl-set').count() > 3,
    `${await page.locator('.jl-set').count()}세트`);
  await page.locator('.wd-how button', { hasText: '이어서' }).click();
  await page.waitForTimeout(500);
  ok('돌아오면 원래 화면', await page.locator('.bigstart').count() === 1);

  console.log('\n[ 문법 안에 셋 ]');
  await openMenu(page, '문법');
  ok('갈래가 셋', await page.locator('.gm-tabs button').count() === 3,
    (await page.locator('.gm-tabs button').allTextContents()).join(' / '));
  ok('기초문법이 있다', await page.locator('.gm-tabs [data-tab="cards"]').count() === 1);
  ok('일상문법이 있다', await page.locator('.gm-tabs [data-tab="daily"]').count() === 1);
  ok('문형 연습이 있다', await page.locator('.gm-tabs [data-tab="pattern"]').count() === 1);
  /* 이름만 있으면 어느 걸 눌러야 할지 매번 셋 다 들어가 보게 된다 */
  ok('무엇이 다른지 적혀 있다', (await page.locator('.gm-note').innerText()).length > 4,
    await page.locator('.gm-note').innerText());

  console.log('\n[ 일상문법 ]');
  await page.locator('.gm-tabs [data-tab="daily"]').click();
  await page.waitForTimeout(600);
  ok('묶음이 여섯', await page.locator('.dg-set').count() === 6);
  const intro = await page.locator('.av-intro').first().innerText();
  /* ★ 규칙을 아는 것과 자리에 넣는 것은 다른 일이다 ★ */
  ok('왜 따로 연습하는지 적혀 있다', intro.includes('乗る') || intro.includes('電車'),
    intro.replace(/\n/g, ' ').slice(0, 70));
  ok('회독에 안 쌓인다고 밝힌다',
    (await page.textContent('.sub-body')).includes('회독에 안 쌓여요'));

  const reviewBefore = await page.evaluate(
    () => localStorage.getItem('jp_manabu_review_v1') || '{}',
  );

  await page.locator('.dg-set').first().click();
  await page.waitForTimeout(600);
  ok('빈칸이 뜬다', await page.locator('.av-blank').count() === 1);
  ok('보기가 셋', await page.locator('.qopt').count() === 3);
  ok('한국어 뜻이 같이 보인다', (await page.locator('.av-ko').innerText()).length > 0);

  /* 보기 순서는 무작위다. 첫 보기를 반복해서 누르면 모두 정답일 수도 있다.
     실제 첫 문제의 오답을 명시적으로 골라 오류 설명 경로를 검사한다. */
  const firstItem = DAILY_GRAMMAR_SETS[0].items[0];
  ok('선택한 묶음의 첫 문제를 표시한다',
    (await page.locator('.av-jp').textContent()) === firstItem.jp.replace('【　】', '？'));
  const options = await page.locator('.qopt .qo-body b').allTextContents();
  const wrongIndex = options.findIndex((text) => text !== firstItem.answer && firstItem.why[text]);
  if (wrongIndex < 0) throw new Error('첫 문제에 설명이 있는 오답 보기가 없습니다');
  await page.locator('.qopt').nth(wrongIndex).click();
  await page.locator('.av-why').waitFor({ state: 'visible' });
  const wrongPicked = await page.locator('.av-why').isVisible();
  ok('틀리면 설명이 뜬다', wrongPicked);
  if (wrongPicked) {
    ok('내가 고른 게 왜 틀렸는지 적혀 있다', await page.locator('.av-wrong').count() === 1,
      (await page.locator('.av-why').innerText()).replace(/\n/g, ' ').slice(0, 80));
    ok('답이 뭔지도 알려 준다', (await page.locator('.av-right').innerText()).includes('답은'));
    const stayed = await page.locator('.av-why').count();
    await page.waitForTimeout(1600);
    ok('틀리면 저절로 안 넘어간다', await page.locator('.av-why').count() === stayed);
    await page.locator('.av-why .submit-btn').click();
    await page.waitForTimeout(500);
  }

  for (let i = 0; i < 20; i++) {
    if (await page.locator('.finish').count()) break;
    if (await page.locator('.av-why .submit-btn').count()) {
      await page.locator('.av-why .submit-btn').click();
      await page.waitForTimeout(500);
      continue;
    }
    if (await page.locator('.qopt').count() === 0) break;
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(1100);
  }
  ok('끝나면 결과가 뜬다', await page.locator('.finish').count() === 1);
  ok('몇 개 맞혔는지 보인다',
    /\d+\s*\/\s*\d+개 맞힘/.test(await page.locator('.finish').innerText()));

  /* ★ 조사는 회독 카드가 아니다 ★ 「を」를 카드로 만들 수는 없고, 억지로
     밀어 넣으면 오늘의 학습에 카드도 없는 항목이 뜬다 */
  const reviewAfter = await page.evaluate(
    () => localStorage.getItem('jp_manabu_review_v1') || '{}',
  );
  ok('일상문법은 회독을 안 건드린다', reviewBefore === reviewAfter);

  // 진도는 남는다
  const done = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}').dailyGrammar || {},
  );
  ok('묶음 진도가 남는다', Object.keys(done).length === 1, JSON.stringify(done));
  ok('몇 개 맞혔는지 적힌다', typeof Object.values(done)[0]?.right === 'number');

  console.log('\n[ 설정에서도 같은 묶음 ]');
  /* 결과 화면을 닫고 나간다. 탭으로 나가는 일은 goTab이 알아서 한다 */
  await page.locator('.finish .ghost-btn').click();
  await page.waitForTimeout(600);
  await openMore(page, 'study');   // 학습 메뉴 묶음
  await page.waitForTimeout(700);
  ok('설정에도 같은 묶음이 있다(학습 탭 셋 + 안에 든 연습)', await page.locator('.setgroup').count() === 4,
    (await page.locator('.sg-label').allTextContents()).join(' / '));
  /* 켜는 칸이 있는데 학습 탭에 없으면 켜도 아무 데도 안 뜨는 유령 칸이 된다 */
  ok('없어진 JLPT 칸은 설정에도 없다',
    await page.locator('.setgroup .set-title', { hasText: 'JLPT' }).count() === 0);

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');

  console.log('\n[ ★ 바로가기 ★ ]');
  {
    /* 묶음은 「처음 오는 사람이 무엇이 있는지 알아보는」 차례다. 그건 맞는데,
       날마다 듣기와 기출만 쓰는 사람은 날마다 그 두 칸을 찾아 내려가야 한다.
       자주 쓴 것이 저절로 올라오게 하면 눈 감고 누르던 자리가 매번 달라져서
       더 나쁘다 — 사람이 고른 것만, 고른 차례 그대로 맨 앞에 둔다. */
    await goTab(page, '학습');
    await page.waitForTimeout(500);
    ok('고치는 길이 늘 보인다', await page.locator('.sh-edit').count() === 1,
      (await page.locator('.sh-edit').innerText()).trim());
    ok('고르기 전에는 빈 바로가기 안내가 있다', await page.locator('.sh-fav-empty').count() === 1);
    ok('평소에는 별이 안 뜬다 — 누를 자리가 둘이 되면 안 된다',
      await page.locator('.mt-star').count() === 0);

    await page.locator('.sh-edit').click();
    await page.waitForTimeout(350);
    ok('고치는 중에는 칸마다 별', await page.locator('.mt-star').count() > 5,
      `${await page.locator('.mt-star').count()}개`);

    for (const id of ['listen', 'kiju', 'sentences']) {
      await page.locator(`.menutile[data-menu="${id}"]`).first().click();
      await page.waitForTimeout(250);
    }
    ok('★ 고른 것이 바로가기에 올라온다 ★',
      (await page.locator('.mfavs .mt-title').allTextContents()).join(' · ') === '듣기 · JLPT 기출 단어 · 회화 문장',
      (await page.locator('.mfavs .mt-title').allTextContents()).join(' · '));
    ok('★ 즐겨찾기를 골라도 전체 목록에는 남는다 ★',
      await page.locator('.menutile[data-menu="listen"]').count() === 2 && await page.locator('.menutile[data-menu="kiju"]').count() === 2 && await page.locator('.menutile[data-menu="sentences"]').count() === 2);
    ok('★ 고르지 않은 칸은 제자리에 남는다 ★', await page.locator('.menugroup:not([data-group="fav"]) .menutile[data-menu="words"]').count() === 1);
    ok('고른 칸에는 별이 켜져 있다(눌러서 뺄 수 있다)', await page.locator('.mfavs .menutile[data-fav="true"]').count() === 3);
    ok('기기에 남는다',
      await page.evaluate(() => JSON.stringify(
        JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}').favs,
      )) === '["listen","kiju","sentences"]');

    await page.getByRole('button', { name: '회화 문장 순서를 앞으로', exact: true }).click();
    ok('화살표로 저장 순서가 바뀐다', (await page.locator('.mfavs .mt-title').allTextContents()).join() === '듣기,회화 문장,JLPT 기출 단어');
    await page.getByRole('button', { name: '회화 문장 순서를 뒤로', exact: true }).click();
    for (const id of ['n3', 'words', 'grammar']) await page.locator(`[data-group="catalog"] .menutile[data-menu="${id}"]`).click();
    ok('기존 최대 여섯 개를 유지한다', await page.locator('.mfavs .menutile').count() === 6);
    await page.locator('[data-group="catalog"] .menutile[data-menu="kanji"]').click();
    ok('일곱 번째는 추가하지 않는다', await page.locator('.mfavs .menutile').count() === 6);
    await page.setViewportSize({ width: 1024, height: 900 });
    ok('PC 바로가기는 세 열', await page.locator('.mfavs').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length === 3));
    await page.setViewportSize({ width: 390, height: 844 });
    ok('휴대폰 바로가기는 두 열', await page.locator('.mfavs').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length === 2));
    ok('각 바로가기에 저장 순서가 보인다', (await page.locator('.sh-order-position').allTextContents()).join() === '1 / 6,2 / 6,3 / 6,4 / 6,5 / 6,6 / 6');
    ok('편집 도구에 현재 선택 수가 보인다', (await page.locator('.sh-editbar [role="status"]').innerText()) === '6 / 6개 선택');
    for (const id of ['n3', 'words', 'grammar']) await page.locator(`.mfavs .menutile[data-menu="${id}"]`).click();
    await page.locator('[data-group="more"]').scrollIntoViewIfNeeded();
    const sticky = await page.locator('.sh-editbar').evaluate((el) => {
      const bar = el.getBoundingClientRect(), screen = el.closest('.screen').getBoundingClientRect();
      return { top: bar.top, bottom: bar.bottom, screenTop: screen.top + parseFloat(getComputedStyle(el.closest('.screen')).paddingTop), screenBottom: screen.bottom };
    });
    ok('목록 아래에서도 편집 도구와 완료가 화면 상단에 남는다', Math.abs(sticky.top - sticky.screenTop) < 2 && sticky.bottom < sticky.screenBottom, JSON.stringify(sticky));
    await page.locator('.sh-edit').click();
    await page.waitForTimeout(350);
    ok('아래에서 완료해도 편집 상태가 종료된다', await page.locator('.sh-editbar').count() === 0 && (await page.locator('.sh-edit').innerText()) === '편집');
    ok('끝내면 별이 사라진다', await page.locator('.mt-star').count() === 0);
    ok('★ 바로가기 세 개 외 전체 열한 메뉴는 보존한다 ★',
      await page.locator('.menutile').count() === 14, `${await page.locator('.menutile').count()}칸`);
    ok('★ 맨 앞 묶음이 바로가기 ★',
      await page.locator('.menugroup').first().getAttribute('data-group') === 'fav');

    /* 화면에만 뜨고 안 열리면 고친 게 아니다 */
    await page.locator('.mfavs .menutile[data-menu="listen"]').click();
    await page.waitForTimeout(900);
    ok('★ 눌러서 바로 열린다 ★',
      (await page.locator('.subscreen.open .sub-title').innerText().catch(() => '')).trim() === '듣기',
      (await page.locator('.subscreen.open .sub-title').innerText().catch(() => '못 열림')).trim());
    await page.locator('.subscreen.open .sub-back').click();
    await page.waitForTimeout(500);
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
