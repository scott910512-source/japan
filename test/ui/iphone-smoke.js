/* 아이폰에서 쓰는 모양으로 한 바퀴.
 *
 * ★ 이 검사가 할 수 있는 것과 못 하는 것 ★
 *
 * 이 앱을 쓰는 자리는 거의 아이폰 홈 화면 앱이다. 그런데 이 컨테이너에는
 * 크롬(Chromium)만 있고 사파리 엔진(WebKit)은 없다 — CI도 같은 이미지라
 * 거기서도 못 돈다. 그래서 할 수 있는 것과 못 하는 것을 갈라 둔다.
 *
 * 할 수 있는 것 — 화면 크기와 손가락
 *   아이폰 세로 화면(390×844, 픽셀 3배)과 터치 입력을 흉내 낸다. 거기서
 *   좌우로 밀리는 곳, 손가락보다 작은 버튼, 홈 인디케이터에 가리는 자리,
 *   주요 길이 끊기는 곳은 엔진과 상관없이 잡힌다.
 *
 * 못 하는 것 — 엔진이 다른 자리
 *   음성(speechSynthesis)이 목록을 늦게 채우는 것, 화면 걸쇠가 아예 없는 것,
 *   첫 제스처까지 오디오가 안 열리는 것, 화면이 꺼지면 타이머가 멈추는 것.
 *   전부 사파리 고유라 여기서는 흉내도 안 낸다 — 흉내 낸 검사가 통과하면
 *   「확인했다」고 착각하게 되고, 그게 아무 검사도 없는 것보다 나쁘다.
 *   그 자리들은 실기기로만 확인된다(보고서에 남긴다).
 *
 * 그래서 이것은 smoke 검사다. 「깨진 데 없이 한 바퀴 돌아간다」까지만 본다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openListen, openMenu, openReview } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* 아이폰 14/15 세로. 390은 요즘 아이폰의 가장 흔한 폭이고, 844는 주소창 없는
   홈 화면 앱 높이에 가깝다. 픽셀 3배는 1.5px 선이 사라지는지를 본다. */
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

/* 손가락이 닿는 최소 크기. 애플이 정한 값이다(토큰 --touch와 같은 값). */
const TOUCH = 44;

/* 눈에 보이는 것만 본다 — 숨은 화면의 버튼까지 재면 안 쓰는 자리가 잡힌다 */
const SEEN = `(el) => {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (r.bottom < 0 || r.top > innerHeight) return false;
  let n = el;
  while (n && n instanceof Element) {
    const st = getComputedStyle(n);
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
    n = n.parentElement;
  }
  return true;
}`;

/* 가로로 밀리는 곳. 폰에서 좌우 스크롤이 생기면 바로 티가 난다. */
const overflow = (page) => page.evaluate((src) => {
  const seen = eval(src);
  const w = document.documentElement.clientWidth;
  const bad = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (!seen(el)) return;
    const r = el.getBoundingClientRect();
    if (r.right > w + 1 || r.left < -1) {
      bad.push(`${el.className || el.tagName} ${Math.round(r.left)}~${Math.round(r.right)} / ${w}`);
    }
  });
  return bad.slice(0, 4);
}, SEEN);

