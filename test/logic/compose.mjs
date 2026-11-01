/* 문장 만들기의 규칙.
 *
 *   · 이미 본 문장만, 목표 급수 안에서만 나온다(조립은 조각이 있는 것만, 쓰기는 길이가 알맞은 것만)
 *   · 쓰기 채점: 한자·가나·마침표가 달라도 같은 문장이면 맞다, 한두 글자 오타는 close, 엉뚱하면 틀림
 *   · 복습 판정: 조립은 한 번에=알아요/고쳐서=애매해요, 쓰기는 맞음=알아요/틀림=몰라요
 *   · 빈칸 자료는 답이 하나다
 *   · AI 첨삭: 답을 안전하게 읽는다(펜스·군더더기·빠진 칸), 키가 없으면 부르지 않는다 */
import { composePool, judgeWrite, buildVerdict, writeVerdict, clozeItems, clozePool, COMPOSE_MODES, COMPOSE_MODE,
  newSession, pickNext, record } from '../../src/lib/compose.js';
import { parseCorrection, shapeCorrection, userText, hasAiKey, correctSentence, SYSTEM, MAX_SENTENCE_CHARS } from '../../src/lib/composeAi.js';
import { applyVerdict, VERDICT, addDays, todayKey, BOX } from '../../src/lib/review.js';
import { DAILY_GRAMMAR_SETS } from '../../src/data/grammar-daily.js';
import { ADVERB_SETS } from '../../src/data/adverbs.js';
import { auditSets } from '../../src/lib/blank.js';

let pass = 0; let fail = 0;
const ok = (l, c, e) => {
  if (c) { pass++; console.log('  ✓', l, e !== undefined ? `— ${e}` : ''); } else { fail++; console.log('  ✗', l, e !== undefined ? `— ${e}` : ''); }
};
const today = todayKey();
const seen = () => applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -3));
const S = (id, jp, kana, ko, level = 'N5') => ({ id, kanji: jp, kana, mean: ko, level });
const SENT = [
  S('a', '私は学生です。', 'わたしはがくせいです。', '저는 학생입니다.'),
  S('b', '駅まで歩いて行きました。', 'えきまであるいていきました。', '역까지 걸어갔어요.', 'N4'),
  S('c', 'すみません', 'すみません', '실례합니다'),                  // 너무 짧다
  S('d', '契約書の内容を確認してからサインしてください。', 'けいやくしょのないようをかくにんしてからさいんしてください。', '계약서 내용을 확인하고 서명해 주세요.', 'N3'),
  S('e', 'これはいくらですか。', 'これはいくらですか。', '이건 얼마예요?'),
];
const review = { a: seen(), b: seen(), c: seen(), d: seen() };   // e는 안 봤다

console.log('\n[ 갈래 ]');
ok('네 갈래: 조립 · 빈칸 · 쓰기 · 내 문장', COMPOSE_MODES.map((m) => m.id).join() === 'build,blank,write,free' && COMPOSE_MODE.FREE === 'free');

console.log('\n[ 풀 ]');
{
  const write = composePool({ sentences: SENT, review, goal: 'N3', mode: 'write', today });
  ok('★ 본 문장만, 길이가 알맞은 것만 ★', write.map((i) => i.id).join() === 'b,d', write.map((i) => i.id).join());
  ok('★ 안 본 문장(e)은 안 나온다 ★', !write.some((i) => i.id === 'e'));
  ok('★ 너무 짧은 문장(すみません·私は学生です。)은 쓰기에서 뺀다 ★', !write.some((i) => i.id === 'c') && !write.some((i) => i.id === 'a'));
  const n4 = composePool({ sentences: SENT, review, goal: 'N4', mode: 'write', today });
  ok('★ 목표 N4: N3 문장은 안 나온다 ★', n4.map((i) => i.id).join() === 'b', n4.map((i) => i.id).join());
  const build = composePool({ sentences: SENT, review, goal: 'N3', mode: 'build', hasChunks: (id) => id !== 'a', today });
  ok('조립은 조각이 있는 문장만', build.map((i) => i.id).join() === 'b,c,d', build.map((i) => i.id).join());
  ok('약한 정도가 붙는다', write.every((i) => typeof i.d === 'number'));
  ok('뽑기는 쭉 퀴즈와 같은 규칙을 쓴다', pickNext(write, newSession(), () => 0.5) != null);
}

