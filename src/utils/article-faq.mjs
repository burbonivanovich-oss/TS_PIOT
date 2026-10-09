// Вопросы и ответы из блока «Частые вопросы» в теле статьи — для разметки
// FAQPage. Два формата корпуса: вопрос подзаголовком «### …?» или жирной
// строкой «**…?**». Разметка строится только при однозначном разборе:
// если хоть один пункт блока не похож на «вопрос? + ответ», блок пропускается
// целиком — неверная разметка хуже, чем никакая.

const FAQ_HEADING = /^(#{2,3})[ \t]*(?:Частые вопросы|Часто задаваемые вопросы|Вопросы и ответы|FAQ)(?!\p{L}).*$/imu;
const MIN_ITEMS = 2;
const MIN_ANSWER = 20;

export function plainText(markdown) {
  return String(markdown ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, '$1$2')
    .replace(/\\\n/g, '\n')
    .replace(/\\$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function faqSection(body) {
  const match = FAQ_HEADING.exec(body);
  if (!match) return null;
  const level = match[1].length;
  const rest = body.slice(match.index + match[0].length);
  const stop = new RegExp(`^#{1,${level}}[ \\t]`, 'm').exec(rest);
  return { level, text: stop ? rest.slice(0, stop.index) : rest };
}

function splitItems(text, level) {
  const sub = '#'.repeat(level + 1);
  const headingRe = new RegExp(`^${sub}[ \\t]+(.+?)[ \\t]*$`, 'gm');
  const headings = [...text.matchAll(headingRe)];
  if (headings.length >= MIN_ITEMS) {
    if (text.slice(0, headings[0].index).trim()) return null;
    // Подзаголовок внутри блока вопросов — вопрос, даже без знака «?».
    return headings.map((h, i) => ({
      question: /[?？]\s*$/.test(h[1]) ? h[1] : `${h[1].replace(/[.:;\s]+$/, '')}?`,
      answer: text.slice(h.index + h[0].length, headings[i + 1]?.index ?? text.length),
    }));
  }
  const boldRe = /^\*\*((?:(?!\*\*)[\s\S])+?)\*\*\\?[ \t]*(?:\n|$)/gm;
  const bolds = [...text.matchAll(boldRe)];
  if (bolds.length < MIN_ITEMS) return null;
  if (text.slice(0, bolds[0].index).trim()) return null;
  return bolds.map((b, i) => ({
    question: b[1],
    answer: text.slice(b.index + b[0].length, bolds[i + 1]?.index ?? text.length),
  }));
}

export function extractArticleFaq(body) {
  const section = faqSection(String(body ?? ''));
  if (!section) return [];
  const raw = splitItems(section.text, section.level);
  if (!raw) return [];
  const items = raw.map(({ question, answer }) => ({
    question: plainText(question),
    answer: plainText(answer),
    rawAnswer: answer,
  }));
  const valid = items.every(({ question, answer, rawAnswer }) =>
    question.endsWith('?') &&
    answer.length >= MIN_ANSWER &&
    !/^\s*(?:import|export)\s/m.test(rawAnswer) &&
    !/VERIFY|TODO/.test(rawAnswer) &&
    !/<[A-Z]/.test(rawAnswer) &&
    !/[{}]/.test(answer),
  );
  return valid ? items.map(({ question, answer }) => ({ question, answer })) : [];
}

export function faqPageJsonLd(items) {
  if (!Array.isArray(items) || items.length < MIN_ITEMS) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}
