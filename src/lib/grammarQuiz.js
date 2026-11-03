import { conjugate, FORM_LABELS } from './conjugate.js';
import { prioritizeMistakes } from './mistakes.js';

export const GRAMMAR_QUIZ_SIZE = 10;

export function shuffleGrammar(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The finite set is built once; answering/reviewing never appends questions.
export function grammarQuiz(words, module, book = {}, random = Math.random) {
  if (!module) return [];
  const verbs = words.filter((w) => w.type === 'verb' && w.kana && ['1', '2', '3'].includes(String(w.group)))
    .map((word) => ({ word, forms: conjugate(word.kana, String(word.group)) }));
  const seen = new Set();
  const pool = [];
  for (const { word, forms } of verbs) {
    for (const formKey of module.forms) {
      if (!forms?.[formKey]) continue;
      const visible = `${word.kanji || word.kana}:${word.kana}:${formKey}`;
      if (seen.has(visible)) continue;
      seen.add(visible);
      pool.push({ id: `grammar:${module.id}:${word.id}:${formKey}`, formKey, word, answer: forms[formKey], forms });
    }
  }
  const selected = prioritizeMistakes(shuffleGrammar(pool, random), book, (q) => q.id, GRAMMAR_QUIZ_SIZE);
  return selected.map(({ forms, ...q }) => {
    const wrong = conjugate(q.word.kana, String(q.word.group) === '2' ? '1' : '2')?.[q.formKey];
    // Never pad duplicate choices with whitespace; every visible answer is unique.
    const candidates = [wrong, ...shuffleGrammar(Object.values(forms), random), ...shuffleGrammar(verbs.map((v) => v.forms?.[q.formKey]), random)];
    const distractors = [...new Set(candidates.filter(Boolean).map((s) => s.trim()))].filter((s) => s !== q.answer).slice(0, 3);
    return { ...q, options: shuffleGrammar([q.answer, ...distractors], random) };
  });
}

export function grammarAttempt(module, q, chosen) {
  return {
    id: q.id, source: 'grammar', ref: q.id, kind: `기초문법 · ${module.title}`,
    prompt: `${q.word.kanji || q.word.kana} (${q.word.kana})의 ${FORM_LABELS[q.formKey]}은?`,
    correct: q.answer, chosen, options: q.options,
    explanation: `${q.word.kana} → ${q.answer} · ${FORM_LABELS[q.formKey]}. ${module.rules.map(([a, b]) => `${a}: ${b}`).join(' / ')}`,
    ok: chosen === q.answer,
  };
}
