/* 오답노트 한 곳 — 숫자를 한 군데에서 센다.
 *
 * 틀린 문제를 적는 곳이 둘이다.
 *   새 오답노트   progress.mistakes — 단어 시험·쭉 퀴즈·문장 만들기·N3 문제가 다 적는다. 틀린 문제, 내 답, 해설.
 *   N3 오답노트   progress.n3.wrong — N3 코스 안에서 문제 id로 쌓던 옛 것. 두 번 맞히면 빠진다.
 *
 * 저장소는 둘 다 그대로 두고 화면만 하나로 합친다. N3 문제는 두 군데에 다 적히니(새 쪽 id는 n3:문제id)
 * 그냥 더하면 두 번 센다. 그래서 「새 오답노트 몇 개」와 「N3 코스에만 남은 것 몇 개」로 나눠 말한다. */
import { activeMistakes } from './mistakes.js';

export function wrongTotals(book, n3WrongCount = 0) {
  const fresh = activeMistakes(book);
  const n3InBook = fresh.filter((m) => m.source === 'n3').length;
  /* N3 쪽에 있는데 새 쪽에서 이미 다시 만날 오답으로 잡힌 것은 빼고, 코스에만 남은 것을 센다 */
  const n3Only = Math.max(0, (Number(n3WrongCount) || 0) - n3InBook);
  return { fresh: fresh.length, n3Only, n3All: Number(n3WrongCount) || 0, total: fresh.length + n3Only };
}
