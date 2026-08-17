/* 디자인·UX 점검 — 실제로 그려 보고 넘치는 곳, 안 눌리는 곳, 안 보이는 글자를 찾는다. */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.APP_URL || 'http://localhost:8932/japan/';
/* 이 환경에는 크롬이 여기 있다. 없으면(예: CI) playwright가 받아 둔 걸
   알아서 찾게 undefined로 둔다. */
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined);
const OUT = process.env.OUT;

let pass = 0, fail = 0;
// 통과는 조용히 센다 — 화면 7개 × 항목 3개 × 테마 2라 다 찍으면 안 읽힌다
const ok = (l, c, e) => { if (c) { pass++; } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); } };


const VISIBLE = `(el) => {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (r.bottom < 0 || r.top > innerHeight * 3) return false;
  let n = el;
  while (n && n instanceof Element) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    if (cs.pointerEvents === 'none' && n !== el) return false;
    n = n.parentElement;
  }
  return true;
}`;

const boot = async (page) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('jp_manabu_signed_in_v1', '1');
    const s = JSON.parse(localStorage.getItem('jp_manabu_settings_v1') || '{}');
    s.onboarded = true; s.autoTTS = false;
    if (window.__THEME) s.theme = window.__THEME;
    localStorage.setItem('jp_manabu_settings_v1', JSON.stringify(s));
    // 진도가 있는 상태로 본다 — 빈 화면만 보면 넘치는 곳을 못 찾는다
    const rev = {};
    for (let i = 0; i < 60; i++) rev[`n5-${String(i + 1).padStart(4, '0')}`] = { box: (i % 3) + 1, streak: i % 4, lastSeen: '2026-08-10', rounds: 3, wrongCount: i % 5, vagueCount: i % 3 };
    localStorage.setItem('jp_manabu_review_v1', JSON.stringify(rev));
    localStorage.setItem('jp_manabu_stats_v1', JSON.stringify({ '2026-08-16': { studied: 41, known: 22, vague: 11, unknown: 8 } }));
  });
  await page.waitForTimeout(1100);
  /* 켜진 채로 다시 불러온 뒤에 끊는다. 끊고 나서 불러오면 서비스워커가 아직
     자리를 안 잡았을 때 아무것도 안 뜬다 — 인터넷이 되는 곳(CI)에서 이것 때문에
     화면 검사가 통째로 죽었다. 로그인 문을 지나가려면 오프라인이기만 하면 된다. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.context().setOffline(true);
  const off = page.locator('.gate-offline');
  await off.waitFor({ timeout: 8000 }).catch(() => {});
  if (await off.count()) { await off.click(); await page.waitForTimeout(700); }
};

/* 가로로 넘치는 곳 — 폰에서 좌우로 밀리면 그게 다 티가 난다 */
const overflow = (page) => page.evaluate((src) => {
  const seen = eval(src);
  const bad = [];
  const w = document.documentElement.clientWidth;
  document.querySelectorAll('body *').forEach((el) => {
    if (!seen(el)) return;
    const r = el.getBoundingClientRect();
    if (r.right > w + 1 || r.left < -1) {
      bad.push(`${el.className || el.tagName} ${Math.round(r.left)}~${Math.round(r.right)} (화면 ${w})`);
    }
  });
  return [...new Set(bad)].slice(0, 6);
}, VISIBLE);

