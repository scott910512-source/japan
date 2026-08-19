/* 동사 활용 — 규칙으로 만든다.
 *
 * 이건 모델에게 물어볼 일이 아니다. 일본어 동사 활용은 사전형과 그룹만 알면
 * 예외 몇 개를 빼고 전부 규칙이다. 규칙인 것을 규칙으로 적으면 돈이 안 들고,
 * 인터넷이 없어도 되고, 매번 같은 답이 나온다. 모델은 가끔 다르게 준다.
 *
 * 단어 자료에 group(1형/2형/3형)이 이미 다 붙어 있어서 그대로 쓴다. */

/* 1형(五段)은 끝 글자가 어느 줄인지로 갈린다.
   a = ない가 붙는 모양, i = ます가 붙는 모양, ta = 과거형 꼬리. */
const GODAN = {
  う: { a: 'わ', i: 'い', ta: 'った' },
  つ: { a: 'た', i: 'ち', ta: 'った' },
  る: { a: 'ら', i: 'り', ta: 'った' },
  む: { a: 'ま', i: 'み', ta: 'んだ' },
  ぶ: { a: 'ば', i: 'び', ta: 'んだ' },
  ぬ: { a: 'な', i: 'に', ta: 'んだ' },
  く: { a: 'か', i: 'き', ta: 'いた' },
  ぐ: { a: 'が', i: 'ぎ', ta: 'いだ' },
  す: { a: 'さ', i: 'し', ta: 'した' },
};

/* 과거형에서 て형은 た를 て로, だ를 で로 바꾼 것이다. 예외가 없다. */
function teOf(ta) {
  return ta.replace(/だ$/, 'で').replace(/た$/, 'て');
}

/* 규칙에서 벗어나는 것들. 많지 않아서 적어 두는 게 정확하다.
   a/i는 어간 뒤에 붙일 모양, ta는 과거형 꼬리다. */
const SPECIAL = {
  // 行く는 1형인데 과거만 った다 (行いた가 아니다). 제일 자주 틀리는 자리.
  行く: { a: 'か', i: 'き', ta: 'った' },
  いく: { a: 'か', i: 'き', ta: 'った' },
  // ある의 부정은 あらない가 아니라 ない다. 어간까지 사라진다.
  ある: { a: '', i: 'り', ta: 'った', naiWhole: 'ない', naiPastWhole: 'なかった' },
  // 敬語 다섯 개는 ます형만 い로 줄어든다 (いらっしゃります가 아니다)
  いらっしゃる: { a: 'ら', i: 'い', ta: 'った' },
  くださる: { a: 'ら', i: 'い', ta: 'った' },
  下さる: { a: 'ら', i: 'い', ta: 'った' },
  なさる: { a: 'ら', i: 'い', ta: 'った' },
  おっしゃる: { a: 'ら', i: 'い', ta: 'った' },
  ござる: { a: 'ら', i: 'い', ta: 'った' },
  // 問う·請う는 과거가 とうた 쪽이다
  問う: { a: 'わ', i: 'い', ta: 'うた' },
  とう: { a: 'わ', i: 'い', ta: 'うた' },
};

/* 3형은 두 개뿐이다. 来る는 한자는 그대로인데 읽는 소리가 바뀌어서
   (く→き→こ) 한자 쪽과 가나 쪽을 따로 적어야 한다. */
const SURU = { a: 'し', i: 'し', ta: 'した' };
const KURU_KANA = { a: 'こ', i: 'き', ta: 'きた' };

/* 활용에서 쓰는 형태들. 화면에 나오는 차례가 이 차례다. */
export const FORMS = [
  { key: 'dict', ko: '기본형', ex: '遊ぶ', koEx: '놀다' },
  { key: 'masu', ko: '정중형', ex: '遊びます', koEx: '놉니다' },
  { key: 'masuPast', ko: '정중 과거', ex: '遊びました', koEx: '놀았습니다' },
  { key: 'masuNeg', ko: '정중 부정', ex: '遊びません', koEx: '놀지 않습니다' },
  { key: 'masuNegPast', ko: '정중 과거부정', ex: '遊びませんでした', koEx: '놀지 않았습니다' },
  { key: 'ta', ko: '과거', ex: '遊んだ', koEx: '놀았다' },
  { key: 'nai', ko: '부정', ex: '遊ばない', koEx: '놀지 않는다' },
  { key: 'naiPast', ko: '과거 부정', ex: '遊ばなかった', koEx: '놀지 않았다' },
  { key: 'te', ko: 'て형', ex: '遊んで', koEx: '놀고 / 놀아서' },
];

/* 릴에 나오는 기초 시제 다섯 개 — 사전형은 문제로 주어지니까 빼고 묻는다. */
export const BASIC_KEYS = ['masu', 'masuPast', 'nai', 'naiPast', 'ta'];
export const MORE_KEYS = ['te', 'masuNeg', 'masuNegPast'];
export const ASK_KEYS = [...BASIC_KEYS, ...MORE_KEYS];

export const FORM_LABEL = Object.fromEntries(FORMS.map((f) => [f.key, f.ko]));

