import { auditSourceUrl, evaluateEvidence, urlFromMatch } from './sources.mjs';

const EDGE = '(?<![\\p{L}\\p{N}])';
const MONTH = '(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)';
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const UNITS = { ноль:0, один:1, одна:1, одну:1, два:2, две:2, двух:2, три:3, трех:3, трёх:3, четыре:4, четырех:4, четырёх:4, пять:5, пяти:5, шесть:6, шести:6, семь:7, семи:7, восемь:8, восьми:8, девять:9, девяти:9, десять:10, десяти:10, одиннадцать:11, двенадцать:12, тринадцать:13, четырнадцать:14, пятнадцать:15, шестнадцать:16, семнадцать:17, восемнадцать:18, девятнадцать:19, двадцать:20, тридцать:30, сорок:40, пятьдесят:50, шестьдесят:60, семьдесят:70, восемьдесят:80, девяносто:90, сто:100, двести:200, триста:300, четыреста:400, пятьсот:500, шестьсот:600, семьсот:700, восемьсот:800, девятьсот:900 };
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

/** The displayed FAQ is read from raw YAML; the scalar parser cannot represent its object lists. */
export function articleClaimText(article) {
  if (typeof article === 'string') return article;
  const visible = [];
  let selected = false;
  let field = null;
  for (const line of String(article.fm ?? article.raw ?? '').split(/\r?\n/)) {
    const root = line.match(/^([\w-]+):\s*(.*)$/);
    if (root) { selected = ['title','description','faq','lead','summary'].includes(root[1]); field = null; }
    if (!selected || /^\s*#/.test(line)) continue;
    const key = line.match(/^\s*(?:-\s*)?[\w-]+:\s*(.*)$/);
    if (key) { visible.push(''); field = visible.length - 1; }
    let text = line.replace(/^\s*(?:-\s*)?(?:[\w-]+:\s*)?/, '').trim();
    if (!text || /^[>|][+-]?$/.test(text)) continue;
    text = text.replace(/^(["'])(.*)\1$/, '$2').replace(/\\"/g, '"');
    if (field === null) { visible.push(text); field = visible.length - 1; }
    else visible[field] += (visible[field] ? ' ' : '') + text;
  }
  // Separate displayed metadata fields so a source in one cannot cover another.
  const fields = visible.filter(Boolean);
  return String(article.body ?? '') + (fields.length ? '\n\n' + fields.join('.\n\n') : '');
}

function withoutExamples(text) {
  // Mask fenced examples; inline formatting must not hide normative prose.
  return text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, m=>m.replace(/[^\n]/g,' '))
    .replace(/`/g, ' ')
    .replace(/(?<![\p{L}\p{N}])[*_]{1,2}(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])[*_]{1,2}(?![\p{L}\p{N}])/gu, m=>' '.repeat(m.length))
    .replace(/<\/?[A-Za-z][\w:-]*\s*>/g, m=>' '.repeat(m.length));
}

function sentenceAt(text, index) {
  const masked = text.replace(/\d{1,2}\.\d{1,2}\.\d{4}|(?:тыс|руб|ст)\.(?=\s*\d|\s*(?:руб|₽))/gi, m=>m.replace(/\./g,'\u0001'));
  let start = 0, end = masked.length;
  for (const m of masked.matchAll(/[.!?](?=\s|$)|\n\s*\n|\|/g)) {
    const at = m.index + m[0].length;
    if (at <= index) start = at;
    else { end = m.index + (/^[.!?]/.test(m[0]) ? 1 : 0); break; }
  }
  return text.slice(start,end);
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
  const text=withoutExamples(articleClaimText(input));
  return PATTERNS.flatMap(p=>[...text.matchAll(p.re)].flatMap(m=>{
    const sentence=sentenceAt(text,m.index);
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
    return [{id:p.id,text:m[0],sentence,covered,source,reason}];
  }));
}
