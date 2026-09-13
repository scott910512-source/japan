/* 뜻(한국어)을 소리로 내는 길.
 *
 * ★ 「자동 듣기에서 한국어를 안 읽어준다」 ★
 *
 * 재현해 보니 앱은 ko-KR로 제대로 넘기고 있었다. 넘긴 뒤가 문제였다.
 *
 *   · 일본어는 클라우드 폴백이 있다. 키를 넣어 두면 기기에 일본어 음성이
 *     없어도 mp3를 받아서 튼다 — 그래서 일본어는 늘 들린다.
 *   · 한국어는 기기 음성밖에 없었다. requestCloud가 languageCode를 ja-JP로
 *     박아 두어서 클라우드를 쓸 수가 없었다.
 *   · 게다가 실패를 아무도 안 들었다. utter.onerror가 없어서 엔진이
 *     synthesis-failed를 돌려줘도 앱은 모르고 사용자에게도 안 알렸다.
 *
 * 그래서 「일본어는 나오는데 한국어만 안 나오고, 왜 안 나오는지도 모른다」가 됐다.
 * 여기서 보는 것은 넷이다.
 *   기기 음성이 있으면 공짜로 낸다 (돈 쓰지 않는다)
 *   기기가 실패하면 클라우드로 넘어간다
 *   한 번 실패한 기기는 다음부터 바로 클라우드로 간다 (들리다 말다 하지 않는다)
 *   둘 다 안 되면 조용한 이유를 말해 준다 — 한 번만
 */

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};

/* ── 기기 흉내 ──
   tts.js는 불러올 때 window.speechSynthesis에 핸들러를 건다. 그래서 먼저 세운다. */
const spoken = [];      // 기기 음성으로 넘긴 것
const calls = [];       // 구글 TTS로 부른 것
let voices = [];
let nextError = null;   // 다음 발화에서 낼 오류 (엔진이 실패하는 기기 흉내)

class Utter {
  constructor(text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; }
}

globalThis.SpeechSynthesisUtterance = Utter;
globalThis.Audio = class {
  constructor() { this.dataset = {}; this.currentTime = 0; }
  play() { return Promise.resolve(); }
  pause() {}
};

/* nextError를 'SILENT'로 두면 아이폰 흉내다 — 오류도 start도 안 준다. */
const synth = {
  getVoices: () => voices,
  cancel: () => {},
  speak: (u) => {
    spoken.push({ lang: u.lang, text: u.text, voice: u.voice?.lang || null });
    if (nextError === 'SILENT') return;          // 아무 기별이 없다
    if (nextError) { u.onerror?.({ error: nextError }); return; }
    u.onstart?.();                               // 멀쩡한 기기는 말을 시작한다
  },
  onvoiceschanged: null,
};
globalThis.window = { speechSynthesis: synth };
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

globalThis.fetch = (url, opt) => {
  const body = JSON.parse(opt.body);
  calls.push({ lang: body.voice.languageCode, name: body.voice.name ?? null, text: body.input.text });
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ audioContent: 'AAAA' }),
  });
};

const tts = await import('../../src/lib/tts.js');

/* speak은 cancel과 같은 틱에 부르면 사파리가 버려서, 한 틱 떼어 놓았다.
   그래서 기다리는 시간이 필요하다 — 넘겼는지 보려면 200ms,
   조용한 기기의 시간초과까지 보려면 1.2초. */
const settle = () => new Promise((r) => { setTimeout(r, 200); });
const settleSilent = () => new Promise((r) => { setTimeout(r, 1200); });

const reset = () => { spoken.length = 0; calls.length = 0; nextError = null; };
const KO = { voiceURI: 'ko', name: 'Korean', lang: 'ko-KR' };

console.log('\n[ 기기에 한국어 음성이 있으면 공짜로 낸다 ]');
{
  voices = [KO];
  synth.onvoiceschanged?.();            // 목록이 바뀌었다고 알린다
  tts.configureTTS({ gttsKey: 'KEY', useCloud: true, voice: 'ja-JP-Neural2-B' });
  reset();
  tts.speakKorean('목소리', 1);
  await settle();
  ok('기기 음성으로 넘긴다', spoken.length === 1 && spoken[0].lang === 'ko-KR', JSON.stringify(spoken[0]));
  ok('한국어 음성을 붙인다', spoken[0].voice === 'ko-KR');
  /* 클라우드 몫은 일본어에 쓰는 유료 자원이다. 기기가 되면 건드리지 않는다 */
  ok('★ 클라우드를 부르지 않는다 ★', calls.length === 0, `${calls.length}회`);
}

