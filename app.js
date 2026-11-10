import { correct } from './grading.js';
import { builtIn } from './words.js';
import { cetFour } from './cet4.js';

const icons = {
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2m-8 3h2"/>',
  import:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  left:'<path d="m14 6-6 6 6 6"/>', right:'<path d="m10 6 6 6-6 6"/>',
  book:'<path d="M6 3h14v17H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-2 15a2 2 0 0 1 2-2h14M8 7h8m-8 4h5"/>',
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  hidden:'<path d="m3 3 18 18M9 6.5A10 10 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-3 3.5m-3 1.8a10 10 0 0 1-4 .7c-6.5 0-10-6-10-6a15 15 0 0 1 4-4"/>',
  pen:'<path d="m4 16 11-11a2 2 0 0 1 3 3L7 19H4zm9-9 3 3"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  save:'<path d="M4 5h13l3 3v12H4zm4 0v5h8V5m-8 15v-6h8v6"/>'
};
const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24">' + icons[name] + '</svg>';
const $ = id => document.getElementById(id);
const elem = (tag, cls, value) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (value !== undefined) e.textContent = value;
  return e;
};
document.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = icon(e.dataset.icon); });
const dayMs = 86400000;
const start = Date.UTC(2026, 10, 11);
const dates = Array.from({length:30}, (_,i) => new Date(start + i * dayMs));
const weekday = '日一二三四五六';
const pad = n => String(n).padStart(2,'0');
const dateText = d => (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
const todayIndex = (now = Date.now()) => Math.floor((now + 8 * 3600000 - start) / dayMs);
const columns = [
  {name:'英文单词',label:'WORD',kind:0,ref:true},
  {name:'中文释义',label:'MEANING',kind:1,ref:true},
  {name:'默写单词',label:'SPELLING',kind:0},
  {name:'默写释义',label:'DEFINITION',kind:1}
];

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem('mint-notebook:' + key)) ?? fallback; }
  catch { return fallback; }
};
const save = (key,value) => {
  try { localStorage.setItem('mint-notebook:' + key, JSON.stringify(value)); return true; }
  catch { $('storage-label').textContent = '浏览器存储不可用，本次作答仅保留在当前页面'; return false; }
};
let imported = read('import',null);
let source = read('source','built-in') === 'import' && imported ? 'import' : 'built-in';
let level = read('level','six') === 'four' ? 'four' : 'six';
const answers = read('answers',{});
const review = read('review-v1',{});
const bank = () => level === 'four' ? cetFour : source === 'import' ? imported.words : builtIn;
const sourceKey = () => level === 'four' ? 'cet4-v1' : source === 'import' ? imported.id : 'original-v1';
const dateKey = (day = selected) => sourceKey() + ':' + day;
const dayAnswers = () => answers[dateKey()] ?? (answers[dateKey()] = {});
const wordsForDay = (day = selected) => bank().slice(day * 25, (day + 1) * 25);
const needsReview = record => !!(record?.manual || record?.misses.length);
const reviewRecord = (day,row) => review[dateKey(day)]?.[row];
let lastReviewPage;
const saveReview = () => save('review-v1',review);
function updateReviewRecord(day,row,change) {
  const key = dateKey(day);
  const records = review[key] ?? (review[key] = {});
  const record = records[row] ?? {manual:false,misses:[],reviewed:false};
  change(record);
  if (needsReview(record)) records[row] = record;
  else delete records[row];
}
const modes = ['reference','reference','write','write'];
const hidden = [false,false,false,false];
const grades = new Map();
let lastToday = todayIndex();
let selected = Math.min(29, Math.max(0,lastToday));
let following = true;
let clockTimer, messageTimer;

function message(text) {
  clearTimeout(messageTimer);
  $('feedback').textContent = text;
  if (text) messageTimer = setTimeout(() => { $('feedback').textContent = ''; }, 6500);
}