console.log('\n[ 쓰기 채점 ]');
{
  const s = SENT[1];                       // 駅まで歩いて行きました。
  ok('같은 문장이면 맞다', judgeWrite(s, '駅まで歩いて行きました。').verdict === 'correct');
  ok('★ 마침표가 없어도 맞다 ★', judgeWrite(s, '駅まで歩いて行きました').verdict === 'correct');
  ok('★ 히라가나로 써도 맞다 ★', judgeWrite(s, 'えきまであるいていきました').verdict === 'correct');
  ok('공백이 끼어도 맞다', judgeWrite(s, '駅まで 歩いて 行きました。').verdict === 'correct');
  ok('한두 글자 다르면 close(내가 정한다)', judgeWrite(s, '駅まで歩いて行きます。').verdict === 'close');
  ok('★ 엉뚱하면 틀림 ★', judgeWrite(s, '私は学生です。').verdict === 'wrong');
  ok('빈 입력은 틀림', judgeWrite(s, '').verdict === 'wrong' && judgeWrite(s, '   ').verdict === 'wrong' && judgeWrite(s, null).verdict === 'wrong');
  ok('정답이 같이 돌아온다(알려 주려고)', judgeWrite(s, 'ちがう').expected === '駅まで歩いて行きました。');
  const short = SENT[0];
  ok('짧은 문장은 한 글자 차이까지만 close', judgeWrite(short, '私は先生です。').verdict !== 'correct');
}

console.log('\n[ 복습 판정 ]');
{
  ok('★ 조립: 한 번에 맞히면 알아요 ★', buildVerdict(true) === VERDICT.KNOWN);
  ok('★ 조립: 고쳐서 맞히면 애매해요(조각이 보였으니 반만) ★', buildVerdict(false) === VERDICT.VAGUE);
  ok('★ 쓰기: 맞으면 알아요, 틀리면 몰라요 ★', writeVerdict(true) === VERDICT.KNOWN && writeVerdict(false) === VERDICT.UNKNOWN);
  const before = applyVerdict(undefined, VERDICT.KNOWN, addDays(today, -4));
  const wrong = applyVerdict(before, writeVerdict(false), today);
  ok('틀리면 오늘 복습에 올라온다', wrong.box === BOX.UNKNOWN && wrong.due === today);
  const vague = applyVerdict(before, buildVerdict(false), today);
  ok('애매해요도 오늘 다시 나온다', vague.box === BOX.VAGUE && vague.due === today);
}

console.log('\n[ 빈칸 자료 — 답이 하나 ]');
{
  const items = clozeItems(DAILY_GRAMMAR_SETS, ADVERB_SETS);
  ok('일상문법 36 + 부사 20 = 56문제', items.length === 56, `${items.length}`);
  ok('id가 안 겹친다', new Set(items.map((i) => i.id)).size === items.length);
  ok('★ 자료가 성하다(빈칸·보기·왜 틀렸는지) ★', auditSets(DAILY_GRAMMAR_SETS).length === 0 && auditSets(ADVERB_SETS).length === 0,
    [...auditSets(DAILY_GRAMMAR_SETS), ...auditSets(ADVERB_SETS)].slice(0, 2).join(' | ') || '깨끗');
  ok('어느 묶음인지 붙는다', items.every((i) => i.set));
  const pool = clozePool(items);
  ok('쭉 퀴즈의 뽑기를 그대로 쓴다', pool.length === 56 && pickNext(pool, newSession(), () => 0.3) != null);
  let s = record(newSession(), pool[0], false);
  ok('틀리면 이 판에서 더 나온다', s.bump[pool[0].id] > 0);
}

