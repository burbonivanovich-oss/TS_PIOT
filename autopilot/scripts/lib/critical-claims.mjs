import { auditSourceUrl, evaluateEvidence, urlFromMatch } from './sources.mjs';

const EDGE = '(?<![\\p{L}\\p{N}])';
const MONTH = '(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)';
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const UNITS = { ноль:0, один:1, одна:1, одну:1, два:2, две:2, двух:2, три:3, трех:3, трёх:3, четыре:4, четырех:4, четырёх:4, пять:5, пяти:5, шесть:6, шести:6, семь:7, семи:7, восемь:8, восьми:8, девять:9, девяти:9, десять:10, десяти:10, одиннадцать:11, двенадцать:12, тринадцать:13, четырнадцать:14, пятнадцать:15, шестнадцать:16, семнадцать:17, восемнадцать:18, девятнадцать:19, двадцать:20, тридцать:30, сорок:40, пятьдесят:50, шестьдесят:60, семьдесят:70, восемьдесят:80, девяносто:90, сто:100, двести:200, триста:300, четыреста:400, пятьсот:500, шестьсот:600, семьсот:700, восемьсот:800, девятьсот:900 };
// Правовые нормы обычно записывают денежные суммы в родительном падеже.
// Эти формы означают те же числа; совпадение значения по-прежнему обязательно.
Object.assign(UNITS, { одного:1, одной:1, одному:1, одну:1,
  одиннадцати:11, двенадцати:12, тринадцати:13, четырнадцати:14,
  пятнадцати:15, шестнадцати:16, семнадцати:17, восемнадцати:18,
  девятнадцати:19, двадцати:20, тридцати:30, сорока:40,
  пятидесяти:50, шестидесяти:60, семидесяти:70, восьмидесяти:80,
  девяноста:90, ста:100, двухсот:200, трехсот:300, трёхсот:300,
  четырехсот:400, четырёхсот:400, пятисот:500, шестисот:600,
  семисот:700, восьмисот:800, девятисот:900 });
const SCALE = { тысяча:1000, тысячи:1000, тысяч:1000, тысячу:1000, тыс:1000, миллион:1000000, миллиона:1000000, миллионов:1000000, млн:1000000, миллиард:1000000000, миллиарда:1000000000, миллиардов:1000000000, млрд:1000000000 };
const WORD = `(?:${Object.keys({...UNITS,...SCALE}).sort((a,b)=>b.length-a.length).join('|')})`;
const DIGITS = '\\d+(?:[ \\u00a0\\u202f]\\d{3})*(?:[.,]\\d+)?';
const SCALE_WORD = '(?:тыс\\.?|млн\\.?|млрд\\.?|тысяч[аиу]?|миллион(?:а|ов)?|миллиард(?:а|ов)?)';
const AMOUNT = `(?:${DIGITS}(?:\\s*${SCALE_WORD})?|${WORD}(?:\\s+${WORD})*)`;
const AMOUNT_RE = new RegExp(`${EDGE}${AMOUNT}(?![\\p{L}\\p{N}])`, 'giu');
const RUBLES = '(?:₽|руб(?:\\.|ль|ля|лей|лях)?)(?![\\p{L}])';
const MONEY = new RegExp(`${EDGE}(?:от\\s+)?${AMOUNT}(?:\\s*(?:[-–—]|до)\\s*${AMOUNT})?\\s*${RUBLES}`, 'giu');
const LIABILITY = /штраф|санкци|ответственн|наказ|взыска|неустойк|пен[яию]|КоАП|конфиска|предупрежден/i;
const PATTERNS = [
  {id:'date', re:new RegExp(`${EDGE}(?:с|до|после|начиная\\s+с|не\\s+позднее)\\s+(?:\\d{1,2}\\.\\d{1,2}\\.\\d{4}|(?:\\d{1,2}\\s+)?${MONTH}\\s+\\d{4})`, 'giu')},
  {id:'fine', re:MONEY, context:LIABILITY},
  {id:'law', re:new RegExp(`${EDGE}(?:(?:ст\\.\\s*|стать[ияию]\\s+)\\d+(?:\\.\\d+)*(?![\\d.]|-\\d)|№\\s*\\d{2,4}-ФЗ|КоАП|НК\\s+РФ)`, 'giu')},
];
const SOURCE_RE = /\]\(https?:\/\/(?:[^)]*\.)?(?:consultant\.ru|garant\.ru|nalog\.gov\.ru|publication\.pravo\.gov\.ru|pravo\.gov\.ru|честныйзнак\.рф|xn--80ajghhoc2aj1c8b\.xn--p1ai|crpt\.ru|kremlin\.ru|duma\.gov\.ru|regulation\.gov\.ru)[^)]*\)/gi;

