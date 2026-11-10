import { correct, english } from './grading.js';

export const totalQuestions = 50;
export const wordsPerWeek = 175;
export const weekCount = 4;
const start = Date.UTC(2026, 10, 11);
const dayMs = 86400000;

export function currentWeek(now = Date.now()) {
  return Math.floor((now + 8 * 3600000 - start) / (7 * dayMs));
}

export function weekLabel(week) {
  const dateLabel = day => {
    const date = new Date(start + day * dayMs);
    return (date.getUTCMonth() + 1) + '.' + String(date.getUTCDate()).padStart(2, '0');
  };
  return dateLabel(week * 7) + ' – ' + dateLabel(week * 7 + 6);
}

function shuffled(values, random) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function editDistance(a, b) {
  let last = Array.from({length:b.length + 1}, (_,i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, last[j] + 1, last[j - 1] + Number(a[i - 1] !== b[j - 1]));
    }
    last = row;
  }
  return last[b.length];
}

function similarity(a, b) {
  let prefix = 0;
  while (prefix < a.length && a[prefix] === b[prefix]) prefix++;
  return 1 - editDistance(a,b) / Math.max(a.length,b.length) + 0.04 * Math.min(prefix,4);
}

function distinctWords(rows) {
  const words = new Map();
  for (const entry of rows) {
    const key = english(entry[0]);
    if (!words.has(key)) words.set(key, entry);
  }
  return [...words.values()];
}

function choicesFor(word, meanings, candidates, random) {
  const normalized = english(word);
  const ranked = shuffled(candidates, random)
    .filter(([other, otherMeanings]) => !correct(other,word,meanings,0)
      && !otherMeanings.some(meaning => correct(meaning,word,meanings,1))
      && !meanings.some(meaning => correct(meaning,other,otherMeanings,1)))
    .map(([other]) => ({word:other, score:similarity(normalized,english(other))}))
    .sort((a,b) => b.score - a.score);
  return ranked.slice(0,3).map(entry => entry.word);
}

export function makeTest(bank, week, random = Math.random) {
  if (!Number.isInteger(week) || week < 0 || week >= weekCount) throw new RangeError('请选择一个测试周。');
  const from = week * wordsPerWeek;
  const scope = distinctWords(bank.slice(from,from + wordsPerWeek));
  if (scope.length < totalQuestions) throw new Error('本周词表至少需要 50 个不同单词。');
  const kinds = shuffled([
    ...Array(17).fill('spelling'),
    ...Array(17).fill('meaning'),
    ...Array(16).fill('choice')
  ], random);
  const sample = shuffled(scope,random).slice(0,totalQuestions);
  const all = distinctWords(bank);
  return sample.map(([word,meanings],i) => {
    const kind = kinds[i];
    if (kind !== 'choice') return {word,meanings,kind};
    const local = choicesFor(word,meanings,scope,random);
    const distractors = local.length === 3 ? local : choicesFor(word,meanings,all,random);
    if (distractors.length !== 3) throw new Error('这份词表中有太多重复释义，无法凑齐四个有效选项。');
    return {word,meanings,kind,choices:shuffled([word,...distractors],random)};
  });
}

export function isCorrect(question, answer) {
  if (!answer.trim()) return false;
  if (question.kind === 'choice') return answer === question.word;
  return correct(answer, question.word, question.meanings, Number(question.kind === 'meaning'));
}