console.log('\n[ AI 첨삭: 답 읽기 ]');
{
  const good = '{"verdict":"okay","corrected":"駅まで歩いて行きました。","kana":"えきまであるいていきました。","reason":"「歩く」는 「歩いて」로 이어요.","natural":[{"jp":"駅まで歩いて行ったよ。","kana":"えきまであるいていったよ。","ko":"역까지 걸어갔어.","note":"친구에게"}]}';
  const r = parseCorrection(good);
  ok('정상 응답', r.verdict === 'okay' && r.corrected.includes('歩いて') && r.natural.length === 1 && r.natural[0].kana.length > 0);
  ok('★ 마크다운 펜스가 붙어도 읽는다 ★', parseCorrection('```json\n' + good + '\n```').verdict === 'okay');
  ok('★ 앞뒤에 말이 붙어도 읽는다 ★', parseCorrection('네, 고쳤어요!\n' + good + '\n끝').corrected === '駅まで歩いて行きました。');
  ok('읽을 수 없으면 던진다(화면이 안내)', (() => { try { parseCorrection('아무 말'); return false; } catch { return true; } })());
  ok('빈 응답은 던진다', (() => { try { parseCorrection(''); return false; } catch { return true; } })());
  const odd = shapeCorrection({ verdict: '엉뚱', reason: 5, natural: [{ jp: 'A' }, { jp: 'A' }, { jp: 'B' }, { jp: 'C' }] });
  ok('★ 모르는 verdict는 okay — 맞다·틀리다 단정 안 한다 ★', odd.verdict === 'okay');
  ok('빠진 칸은 빈 글자로 채운다(흰 화면 방지)', odd.corrected === '' && odd.kana === '' && typeof odd.reason === 'string');
  ok('자연스러운 말은 겹치지 않게 둘까지', odd.natural.length === 2 && odd.natural[0].kana === 'A');
  ok('verdict 세 가지', ['good', 'okay', 'wrong'].every((v) => shapeCorrection({ verdict: v }).verdict === v));
}

console.log('\n[ AI 첨삭: 부르기 전 ]');
{
  ok('★ 키가 없으면 키가 없다고 한다 ★', !hasAiKey({}) && !hasAiKey({ aiProvider: 'claude' }));
  ok('Gemini 키 · Claude 키 · 음성 키를 빌려 쓰는 경우', hasAiKey({ geminiKey: 'k' }) && hasAiKey({ aiProvider: 'claude', claudeKey: 'k' }) && hasAiKey({ gttsKey: 'k' }));
  let msg = '';
  try { await correctSentence({ mine: '私は学生です。' }, {}); } catch (e) { msg = e.message; }
  ok('★ 키가 없으면 부르지 않고 알려 준다 ★', msg.includes('AI 키'), msg);
  msg = '';
  try { await correctSentence({ mine: '' }, { geminiKey: 'k' }); } catch (e) { msg = e.message; }
  ok('빈 문장은 안 보낸다', msg.includes('먼저'), msg);
  msg = '';
  try { await correctSentence({ mine: 'あ'.repeat(MAX_SENTENCE_CHARS + 1) }, { geminiKey: 'k' }); } catch (e) { msg = e.message; }
  ok('너무 긴 문장은 안 보낸다(요금)', msg.includes('너무 길어요'), msg);
  const t = userText({ ko: '저는 학생입니다.', mine: '私学生です', expected: '私は学生です。' });
  ok('보내는 글에 뜻·내 문장·참고 정답이 든다', t.includes('저는 학생입니다.') && t.includes('私学生です') && t.includes('참고용 정답'));
  ok('정답이 없으면 그 줄을 안 보낸다', !userText({ mine: 'あ' }).includes('참고용'));
  ok('★ 프롬프트가 「모르면 모른다」와 「자연스러운 회화」를 요구한다 ★', SYSTEM.includes('확실하지 않으면') && SYSTEM.includes('회화'));
}

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