/* 손가락보다 작은 버튼 */
const tooSmall = (page) => page.evaluate(([src, min]) => {
  const seen = eval(src);
  const bad = [];
  document.querySelectorAll('button, a, [role="button"], input, select').forEach((el) => {
    if (!seen(el)) return;
    const r = el.getBoundingClientRect();
    /* 글자 속 링크는 뺀다 — 문장 안의 링크를 44px로 만들면 줄이 벌어진다 */
    if (el.tagName === 'A' && el.closest('p, li, .set-note, .set-sub')) return;
    if (r.height < min - 0.5 || r.width < min - 0.5) {
      bad.push(`${el.className || el.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  });
  return bad.slice(0, 5);
}, [SEEN, TOUCH]);

const boot = async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    const rev = {};
    for (let i = 0; i < 40; i++) {
      rev[`n5-${String(i + 1).padStart(4, '0')}`] = {
        box: (i % 3) + 1, streak: i % 4, lastSeen: '2026-08-10',
        rounds: 3, wrongCount: i % 5, vagueCount: i % 3,
      };
    }
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rev));
  });
  await page.waitForTimeout(1100);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     검사가 통째로 죽은 적이 있다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
  await page.locator('.tabbar').waitFor({ timeout: 20000 });
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage(IPHONE);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  await boot(page);

  console.log('\n[ 아이폰 세로 화면에서 한 바퀴 ]');
  const walk = async (name) => {
    const over = await overflow(page);
    const small = await tooSmall(page);
    ok(`${name} — 좌우로 밀리지 않는다`, over.length === 0, over.join(' | '));
    ok(`${name} — 손가락보다 작은 버튼이 없다`, small.length === 0, small.join(' | '));
  };

  await walk('홈');
  await goTab(page, '학습'); await page.waitForTimeout(700);
  await walk('학습');
  await goTab(page, '복습'); await page.waitForTimeout(700);
  await walk('복습');
  await goTab(page, '내 학습'); await page.waitForTimeout(700);
  await walk('내 학습');

  console.log('\n[ 탭바가 손가락에 맞나 ]');
  {
    /* 탭바는 제일 자주 누르는 자리다. 아래 끝에 있어서 홈 인디케이터와
       겹치기 쉬운데, 겹치면 탭을 누르려다 앱이 닫힌다. */
    const box = await page.locator('.tabbar').boundingBox();
    ok('탭바가 화면 아래에 붙어 있다', box && box.y + box.height >= 844 - 2,
      box ? `아래 끝 ${Math.round(box.y + box.height)} / 844` : 'none');
    const tabs = await page.locator('.tabbar .tab').all();
    ok('탭이 넷', tabs.length === 4, `${tabs.length}개`);
    let worst = 999;
    for (const t of tabs) {
      const b = await t.boundingBox();
      if (b) worst = Math.min(worst, b.height);
    }
    ok('★ 탭 하나하나가 손가락에 맞는다 ★', worst >= TOUCH - 0.5, `제일 낮은 탭 ${Math.round(worst)}px`);
  }

  console.log('\n[ 손가락으로 눌러서 듣기까지 ]');
  {
    /* ★ 클릭이 아니라 탭으로 ★
       마우스 클릭만 검사하면 터치에서만 생기는 문제를 못 잡는다 — 겹친
       요소가 터치를 가로채는 자리가 그렇다. */
    await goTab(page, '학습');
    await page.waitForTimeout(600);
    await openMenu(page, '듣기');
    await page.waitForTimeout(600);
    const way = page.locator('.lh-way[data-way="auto"]');
    ok('듣기 고르기가 열린다', await way.count() === 1);
    await way.tap();
    await page.waitForTimeout(800);
    ok('자동 듣기 화면이 열린다', await page.locator('.ls-go').count() === 1);
    await walk('듣기 설정');

    await page.locator('.ls-go').tap();
    await page.waitForTimeout(500);
    await page.locator('.ls-ask .submit-btn').tap();
    await page.waitForTimeout(1500);
    ok('★ 손가락으로만 재생까지 간다 ★', await page.locator('.listen.play').count() === 1);
    await walk('듣기 재생 중');

    /* 달리기 박자 — 안 보고 누르는 자리라 특히 넓어야 한다 */
    const beat = page.locator('.ls-beat');
    const bb = await beat.boundingBox();
    ok('★ 박자 버튼이 안 보고 눌러도 맞게 크다 ★',
      bb && bb.height >= 52 && bb.width > 300,
      bb ? `${Math.round(bb.width)}×${Math.round(bb.height)}` : 'none');
    await beat.tap();
    await page.waitForTimeout(400);
    ok('눌러서 박자가 켜진다', (await page.locator('.ls-beat .lb-now').innerText()).includes('160'),
      (await page.locator('.ls-beat .lb-now').innerText()).trim());

    /* 멈춤 · 이어서 — 달리다가 서는 자리 */
    await page.locator('.ls-pause').tap();
    await page.waitForTimeout(400);
    ok('멈춤이 눌린다', await page.locator('.ls-pause').getAttribute('aria-pressed') === 'true');
    await page.locator('.ls-pause').tap();
    await page.waitForTimeout(400);
    ok('이어서가 눌린다', await page.locator('.ls-pause').getAttribute('aria-pressed') === 'false');

    await page.locator('.listen .sub-back').tap();
    await page.waitForTimeout(600);
  }

  console.log('\n[ 복습 · 회독 한 장 ]');
  {
    await goTab(page, '홈');
    await page.waitForTimeout(600);
    await openReview(page);
    await page.waitForTimeout(800);
    /* 복습 탭의 맨 윗 카드(.rv-top)가 떠 있으면 열린 것이다 — 탭이라
       .subscreen 으로는 안 잡힌다(그건 밀어 넣는 화면 쪽이다). */
    ok('복습 탭이 열린다', await page.locator('.rv-top').count() > 0,
      `활성 탭 ${await page.locator('.tabbar .tab.active').getAttribute('data-tab')}`);
    await walk('복습 탭');
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
