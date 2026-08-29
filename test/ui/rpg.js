/* 일본 생존이 진짜로 앱에 붙었는가.
 *
 * 이 검사가 보는 건 화면이 예쁘게 뜨는지가 아니다. 마지막 줄 하나다 —
 * 실전에서 틀린 표현이 회독 저장소에 들어가는가. 거기까지 안 이어지면
 * 이건 앱에 붙은 기능이 아니라 앱 위에 얹힌 딴 게임이다.
 *
 * 그래서 일부러 다 틀린다. 틀려야 회독으로 넘어가는 값이 생긴다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser, progress = {}, settings = {}) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((p) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.canReadKana = true; s.autoTTS = false;
    Object.assign(s, p.settings);
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    localStorage.setItem('jp_manabu_progress_v1', JSON.stringify(p.progress));
  }, { progress, settings });
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

const readReview = (page) => page.evaluate(
  () => JSON.parse(localStorage.getItem('jp_manabu_review_v1') || '{}'),
);
const readProgress = (page) => page.evaluate(
  () => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}'),
);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  /* ── 1. 처음 들어간 사람 — 실전은 잠겨 있어야 한다 ── */
  console.log('\n[ 처음 들어갔을 때 ]');
  {
    const page = await boot(browser, {});
    page.on('pageerror', (e) => errors.push(e.message));

    await goTab(page, '학습');
    ok('학습 메뉴에 일본 생존이 있다',
      await page.locator('.menutile', { hasText: '일본 생존' }).count() === 1);

    await openMenu(page, '일본 생존');
    ok('레벨 줄이 보인다', await page.locator('.rp-lv').count() === 1);
    ok('편의점 스테이지가 있다', await page.locator('.rp-stage', { hasText: '편의점' }).count() === 1);
    ok('아직 안 만든 곳도 보여 준다', await page.locator('.rp-soonone').count() >= 3);

    const live = page.locator('.rp-stage .submit-btn');
    ok('체크포인트 전에는 실전이 잠겨 있다', await live.isDisabled());
    ok('왜 잠겼는지 적혀 있다',
      (await page.locator('.rp-stage .set-note').innerText()).includes('80'));

    /* 익히기 → 표현이 한 장씩 */
    await page.locator('.rp-stage .ghost-btn').click();
    await page.waitForTimeout(500);
    ok('익히기 화면이 뜬다', await page.locator('.rp-learn').count() === 1);
    ok('일본어가 크게 보인다',
      (await page.locator('.rp-learn .rp-jp').innerText()).length > 0);
    ok('뜻도 같이 보인다', (await page.locator('.rp-learn .rp-ko').innerText()).includes('어서'));
    ok('숙련도가 「처음 봄」', (await page.locator('.rp-mastery').innerText()) === '처음 봄');

    // 끝까지 넘겨서 연습으로 들어가는지
    for (let i = 0; i < 12; i++) {
      const t = await page.locator('.rp .bigstart .bs-t').innerText();
      await page.locator('.rp .bigstart').click();
      await page.waitForTimeout(300);
      if (t === '연습 시작') break;
    }
    ok('마지막 장에서 연습으로 넘어간다', await page.locator('.rp-q').count() === 1);
    ok('보기가 세 개', await page.locator('.qopt').count() === 3);
    ok('남은 문제 수가 보인다',
      (await page.locator('.rp-headbody span').innerText()).includes('연습'));

    /* 한 문제 풀어 본다 — 이 단계는 회독 기록을 건드리면 안 된다 */
    const before = Object.keys(await readReview(page)).length;
    await page.locator('.qopt').first().click();
    await page.waitForTimeout(1100);
    ok('연습은 회독 기록을 건드리지 않는다',
      Object.keys(await readReview(page)).length === before, `${before}개 그대로`);

    await page.close();
  }

  /* ── 2. 실전 — 여기가 이 검사의 본론 ── */
  console.log('\n[ 실전에서 틀리면 회독으로 간다 ]');
  {
    const page = await boot(browser, {
      rpg: { exp: 120, stages: { conbini: { learned: true, checkpoint: 0.9 } } },
    });
    page.on('pageerror', (e) => errors.push(e.message));

    await openMenu(page, '일본 생존');
    ok('EXP가 남아 있다', (await page.locator('.rp-exp').innerText()).includes('120'));
    const live = page.locator('.rp-stage .submit-btn');
    ok('체크포인트를 넘겼으면 실전이 열린다', !(await live.isDisabled()));

    await live.click();
    await page.waitForTimeout(600);
    ok('하트가 셋', (await page.locator('.rp-hearts').innerText()).split('❤️').length - 1 === 3);
    ok('점원 대사가 보인다', await page.locator('.rp-scene .rp-jp').count() === 1);
    ok('읽는 법은 가려두지 않는다',
      (await page.locator('.rp-scene .rp-kana').innerText()).length > 0);
    ok('한글 뜻은 안 보여 준다',
      !(await page.locator('.rp-scene').innerText()).includes('어서 오세요'));

    /* 힌트 — 눌러야 열린다 */
    ok('처음엔 힌트가 닫혀 있다', await page.locator('.rp-hints').count() === 0);
    await page.locator('.rp-hintbtn').click();
    await page.waitForTimeout(300);
    ok('힌트를 누르면 한 줄 열린다', await page.locator('.rp-hints p').count() === 1);
    await page.locator('.rp-hintbtn').click();
    await page.waitForTimeout(300);
    ok('한 번 더 누르면 두 줄', await page.locator('.rp-hints p').count() === 2);

    /* 일부러 다 틀린다 — 하트 셋이 빠지면 결과로 간다 */
    for (let i = 0; i < 4; i++) {
      if (await page.locator('.finish').count()) break;
      const wrong = page.locator('.qopt').last();   // 오답은 늘 마지막 칸에 둔 자료
      await wrong.click();
      await page.waitForTimeout(1900);
    }

    ok('하트가 다 빠지면 결과 화면', await page.locator('.finish').count() === 1);
    const fin = await page.locator('.finish').innerText();
    ok('등급이 나온다', /[SABCD]/.test(await page.locator('.fin-big span').innerText()), fin.slice(0, 60).replace(/\n/g, ' / '));
    ok('정답률·힌트·연속이 다 보인다', await page.locator('.fin-cell').count() === 3);
    ok('EXP를 얼마 벌었는지 보인다', fin.includes('EXP'));
    ok('다시 볼 표현을 짚어 준다', await page.locator('.rp-backone').count() >= 1);
    ok('오늘의 학습으로 간다고 말해 준다', fin.includes('약점'));

    /* ★ 이 검사의 이유 ★ */
    const review = await readReview(page);
    const marked = Object.keys(review).filter((k) => k.startsWith('rpg-conbini-'));
    ok('틀린 표현이 회독 저장소에 들어갔다', marked.length >= 1, marked.join(', ') || '없음');
    ok('「몰라요」로 들어갔다 — 상자 1',
      marked.some((k) => review[k].box === 1), JSON.stringify(review[marked[0]] || {}));
    ok('오답 수가 세어졌다', marked.some((k) => (review[k].wrongCount || 0) >= 1));

    const prog = await readProgress(page);
    ok('EXP가 늘었다', prog.rpg.exp > 120, `120 → ${prog.rpg.exp}`);
    ok('깬 횟수가 올랐다', prog.rpg.stages.conbini.cleared === 1);

    /* 회독에 들어갔으면 복습 탭이 그걸 집어야 한다 */
    await page.locator('.finish .ghost-btn').click();
    await page.waitForTimeout(500);
    ok('돌아가기를 누르면 스테이지 목록', await page.locator('.rp-stage').count() === 1);
    ok('통과 기록이 남았다',
      (await page.locator('.rp-stbody span').first().innerText()).includes('1번'));

    await page.close();
  }

  /* ── 3. 메뉴를 끄면 사라져야 한다 ── */
  console.log('\n[ 설정에서 끄면 ]');
  {
    /* 끈 채로 켠다. 켜고 나서 다시 부르면 오프라인이라 서비스워커가
       자리를 못 잡는다 — 활용 검사에서 한 번 당한 자리다. */
    const page = await boot(browser, {}, { menus: { rpg: false } });
    page.on('pageerror', (e) => errors.push(e.message));
    await goTab(page, '학습');
    ok('꺼 두면 메뉴에 안 나온다',
      await page.locator('.menutile', { hasText: '일본 생존' }).count() === 0);
    await page.close();
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | ') || '깨끗');

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
