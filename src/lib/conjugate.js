// 1그룹(う동사) 어미별 활용 테이블
const U_TABLE = {
  う: { i: 'い', te: 'って', ta: 'った', naiSuf: 'わない', pot: 'える', volCasual: 'おう' },
  つ: { i: 'ち', te: 'って', ta: 'った', naiSuf: 'たない', pot: 'てる', volCasual: 'とう' },
  る: { i: 'り', te: 'って', ta: 'った', naiSuf: 'らない', pot: 'れる', volCasual: 'ろう' },
  ぬ: { i: 'に', te: 'んで', ta: 'んだ', naiSuf: 'なない', pot: 'ねる', volCasual: 'のう' },
  ぶ: { i: 'び', te: 'んで', ta: 'んだ', naiSuf: 'ばない', pot: 'べる', volCasual: 'ぼう' },
  む: { i: 'み', te: 'んで', ta: 'んだ', naiSuf: 'まない', pot: 'める', volCasual: 'もう' },
  く: { i: 'き', te: 'いて', ta: 'いた', naiSuf: 'かない', pot: 'ける', volCasual: 'こう' },
  ぐ: { i: 'ぎ', te: 'いで', ta: 'いだ', naiSuf: 'がない', pot: 'げる', volCasual: 'ごう' },
  す: { i: 'し', te: 'して', ta: 'した', naiSuf: 'さない', pot: 'せる', volCasual: 'そう' },
};

const IRREGULAR = {
  くる: { masu: 'きます', te: 'きて', ta: 'きた', nai: 'こない', potentialDict: 'こられる', volitionalCasual: 'こよう', ba: 'くれば' },
  する: { masu: 'します', te: 'して', ta: 'した', nai: 'しない', potentialDict: 'できる', volitionalCasual: 'しよう', ba: 'すれば' },
};

/* ★ 예외 ★ (2026-11-17 QA B02) 표만 따르면 틀린 꼴이 나오는 동사들
 *   ある        ない형은 「ない」(あらない ×)
 *   존경어 5개  ます형 어간이 い(いらっしゃいます · おっしゃいます · なさいます · くださいます · ございます — りま ×)
 *   問う · 請う  て형 · た형이 うて · うた(とった ×)
 *   가능형이 없는 동사 — 이미 「할 수 있다 · 보인다 · 들린다 · 안다」를 뜻하거나 의지로 하는 동작이 아니다(できられる ×, わかれる ×,
 *   みえられる ×). 가능형 칸을 비워 두면 드릴이 그 문제를 내지 않는다 */
const HONORIFIC_I = ['いらっしゃる', 'おっしゃる', 'なさる', 'くださる', 'ござる'];
const U_TE_VERBS = ['とう', 'こう'];   // 問う · 請う — て형 · た형이 とうて · こうて(沿う 같은 다른 う동사는 표대로 そって)
const NO_POTENTIAL = ['できる', 'わかる', 'みえる', 'きこえる', 'ある', 'いらっしゃる', 'おっしゃる', 'なさる', 'くださる', 'ござる', 'すぎる', 'たりる'];

function buildForms(base) {
  const { masu, te, ta, nai, potentialDict, volitionalCasual, ba } = base;
  if (!potentialDict) {
    const { potentialDict: _p, potentialMasu: _m, ...rest } = buildForms({ ...base, potentialDict: 'x' });
    return { ...rest, potentialDict: null, potentialMasu: null };
  }
  const stem = masu.replace(/ます$/, '');
  return {
    masu,
    masuNeg: masu.replace(/ます$/, 'ません'),
    mashita: masu.replace(/ます$/, 'ました'),
    masenDeshita: masu.replace(/ます$/, 'ませんでした'),
    nai,
    ta,
    te,
    potentialDict,
    potentialMasu: potentialDict.replace(/る$/, 'ます'),
    volitionalCasual,
    volitionalPolite: stem + 'ましょう',
    ba,
    nagara: stem + 'ながら',
    teiru: te + 'います',
    tekudasai: te + 'ください',
    temoiidesuka: te + 'もいいですか',
    naidekudasai: nai + 'でください',
    tara: ta + 'ら',
  };
}

// group: '1' | '2' | '3'
export function conjugate(kana, group) {
  if (!kana) return null;
  const forms = conjugateRaw(kana, group);
  if (forms && NO_POTENTIAL.some((v) => kana === v || (kana.endsWith(v) && v.length >= 3))) {
    return { ...forms, potentialDict: null, potentialMasu: null };
  }
  return forms;
}