/** Keep each displayed field separate, with offsets for explicit evidence bindings. */
function articleClaimParts(article) {
  if (typeof article === 'string') return { text: article, fields: [] };
  const visible = [];
  let selected = false, selectedName = null, field = null;
  for (const line of String(article.fm ?? article.raw ?? '').split(/\r?\n/)) {
    const root = line.match(/^([\w-]+):\s*(.*)$/);
    if (root) { selectedName = root[1]; selected = ['title','description','faq','lead','summary'].includes(selectedName); field = null; }
    if (!selected || /^\s*#/.test(line)) continue;
    const key = line.match(/^\s*(?:-\s*)?[\w-]+:\s*(.*)$/);
    if (key) { visible.push({ name: selectedName, text: '' }); field = visible.length - 1; }
    let text = line.replace(/^\s*(?:-\s*)?(?:[\w-]+:\s*)?/, '').trim();
    if (!text || /^[>|][+-]?$/.test(text)) continue;
    text = text.replace(/^(["'])(.*)\1$/, '$2').replace(/\\"/g, '"');
    if (field === null) { visible.push({ name: selectedName, text }); field = visible.length - 1; }
    else visible[field].text += (visible[field].text ? ' ' : '') + text;
  }
  let text = String(article.body ?? '');
  const fields = [];
  for (const value of visible.filter(v => v.text)) {
    text += fields.length ? '.\n\n' : '\n\n';
    const start = text.length;
    text += value.text;
    fields.push({ name: value.name, start, end: text.length });
  }
  return { text, fields };
}

export function articleClaimText(article) { return articleClaimParts(article).text; }

function withoutExamples(text) {
  // Mask fenced examples; inline formatting must not hide normative prose.
  return text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, m=>m.replace(/[^\n]/g,' '))
    .replace(/`/g, ' ')
    .replace(/(?<![\p{L}\p{N}])[*_]{1,2}(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])[*_]{1,2}(?![\p{L}\p{N}])/gu, m=>' '.repeat(m.length))
    .replace(/<\/?[A-Za-z][\w:-]*\s*>/g, m=>' '.repeat(m.length));
}

function maskedBoundaries(text) {
  // A Markdown link is one displayed unit. Its label and URL cannot be split
  // at punctuation, and a pipe inside either is not a table-cell delimiter.
  return text.replace(/\[[^\]\n]*\]\([^\s)]+\)/g, m=>m.replace(/[.!?|]/g,'\u0001'))
    .replace(/\d{1,2}\.\d{1,2}\.\d{4}|(?:тыс|руб|ст|ч|п|пп|подп|абз)\.(?=\s*\d|\s*(?:руб|₽))/gi, m=>m.replace(/\./g,'\u0001'))
    .replace(/\\\|/g, m=>'\u0001'.repeat(m.length));
}

function sentenceAt(text, index) {
  const masked = maskedBoundaries(text);
  let start = 0, end = masked.length;
  for (const m of masked.matchAll(/[.!?](?=\s|$)|\n\s*\n|\|/g)) {
    const at = m.index + m[0].length;
    if (at <= index) start = at;
    else { end = m.index + (/^[.!?]/.test(m[0]) ? 1 : 0); break; }
  }
  return text.slice(start,end);
}

// Bare dates are critical only in an actual Markdown table row describing a
// regulatory obligation. A date header alone does not make releases or prices
// legal claims. Context selects the row; source coverage stays in its sentence
// and cell, never in a neighboring requirement or source column.
const TABLE_OBLIGATION = /обязательн|запрет|разрешительн[\s\S]{0,30}режим|поэкземплярн|объ[её]мно-сортов|(?:ввод|вывод)[\s\S]{0,30}оборот|регистрац[\s\S]{0,100}(?:участник[\s\S]{0,30}оборот|ФНС|ЕГАИС|Честн[\s\S]{0,15}знак)/i;
const BARE_TABLE_DATE = new RegExp(`${EDGE}(?:\\d{1,2}\\.\\d{1,2}\\.\\d{4}|(?:\\d{1,2}\\s+)?${MONTH}\\s+\\d{4})(?![\\p{L}\\p{N}])`, 'giu');

function tableDateMatches(text) {
  const matches = [];
  let offset = 0, previous = null, width = null;
  for (const line of text.split('\n')) {
    const masked = maskedBoundaries(line);
    const pipes = [...masked.matchAll(/\|/g)].map(m=>m.index);
    let cells = null;
    if (pipes.length) {
      const bounds = [-1, ...pipes, line.length];
      cells = bounds.slice(0,-1).map((start,i)=>({ start:start+1, end:bounds[i+1], text:line.slice(start+1,bounds[i+1]) }));
      if (!cells[0].text.trim()) cells.shift();
      if (cells.length && !cells.at(-1).text.trim()) cells.pop();
      if (cells.length < 2) cells = null;
    }
    if (!cells) { previous = null; width = null; }
    else if (cells.every(c=>/^\s*:?-{3,}:?\s*$/.test(c.text))) {
      width = previous?.length === cells.length ? cells.length : null;
    } else if (width !== null && cells.length === width) {
      const displayed = line.replace(/\[[^\]\n]*\]\([^\s)]+\)/g, m=>m.slice(1,m.indexOf(']')));
      if (TABLE_OBLIGATION.test(displayed)) {
        for (const cell of cells) {
          // Do not discover dates hidden in URL destinations.
          const searchable = cell.text.replace(/\]\([^\s)]+\)/g,m=>' '.repeat(m.length));
          for (const match of searchable.matchAll(BARE_TABLE_DATE)) matches.push({ ...match, 0:match[0], index:offset+cell.start+match.index });
        }
      }
    } else { width = null; }
    previous = cells;
    offset += line.length+1;
  }
  return matches;
}

/** Ruble values independent of numeric grouping, abbreviations and common number words. */
export function monetaryValues(text) {
  const parse = value => {
    value=value.toLowerCase();
    const numeric=value.match(/^([\d\s\u00a0\u202f.,]+)(.*)$/);
    if (numeric) {
      const n=Number(numeric[1].replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));
      const scale=SCALE[numeric[2].trim().replace(/\.$/,'')] ?? 1;
      return n*scale;
    }
    let total=0, group=0;
    for(const word of value.split(/\s+/)) {
      if (word in SCALE) { total+=(group||1)*SCALE[word];group=0; }
      else group+=UNITS[word] ?? 0;
    }
    return total+group;
  };
  const amounts=[...text.matchAll(AMOUNT_RE)].map(m=>({at:m.index,value:parse(m[0])}));
  // In "5–10 тыс. рублей" the final scale applies to both bounds.
  for (const money of text.matchAll(MONEY)) {
    const parts=[...money[0].matchAll(AMOUNT_RE)];
    if (parts.length !== 2) continue;
    const last=parts[1][0].match(new RegExp(`(${SCALE_WORD})$`,'iu'))?.[1];
    const firstHasScale=new RegExp(SCALE_WORD,'iu').test(parts[0][0]);
    if (last && !firstHasScale && parse(parts[0][0]) < 1000) {
      const first=amounts.find(a=>a.at===money.index+parts[0].index);
      if(first) first.value=parse(parts[0][0]+' '+last);
    }
  }
  return amounts.map(a=>a.value).filter(Number.isFinite);
}

/** Dates preserve their precision; a month-only claim can be backed by a day in that month. */
export function criticalDateValues(text) {
  const re = new RegExp(`(?<!\\d)(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})(?!\\d)|(?:(\\d{1,2})\\s+)?(${MONTH})\\s+(\\d{4})(?!\\d)`, 'giu');
  return [...text.matchAll(re)].map(m=>m[3]
    ? { year:Number(m[3]), month:Number(m[2]), day:Number(m[1]) }
    : { year:Number(m[6]), month:MONTHS.indexOf(m[5].toLowerCase())+1, day:m[4] ? Number(m[4]) : null });
}

export function extractClaims(input, sourceEvidence=null, {maxAgeDays=180}={}) {
  const {text:original,fields}=articleClaimParts(input);
  const text=withoutExamples(original);
  return PATTERNS.flatMap(p=>{
    const found = [...text.matchAll(p.re)];
    if (p.id === 'date') {
      const extra = tableDateMatches(text).filter(m=>!found.some(prior=>m.index>=prior.index && m.index+m[0].length<=prior.index+prior[0].length));
      found.push(...extra);
      found.sort((a,b)=>a.index-b.index);
    }
    return found.flatMap(m=>{
    // Masking helps recognition but must not rewrite the statement bound to evidence.
    const sentence=sentenceAt(original,m.index);
    if(p.context && !p.context.test(sentence)) return [];
    const match=sentence.match(SOURCE_RE)?.[0];
    const source=match ? urlFromMatch(match):null;
    let covered=Boolean(source), reason=covered?null:'нет ссылки на первоисточник в этом предложении';
    if(covered) {
      const audit=auditSourceUrl(source);
      if(!audit.ok) {covered=false;reason=audit.reason;}
      else if(sourceEvidence?.[source]) {
        const verdict=evaluateEvidence(sourceEvidence[source],{maxAgeDays});
        if(!verdict.ok) {covered=false;reason=verdict.reason;}
      }
    }
    const field=fields.find(f=>m.index>=f.start && m.index<f.end)?.name;
    return [{id:p.id,text:m[0],sentence,covered,source,reason,...(field ? {field} : {})}];
    });
  });
}