export const GROUP_LABEL = { 1: '1형 (五段)', 2: '2형 (一段)', 3: '3형 (불규칙)' };

/* 어간 + 꼬리로 아홉 모양을 만든다. 여기가 활용의 전부다. */
function build(stem, rule) {
  const { a, i, ta } = rule;
  const nai = rule.naiWhole !== undefined ? rule.naiWhole : `${stem}${a}ない`;
  const naiPast = rule.naiPastWhole !== undefined ? rule.naiPastWhole : `${stem}${a}なかった`;
  return {
    masu: `${stem}${i}ます`,
    masuPast: `${stem}${i}ました`,
    masuNeg: `${stem}${i}ません`,
    masuNegPast: `${stem}${i}ませんでした`,
    ta: `${stem}${ta}`,
    te: `${stem}${teOf(ta)}`,
    nai,
    naiPast,
  };
}

/* 한 표기(한자 또는 가나)를 활용한다. 모르는 모양이면 null. */
function formsOf(text, group) {
  if (!text) return null;
  const g = String(group);

  if (g === '3') {
    if (text.endsWith('する')) return build(text.slice(0, -2), SURU);
    // 来る는 한자가 안 바뀐다. 持って来る 같은 것도 같이 받는다.
    if (text.endsWith('来る')) return build(text.slice(0, -1), { a: '', i: '', ta: 'た' });
    if (text.endsWith('くる')) return build(text.slice(0, -2), KURU_KANA);
    return null;
  }

  if (g === '2') {
    if (!text.endsWith('る')) return null;
    const stem = text.slice(0, -1);
    return build(stem, { a: '', i: '', ta: 'た' });
  }

  if (g === '1') {
    const special = SPECIAL[text];
    if (special) return build(text.slice(0, -1), special);
    const last = text.slice(-1);
    const row = GODAN[last];
    if (!row) return null;
    return build(text.slice(0, -1), row);
  }

  return null;
}

/* 단어 하나를 아홉 모양으로. 한자 쪽과 읽는 쪽을 같이 돌려준다.
   { masu: { jp, yomi }, ... } 모양이라 화면에서 바로 쓴다. */
export function conjugate(word) {
  if (!word || word.type !== 'verb') return null;
  const kanji = word.kanji || word.kana;
  const kana = word.kana || word.kanji;
  const a = formsOf(kanji, word.group);
  const b = formsOf(kana, word.group);
  if (!a || !b) return null;
  const out = { dict: { jp: kanji, yomi: kana } };
  for (const k of Object.keys(a)) out[k] = { jp: a[k], yomi: b[k] };
  return out;
}

export function canDrill(word) {
  return conjugate(word) !== null;
}

/* 헷갈리기 쉬운 이웃 모양. ます와 ました를 못 가르는 게 기초 시제에서
   제일 많이 하는 실수라, 오답에 이웃을 넣어야 진짜 시험이 된다. */
const NEAR = {
  masu: ['masuPast', 'masuNeg', 'masuNegPast'],
  masuPast: ['masu', 'ta', 'masuNeg'],
  masuNeg: ['masuNegPast', 'masu', 'nai'],
  masuNegPast: ['masuNeg', 'naiPast', 'masuPast'],
  ta: ['te', 'masuPast', 'naiPast'],
  te: ['ta', 'masu', 'nai'],
  nai: ['naiPast', 'masuNeg', 'masu'],
  naiPast: ['nai', 'masuNegPast', 'ta'],
};

/* 오답을 만든다.
 *
 * 아무 말이나 섞으면 눈으로 골라내진다. 실제로 사람이 하는 실수만 내야
 * 문제가 된다. 사람이 하는 실수는 세 가지다.
 *   1) 그룹을 잘못 봄 — 走る를 2형으로 보고 走ない
 *   2) 줄을 잘못 봄 — 遊ぶ의 과거를 く줄로 보고 遊いた
 *   3) 시제를 헷갈림 — 遊びます와 遊びました
 * 순서는 늘 같게 둔다. 섞는 건 화면이 한다. */
