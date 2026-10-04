// Назначение по теме статьи, не по единичному упоминанию в её теле.
// Явный выбор редакции в frontmatter имеет приоритет.
export function articleCpa({ cpa, title = '', tags = [] }, fallback) {
  if (cpa !== undefined && cpa !== null) return cpa;
  const titleText = String(title).toLocaleLowerCase('ru-RU');
  const transportTitle = /(?:^|[^а-яёa-z])(?:этрн|эпд)(?:$|[^а-яёa-z])|электронн[а-яё]*\s+транспортн[а-яё]*\s+накладн[а-яё]*/iu.test(titleText);
  const transportTag = tags.some(tag => ['этрн', 'эпд', 'гис эпд', 'электронная транспортная накладная'].includes(String(tag).trim().toLocaleLowerCase('ru-RU')));
  return transportTitle || transportTag ? 'diadoc-logistika' : fallback;
}