console.log('\n[ ★ 기기가 실패하면 클라우드로 넘어간다 ★ ]');
{
  voices = [];
  synth.onvoiceschanged?.();            // 「이 기기는 안 된다」는 판단을 놓는다
  tts.configureTTS({ gttsKey: 'KEY', useCloud: true });
  reset();
  nextError = 'synthesis-failed';
  tts.speakKorean('목소리', 1);
  await settle();
  ok('기기로 먼저 시도한다', spoken.length === 1, `${spoken.length}회`);
  const ko = calls.filter((c) => c.lang === 'ko-KR');
  ok('★ 클라우드로 넘어간다 ★', ko.length === 1, JSON.stringify(calls));
  /* 목소리 이름을 박으면 그 목소리가 계정·지역에서 안 되는 날 400이 난다.
     뜻은 누가 읽어도 알아들으면 되니 구글이 고르게 둔다. */
  /* ko가 비었을 때 ko[0].name을 읽으면 여기서 파일이 죽고 아래 검사가 통째로
     사라진다 — 깨진 자리만 알려 주고 나머지는 계속 봐야 한다. */
  ok('★ 한국어에 목소리 이름을 안 박는다 ★', ko[0]?.name === null, `${ko[0]?.name}`);
  ok('보낸 글자가 그대로다', ko[0]?.text === '목소리');
}

console.log('\n[ ★ 아이폰처럼 아무 말 없이 조용한 기기 ★ ]');
{
  /* 사파리는 못 읽을 때 오류를 주는 게 아니라 그냥 아무 일도 안 한다. 오류도
     start도 안 오니, onerror만 달아 두면 폴백이 걸릴 자리가 없다 — 실제로
     아이폰에서 이것 때문에 고치고도 여전히 조용했다. 시간으로도 본다. */
  voices = [KO];                    // 아이폰에는 한국어 음성이 「있다」
  synth.onvoiceschanged?.();
  tts.configureTTS({ gttsKey: 'KEY', useCloud: true });
  reset();
  nextError = 'SILENT';
  tts.speakKorean('역은 어디예요?', 1);
  await settle();
  ok('기기로 넘기긴 한다', spoken.length === 1, `${spoken.length}회`);
  ok('아직 클라우드로 안 간다', calls.length === 0, `${calls.length}회`);

  await settleSilent();
  ok('★ 조용하면 시간으로 알아챈다 ★',
    calls.filter((c) => c.lang === 'ko-KR').length === 1, JSON.stringify(calls));
  ok('보낸 글자가 그대로다', calls.find((c) => c.lang === 'ko-KR')?.text === '역은 어디예요?');
}

console.log('\n[ 말을 시작하면 시간초과가 안 걸린다 ]');
{
  /* 멀쩡한 기기에서 시간초과가 걸리면 공짜로 낼 소리를 돈 내고 또 받는다.
     start가 오면 거기서 끝이어야 한다. */
  voices = [KO];
  synth.onvoiceschanged?.();
  reset();
  nextError = null;                 // start가 온다
  tts.speakKorean('잘 되는 기기', 1);
  await settleSilent();
  ok('★ 클라우드를 안 부른다 ★', calls.length === 0, JSON.stringify(calls));
  ok('기기로만 냈다', spoken.length === 1);
}

console.log('\n[ ★ 한 번 실패한 기기는 다음부터 바로 클라우드 ★ ]');
{
  /* 매 장마다 한 번씩 조용히 실패하고 나서야 넘어가면 뜻이 들리다 말다 한다. */
  voices = [];
  synth.onvoiceschanged?.();            // 앞 묶음이 놓아 둔 판단을 지운다
  reset();
  nextError = 'synthesis-failed';
  tts.speakKorean('첫 장', 1);          // 여기서 한 번 실패시킨다
  await settle();
  ok('한 번은 실패한다', calls.some((c) => c.lang === 'ko-KR'), JSON.stringify(calls));

  reset();
  nextError = null;                     // 이제 기기가 실패할 일도 없다 — 가지도 않아야 한다
  tts.speakKorean('두 번째', 1);
  await settle();
  ok('★ 기기를 다시 안 건드린다 ★', spoken.length === 0, `${spoken.length}회`);
  ok('곧장 클라우드로 간다', calls.some((c) => c.lang === 'ko-KR' && c.text === '두 번째'), JSON.stringify(calls));
}

