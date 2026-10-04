/* 전체 기능점검 — 모든 화면을 열어 보고, 검사가 안 보던 것을 적는다.
 *
 * 검사 3,219개가 통과해도 그건 「검사가 묻는 것」만 답한 것이다. 여기서는
 * 화면마다 들어가서 사람이 보는 것을 적는다 — JS 에러, 빈 화면, 손가락보다
 * 작은 버튼, 좌우 넘침, 본문 첫 줄. 그리고 화면마다 사진을 찍어 둔다.
 *
 * 밑줄로 시작하니 npm test는 안 집어 간다. 점검 도구다.
 *
 *   APP_URL=http://localhost:8934/japan/ OUT=/tmp/audit node test/ui/_audit.mjs
 *   DEEP_ONLY=1 …   → 1차(탭·메뉴 첫 화면)를 건너뛰고 2차(한두 걸음 더)만 */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { goTab, openMenu, openSettings } from './_nav.js';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
const LOCAL = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL) ? LOCAL : undefined);
const OUT = process.env.OUT || '/tmp/audit';
mkdirSync(OUT, { recursive: true });

const findings = [];
const note = (screen, kind, what) => { findings.push({ screen, kind, what }); };

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

const inspect = (page) => page.evaluate((src) => {
  const seen = eval(src);
  const w = document.documentElement.clientWidth;
  const over = []; const small = []; let buttons = 0;
  document.querySelectorAll('body *').forEach((el) => {
    if (!seen(el)) return;
    const r = el.getBoundingClientRect();
    if (r.right > w + 1 || r.left < -1) over.push(`${(el.className || el.tagName).toString().slice(0, 30)} ${Math.round(r.left)}~${Math.round(r.right)}`);
  });
  document.querySelectorAll('button, a[href], [role="button"], input, select').forEach((el) => {
    if (!seen(el)) return;
    buttons += 1;
    const r = el.getBoundingClientRect();
    if (el.tagName === 'A' && el.closest('p, li, .set-note, .set-sub')) return;
    if (r.height < 43.5 || r.width < 43.5) small.push(`${(el.className || el.tagName).toString().slice(0, 28)} ${Math.round(r.width)}×${Math.round(r.height)} 「${(el.textContent || '').trim().slice(0, 14)}」`);
  });
  const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
  return { over: over.slice(0, 3), small: small.slice(0, 5), buttons, text: text.slice(0, 140), len: text.length };
}, SEEN);

