/* N3 문법 — 세 챕터를 한 목록으로.
 *
 *   ch0  N4 핵심 압축 복습  (진단으로 건너뛸 수 있다)
 *   ch1  N3 기본 문장 만들기
 *   ch2  N3 필수 문법 — 뜻으로 묶고 비슷한 표현을 나란히 비교
 *
 * 레슨 모양은 grammar-ch0.js 머리말 참고. 모든 레슨 id는 g: 로 시작하고,
 * 문제 id는 q: 로 시작한다 — 회독 저장소·오답 노트가 이 앞머리로 갈래를 안다. */
import { GRAMMAR_CH0 } from './grammar-ch0.js';
import { GRAMMAR_CH1 } from './grammar-ch1.js';
import { GRAMMAR_CH2A } from './grammar-ch2a.js';
import { GRAMMAR_CH2B } from './grammar-ch2b.js';
import { GRAMMAR_CH2C } from './grammar-ch2c.js';

export { BLANK } from './grammar-ch0.js';

/* ch2를 뜻으로 묶는 순서. 화면의 커리큘럼과 「비슷한 표현」 묶음이 이걸 따른다. */
export const GRAMMAR_GROUPS = [
  { id: 'reason', title: '이유·원인', sub: 'ため · せいで/おかげで · によって · わけだ' },
  { id: 'purpose', title: '목적', sub: 'ために/ように · のに(용도)' },
  { id: 'change', title: '변화', sub: 'ようになる · ことになる/にする · てくる/ていく · ば～ほど' },
  { id: 'guess', title: '추측', sub: 'そうだ · ようだ/みたいだ · らしい · はずだ · に違いない' },
  { id: 'experience', title: '경험·완료', sub: 'たばかり · ところ · まま · きる' },
  { id: 'condition', title: '조건', sub: 'さえ～ば · としたら · 場合' },
  { id: 'compare', title: '비교·대조', sub: 'に比べて · ほど～ない · 一方で · わりに' },
  { id: 'degree', title: '정도', sub: 'くらい/ほど · ばかり/だけ · しか · だけでなく · こそ' },
  { id: 'time', title: '시간', sub: 'うちに · 間/間に · たびに · 最中 · てはじめて · 前に/あとで' },
  { id: 'state', title: '상태·모습', sub: 'ておく · てしまう · っぽい · がち/気味 · 向き/向け · だらけ' },
  { id: 'decision', title: '결정·의지', sub: 'つもり · ようと思う · べきだ' },
  { id: 'obligation', title: '의무·필요', sub: 'なければならない · なくてもいい · 必要がある · ずに' },
  { id: 'permission', title: '허가·의뢰', sub: 'てもかまわない · てほしい · させていただく' },
  { id: 'hearsay', title: '전언·인용', sub: 'そうだ(전문) · という · によると · とか' },
  { id: 'contrast', title: '역접·양보', sub: 'のに · ても · くせに · としても · ながらも · からといって · けど' },
  { id: 'topic', title: '대상·관계', sub: 'について · にとって · として · を中心に · を通じて · において' },
];

export const GRAMMAR_CHAPTERS = [
  { id: 'ch0', title: 'N4 핵심 압축 복습', sub: 'N3에 꼭 필요한 조사·활용만 빠르게. 진단으로 건너뛰기', emoji: '🔁' },
  { id: 'ch1', title: 'N3 기본 문장 만들기', sub: '수식 · 명사화 · 자타동사 · 수수 · 수동 · 사역 · 경어 · 접속사', emoji: '🧱' },
  { id: 'ch2', title: 'N3 필수 문법', sub: '열여섯 가지 뜻으로 묶어 비슷한 표현끼리 비교', emoji: '📘' },
];

export const GRAMMAR_LESSONS = [...GRAMMAR_CH0, ...GRAMMAR_CH1, ...GRAMMAR_CH2A, ...GRAMMAR_CH2B, ...GRAMMAR_CH2C];

const byId = new Map(GRAMMAR_LESSONS.map((l) => [l.id, l]));
export const grammarById = (id) => byId.get(id) || null;

export function grammarOfChapter(ch) {
  return GRAMMAR_LESSONS.filter((l) => l.ch === ch);
}

export function grammarOfGroup(group) {
  return GRAMMAR_LESSONS.filter((l) => l.group === group);
}

/* 모든 문법 문제를 납작하게 — 실전·약점·복습이 여기서 뽑는다. */
export const GRAMMAR_QUESTIONS = GRAMMAR_LESSONS.flatMap((l) => l.quiz.map((q) => ({
  ...q,
  cat: l.cat || 'grammar',
  ref: l.id,
  refTitle: l.title,
  kind: 'grammar',
  d: q.d || 1,
})));