function conjugateRaw(kana, group) {
  /* 한자로 들어온 来る(쓰는 사람이 kana 칸에 한자를 넣은 경우) — する로 떨어지면 「来る → します」가 된다 */
  if (kana.endsWith('来る')) {
    const head = kana.slice(0, -2);
    return buildForms({ masu: `${head}来ます`, te: `${head}来て`, ta: `${head}来た`, nai: `${head}来ない`, potentialDict: `${head}来られる`, volitionalCasual: `${head}来よう`, ba: `${head}来れば` });
  }
  if (kana === 'くる' && group !== '3') group = '3';
  if (kana === 'ある') {
    return buildForms({ masu: 'あります', te: 'あって', ta: 'あった', nai: 'ない', potentialDict: null, volitionalCasual: 'あろう', ba: 'あれば' });
  }
  const hon = HONORIFIC_I.find((v) => kana === v || kana.endsWith(v));
  if (hon) {
    const head = kana.slice(0, -hon.length);
    const stem = head + hon.slice(0, -1);              // いらっしゃ
    return buildForms({ masu: `${stem}います`, te: `${stem}って`, ta: `${stem}った`, nai: `${stem}らない`, potentialDict: null, volitionalCasual: `${stem}ろう`, ba: `${stem}れば` });
  }
  if (U_TE_VERBS.includes(kana)) {
    const stem = kana.slice(0, -1);
    return buildForms({ masu: `${stem}います`, te: `${stem}うて`, ta: `${stem}うた`, nai: `${stem}わない`, potentialDict: `${stem}える`, volitionalCasual: `${stem}おう`, ba: `${stem}えば` });
  }

  if (group === '3') {
    /* 3형은 する·くる 둘뿐인 게 아니라, 勉強する처럼 앞에 말이 붙은 게 훨씬 많다.
       표만 보고 답하면 앞말이 통째로 날아가서 「勉強する의 ます형」이 「します」가
       된다 — 활용이 아니라 다른 단어가 나오는 셈이다. 앞말을 떼었다 다시 붙인다. */
    for (const tail of ['する', 'くる']) {
      if (kana.endsWith(tail) && kana.length > tail.length) {
        const head = kana.slice(0, -tail.length);
        const base = IRREGULAR[tail];
        return buildForms(Object.fromEntries(
          Object.entries(base).map(([k, v]) => [k, head + v]),
        ));
      }
    }
    const base = IRREGULAR[kana] || IRREGULAR['する'];
    return buildForms(base);
  }

  if (group === '2') {
    const stem = kana.slice(0, -1);
    return buildForms({
      masu: stem + 'ます',
      te: stem + 'て',
      ta: stem + 'た',
      nai: stem + 'ない',
      potentialDict: stem + 'られる',
      volitionalCasual: stem + 'よう',
      ba: stem + 'れば',
    });
  }

  // group 1
  const last = kana.slice(-1);
  const stem = kana.slice(0, -1);
  const t = U_TABLE[last] || U_TABLE['う'];
  let te = stem + t.te;
  let ta = stem + t.ta;
  if (kana === 'いく' || kana === '行く') {
    te = stem + 'って';
    ta = stem + 'った';
  }
  return buildForms({
    masu: stem + t.i + 'ます',
    te,
    ta,
    nai: stem + t.naiSuf,
    potentialDict: stem + t.pot,
    volitionalCasual: stem + t.volCasual,
    ba: stem + t.pot.replace(/る$/, '') + 'ば',
  });
}

export const FORM_LABELS = {
  masu: '~ます (정중형 현재)',
  masuNeg: '~ません (정중형 부정)',
  mashita: '~ました (정중형 과거)',
  masenDeshita: '~ませんでした (정중형 과거 부정)',
  nai: '~ない형 (부정)',
  ta: '~た형 (과거)',
  te: 'て형',
  potentialDict: '가능형 (사전형)',
  potentialMasu: '가능형 (ます형)',
  volitionalCasual: '의지형 (~よう)',
  volitionalPolite: '의지형 (~ましょう)',
  ba: '~ば (가정)',
  nagara: '~ながら (동시동작)',
  teiru: '~ています (진행·상태)',
  tekudasai: '~てください (정중 요청)',
  temoiidesuka: '~てもいいですか (허가)',
  naidekudasai: '~ないでください (금지 요청)',
  tara: '~たら (조건)',
};
