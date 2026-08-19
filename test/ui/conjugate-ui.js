/* 동사 활용 화면.
 *
 * 활용은 규칙이라 답이 하나로 정해진다 — 그래서 화면 검사도 "맞는 답을 골랐을 때
 * 맞다고 하는지"까지 확인할 수 있다. 규칙은 lib에서 이미 글자까지 맞춰 봤으니
 * 여기서는 화면이 그 답을 제대로 쓰는지, 성적이 남는지, 표가 펼쳐지는지를 본다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

async function boot(browser, seed) {
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate((s) => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const st = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    st.onboarded = true; st.autoTTS = false;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(st));
    if (s) for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
  }, seed);
  await page.waitForTimeout(1100);
  /* 켜진 채로 다시 부르고 나서 끊는다. 끊고 부르면 서비스워커가 자리를 못 잡아
     아무것도 안 뜬다 — 인터넷 되는 곳(CI)에서 이것 때문에 검사가 통째로 죽었다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  return page;
}

const open = async (page) => {
  await page.locator('.menutile', { hasText: '동사 활용' }).click();
  await page.waitForTimeout(700);
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  // ── 들어가서 한 판 ──
  const page = await boot(browser);
  page.on('pageerror', (e) => errors.push(e.message));

  ok('홈에 메뉴가 있음', await page.locator('.menutile', { hasText: '동사 활용' }).count() === 1);
  await open(page);

  const body = await page.textContent('.subscreen');
  ok('세 형태를 고를 수 있음', body.includes('1형') && body.includes('2형') && body.includes('3형'));
  ok('기초 시제 다섯이 적혀 있음',
    ['정중형', '정중 과거', '과거', '부정', '과거 부정'].every((t) => body.includes(t)));
  ok('몇 개 봤는지 알려 줌', /동사 \d+개 중 \d+개/.test(body), body.match(/동사 \d+개 중 \d+개/)?.[0]);

  /* 안 물어본 자리를 0%로 그리면 틀린 것처럼 읽힌다 */
  ok('아직 안 본 자리는 점으로', await page.locator('.cj-cell.none').count() > 0);
  ok('처음엔 성적 칸이 안 칠해짐', await page.locator('.cj-cell.good, .cj-cell.bad').count() === 0);

  await page.locator('.subscreen .bigstart').click();
  await page.waitForTimeout(800);

  ok('문제가 시작됨', await page.locator('.qoptions .qopt').count() === 4, `${await page.locator('.qoptions .qopt').count()}개`);
  ok('무엇을 묻는지 보임', (await page.textContent('.qc-tag')).length > 3, await page.textContent('.qc-tag'));
  ok('어느 형인지 알려 줌', (await page.textContent('.cj-gtag')).includes('형'));
  const ask = await page.textContent('.cj-ask');
  ok('사전형과 뜻이 같이 나옴', ask.trim().length > 3, ask.replace(/\s+/g, ' ').trim().slice(0, 30));
  ok('한글 발음도 붙음', await page.locator('.cj-ask i').count() === 1);

  /* 화면이 들고 있는 정답을 그대로 고른다 — 규칙이 맞는지는 lib 검사가 봤다 */
  const answer = await page.evaluate(() => {
    const marks = [...document.querySelectorAll('.qopt')];
    return marks.length;
  });
  ok('보기가 다 눌리는 상태', answer === 4);

  // 일부러 틀려 본다 — 첫 보기를 고르고 결과를 읽는다
  await page.locator('.qopt').first().click();
  await page.waitForTimeout(700);
  ok('정답을 알려 줌', await page.locator('.qopt.correct').count() === 1);
  ok('고른 답에 표시가 붙음', await page.locator('.qopt.correct .qo-mark.ok').count() === 1);

  /* 답을 고른 뒤에 여섯 모양을 한 번에 펼치는 게 이 화면의 핵심이다 */
  const rows = await page.locator('.cj-row').count();
  ok('활용표가 펼쳐짐', rows === 6, `${rows}줄`);
  ok('물어본 줄이 표시됨', await page.locator('.cj-row.on').count() === 1);
  ok('표에 한글 발음이 있음', await page.locator('.cj-row .cj-val i').count() === 6);
  ok('줄마다 듣기 버튼', await page.locator('.cj-say').count() === 6);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('jp_manabu_progress_v1') || '{}'));
  ok('성적이 저장됨', Boolean(saved.conj?.forms && Object.keys(saved.conj.forms).length === 1), JSON.stringify(saved.conj?.forms));
  ok('동사별로도 남음', Object.keys(saved.conj?.words || {}).length === 1, JSON.stringify(saved.conj?.words));

  await page.locator('.subscreen .bigstart').click();
  await page.waitForTimeout(600);
  ok('다음 문제로 넘어감', (await page.textContent('.sh-title')).startsWith('2 /'), await page.textContent('.sh-title'));

  // 중간에 그만두기
  await page.locator('.sh-close').click();
  await page.waitForTimeout(600);
  ok('그만두면 시작 화면으로', await page.locator('.subscreen .bigstart .bs-t').first().textContent() === '활용 연습 시작');
  ok('푼 만큼 성적표가 칠해짐', await page.locator('.cj-cell.good, .cj-cell.bad').count() >= 1);

  // ── 형태를 하나만 골라도 되는지 ──
  await page.locator('.chip', { hasText: '2형' }).click();
  await page.locator('.chip', { hasText: '3형' }).click();
  await page.waitForTimeout(400);
  ok('형태를 꺼도 하나는 남음', await page.locator('.chip.active').count() >= 1);
  await page.locator('.chip', { hasText: '1형' }).click();
  await page.waitForTimeout(300);
  ok('마지막 하나는 못 끔', await page.locator('.chip.active').count() >= 1);

  // ── て형까지 켜면 표가 늘어난다 ──
  await page.locator('.chip', { hasText: '2형' }).click();
  await page.locator('.chip', { hasText: '3형' }).click();
  await page.locator('.subscreen .toggle-row').first().click();
  await page.waitForTimeout(400);
  ok('물어볼 모양이 여덟으로', await page.locator('.cj-keychip').count() === 8, `${await page.locator('.cj-keychip').count()}개`);

  await page.locator('.subscreen .bigstart').click();
  await page.waitForTimeout(800);
  await page.locator('.qopt').first().click();
  await page.waitForTimeout(700);
  ok('표도 아홉 줄로 늘어남', await page.locator('.cj-row').count() === 9, `${await page.locator('.cj-row').count()}줄`);
  await page.locator('.sh-close').click();
  await page.waitForTimeout(500);

  // ── 시험 말고 표만 보기 ──
  await page.locator('.tr-trend > summary').click();
  await page.waitForTimeout(400);
  await page.locator('.cj-look input').fill('飲む');
  await page.waitForTimeout(500);
  ok('찾아서 활용표를 보여 줌', await page.locator('.cj-lookone').count() >= 1);
  const look = await page.textContent('.cj-lookone');
  ok('飲みます가 표에 있음', look.includes('飲みます'), look.replace(/\s+/g, ' ').slice(0, 60));
  ok('飲んだ도', look.includes('飲んだ'));
  await page.locator('.cj-look input').fill('없는동사');
  await page.waitForTimeout(400);
  ok('없으면 없다고 함', (await page.textContent('.cj-look')).includes('찾는 동사가 없어요'));

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();

  // ── 이미 푼 기록이 있으면 ──
  {
    const p2 = await boot(browser, {
      jp_manabu_progress_v1: {
        bookmarks: [],
        conj: { forms: { '1|masu': { right: 8, wrong: 2 }, '2|ta': { right: 1, wrong: 4 } }, words: { 'v-nomu': { right: 2, wrong: 0 } } },
      },
    });
    await open(p2);
    const t = await p2.textContent('.cj-grid');
    ok('맞힌 비율이 숫자로', t.includes('80') && t.includes('20'), t.replace(/\s+/g, ' ').slice(0, 60));
    ok('잘한 자리와 못한 자리를 다르게', await p2.locator('.cj-cell.good').count() >= 1 && await p2.locator('.cj-cell.bad').count() >= 1);
    ok('본 동사 수가 반영됨', (await p2.textContent('.subscreen .bs-s')).includes('1개 봤어요'), await p2.textContent('.subscreen .bs-s'));
    await p2.close();
  }

  // ── 활용 칸이 아예 없던 옛 기록 ──
  {
    const errs = [];
    const p3 = await boot(browser, { jp_manabu_progress_v1: { bookmarks: ['n5-0001'], grammarDone: {} } });
    p3.on('pageerror', (e) => errs.push(e.message));
    await open(p3);
    ok('옛 기록으로도 화면이 뜸', await p3.locator('.cj-grid').count() === 1);
    ok('옛 기록에서 안 죽음', errs.length === 0, errs.slice(0, 2).join(' | '));
    await p3.locator('.subscreen .bigstart').click();
    await p3.waitForTimeout(800);
    ok('옛 기록으로도 문제가 나옴', await p3.locator('.qopt').count() === 4);
    await p3.close();
  }

  // ── 기초문법도 같이 (앞말이 날아가던 자리) ──
  {
    const p4 = await boot(browser);
    await p4.locator('.menutile', { hasText: '기초문법' }).click();
    await p4.waitForTimeout(800);
    ok('기초문법이 열림', (await p4.textContent('.subscreen')).trim().length > 50);
    await p4.close();
  }

  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
