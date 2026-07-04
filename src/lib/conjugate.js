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

function buildForms(base) {
  const { masu, te, ta, nai, potentialDict, volitionalCasual, ba } = base;
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

  if (group === '3') {
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
