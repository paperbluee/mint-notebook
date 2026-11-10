import { builtIn } from './words.js';
import { cetFour } from './cet4.js';
import { currentWeek, weekLabel, makeTest, isCorrect, totalQuestions, weekCount } from './weekly-engine.js';

const $ = id => document.getElementById(id);
function element(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem('mint-notebook:' + key)) ?? fallback; }
  catch { return fallback; }
}
const imported = read('source','built-in') === 'import' ? read('import',null) : null;
const validImport = imported?.id && imported.words?.length >= 750;
const saved = read('weekly-v1',{attempts:{},active:null});
let level = read('level','six') === 'four' ? 'four' : 'six';
let week = Math.max(0, Math.min(weekCount - 1, currentWeek()));
let attempt = null;
let storageAvailable = true;
const labels = {four:'英语四级',six:'英语六级'};
const kindLabels = {spelling:'看中文写英文',meaning:'看英文写中文',choice:'拼写辨析'};
const letters = ['A','B','C','D'];
const bank = () => level === 'four' ? cetFour : validImport ? imported.words : builtIn;
const bankKey = () => level === 'four' ? 'cet4' : validImport ? 'import-' + imported.id : 'cet6';
const attemptKey = () => bankKey() + ':' + week;

function save() {
  try {
    localStorage.setItem('mint-notebook:weekly-v1',JSON.stringify(saved));
  } catch {
    storageAvailable = false;
  }
  $('save-note').textContent = storageAvailable ? '进度保存在此浏览器' : '浏览器存储不可用，进度仅保留在当前页面';
}

function show(section) {
  for (const id of ['setup','paper','results']) $(id).hidden = id !== section;
}

function renderSetup() {
  show('setup');
  $('setup-error').textContent = '';
  $('four').setAttribute('aria-pressed',String(level === 'four'));
  $('six').setAttribute('aria-pressed',String(level === 'six'));
  const activeWeek = currentWeek();
  $('bank-note').textContent = level === 'four' ? '使用默写本的四级词表。' : validImport ? '使用已导入默写本的六级词表。' : '使用默写本内置的六级练习词表。';
  $('weeks').replaceChildren(...Array.from({length:weekCount},(_,index) => {
    const button = element('button',undefined,'week');
    button.type = 'button';
    button.setAttribute('aria-pressed',String(index === week));
    button.append(element('b','第 ' + (index + 1) + ' 周'),element('span',weekLabel(index)),
      element('span',index === activeWeek ? '本周' : index > activeWeek ? '可提前练习' : '可回顾测试'));
    button.addEventListener('click',() => {
      week = index;
      renderSetup();
      $('weeks').children[index].focus();
    });
    return button;
  }));
  const previous = saved.attempts[attemptKey()];
  $('start').textContent = previous ? previous.graded ? '查看上次成绩' : '继续上次作答' : '开始测试';
}

function openAttempt(retake = false) {
  const key = attemptKey();
  try {
    if (retake || !saved.attempts[key]) {
      saved.attempts[key] = {
        level, week, position:0, graded:false,
        questions:makeTest(bank(),week),
        answers:Array(totalQuestions).fill('')
      };
    }
    saved.active = key;
    attempt = saved.attempts[key];
    save();
    if (attempt.graded) renderResults();
    else renderPaper();
  } catch (error) {
    renderSetup();
    $('setup-error').textContent = error.message;
  }
}

const answered = () => attempt.answers.filter(answer => answer.trim()).length;

function updateProgress() {
  const count = answered();
  $('answered').textContent = '已作答 ' + count + ' / ' + totalQuestions;
  $('progress').value = count;
  [...$('question-map').children].forEach((button,i) => {
    const hasAnswer = !!attempt.answers[i].trim();
    button.dataset.answered = String(hasAnswer);
    button.setAttribute('aria-current',String(i === attempt.position));
    button.setAttribute('aria-label','第 ' + (i + 1) + ' 题' + (hasAnswer ? '，已作答' : '，未作答'));
  });
}

function writeAnswer(value) {
  attempt.answers[attempt.position] = value;
  save();
  updateProgress();
}