console.log('\n[ 음성이 새로 깔리면 다시 공짜로 낸다 ]');
{
  /* 목록이 늦게 채워지는 기기에서 첫 장만 실패하고 영구히 클라우드로 가면,
     공짜로 낼 수 있는 소리를 계속 돈 내고 받는다. */
  voices = [KO];
  synth.onvoiceschanged?.();
  reset();
  tts.speakKorean('다시', 1);
  await settle();
  ok('기기 음성으로 돌아온다', spoken.length === 1 && spoken[0].lang === 'ko-KR');
  ok('클라우드를 안 부른다', calls.filter((c) => c.lang === 'ko-KR').length === 0);
}

console.log('\n[ ★ 둘 다 안 되면 이유를 말해 준다 — 한 번만 ★ ]');
{
  const said = [];
  tts.setTTSErrorHandler((m) => said.push(m));
  voices = [];
  synth.onvoiceschanged?.();
  tts.configureTTS({ gttsKey: '', useCloud: true });   // 클라우드 없음
  reset();
  nextError = 'synthesis-failed';
  tts.speakKorean('첫 장', 1);
  await settle();
  ok('★ 조용한 이유를 알린다 ★', said.length === 1, JSON.stringify(said));
  ok('무엇을 하면 되는지도 적는다', said[0].includes('클라우드'), said[0]);
  ok('클라우드를 부르진 않는다', calls.length === 0);

  tts.speakKorean('둘째 장', 1);
  tts.speakKorean('셋째 장', 1);
  await settle();
  /* 장마다 알리면 듣는 내내 토스트가 뜬다 — 걸으면서 쓰는 화면이다 */
  ok('★ 장마다 되풀이하지 않는다 ★', said.length === 1, `${said.length}번`);
}

console.log('\n[ 우리가 끊은 것은 실패가 아니다 ]');
{
  /* 다음 장으로 넘어갈 때마다 cancel을 부른다. 그걸 실패로 보면 멀쩡한 기기가
     「안 된다」고 찍히고, 그 뒤로 공짜 음성을 안 쓴다. */
  const said = [];
  tts.setTTSErrorHandler((m) => said.push(m));
  voices = [KO];
  synth.onvoiceschanged?.();
  tts.configureTTS({ gttsKey: 'KEY', useCloud: true });
  reset();
  nextError = 'interrupted';
  tts.speakKorean('끊긴 것', 1);
  await settle();
  ok('아무 말도 안 한다', said.length === 0, JSON.stringify(said));
  ok('클라우드로 넘기지도 않는다', calls.length === 0, `${calls.length}회`);

  // 그리고 그 기기는 여전히 멀쩡하다 — 다음 장도 기기 음성으로 간다
  reset();
  nextError = null;
  tts.speakKorean('다음 장', 1);
  await settle();
  ok('★ 기기가 여전히 멀쩡하다 ★', spoken.length === 1 && calls.length === 0);
}

console.log('\n[ 일본어는 하던 대로다 ]');
{
  voices = [];
  synth.onvoiceschanged?.();
  tts.configureTTS({ gttsKey: 'KEY', useCloud: true, voice: 'ja-JP-Neural2-B' });
  reset();
  tts.speakJapanese('こえ', 1);
  await settle();
  const ja = calls.filter((c) => c.lang === 'ja-JP');
  ok('일본어는 ja-JP로 부른다', ja.length === 1, JSON.stringify(calls));
  ok('고른 목소리를 그대로 쓴다', ja[0].name === 'ja-JP-Neural2-B', `${ja[0].name}`);
}

console.log('\n[ ★ 캐시가 두 말을 섞지 않는다 ★ ]');
{
  /* 같은 글자를 두 말로 부를 수 있다(숫자·기호·짧은 낱말). 캐시 열쇠에 말이
     없으면 먼저 받은 소리가 다른 말 자리에서 다시 난다 — 한국어 자리에서
     일본어가 나는 셈이다. */
  tts.configureTTS({ gttsKey: 'KEY2', useCloud: true, voice: 'ja-JP-Neural2-B' });
  voices = [];
  synth.onvoiceschanged?.();
  reset();
  tts.speakJapanese('OK', 1);
  await settle();
  nextError = 'synthesis-failed';
  tts.speakKorean('OK', 1);
  await settle();
  ok('★ 말마다 따로 받는다 ★',
    calls.filter((c) => c.text === 'OK' && c.lang === 'ja-JP').length === 1
    && calls.filter((c) => c.text === 'OK' && c.lang === 'ko-KR').length === 1,
    JSON.stringify(calls));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
