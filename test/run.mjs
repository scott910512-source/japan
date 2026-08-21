/* 전부 돌린다.  npm test
 *
 * 두 갈래다.
 *   logic/  순수 함수 — 회독 규칙, 기기 합치기, 자막 파싱. 브라우저가 필요 없다.
 *   ui/     빌드한 결과물을 진짜 크롬으로 눌러 본다. 소스가 아니라 배포될 물건이다.
 *
 * ui 쪽은 미리 빌드해 두고 vite preview로 띄운 뒤 돈다 — 개발 서버가 아니라
 * 실제 배포와 같은 경로(/japan/)와 같은 파일을 봐야 의미가 있다.
 *
 * 크롬은 PLAYWRIGHT 브라우저를 쓴다. 경로가 다르면 CHROMIUM 환경변수로 준다.
 *   CHROMIUM=/path/to/chrome npm test
 * ui를 건너뛰려면:  npm test -- --logic
 */
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PORT = Number(process.env.PORT || 8932);
const APP_URL = `http://localhost:${PORT}/japan/`;
const LOCAL_CHROME = '/opt/pw-browsers/chromium';
const CHROME = process.env.CHROMIUM || (existsSync(LOCAL_CHROME) ? LOCAL_CHROME : '');
const only = process.argv.includes('--logic') ? 'logic' : process.argv.includes('--ui') ? 'ui' : 'all';

const list = (dir, ext) => (existsSync(join(HERE, dir))
  /* 밑줄로 시작하는 건 검사가 아니라 검사들이 같이 쓰는 것이다 —
     화면 사이를 다니는 길(_nav.js) 같은 것. 돌리면 0개 통과로 죽는다. */
  ? readdirSync(join(HERE, dir)).filter((f) => f.endsWith(ext) && !f.startsWith('_')).sort()
  : []);

/* 검사 하나를 돌리고 "통과 N / 실패 M"을 읽어 온다.
   출력은 그대로 흘려보낸다 — 실패했을 때 어느 줄이 깨졌는지 봐야 한다. */
function runOne(cmd, args, label) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    // CHROMIUM이 빈 값이면 넘기지 않는다 — 검사가 알아서 찾게 둔다
    env: { ...process.env, APP_URL, ...(CHROME ? { CHROMIUM: CHROME } : {}) },
    timeout: 180_000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = out.match(/통과\s+(\d+)\s*\/\s*실패\s+(\d+)/);
  const passed = m ? Number(m[1]) : 0;
  const failed = m ? Number(m[2]) : 1;
  const crashed = !m;
  console.log(`\n── ${label}`);
  if (failed > 0 || crashed) {
    process.stdout.write(out.trim().split('\n').slice(-25).join('\n'));
    console.log();
  } else {
    console.log(`   통과 ${passed}`);
  }
  return { label, passed, failed, crashed };
}

/* preview 서버가 뜰 때까지 기다린다. 바로 붙으면 아직 안 올라와 있어서
   첫 검사가 통째로 실패한다. */
async function waitFor(url, ms = 30_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* 아직 안 떴다 */ }
    await new Promise((r) => { setTimeout(r, 300); });
  }
  return false;
}

const results = [];

if (only !== 'ui') {
  for (const f of list('logic', '.mjs')) {
    results.push(runOne('npx', ['vite-node', join(HERE, 'logic', f)], `logic/${f}`));
  }
}

let server = null;
if (only !== 'logic') {
  const ui = list('ui', '.js');
  if (ui.length) {
    if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
      console.log('── 빌드 (dist가 없음)');
      spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    }
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: ROOT, stdio: 'ignore', detached: true,
    });
    if (!(await waitFor(APP_URL))) {
      console.error(`\n서버가 안 떴어요 (${APP_URL}). 다른 게 ${PORT} 포트를 쓰고 있는지 보세요.`);
      try { process.kill(-server.pid); } catch { /* 이미 죽음 */ }
      process.exit(2);
    }
    for (const f of ui) results.push(runOne('node', [join(HERE, 'ui', f)], `ui/${f}`));
  }
}

if (server) { try { process.kill(-server.pid); } catch { /* 이미 죽음 */ } }

const passed = results.reduce((n, r) => n + r.passed, 0);
const failed = results.reduce((n, r) => n + r.failed, 0);
const broken = results.filter((r) => r.failed > 0 || r.crashed);

console.log(`\n${'─'.repeat(46)}`);
console.log(`검사 ${results.length}묶음 · 통과 ${passed} · 실패 ${failed}`);
if (broken.length) {
  console.log(`\n깨진 곳: ${broken.map((r) => r.label + (r.crashed ? '(멈춤)' : '')).join(', ')}`);
  process.exit(1);
}
console.log('전부 통과');