function renderQuestion(focus = false) {
  const i = attempt.position;
  const q = attempt.questions[i];
  $('question-meta').textContent = (i + 1) + ' / ' + totalQuestions + ' · ' + kindLabels[q.kind] + ' · 2 分';
  $('prompt').textContent = q.kind === 'meaning' ? q.word : q.meanings.join('；');
  $('prompt').lang = q.kind === 'meaning' ? 'en' : 'zh-CN';
  $('prev-question').disabled = i === 0;
  $('next-question').textContent = i === totalQuestions - 1 ? '检查并交卷' : '下一题 →';
  if (q.kind === 'choice') {
    const group = element('fieldset',undefined,'option-group');
    group.setAttribute('aria-label','选择对应的英文单词');
    q.choices.forEach((word,j) => {
      const label = element('label',undefined,'option');
      const radio = element('input');
      radio.type = 'radio';
      radio.name = 'choice';
      radio.checked = word === attempt.answers[i];
      radio.addEventListener('change',() => writeAnswer(word));
      const choice = element('span',word);
      choice.lang = 'en';
      label.append(radio,element('b',letters[j],'option-letter'),choice);
      group.append(label);
    });
    $('response').replaceChildren(group);
  } else {
    const input = element('input',undefined,'quiz-input');
    input.type = 'text';
    input.placeholder = q.kind === 'meaning' ? '填写一个中文义项…' : '填写英文单词…';
    input.setAttribute('aria-label',input.placeholder.slice(0,-1));
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.maxLength = 180;
    input.value = attempt.answers[i];
    input.addEventListener('input',() => writeAnswer(input.value));
    input.addEventListener('keydown',event => {
      if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) nextQuestion();
    });
    $('response').replaceChildren(input);
  }
  updateProgress();
  if (focus) $('prompt').focus();
}

function goTo(position) {
  if (position < 0 || position >= totalQuestions) return;
  attempt.position = position;
  save();
  renderQuestion(true);
}

function renderPaper() {
  show('paper');
  $('test-label').textContent = labels[level] + ' · 第 ' + (week + 1) + ' 周 · ' + weekLabel(week);
  $('question-map').replaceChildren(...Array.from({length:totalQuestions},(_,i) => {
    const button = element('button',String(i + 1),'day');
    button.type = 'button';
    button.addEventListener('click',() => goTo(i));
    return button;
  }));
  renderQuestion(true);
}

function renderResults() {
  show('results');
  const misses = [];
  let correctCount = 0;
  let blank = 0;
  attempt.questions.forEach((q,i) => {
    const answer = attempt.answers[i];
    if (isCorrect(q,answer)) { correctCount++; return; }
    if (!answer.trim()) blank++;
    const item = element('li');
    item.value = i + 1;
    item.append(element('b',q.word + ' · ' + q.meanings.join('；')),
      element('small',kindLabels[q.kind] + ' · 你的答案：' + (answer.trim() || '未作答')));
    misses.push(item);
  });
  $('score').textContent = String(correctCount * 2);
  $('result-label').textContent = labels[level] + ' · 第 ' + (week + 1) + ' 周';
  $('score-detail').textContent = '答对 ' + correctCount + ' 题 · 答错 ' + (misses.length - blank) + ' 题 · 未作答 ' + blank + ' 题';
  $('correction-title').textContent = misses.length ? '错题回顾' : '全部答对';
  $('corrections').replaceChildren(...misses);
  $('result-title').focus();
}

function submit() {
  const remaining = totalQuestions - answered();
  $('submit-copy').textContent = remaining
    ? '还有 ' + remaining + ' 题未答，交卷后按 0 分计。'
    : '50 题已作答，交卷后即可查看分数和错题。';
  $('submit-dialog').returnValue = '';
  $('submit-dialog').showModal();
}

function nextQuestion() {
  if (attempt.position === totalQuestions - 1) submit();
  else goTo(attempt.position + 1);
}

function returnToSetup() {
  saved.active = null;
  save();
  renderSetup();
  $('start').focus();
}

for (const id of ['four','six']) {
  $(id).addEventListener('click',() => {
    level = id;
    renderSetup();
  });
}
$('start').addEventListener('click',() => openAttempt());
$('leave').addEventListener('click',returnToSetup);
$('back').addEventListener('click',returnToSetup);
$('retry').addEventListener('click',() => openAttempt(true));
$('prev-question').addEventListener('click',() => goTo(attempt.position - 1));
$('next-question').addEventListener('click',nextQuestion);
$('submit').addEventListener('click',submit);
$('submit-dialog').addEventListener('close',() => {
  if ($('submit-dialog').returnValue !== 'submit') return;
  attempt.graded = true;
  save();
  renderResults();
});

const active = saved.attempts[saved.active];
if (active) {
  level = active.level;
  week = active.week;
}
if (active && saved.active === attemptKey()) openAttempt();
else renderSetup();