const boot = async (browser) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    s.menus = { ...(s.menus || {}), n3: true, swiss: true, videos: true };
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    const rev = {};
    for (let i = 0; i < 60; i++) {
      rev[`n5-${String(i + 1).padStart(4, '0')}`] = {
        box: (i % 3) + 1, streak: i % 4, lastSeen: '2026-09-20', rounds: 3,
        wrongCount: i % 5, vagueCount: i % 3,
      };
    }
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rev));
    localStorage.setItem('jp_manabu_stats_v1', JSON.stringify({ '2026-10-02': { studied: 41, known: 22, vague: 11, unknown: 8 } }));
  });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(800); }
  await page.locator('.tabbar').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  return page;
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await boot(browser);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
  const t0 = Date.now();
  const stamp = () => `${Math.round((Date.now() - t0) / 1000)}s`;

  let shot = 0;
  const look = async (name, opts = {}) => {
    await page.waitForTimeout(opts.wait || 900);
    const errsBefore = errs.length;
    const r = await inspect(page);
    shot += 1;
    const file = `${OUT}/${String(shot).padStart(2, '0')}-${name.replace(/[^\w가-힣]+/g, '_')}.png`;
    await page.screenshot({ path: file, fullPage: false }).catch(() => {});
    const flags = [];
    if (r.len < 20) { flags.push('빈화면'); note(name, '오류', `빈 화면 (글자 ${r.len}자)`); }
    if (r.over.length) { flags.push('넘침'); note(name, '오류', `좌우 넘침: ${r.over.join(' | ')}`); }
    if (r.small.length) { flags.push(`작은버튼${r.small.length}`); note(name, '특이', `손가락보다 작은 버튼: ${r.small.join(' | ')}`); }
    const newErrs = errs.slice(errsBefore);
    if (newErrs.length) { flags.push('JS에러'); note(name, '오류', `JS: ${newErrs.slice(0, 2).join(' | ')}`); }
    console.log(`\n■ ${name}  [${stamp()}]${flags.length ? '   ⚠ ' + flags.join(' · ') : ''}`);
    console.log(`   버튼 ${r.buttons}개 · ${r.text.slice(0, 120)}`);
    return r;
  };

  /* 밀어 넣은 화면을 닫고 탭으로 */
  const back = async () => {
    for (let i = 0; i < 5; i++) {
      /* 시트가 떠 있으면 먼저 — 시트가 뒤쪽 버튼을 다 가린다 */
      const sheet = page.locator('.sheet-backdrop.open');
      if (await sheet.count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); continue; }
      /* 보이는 것만 — 숨은 화면의 닫기를 잡으면 4초씩 허비하다 전체가 멈춘다 */
      const b = page.locator('.sh-close:visible, .listen .sub-back:visible, .subscreen.open .sub-back:visible, .inner-back:visible, .moreback:visible');
      if (!(await b.count())) break;
      const cls = await b.first().getAttribute('class').catch(() => '?');
      const ok = await b.first().click({ timeout: 4000 }).then(() => true).catch(() => false);
      if (process.env.TRACE) console.log(`   ← 닫기 ${cls}${ok ? '' : ' (실패)'}`);
      await page.waitForTimeout(500);
    }
  };

  /* 한 화면이 끝없이 기다리면 전체가 멈춘다 — 상한을 두고 다음으로 */
  const bounded = (name, fn, ms = 45000) => Promise.race([
    fn(),
    new Promise((_, rej) => { setTimeout(() => rej(new Error(`${ms / 1000}초 안에 안 끝남`)), ms); }),
  ]).catch((e) => {
    note(name, '오류', e.message.split('\n')[0].slice(0, 90));
    console.log(`\n■ ${name}  [${stamp()}]   ⚠ ${e.message.split('\n')[0].slice(0, 80)}`);
  });

  const clickAll = async (steps) => {
    for (const sel of steps) {
      const b = page.locator(sel).first();
      if (!(await b.count())) return `없음: ${sel}`;
      if (await b.isDisabled().catch(() => false)) return `비활성: ${sel}`;
      await b.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    return null;
  };

  // ── 1차: 네 탭 · 학습 메뉴 전부 · 설정 묶음 ──
  const firstPass = async () => {
    await look('홈');
    await goTab(page, '학습'); await look('학습 탭');
    await goTab(page, '복습'); await look('복습 탭');
    await goTab(page, '내 학습'); await look('내 학습 탭');

    const menus = ['한 권으로 끝내는 N3', '기출 단어', '단어', '문법', '한자', '문장', '듣기', '영상',
      '단어 시험', '동사 활용', '부사 연습', '짝 맞추기', '실전 연습', '완전기초', '독일어'];
    for (const m of menus) {
      await bounded(`메뉴: ${m}`, async () => {
        await openMenu(page, m);
        await look(`메뉴: ${m}`);
      });
      await bounded(`메뉴: ${m} 닫기`, async () => { await back(); await goTab(page, '홈'); }, 20000);
    }

    await bounded('복습: 복습 시작', async () => {
      await goTab(page, '복습');
      const b = page.locator('.rv-start').first();
      if (await b.count() && !(await b.isDisabled().catch(() => true))) { await b.click(); await look('복습: 복습 시작'); }
      await back();
    });

    await bounded('설정', async () => {
      await openSettings(page); await look('설정');
      const groups = await page.locator('.moregroup').evaluateAll((els) => els.map((e) => (e.querySelector('b, strong')?.textContent || e.textContent || '').trim().slice(0, 12)));
      console.log('   설정 묶음:', groups.join(' · '));
      for (let i = 0; i < groups.length; i++) {
        await page.locator('.moregroup').nth(i).click({ timeout: 4000 }).catch(() => {});
        await look(`설정: ${groups[i]}`);
        const mb = page.locator('.moreback').first();
        if (await mb.count()) { await mb.click().catch(() => {}); await page.waitForTimeout(400); }
      }
      await back();
    }, 120000);
  };

  // ── 2차: 메뉴마다 한두 걸음 더 ──
  // 셀렉터는 src/screens 의 className 그대로. 없으면 건너뛰고 적는다.
  const deepPass = async () => {
    const deep = [
      ['한 권으로 끝내는 N3', ['.n3-cta'], '오늘의 N3'],
      ['한 권으로 끝내는 N3', ['.n3-cta', '.n3-runnext'], '오늘의 N3 → 다음 단계'],
      ['기출 단어', ['.bigstart'], '1묶음 회독'],
      ['단어', ['.bigstart'], '학습 시작'],
      ['문법', ['.gram-card'], '시제'],
      ['문장', ['.menucard'], '표 사기'],
      ['문장', ['.menucard', '.menucard'], '표 사기 → 첫 문장'],
      ['듣기', ['.lh-way[data-way="auto"]'], '자동 듣기 설정'],
      ['듣기', ['.lh-way[data-way="auto"]', '.ls-go', '.ls-ask .submit-btn'], '자동 듣기 재생'],
      ['듣기', ['.lh-way[data-way="shadow"]'], '따라 말하기'],
      ['영상', ['.vd-open'], '담아 둔 영상 열기'],
      ['단어 시험', ['.bigstart'], '시험 시작'],
      ['동사 활용', ['.bigstart'], '활용 연습 시작'],
      ['부사 연습', ['.av-set'], '첫 묶음'],
      ['짝 맞추기', ['.mt-pick'], '글자로'],
      ['실전 연습', ['.ghost-btn'], '표현 익히기'],
      ['완전기초', ['.kr-quiz'], 'あ행 퀴즈'],
      ['완전기초', ['.chiprow button:nth-child(3)'], '숫자'],
      ['완전기초', ['.chiprow button:nth-child(4)'], '인사'],
      ['독일어', ['.swh-next'], '시작하기 — 인사'],
    ];
    for (const [menu, steps, name] of deep) {
      await bounded(`${menu} → ${name}`, async () => {
        await goTab(page, '홈');
        await openMenu(page, menu);
        const miss = await clickAll(steps);
        if (miss) console.log(`\n■ ${menu} → ${name}  [${stamp()}]   (건너뜀 — ${miss})`);
        else await look(`${menu} → ${name}`);
      });
      await bounded(`${menu} → ${name} 닫기`, back, 20000);
    }

    await bounded('홈 → 오늘 학습 시작', async () => {
      await goTab(page, '홈');
      const miss = await clickAll(['.bigcta', '.study.intro .bigstart']);
      if (miss) console.log(`\n■ 홈 → 오늘 학습 시작  [${stamp()}]   (건너뜀 — ${miss})`);
      else await look('홈 → 오늘 학습 시작 → 카드');
      const card = page.locator('.studycard').first();
      if (await card.count()) { await card.click(); await look('홈 → 카드 뒤집음'); }
      await back();
    });
    await bounded('복습 → 시작 → 카드', async () => {
      await goTab(page, '복습');
      const miss = await clickAll(['.rv-start', '.study.intro .bigstart']);
      if (miss) console.log(`\n■ 복습 → 시작 → 카드  [${stamp()}]   (건너뜀 — ${miss})`);
      else await look('복습 → 시작 → 카드');
      await back();
    });
    await bounded('내 학습 → N3 카드', async () => {
      await goTab(page, '내 학습');
      const miss = await clickAll(['.me-n3']);
      if (miss) console.log(`\n■ 내 학습 → N3 카드  [${stamp()}]   (건너뜀 — ${miss})`);
      else await look('내 학습 → N3 카드');
      await back();
    });
    await bounded('내 학습 → 지난달', async () => {
      await goTab(page, '내 학습');
      const miss = await clickAll(['.logmonth-nav']);
      if (!miss) await look('내 학습 → 지난달');
    });
  };

  if (!process.env.DEEP_ONLY) await firstPass();
  await deepPass();

  // ── 요약 ──
  console.log('\n\n══════════ 요약 ══════════');
  const errors = findings.filter((f) => f.kind === '오류');
  const odd = findings.filter((f) => f.kind === '특이');
  console.log(`기술적 오류 ${errors.length}건 · 특이사항 ${odd.length}건 · 사진 ${shot}장 → ${OUT} · ${stamp()}`);
  if (errors.length) { console.log('\n[ 기술적 오류 ]'); for (const f of errors) console.log(`  ✗ ${f.screen}: ${f.what}`); }
  if (odd.length) { console.log('\n[ 특이사항 ]'); for (const f of odd) console.log(`  · ${f.screen}: ${f.what}`); }
  console.log(`\n전체 JS 에러 ${errs.length}건`);
  for (const e of [...new Set(errs)].slice(0, 8)) console.log('  -', e.slice(0, 160));
  await browser.close();
})().catch((e) => { console.error('CRASH:', e.message); process.exit(1); });