function renderCalendar() {
  const host = $('calendar');
  if (!host.children.length) {
    [[0,20,'十一月','NOVEMBER'],[20,30,'十二月','DECEMBER']].forEach(([from,to,name,en]) => {
      const section = elem('div');
      const month = elem('div','month-name',name);
      month.append(elem('span','',en));
      const grid = elem('div','days');
      for (let i = from; i < to; i++) {
        const button = elem('button','day',pad(dates[i].getUTCDate()));
        button.type = 'button';
        button.dataset.day = i;
        button.setAttribute('aria-label',dateText(dates[i]));
        button.addEventListener('click',() => select(i,i === todayIndex()));
        grid.append(button);
      }
      section.append(month,grid);
      host.append(section);
    });
  }
  host.querySelectorAll('button').forEach(button => {
    const i = Number(button.dataset.day);
    button.setAttribute('aria-current',String(i === selected));
    button.classList.toggle('is-today',i === todayIndex());
    button.classList.toggle('has-work',Object.values(answers[dateKey(i)] ?? {}).some(v => v.trim()));
    button.classList.toggle('needs-review',Object.values(review[dateKey(i)] ?? {}).some(record => needsReview(record) && !record.reviewed));
  });
}

function renderProgress() {
  const values = dayAnswers();
  $('progress').textContent = Array.from({length:25},(_,row) => row)
    .filter(row => columns.some((_,col) => values[row + ':' + col]?.trim())).length;
}

function mini(col, image, title, label, action, pressed, disabled = false) {
  const b = elem('button','mini');
  b.type = 'button';
  b.innerHTML = icon(image);
  b.append(document.createTextNode(title));
  b.title = label;
  b.setAttribute('aria-label',columns[col].name + ' · ' + label);
  if (pressed !== undefined) b.setAttribute('aria-pressed',pressed);
  b.disabled = disabled;
  b.addEventListener('click',action);
  return b;
}

function renderHead() {
  const row = elem('tr');
  const number = elem('th','row-num','#');
  number.scope = 'col';
  row.append(number);
  columns.forEach((column,col) => {
    const th = elem('th','',column.name);
    th.scope = 'col';
    th.append(elem('small','',column.label));
    const group = elem('div','header-controls');
    group.append(mini(col,hidden[col] ? 'hidden' : 'eye',hidden[col] ? '显示' : '隐藏','显示或隐藏整列',() => {
      hidden[col] = !hidden[col];
      renderBody();
      renderHead();
      $('table-head').querySelectorAll('th')[col + 1].querySelector('button').focus();
    },hidden[col]));
    group.append(mini(col,'check','批改','批改本列',() => grade([col]),undefined,modes[col] !== 'write' || hidden[col]));
    if (column.ref) group.append(mini(col,'pen',modes[col] === 'write' ? '答案' : '默写','切换答案与填写模式',() => {
      modes[col] = modes[col] === 'write' ? 'reference' : 'write';
      hidden[col] = false;
      renderBody();
      renderHead();
      $('table-head').querySelectorAll('th')[col + 1].querySelector('button:last-child').focus();
    },modes[col] === 'write'));
    th.append(group);
    row.append(th);
  });
  $('table-head').replaceChildren(row);
}

function paintGrade(cell, input, value) {
  cell.querySelector('.cell-feedback')?.remove();
  delete input.dataset.grade;
  input.removeAttribute('aria-describedby');
  if (!value) return;
  input.dataset.grade = value.ok ? 'correct' : 'review';
  const note = elem('span','cell-feedback' + (value.ok ? ' ok' : ''),value.ok ? '✓ 正确' : '待复核 · ' + value.expected);
  note.id = input.id + '-result';
  input.setAttribute('aria-describedby',note.id);
  cell.append(note);
}

function paintStar(button,row,word) {
  const record = reviewRecord(selected,row);
  button.setAttribute('aria-pressed',String(!!record?.manual));
  button.dataset.weak = String(needsReview(record));
  button.dataset.reviewed = String(!!record?.reviewed);
  const label = record?.manual ? '取消手动标记' : '标记再背一次';
  button.title = label;
  button.setAttribute('aria-label',word + ' · ' + label);
}

