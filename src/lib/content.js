/* 학습 자료(단어 2,674 · 상황 문장 600)를 여는 자리.
 *
 * ★ 메인 번들에서 자료를 뺐다 ★
 *
 * App이 allWords.js와 allSituations.js를 정적으로 불러와서, 첫 로딩 JS
 * 1.4MB 가운데 1MB가 단어 자료였다. 홈 첫 화면을 그리기도 전에 3,000단어를
 * 파싱하고 합쳤다. 이제 App은 이 파일을 `import()`로 연다 — 자료는 제 청크로
 * 갈라져 껍데기(탭·홈)가 먼저 뜨고, 자료가 오면 계획을 짠다. 오프라인 사전
 * 캐시(globPatterns)는 그대로라 서비스워커가 이 청크도 미리 받아 둔다.
 *
 * 문장 카드도 여기서 한 번만 만든다. 레벨은 단어장으로 잰다(sentlevel.js) —
 * 그 단어장이 곧 이 자료라, 카드를 만드는 일이 자료를 여는 일과 한 몸이다.
 * cards.js는 자료를 모르는 순수 함수만 남긴다(App이 정적으로 불러오는 파일이라). */
import { ALL_WORDS } from '../data/allWords.js';
import { ALL_SITUATIONS } from '../data/allSituations.js';
import { sentenceToCard } from './cards.js';
import { defaultLexicon, gradeSentence } from './sentlevel.js';

export { ALL_WORDS, ALL_SITUATIONS };

/* 자료에 있는 문장을 전부 카드로. 화면마다 다시 만들지 않게 한 번만 만든다. */
let cached = null;
export function allSentenceCards() {
  if (!cached) {
    /* 레벨은 여기서 한 번만 잰다. 600문장에 3ms라 화면마다 다시 재도
       티는 안 나지만, 같은 문장이 화면마다 다른 레벨로 보일 여지를 아예
       안 만드는 편이 낫다. */
    const lex = defaultLexicon();
    cached = ALL_SITUATIONS.flatMap((s) => s.parts.flatMap(
      (p) => p.items.map((i) => sentenceToCard(
        i, `${s.label} · ${p.label}`, gradeSentence(i, lex),
      )),
    ));
  }
  return cached;
}

/* App이 한 번에 받는 묶음. 세 개를 따로 주면 셋 중 하나만 온 상태가 생긴다. */
let bundle = null;
export function getContent() {
  if (!bundle) {
    bundle = {
      words: ALL_WORDS,
      situations: ALL_SITUATIONS,
      sentenceCards: allSentenceCards(),
      /* 문장 id 전부 — 문장 복습이 몇 개인지 셀 때 */
      sentenceIds: ALL_SITUATIONS.flatMap((s) => s.parts.flatMap((p) => p.items.map((i) => i.id))),
    };
  }
  return bundle;
}
