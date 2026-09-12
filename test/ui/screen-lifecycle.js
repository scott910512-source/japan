/* 지연 로딩 뒤에도 탭의 입력·스크롤과 오프라인 학습이 유지되는지 확인한다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, startStudy } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const CHROME = process.env.CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
let pass = 0, fail = 0;
const ok = (label, condition) => {
  if (condition) { pass++; console.log('  ✓', label); }
  else { fail++; console.log('  ✗', label); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    // 기존 UI 검사와 같은 로컬 테스트 기록. 실제 계정·서버는 사용하지 않는다.
    await page.evaluate(() => {
      localStorage.setItem('jp_manabu_signed_in_v1', '1');
      const settings = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
      Object.assign(settings, { onboarded: true, autoTTS: false, speakOnJudge: false });
      localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(settings));
    });
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active?.state !== 'activated') await new Promise((resolve) => {
        registration.active.addEventListener('statechange', resolve, { once: true });
      });
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.context().setOffline(true);
    await page.locator('.gate-offline').click();
    await page.locator('.bigcta').waitFor();

    ok('방문 전 학습 허브를 실행하지 않는다', await page.locator('.menugroup').count() === 0);
    ok('방문 전 설정을 실행하지 않는다', await page.locator('.moregroup').count() === 0);
    await goTab(page, '학습');
    await page.locator('.menugroup').first().waitFor();
    ok('처음 여는 학습 화면도 오프라인에서 열린다', await page.locator('.menugroup').count() > 0);
    const screen = page.locator('.screen.active');
    await screen.evaluate((el) => { el.scrollTop = 200; });
    const scroll = await screen.evaluate((el) => el.scrollTop);
    ok('학습 허브에 실제 스크롤이 생긴다', scroll > 0);
    await goTab(page, '오늘');
    ok('방문한 화면은 숨기고 보존한다', await page.locator('.menugroup').count() > 0 && !(await page.locator('.menugroup').first().isVisible()));
    await goTab(page, '학습');
    ok('다시 열어도 스크롤 위치를 잃지 않는다', await page.locator('.screen.active').evaluate((el) => el.scrollTop) === scroll);
    await startStudy(page);
    await page.locator('.studycard').waitFor();
    ok('회독 청크도 오프라인에서 열린다', await page.locator('.studycard').isVisible());
    ok('주요 메뉴의 접근성 이름이 있다', await page.getByRole('navigation', { name: '주요 메뉴' }).isVisible());
    ok('JS 오류 없음', errors.length === 0);
  } finally { await browser.close(); }
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