function renderReview() {
  const now = todayIndex();
  const finalPage = now >= 30 && selected === 29;
  const day = finalPage ? selected : selected - 1;
  const title = finalPage ? '最后一日复习' : now === selected ? '昨日复习' : '上一学习日复习';
  const panel = $('review-panel');
  const content = $('review-content');
  const entries = Object.entries(review[dateKey(day)] ?? {}).filter(([,record]) => needsReview(record));
  const pending = entries.filter(([,record]) => !record.reviewed).length;
  const pageKey = dateKey() + ':' + day;
  $('review-title').textContent = title;
  $('review-count').textContent = day < 0 ? '计划首日' : dateText(dates[day]) + ' · 待复习 ' + pending + ' 词';
  if (lastReviewPage !== pageKey) {
    lastReviewPage = pageKey;
    panel.open = pending > 0;
  }
  if (!entries.length) {
    const hint = day < 0 ? '今日标星或批改后待复核的词，会出现在下一学习日的复习清单。' : '这一天还没有需要复习的词。';
    content.replaceChildren(elem('p','review-empty',hint));
    return;
  }
  const words = wordsForDay(day);
  const list = elem('ul');
  entries.forEach(([row,record],index) => {
    const [word,meanings] = words[row];
    const item = elem('li','review-item' + (record.reviewed ? ' is-reviewed' : ''));
    const term = elem('span','review-word',word);
    term.lang = 'en';
    const mark = elem('button','mini',record.reviewed ? '已复习' : '记为已复习');
    mark.type = 'button';
    mark.setAttribute('aria-pressed',String(record.reviewed));
    mark.setAttribute('aria-label',word + (record.reviewed ? ' · 取消已复习' : ' · 记为已复习'));
    mark.addEventListener('click',() => {
      updateReviewRecord(day,row,value => { value.reviewed = !value.reviewed; });
      saveReview();
      renderReview();
      renderCalendar();
      if (day === selected) paintStar($('star-' + row),Number(row),word);
      $('review-content').querySelectorAll('button')[index]?.focus();
    });
    item.append(term,elem('span','review-meaning',meanings.join('；')),mark);
    list.append(item);
  });
  content.replaceChildren(list);
}

function renderBody() {
  const rows = wordsForDay().map(([word, meanings],rowIndex) => {
    const row = elem('tr');
    const number = elem('td','row-num',pad(rowIndex + 1));
    const star = elem('button','star-button');
    star.type = 'button';
    star.id = 'star-' + rowIndex;
    star.innerHTML = icon('star');
    paintStar(star,rowIndex,word);
    star.addEventListener('click',() => {
      updateReviewRecord(selected,rowIndex,record => {
        record.manual = !record.manual;
        if (record.manual) record.reviewed = false;
      });
      saveReview();
      paintStar(star,rowIndex,word);
      renderCalendar();
      renderReview();
    });
    number.append(star);
    row.append(number);
    columns.forEach((column,col) => {
      const cell = elem('td');
      if (hidden[col]) cell.append(elem('span','hidden-marker','—'));
      else if (modes[col] === 'reference') {
        const ref = elem('span',column.kind === 0 ? 'ref-word' : 'ref-meaning',column.kind === 0 ? word : meanings.join('；'));
        if (column.kind === 0) ref.lang = 'en';
        cell.append(ref);
      } else {
        const key = rowIndex + ':' + col;
        const input = elem('input','entry');
        input.type = 'text';
        input.id = 'input-' + rowIndex + '-' + col;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.maxLength = 180;
        input.placeholder = column.kind === 0 ? '填写英文…' : '填写中文…';
        input.setAttribute('aria-label','第 ' + (rowIndex + 1) + ' 行 · ' + column.name);
        input.value = dayAnswers()[key] ?? '';
        input.addEventListener('input',() => {
          if (input.value.trim()) dayAnswers()[key] = input.value;
          else delete dayAnswers()[key];
          save('answers',answers);
          grades.delete(key);
          paintGrade(cell,input,null);
          renderProgress();
          renderCalendar();
        });
        input.addEventListener('keydown',event => {
          if (event.key === 'Enter' && !event.isComposing) $('input-' + (rowIndex + 1) + '-' + col)?.focus();
        });
        cell.append(input);
        paintGrade(cell,input,grades.get(key));
      }
      row.append(cell);
    });
    return row;
  });
  $('table-body').replaceChildren(...rows);
}

