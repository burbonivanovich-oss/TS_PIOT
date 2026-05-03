export type Product = {
  id: string;
  label: string;    // категория услуги: «Онлайн-касса»
  name: string;     // название продукта
  pitch: string;    // ключевой месседж (1–2 предложения)
  ctaText: string;  // текст кнопки
  ctaUrl: string;   // реферальная ссылка
};

export const PRODUCTS: Record<string, Product> = {
  evotor: {
    id: 'evotor',
    label: 'Онлайн-касса',
    name: 'Эвотор',
    pitch: 'ТС ПИоТ встроен в прошивку. Обновление до последней версии бесплатное.',
    ctaText: 'Выбрать кассу',
    ctaUrl: 'https://evotor.ru/',
  },
  'mts-kassa': {
    id: 'mts-kassa',
    label: 'Онлайн-касса',
    name: 'МТС Касса',
    pitch: 'Поддержка маркированных товаров и ТС ПИоТ. Рассрочка на оборудование.',
    ctaText: 'Узнать цену',
    ctaUrl: 'https://kassa.mts.ru/',
  },
  platformaofd: {
    id: 'platformaofd',
    label: 'Оператор ФД',
    name: 'Платформа ОФД',
    pitch: 'Передача чеков в ФНС. Работает с кассами всех производителей, совместима с ТС ПИоТ.',
    ctaText: 'Подключить ОФД',
    ctaUrl: 'https://platformaofd.ru/',
  },
  taxcom: {
    id: 'taxcom',
    label: 'ОФД + ЭДО',
    name: 'Такском',
    pitch: 'Оператор ФД, электронная подпись и ЭДО в одном личном кабинете.',
    ctaText: 'Подробнее',
    ctaUrl: 'https://taxcom.ru/',
  },
  'kontur-buh': {
    id: 'kontur-buh',
    label: 'Бухгалтерия онлайн',
    name: 'Контур.Бухгалтерия',
    pitch: 'Учёт, налоги, зарплата и сдача отчётности для МСБ. Первые 14 дней бесплатно.',
    ctaText: 'Попробовать бесплатно',
    ctaUrl: 'https://www.kontur-buh.ru/',
  },
  'sbis-edo': {
    id: 'sbis-edo',
    label: 'ЭДО',
    name: 'СБИС',
    pitch: 'Электронный документооборот с поставщиками. Поддержка УПД для маркировки.',
    ctaText: 'Подключить ЭДО',
    ctaUrl: 'https://sbis.ru/',
  },
  '1c-fresh': {
    id: '1c-fresh',
    label: 'Учётная система',
    name: '1С:Фреш',
    pitch: 'Облачная 1С без установки. Подходит для ИП и ООО на УСН и ОСНО.',
    ctaText: 'Начать бесплатно',
    ctaUrl: 'https://1cfresh.com/',
  },
};

// Дефолтный продукт для сайдбара по категории
export const SIDEBAR_DEFAULTS: Record<string, string> = {
  'ts-piot': 'evotor',
  'markirovka': 'platformaofd',
  'zakonodatelstvo': 'kontur-buh',
};

// Цвета градиентов для hero по категории
export const CAT_GRADIENTS: Record<string, { from: string; to: string }> = {
  'ts-piot': { from: '#1d4ed8', to: '#0ea5e9' },
  'markirovka': { from: '#059669', to: '#10b981' },
  'zakonodatelstvo': { from: '#7c3aed', to: '#8b5cf6' },
  default: { from: '#1d4ed8', to: '#3b82f6' },
};

export type InlineBlock =
  | { type: 'product'; productId: string }
  | { type: 'compare'; productIds: [string, string] }
  | { type: 'tool'; label: string; desc: string; url: string; internal?: boolean };

export type InlinePosition = { afterH2: number; block: InlineBlock };

// Врезки по категориям: после какого H2 (индекс с 0) вставлять
export const CATEGORY_BLOCKS: Record<string, InlinePosition[]> = {
  'ts-piot': [
    { afterH2: 1, block: { type: 'product', productId: 'evotor' } },
    { afterH2: 3, block: { type: 'compare', productIds: ['evotor', 'mts-kassa'] } },
  ],
  'markirovka': [
    { afterH2: 1, block: { type: 'product', productId: 'platformaofd' } },
    {
      afterH2: 3,
      block: {
        type: 'tool',
        label: 'Калькулятор штрафов за маркировку',
        desc: 'Рассчитайте сумму штрафа по ст. 15.12 КоАП за нарушение требований маркировки.',
        url: '/kalkulyator-shtrafov/',
        internal: true,
      },
    },
  ],
  'zakonodatelstvo': [
    { afterH2: 1, block: { type: 'product', productId: 'kontur-buh' } },
    { afterH2: 2, block: { type: 'product', productId: 'sbis-edo' } },
  ],
};