/* 손가락으로 누르는 것들이 충분히 큰가 (iOS 권장 44px) */
const smallTaps = (page) => page.evaluate((src) => {
  const seen = eval(src);
  const bad = [];
  document.querySelectorAll('button, a, [role=button], input, select, summary').forEach((el) => {
    if (!seen(el)) return;
    const r = el.getBoundingClientRect();
    if (r.height < 32 || r.width < 32) bad.push(`${el.className || el.tagName} "${(el.textContent || '').trim().slice(0, 14)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  });
  return [...new Set(bad)].slice(0, 8);
}, VISIBLE);

/* 글자와 배경 대비 — 어두운 배경에 어두운 회색이면 안 읽힌다 */
const lowContrast = (page) => page.evaluate((src) => {
  const seen = eval(src);
  /* 색을 [r,g,b,a]로 읽는다. 크롬은 color-mix 결과를 "color(srgb 1 1 1 / 0.82)"
     처럼 0~1 값으로 돌려주기도 해서, 숫자만 긁어 쓰면 흰색을 검정으로 읽는다. */
  const parse = (c) => {
    if (!c) return null;
    if (/transparent/.test(c)) return [0, 0, 0, 0];
    const n = (c.match(/-?\d*\.?\d+(e-?\d+)?/gi) || []).map(Number);
    if (n.length < 3) return null;
    const unit = /^color\(/.test(c) ? 255 : 1;
    return [n[0] * unit, n[1] * unit, n[2] * unit, n.length > 3 ? n[3] : 1];
  };
  const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // 배경은 위로 올라가며 겹쳐 쌓는다 — 반투명 한 겹만 보면 값이 엉뚱해진다
  const bgOf = (el) => {
    const stack = [];
    let n = el;
    while (n && n instanceof Element) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] === 1) break; }
      n = n.parentElement;
    }
    let base = parse(getComputedStyle(document.documentElement).backgroundColor);
    if (!base || base[3] === 0) base = [255, 255, 255];
    let out = base.slice(0, 3);
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return out;
  };
  const bad = [];
  document.querySelectorAll('body *').forEach((el) => {
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
    if (!t || !seen(el)) return;
    const cs = getComputedStyle(el);
    if (Number(cs.opacity) < 0.5) return;
    if (el.disabled || el.closest('button')?.disabled) return; // 못 누르는 건 흐린 게 맞다
    // 그라데이션 위의 글자는 색이 한 값이 아니라 여기서 잴 수 없다 — 눈으로 본다
    for (let n = el; n instanceof Element; n = n.parentElement) {
      if (getComputedStyle(n).backgroundImage.includes('gradient')) return;
    }
    const fg = parse(cs.color);
    if (!fg) return;
    const bg = bgOf(el);
    const ratio = (Math.max(lum(over(fg, bg)), lum(bg)) + 0.05) / (Math.min(lum(over(fg, bg)), lum(bg)) + 0.05);
    const size = parseFloat(cs.fontSize);
    const need = (size >= 18.66 && Number(cs.fontWeight) >= 700) || size >= 24 ? 3 : 4.5;
    if (ratio < need) bad.push(`"${t.slice(0, 18)}" ${ratio.toFixed(1)}:1 (${Math.round(size)}px, 기준 ${need})`);
  });
  return [...new Set(bad)].slice(0, 8);
}, VISIBLE);

const check = async (page, theme, name) => {
  const o = await overflow(page);
  const t = await smallTaps(page);
  const c = await lowContrast(page);
  if (o.length || t.length || c.length) {
    console.log(`\n[${name}]`);
    if (o.length) { console.log('  가로 넘침:'); o.forEach((x) => console.log('    -', x)); }
    if (t.length) { console.log('  누르기 작음(<32px):'); t.forEach((x) => console.log('    -', x)); }
    if (c.length) { console.log('  대비 낮음:'); c.forEach((x) => console.log('    -', x)); }
  }
  ok(`${name} 넘침`, o.length === 0);
  ok(`${name} 탭 크기`, t.length === 0);
  ok(`${name} 대비`, c.length === 0);
  if (OUT) await page.screenshot({ path: `${OUT}/${theme}-${name}.png` });
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const errors = [];

  /* 두 테마를 다 본다. 어두운 쪽만 보다가 밝은 테마에서 「애매해요」가
     2.2:1까지 떨어져 있던 걸 놓친 적이 있다. */
  for (const theme of ['dark', 'light']) {
    console.log(`\n[${theme === 'dark' ? '어두운 테마' : '밝은 테마'}]`);
  // 아이폰 SE 크기 — 제일 좁은 축에서 깨지는지가 중요하다
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((t) => { window.__THEME = t; }, theme);
  await boot(page);

  await check(page, theme, '01-홈');
  await page.locator('.tabbar .tab', { hasText: '복습' }).click();
  await page.waitForTimeout(700); await check(page, theme, '02-복습');
  await page.locator('.tabbar .tab', { hasText: '영상' }).click();
  await page.waitForTimeout(900); await check(page, theme, '03-영상목록');
  await page.locator('.vd-open').first().click();
  await page.waitForTimeout(700);
  await page.locator('.vd-how > summary').click();
  await page.waitForTimeout(300); await check(page, theme, '04-영상-방법보기');
  await page.locator('.tabbar .tab', { hasText: '설정' }).click();
  await page.waitForTimeout(700); await check(page, theme, '05-설정');
  await page.locator('.tabbar .tab', { hasText: '학습' }).click();
  await page.waitForTimeout(1200); await check(page, theme, '07-회독-앞면');
  await page.locator('.studycard').first().click();
  await page.waitForTimeout(600); await check(page, theme, '08-회독-뒷면');
  await page.close();
  }

  ok('JS 에러 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`\n통과 ${pass} / 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH:', e.message); process.exit(2); });