function grade(cols) {
  let good = 0, incorrect = 0, blank = 0;
  const values = dayAnswers();
  wordsForDay().forEach(([word,meanings],i) => {
    cols.filter(col => modes[col] === 'write' && !hidden[col]).forEach(col => {
      const key = i + ':' + col;
      const value = values[key]?.trim();
      if (!value) { blank++; return; }
      const ok = correct(value,word,meanings,columns[col].kind);
      if (ok) good++; else incorrect++;
      updateReviewRecord(selected,i,record => {
        const index = record.misses.indexOf(col);
        if (ok && index !== -1) record.misses.splice(index,1);
        if (!ok) {
          if (index === -1) record.misses.push(col);
          record.reviewed = false;
        }
      });
      paintStar($('star-' + i),i,word);
      const result = {ok,expected:columns[col].kind === 0 ? word : meanings.join('；')};
      grades.set(key,result);
      const input = $('input-' + i + '-' + col);
      paintGrade(input.parentElement,input,result);
    });
  });
  if (good + incorrect === 0) message('请先在可见的默写栏填入答案。');
  else {
    saveReview();
    renderCalendar();
    renderReview();
    message('批改完成 · 正确 ' + good + ' · 待复核 ' + incorrect + ' · 空白 ' + blank + '。待复核词已加入复习清单。');
  }
}

function render() {
  const d = dates[selected];
  const now = todayIndex();
  $('day-title').textContent = 'List ' + pad(selected + 1);
  $('date').textContent = '2026年' + dateText(d) + ' · 周' + weekday[d.getUTCDay()];
  $('date-tag').textContent = selected === now ? '今日任务' : selected > now ? '提前预习' : '回顾复习';
  $('clock-note').textContent = now < 0 ? '11月11日零点开始' : now > 29 ? '计划已结束 · 随时复习' : '北京时间 00:00 切换';
  $('today').disabled = now < 0 || now > 29;
  $('prev').disabled = selected === 0;
  $('next').disabled = selected === 29;
  $('cover-title').textContent = level === 'four' ? '四级单词默写本' : '六级单词默写本';
  $('level-four').setAttribute('aria-pressed',String(level === 'four'));
  $('level-six').setAttribute('aria-pressed',String(level === 'six'));
  $('open-import').hidden = level === 'four';
  const badge = $('source-badge');
  if (level === 'four') {
    const credit = elem('a','','ECDICT');
    credit.href = 'https://github.com/skywind3000/ECDICT';
    credit.target = '_blank';
    credit.rel = 'noopener';
    credit.className = 'word-source';
    badge.replaceChildren(document.createTextNode('词表 · 四级常用词 · '),credit);
    badge.title = '首日精选常用词，其余按 ECDICT 四级标签与通用语料词频筛选。';
  } else {
    badge.textContent = source === 'import' ? '词表 · 已导入' : '词表 · 内置六级练习词';
    badge.removeAttribute('title');
  }
  renderReview();
  renderCalendar();
  renderProgress();
  renderHead();
  renderBody();
}
function select(i, follow) {
  if (i < 0 || i > 29) return;
  following = follow;
  if (selected !== i) grades.clear();
  selected = i;
  message('');
  render();
}
function updateClock() {
  clearTimeout(clockTimer);
  const now = todayIndex();
  if (now !== lastToday) {
    lastToday = now;
    if (following && now >= 0 && now < 30) select(now,true);
    else {
      $('date-tag').textContent = selected === now ? '今日任务' : selected > now ? '提前预习' : '回顾复习';
      $('clock-note').textContent = now > 29 ? '计划已结束 · 随时复习' : now < 0 ? '11月11日零点开始' : '北京时间 00:00 切换';
      $('today').disabled = now < 0 || now > 29;
      renderCalendar();
      renderReview();
    }
  }
  const nextMidnight = start + (now + 1) * dayMs - 8 * 3600000;
  clockTimer = setTimeout(updateClock, Math.max(20,nextMidnight - Date.now() + 30));
}
function selectLevel(value) {
  if (level === value) return;
  level = value;
  save('level',level);
  grades.clear();
  message('');
  render();
}
$('level-four').addEventListener('click',() => selectLevel('four'));
$('level-six').addEventListener('click',() => selectLevel('six'));
$('prev').addEventListener('click',() => select(selected - 1,false));
$('next').addEventListener('click',() => select(selected + 1,false));
$('today').addEventListener('click',() => select(todayIndex(),true));
$('grade-all').addEventListener('click',() => grade([0,1,2,3]));
document.addEventListener('visibilitychange',() => { if (!document.hidden) updateClock(); });
window.addEventListener('focus',updateClock);

