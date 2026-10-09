// Назначение по теме статьи, не по единичному упоминанию в её теле.
// Явный выбор редакции в frontmatter имеет приоритет.
//
// Если выбранная кнопка бесплатная (внутренняя ссылка без erid), а у темы
// есть платное предложение, подставляется оно: статья без платной кнопки
// не зарабатывает совсем. Платность определяет вызывающий через isPaid —
// по наличию erid. Без подходящего платного предложения бесплатная кнопка
// остаётся: реклама не по теме хуже, чем никакой.

const lower = (value) => String(value ?? '').toLocaleLowerCase('ru-RU');

// Порядок важен: от узкого продукта к широкому. «ОФД для ТС ПИоТ» — про
// ОФД, «Маркировка воды: что требуется от розницы» — про кассу магазина.
// strong: узкий продукт важнее платной кнопки раздела, если редакция не
// выбрала кнопку сама («Меркурий» в разделе маркировки — не «Маркировка под ключ»).
export const ARTICLE_TOPIC_OFFERS = Object.freeze([
  { id: 'kontur-merkuriy', strong: true, re: /меркури|(?:^|[^а-яёa-z])(?:всд|ветис)(?:$|[^а-яёa-z])|ветеринарн/u },
  { id: 'kontur-ofd', re: /(?:^|[^а-яёa-z])офд(?:$|[^а-яёa-z])|оператор[а-яё]*\s+фискальн/u },
  { id: 'kontur-mchd', re: /(?:^|[^а-яёa-z])мчд(?:$|[^а-яёa-z])|машиночитаем/u },
  { id: 'diadoc-kedo', re: /(?:^|[^а-яёa-z])кэдо(?:$|[^а-яёa-z])|кадров[а-яё]*\s+(?:электронн|документ)/u },
  { id: 'kontur-focus', re: /контрагент/u },
  { id: 'ts-piot-provider', re: /тс\s+пиот/u },
  { id: 'kontur-market', re: /касс[аеуыой]|(?:^|[^а-яёa-z])ккт(?:$|[^а-яёa-z])|фискальн[а-яё]*\s+накопител|эвотор|атол|дримкас|(?:^|[^а-яёa-z])(?:розниц|магазин)/u },
  { id: 'kontur-elba', re: /(?:^|[^а-яёa-z])(?:усн|ндс|енс|енп|псн|нпд)(?:$|[^а-яёa-z])|налог|патент|самозанят|взнос|маркетплейс|wildberries|ozon|бухгалтер/u },
  { id: 'kontur-extern', re: /отч[её]тност/u },
  { id: 'kontur-markirovka', re: /маркировк|честн[а-яё]*\s+знак|data\s+matrix|гис\s+мт/u },
]);

export function articleTopicOffer({ title = '', tags = [] } = {}, { strongOnly = false } = {}) {
  const text = [title, ...tags].map(lower).join(' · ');
  return ARTICLE_TOPIC_OFFERS.find((offer) => (!strongOnly || offer.strong) && offer.re.test(text))?.id ?? null;
}

export function articleCpa({ cpa, title = '', tags = [] }, fallback, { isPaid, categoryOffer } = {}) {
  let chosen;
  if (cpa !== undefined && cpa !== null) {
    chosen = cpa;
  } else {
    const titleText = lower(title);
    const transportTitle = /(?:^|[^а-яёa-z])(?:этрн|эпд)(?:$|[^а-яёa-z])|электронн[а-яё]*\s+транспортн[а-яё]*\s+накладн[а-яё]*/iu.test(titleText);
    const transportTag = tags.some(tag => ['этрн', 'эпд', 'гис эпд', 'электронная транспортная накладная'].includes(String(tag).trim().toLocaleLowerCase('ru-RU')));
    // ЭДО и УПД в заголовке — тема Диадока, в каком бы разделе ни лежала
    // статья (акцент владельца с 09.10.2026). Только по заголовку: тег «ЭДО»
    // стоит и на статьях о маркировке, у них своя кнопка. КЭДО — отдельный продукт.
    const edoTitle = /(?:^|[^а-яёa-z])(?:эдо|упд)(?:$|[^а-яёa-z])|электронн[а-яё]*\s+документооборот/u.test(titleText) && !/маркир/u.test(titleText);
    const strong = typeof isPaid === 'function' ? articleTopicOffer({ title, tags }, { strongOnly: true }) : null;
    chosen = transportTitle || transportTag ? 'diadoc-logistika'
      : edoTitle && typeof isPaid === 'function' && isPaid('kontur-diadoc') ? 'kontur-diadoc'
      : strong && isPaid(strong) ? strong : fallback;
  }
  if (typeof isPaid !== 'function' || isPaid(chosen)) return chosen;
  const topical = articleTopicOffer({ title, tags });
  if (topical && isPaid(topical)) return topical;
  if (categoryOffer && isPaid(categoryOffer)) return categoryOffer;
  return chosen;
}
