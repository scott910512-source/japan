/* Fan theme copy/assets are independent of the learning and reward rules. */
import gon from '../assets/hunter/characters/gon.png';
import gonThumb from '../assets/hunter/characters/gon-thumb.png';
import killua from '../assets/hunter/characters/killua.png';
import killuaThumb from '../assets/hunter/characters/killua-thumb.png';
import kurapika from '../assets/hunter/characters/kurapika.png';
import kurapikaThumb from '../assets/hunter/characters/kurapika-thumb.png';
import leorio from '../assets/hunter/characters/leorio.png';
import leorioThumb from '../assets/hunter/characters/leorio-thumb.png';
import hisoka from '../assets/hunter/characters/hisoka.png';
import hisokaThumb from '../assets/hunter/characters/hisoka-thumb.png';
const ART = { gon: [gon, gonThumb], killua: [killua, killuaThumb], kurapika: [kurapika, kurapikaThumb], leorio: [leorio, leorioThumb], hisoka: [hisoka, hisokaThumb] };
export const GUIDES = [
  { id: 'gon', name: '곤', role: '모험 가이드', color: '#54b768', quote: '모르는 건 하나씩 알아가면 돼. 오늘도 같이 가자!', hair: '#183b32' },
  { id: 'killua', name: '키르아', role: '복습 파트너', color: '#a99bec', quote: '급하게 갈 필요 없어. 어제 헷갈린 것부터 확실하게.', hair: '#e9efff' },
  { id: 'kurapika', name: '쿠라피카', role: '문법·한자 가이드', color: '#d6ad53', quote: '글자를 이루는 조각을 살펴봐. 이해하면 오래 기억할 수 있어.', hair: '#f3cc63' },
  { id: 'leorio', name: '레오리오', role: '성장 기록 담당', color: '#6d9ecb', quote: '작은 진전도 기록으로 남아. 지금까지 해온 걸 믿어봐.', hair: '#293c53' },
  { id: 'hisoka', name: '히소카', role: '도전 시험 가이드', color: '#c783af', quote: '조금 어려운 문제에도 도전해 볼까? 틀려도 다시 배우면 돼.', hair: '#bf567e' },
].map((guide) => {
  return { ...guide, image: ART[guide.id][0], portrait: ART[guide.id][1] };
});

const menu = (title, id, note, view) => ({ title, id, note, view });
export const REGIONS = [
  { id: 'kukuroo', name: '쿠쿠루 마운틴', level: 'N5', kind: '기초 수련', icon: '⛰', x: 24, y: 80, intro: '가나와 첫 단어부터. 매일 조금씩 모험의 기초를 다져요.', missions: [menu('가나·인사 익히기', 'basics', '히라가나 · 가타카나 · 숫자'), menu('첫 단어 수련', 'words', 'N5 단어와 예문'), menu('기초 문법', 'grammar', '조사와 기본 문장')] },
  { id: 'whale', name: '기린섬', level: 'N5', kind: '단어와 회화', icon: '⚓', x: 71, y: 68, intro: '배운 단어를 일상 문장으로 이어보고, 소리로도 만나봐요.', missions: [menu('자주 나오는 단어', 'kiju', '기출 빈도 순으로 학습'), menu('일상 문장 말하기', 'sentences', '상황별 표현과 발음'), menu('듣고 따라 말하기', 'listen', '자동 듣기 · 섀도잉')] },
  { id: 'heavens', name: '하늘투기장', level: 'N4', kind: '문법·한자', icon: '塔', x: 26, y: 53, intro: '조사와 동사 활용을 다지고, 한자의 구조를 눈으로 이해해요.', missions: [menu('N4 문법 복습', 'n3', '기초를 다지는 Chapter 0', { kind: 'curriculum', chapter: 'ch0' }), menu('한자 구조·유래·연상', 'kanji', '한국 한자 연결 · 읽기 · 확인 문제'), menu('동사 활용 수련', 'conjugate', 'ない형 · て형 · 시제')] },
  { id: 'exam', name: '헌터시험장', level: 'N4', kind: '진단과 응용', icon: '★', x: 71, y: 40, intro: '현재 문법 실력을 확인하고, 부족한 부분부터 채워가요.', missions: [menu('N4 문법 진단', 'n3', '15문항 · 결과에 맞춰 복습', { kind: 'test', id: 't:ch0' }), menu('배운 것으로 쭉 퀴즈', 'stream', '이미 본 자료 · 약점 우선'), menu('상황 대화 도전', 'rpg', '편의점 등 실생활 대화')] },
  { id: 'yorknew', name: '요크신 시티', level: 'N3', kind: '문장과 독해', icon: '▥', x: 25, y: 25, intro: '문장을 읽고 직접 만들며, N3의 긴 표현에도 익숙해져요.', missions: [menu('N3 문법 과정', 'n3', '핵심 문형과 확인 문제', { kind: 'curriculum', chapter: 'ch1' }), menu('N3 독해 훈련', 'n3', '짧은 글부터 실전 지문까지', { kind: 'curriculum', chapter: 'ch5' }), menu('문장 만들기', 'compose', '조립 · 빈칸 · 쓰기 · 내 문장')] },
  { id: 'greed', name: '그리드 아일랜드', level: 'N3', kind: '종합 훈련', icon: '♜', x: 70, y: 12, intro: '어휘·한자·문법·청해를 함께 수련하고 실전 시험에 도전해요.', missions: [menu('오늘의 N3 수련', 'n3', '기존 N3 일일 학습 계획', { kind: 'today' }), menu('N3 청해 훈련', 'n3', '듣기 · 해설 · 섀도잉', { kind: 'curriculum', chapter: 'ch6' }), menu('N3 모의고사', 'n3', '영역별 실전 문제', { kind: 'exam' })] },
];
