import { addDays, todayKey } from './review.js';
import { narrowAscii, normalizeJp, stripPunct } from './jptext.js';

export function judgeMistake(row, value) {
  const norm = (s) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(String(s))
    ? normalizeJp(s) : narrowAscii(stripPunct(s)).replace(/[·\s]/g, '').toLowerCase();
  return [row.correct, ...(row.accepted || [])].filter(Boolean).some((answer) => norm(answer) === norm(value));
}

// A wrong answer survives leaving the quiz and syncing. Recovery needs correct
// answers on two different dates after the last error, not two immediate clicks.
export function recordMistake(book = {}, attempt, today = todayKey(), at = Date.now()) {
  book = book || {};
  if (!attempt?.id || typeof attempt.ok !== 'boolean') return book;
  const old = book[attempt.id];
  if (attempt.ok && !old) return book;
  const row = { ...(old || {}), ...attempt, at,
    wrong: (old?.wrong || 0) + (attempt.ok ? 0 : 1),
    right: (old?.right || 0) + (attempt.ok ? 1 : 0),
    lastWrongAt: attempt.ok ? old.lastWrongAt : at,
    wrongChosen: attempt.ok ? old.wrongChosen : attempt.chosen,
    wrongExplanation: attempt.ok ? old.wrongExplanation : attempt.explanation,
    successes: attempt.ok ? { ...(old.successes || {}), [today]: at } : {},
  };
  row.resolved = Object.values(row.successes).filter((time) => time > row.lastWrongAt).length >= 2;
  row.due = attempt.ok ? addDays(today, row.resolved ? 7 : 1) : today;
  return { ...book, [attempt.id]: row };
}

export function mergeMistakes(a = {}, b = {}) {
  a = a || {}; b = b || {};
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id]; const y = b[id];
    if (!x || !y) { out[id] = x || y; continue; }
    const latest = (x.at || 0) >= (y.at || 0) ? x : y;
    const lastWrongAt = Math.max(x.lastWrongAt || 0, y.lastWrongAt || 0);
    const successes = {};
    for (const day of new Set([...Object.keys(x.successes || {}), ...Object.keys(y.successes || {})])) {
      const at = Math.max(x.successes?.[day] || 0, y.successes?.[day] || 0);
      if (at > lastWrongAt) successes[day] = at;
    }
    const days = Object.keys(successes).sort();
    const resolved = days.length >= 2;
    out[id] = { ...latest, wrong: Math.max(x.wrong || 0, y.wrong || 0), right: Math.max(x.right || 0, y.right || 0), lastWrongAt, successes, resolved, due: resolved ? addDays(days[days.length - 1], 7) : latest.due };
  }
  return out;
}

export const activeMistakes = (book = {}, today = todayKey()) => Object.values(book || {}).filter((m) => m && (!m.resolved || (m.due && m.due <= today))).sort((a, b) => String(a.due || today).localeCompare(String(b.due || today)) || (b.lastWrongAt || 0) - (a.lastWrongAt || 0));

// Reserve part of each new test for actual unresolved mistakes. Remaining slots
// stay varied so one difficult item does not consume the entire session.
export function prioritizeMistakes(items, book, refOf, count = items.length) {
  const refs = new Set(activeMistakes(book).map((m) => m.ref));
  const reserved = items.filter((item) => refs.has(refOf(item))).slice(0, Math.max(1, Math.ceil(count * .4)));
  const selected = new Set(reserved);
  return [...reserved, ...items.filter((item) => !selected.has(item))].slice(0, count);
}