export function distractors(word, formKey, want = 3) {
  const right = conjugate(word);
  if (!right || !right[formKey]) return [];
  const correct = right[formKey].jp;
  const kanji = word.kanji || word.kana;
  const g = String(word.group);
  const out = [];
  const push = (v) => {
    if (v && v !== correct && !out.includes(v)) out.push(v);
  };
  const add = (forms, key = formKey) => { if (forms && forms[key]) push(forms[key]); };

  /* 그룹을 잘못 본 답. 3형은 보통 동사처럼 굴린 답이 나온다
     (勉強する → 勉強すります). */
  const wrongGroup = [];
  if (g === '1' && kanji.endsWith('る')) wrongGroup.push(formsOf(kanji, '2'));
  if (g === '2') wrongGroup.push(formsOf(kanji, '1'));
  if (g === '3' && kanji.endsWith('る')) {
    wrongGroup.push(build(kanji.slice(0, -1), GODAN['る']));
    wrongGroup.push(build(kanji.slice(0, -1), { a: '', i: '', ta: 'た' }));
  }
  wrongGroup.forEach((f) => add(f));

  /* 줄을 잘못 본 답. 과거·て형에서만 갈린다 — ます형에 다른 줄을 대면
     走たない 같은 아무도 안 쓰는 말이 나와서 오히려 티가 난다. */
  if ((formKey === 'ta' || formKey === 'te') && (g === '1' || g === '2')) {
    const stem = kanji.slice(0, -1);
    const last = kanji.slice(-1);
    for (const [kana, row] of Object.entries(GODAN)) {
      if (kana !== last) add(build(stem, row));
      if (out.length >= want) break;
    }
  }

  // 시제를 헷갈린 답 — 맞는 규칙으로 만든 다른 모양
  for (const k of NEAR[formKey] || []) {
    if (out.length >= want) break;
    push(right[k]?.jp);
  }

  // 그래도 모자라면 "그룹도 시제도 어긋난" 답으로 채운다
  for (const k of NEAR[formKey] || []) {
    if (out.length >= want) break;
    wrongGroup.forEach((f) => add(f, k));
  }

  return out.slice(0, want);
}

/* 문제 하나 = 동사 하나 + 물어볼 모양 하나.
   보기는 정답 1 + 오답 3, 자리는 seed로 정해서 같은 문제면 같은 자리에 온다. */
export function makeQuestion(word, formKey, seed = 0) {
  const forms = conjugate(word);
  if (!forms || !forms[formKey]) return null;
  const wrong = distractors(word, formKey, 3);
  if (wrong.length < 1) return null;
  const choices = [forms[formKey].jp, ...wrong];
  // seed로 자리를 돌린다 — 정답이 늘 첫 칸에 있으면 그것만 외운다
  const at = ((seed % choices.length) + choices.length) % choices.length;
  const rotated = [...choices.slice(choices.length - at), ...choices.slice(0, choices.length - at)];
  return {
    id: `conj-${word.id}-${formKey}`,
    word,
    formKey,
    label: FORM_LABEL[formKey],
    answer: forms[formKey],
    choices: rotated,
    forms,
  };
}

/* 오늘 풀 문제를 뽑는다.
 *
 * 그룹을 골고루 섞는다. 1형만 스무 개 나오면 2형은 영영 안 는다.
 * 형태도 돌아가며 물어서, 한 동사를 여러 번 만나면 매번 다른 걸 묻는다. */
export function planDrill(words, {
  count = 12, groups = ['1', '2', '3'], keys = BASIC_KEYS, seed = 0, wordStats = null,
} = {}) {
  const usable = words.filter((w) => canDrill(w) && groups.includes(String(w.group)));
  if (!usable.length || !keys.length) return [];

  /* 아직 안 본 동사가 먼저, 그다음이 틀린 적 있는 동사다. 안 그러면 105개
     중에 늘 같은 앞쪽 몇 개만 돌아서 "다 외운다"가 되질 않는다. */
  const rank = (w) => {
    const s = wordStats?.[w.id];
    if (!s || s.right + s.wrong === 0) return -1;
    return s.right / (s.right + s.wrong);
  };
  const ordered = wordStats ? [...usable].sort((a, b) => rank(a) - rank(b)) : usable;

  const byGroup = groups.map((g) => ordered.filter((w) => String(w.group) === g)).filter((l) => l.length);
  if (!byGroup.length) return [];

  const out = [];
  const used = new Set();
  for (let i = 0; out.length < count && i < count * 8; i++) {
    const bucket = byGroup[i % byGroup.length];
    // 성적을 보고 줄을 세웠으면 앞에서부터 — seed로 건너뛰면 그 정렬이 헛것이 된다
    const at = wordStats ? Math.floor(i / byGroup.length) : seed + Math.floor(i / byGroup.length);
    const w = bucket[at % bucket.length];
    const key = keys[(seed + i) % keys.length];
    const id = `${w.id}-${key}`;
    if (used.has(id)) continue;
    const q = makeQuestion(w, key, seed + i);
    if (!q) continue;
    used.add(id);
    out.push(q);
  }
  return out;
}

/* 어느 그룹의 어느 모양에서 틀리는지 — 표로 봐야 뭘 더 볼지 알 수 있다.
   기록은 { '1|masu': { right, wrong } } 모양이다. */
export function drillKey(word, formKey) {
  return `${word.group}|${formKey}`;
}

export function applyDrill(stats, word, formKey, right) {
  const k = drillKey(word, formKey);
  const prev = stats[k] || { right: 0, wrong: 0 };
  return {
    ...stats,
    [k]: { right: prev.right + (right ? 1 : 0), wrong: prev.wrong + (right ? 0 : 1) },
  };
}

/* 맞힌 비율. 아직 안 본 자리는 null — 0%로 보이면 틀린 것처럼 읽힌다. */
export function drillRate(stats, group, formKey) {
  const s = stats[`${group}|${formKey}`];
  if (!s || s.right + s.wrong === 0) return null;
  return s.right / (s.right + s.wrong);
}