const dialog = $('import-dialog');
$('open-import').addEventListener('click',() => {
  $('source-detail').textContent = source === 'import'
    ? '当前使用你导入的词表。'
    : '当前使用独立编写的六级练习词表。目标教材为俞敏洪《六级词汇词根＋联想记忆法（乱序版）》，内置词表尚未与原书核对。';
  $('reset-source').disabled = source === 'built-in';
  $('import-result').textContent = '';
  dialog.showModal();
});
$('close-import').addEventListener('click',() => dialog.close());
function setSource(value) {
  source = value;
  save('source',source);
  grades.clear();
  dialog.close();
  render();
}
$('reset-source').addEventListener('click',() => setSource('built-in'));
function csvColumns(line) {
  if (line.includes('\t')) return line.split('\t');
  const fields = [];
  let text = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { text += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { fields.push(text); text = ''; }
    else text += char;
  }
  if (quoted) throw new Error('CSV 中有未闭合的引号。');
  fields.push(text);
  return fields;
}
function parseImport(text) {
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (/^(word|english|英文|单词|英文单词)(?:,|\t)/i.test(lines[0] ?? '')) lines.shift();
  if (lines.length < 750) throw new Error('已读到 ' + lines.length + ' 行，需要至少 750 条单词和释义。');
  return lines.slice(0,750).map((line,i) => {
    const [wordRaw,...rest] = csvColumns(line);
    const word = wordRaw.trim();
    const meanings = rest.join('；').split(/[；;|\/]+/).map(s => s.trim()).filter(Boolean);
    if (!/^[A-Za-z][A-Za-z0-9 .’'‐‑–-]{0,79}$/.test(word) || !meanings.length || !meanings.some(m => /\p{Script=Han}/u.test(m)) || meanings.join('').length > 480) {
      throw new Error('第 ' + (i + 1) + ' 条格式有误，请检查英文单词和中文释义。');
    }
    return [word,meanings];
  });
}
$('import-form').addEventListener('submit',async event => {
  event.preventDefault();
  const field = $('word-file').files[0];
  try {
    if (field && field.size > 2000000) throw new Error('请上传 2 MB 以内的词表文件。');
    const words = parseImport(field ? await field.text() : $('word-paste').value);
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(words)));
    const id = Array.from(new Uint8Array(digest),b => b.toString(16).padStart(2,'0')).join('');
    const replacement = {id,words};
    if (!save('import',replacement)) throw new Error('浏览器无法保存这份词表。');
    imported = replacement;
    $('import-form').reset();
    setSource('import');
    message('词表已导入 · 750 词已按顺序分配。');
  } catch (error) {
    $('import-result').textContent = error.message;
  }
});

render();
updateClock();
