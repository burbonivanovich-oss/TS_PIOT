// Текстовые примитивы: нормализация запроса, токены, похожесть.
// Без внешних зависимостей и без эмбеддингов — сравнение должно давать
// одинаковый ответ на любой машине и в любой момент времени, иначе учёт
// дублей перестаёт быть воспроизводимым.

const STOPWORDS = new Set([
  'и', 'в', 'во', 'на', 'с', 'со', 'по', 'для', 'от', 'до', 'из', 'к', 'о', 'об', 'у',
  'а', 'но', 'или', 'не', 'же', 'ли', 'бы', 'то', 'это', 'эти', 'этот', 'эта',
  'что', 'как', 'какой', 'какие', 'кто', 'кому', 'чего', 'чем', 'все', 'всё', 'вся',
  'при', 'за', 'уже', 'если', 'нужно', 'нужен', 'нужна', 'нужны', 'можно', 'года',
  'году', 'год', 'быть', 'есть', 'его', 'её', 'их', 'там', 'так', 'такое', 'такой',
  'ваш', 'ваши', 'свой', 'свои', 'мой', 'без', 'над', 'под', 'про', 'через',
]);

// Грубый стеммер: срезает самые частые русские окончания. Точность лемматизации
// здесь не нужна — задача только свести «маркировки», «маркировку», «маркировка»
// к одному ключу. Порядок важен: длинные окончания проверяются первыми.
const SUFFIXES = [
  'ованиями', 'ованиях', 'ованием', 'ования', 'ование',
  'ениями', 'ениях', 'ением', 'ения', 'ение',
  'ами', 'ями', 'ах', 'ях', 'ов', 'ев', 'ей', 'ий', 'ый', 'ой', 'ая', 'яя',
  'ые', 'ие', 'ом', 'ем', 'ах', 'ую', 'юю', 'ии', 'ья', 'ье',
  'а', 'я', 'ы', 'и', 'о', 'е', 'у', 'ю', 'ь',
];

export function stem(word) {
  if (word.length <= 4) return word;
  for (const suffix of SUFFIXES) {
    if (word.length - suffix.length >= 4 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

export function words(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`.,:;!?()\[\]{}–—\-/\\|№*_#>]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function tokenize(text) {
  return new Set(
    words(text)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map(stem),
  );
}

/**
 * Канонический ключ запроса: отсортированные стеммированные значимые токены.
 * «Кто обязан подключить ТС ПИоТ» и «ТС ПИоТ: кому подключать обязательно»
 * дают близкие, но не равные ключи — точное равенство ловит только настоящие
 * перестановочные дубли, остальное добирает jaccard.
 */
export function canonicalKey(text) {
  return [...tokenize(text)].sort().join(' ');
}

export function jaccard(a, b) {
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Доля токенов a, покрытых b. Асимметрично — нужно для «узкая тема внутри широкой». */
export function coverage(a, b) {
  if (a.size === 0) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / a.size;
}

/** Шинглы по n слов — для сравнения тел статей, а не заголовков. */
export function shingles(text, size = 5) {
  const ws = words(text).filter((w) => !STOPWORDS.has(w)).map(stem);
  const out = new Set();
  for (let i = 0; i + size <= ws.length; i++) out.add(ws.slice(i, i + size).join(' '));
  return out;
}

export function slugify(text) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
    т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split('')
    .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * IDF по корпусу. Без него сравнение заголовков в узкой тематике врёт: слова
 * «маркировка», «касса», «2026» встречаются почти в каждом заголовке, и
 * «маркировка игрушек» с «маркировкой косметики» дают jaccard 0.71 — то есть
 * дубль там, где две разные категории товаров. Общее слово должно весить мало.
 */
export function buildIdf(docs) {
  const df = new Map();
  for (const doc of docs) {
    for (const token of tokenize(doc)) df.set(token, (df.get(token) || 0) + 1);
  }
  const n = Math.max(docs.length, 1);
  const idf = new Map();
  for (const [token, count] of df) idf.set(token, Math.log((n + 1) / (count + 0.5)));
  return { idf, n, fallback: Math.log((n + 1) / 0.5) };
}

const weightOf = (model, token) =>
  model ? (model.idf.get(token) ?? model.fallback) : 1;

/** Жаккар со взвешиванием по IDF: редкое пересечение весит больше частого. */
export function weightedJaccard(a, b, model) {
  let inter = 0;
  let union = 0;
  for (const token of a) {
    const w = weightOf(model, token);
    union += w;
    if (b.has(token)) inter += w;
  }
  for (const token of b) if (!a.has(token)) union += weightOf(model, token);
  return union === 0 ? 0 : inter / union;
}

/**
 * Асимметричное покрытие с весами: какая доля «веса» темы a уже присутствует в
 * материале b. Главный сигнал дубля — именно оно, а не жаккар: заголовки в
 * корпусе несут разный хвост уточнений («сроки, товары, что делать»), который
 * раздувает объединение и топит симметричную метрику. Если все различающие
 * слова темы уже есть в существующей статье — это дубль, сколько бы лишнего ни
 * было в её заголовке.
 */
export function weightedCoverage(a, b, model) {
  let total = 0;
  let hit = 0;
  for (const token of a) {
    const w = weightOf(model, token);
    total += w;
    if (b.has(token)) hit += w;
  }
  return total === 0 ? 0 : hit / total;
}
