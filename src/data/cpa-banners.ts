import ordErids from './ord-erids.json';

export interface CpaBanner {
	id: string;
	eyebrow: string;
	title: string;
	description: string;
	cta: string;
	ctaHref: string;
	visual: {
		abbrev: string;
		bg: string;
	};
	/** erid-токен из Яндекс ОРД. Проставляется автоматически из ord-erids.json. */
	erid?: string;
	/**
	 * Конфиг официального виджета заявки Контура (если у оффера он есть).
	 * Значения уходят в глобальный _skbOrder лоадера дословно — менять нельзя,
	 * иначе ломается партнёрская атрибуция. Рендерится через KonturOrderWidget.
	 */
	widget?: {
		/** _skbOrder ProductId (напр. 'Egais', 'Ofd', 'Marking') */
		productId: string;
		/** _skbOrder ProductName (напр. 'market', 'ofd', 'markirovka') */
		productName: string;
		/** _skbOrder SupplierUid — партнёрский код, аналог тега f74746 для форм */
		supplierUid: string;
		/** _skbOrder Source — метка источника (можно кастомизировать под аналитику) */
		source?: string;
	};
}

const _erids: Record<string, string> = Object.fromEntries(
	Object.entries(ordErids as Record<string, string>).filter(([k]) => !k.startsWith('_'))
);

const _BANNERS_RAW: Record<string, Omit<CpaBanner, 'erid'>> = {
	'chestny-znak': {
		id: 'chestny-znak',
		eyebrow: 'Честный знак',
		title: 'Зарегистрируйтесь в системе маркировки бесплатно',
		description:
			'Личный кабинет участника оборота — обязательный первый шаг перед подключением ТС ПИоТ и работой с маркированными товарами.',
		cta: 'Как зарегистрироваться →',
		ctaHref: '/blog/2026-05-31-chestny-znak-registraciya/',
		visual: { abbrev: 'ЧЗ', bg: '#111' },
	},
	'default-ts-piot': {
		id: 'default-ts-piot',
		eyebrow: 'Полезно знать',
		title: 'Подключите ТС ПИоТ до 1 июля 2026',
		description:
			'Срок обязателен для всех касс с разрешительным режимом «Честного знака». Без модуля — касса заблокирует продажи маркированных товаров.',
		cta: 'Инструкция по подключению →',
		ctaHref: '/blog/2026-05-01-ts-piot-podklyuchenie-instrukciya/',
		visual: { abbrev: 'ТС', bg: '#111' },
	},
	'default-markirovka': {
		id: 'default-markirovka',
		eyebrow: 'Маркировка',
		title: 'Проверьте, попадает ли ваш товар под обязательную маркировку',
		description:
			'Более 20 категорий уже в системе «Честный знак». Штраф за отсутствие маркировки — от 50 000 ₽ для организаций.',
		cta: 'Проверить категорию →',
		ctaHref: '/category/markirovka/',
		visual: { abbrev: 'МК', bg: '#9E2B4F' },
	},
	'default-zakonodatelstvo': {
		id: 'default-zakonodatelstvo',
		eyebrow: 'Законодательство',
		title: 'Рассчитайте штраф за нарушение на вашем калькуляторе',
		description:
			'Введите сумму расчёта и тип нарушения — получите диапазон штрафа по актуальной редакции КоАП РФ.',
		cta: 'Открыть калькулятор →',
		ctaHref: '/kalkulyator-shtrafov/',
		visual: { abbrev: 'КШ', bg: '#AFCC00' },
	},
	'ts-piot-provider': {
		id: 'ts-piot-provider',
		eyebrow: 'Реклама · Контур.Маркет',
		title: 'Касса с модулем ТС ПИоТ под ключ — скидка 15% онлайн',
		description:
			'Контур.Маркет включает кассовую программу по 54-ФЗ, модуль ТС ПИоТ для разрешительного режима и товарный учёт с маркировкой. Подключение от 1 рабочего дня.',
		cta: 'Подключить Контур.Маркет →',
		ctaHref: 'https://kontur.ru/lp/market-ts-piot?p=f74746',
		visual: { abbrev: 'ТС', bg: '#9E2B4F' },
		widget: {
			productId: 'Egais',
			productName: 'market',
			supplierUid: '0d1c45d7-c296-4b0a-bb3c-72cac0b27d60',
			source: 'etiketka: ТС ПИоТ',
		},
	},
	'online-buh': {
		id: 'online-buh',
		eyebrow: 'Реклама · Контур.Эльба',
		title: 'Бухгалтерия для ИП и ООО на УСН — 30 дней бесплатно',
		description:
			'Эльба сама считает налоги, формирует уведомления по ЕНС и сдаёт отчётность. Работает с УСН, патентом, НДС 5% и 7%. Подходит без бухгалтера.',
		cta: 'Попробовать Эльбу →',
		ctaHref: 'https://e-kontur.ru/?p=f74746',
		visual: { abbrev: 'БУХ', bg: '#1E4A7A' },
	},
	'edo-operator': {
		id: 'edo-operator',
		eyebrow: 'Реклама · Диадок',
		title: 'ЭДО для приёмки маркированных товаров — скидка 10% онлайн',
		description:
			'Диадок принимает УПД с кодами маркировки от поставщиков, передаёт сведения в «Честный знак». Аккредитованный оператор, используют более 1,5 млн компаний.',
		cta: 'Подключить Диадок →',
		ctaHref: 'https://diadoc.ru/order?p=f74746',
		visual: { abbrev: 'ЭДО', bg: '#1E4A7A' },
	},

	// --- CPA: партнёрская программа Контура ---

	'kontur-ofd': {
		id: 'kontur-ofd',
		eyebrow: 'Реклама · Контур.ОФД',
		title: 'Подключите ОФД до регистрации кассы — скидка 15% при онлайн-оплате',
		description:
			'Передача чеков в ФНС по 54-ФЗ, регистрация и перерегистрация кассы онлайн без визита в налоговую. Совместим со всеми моделями касс.',
		cta: 'Подключить ОФД →',
		ctaHref: 'https://kontur.ru/ofd/price?p=f74746',
		visual: { abbrev: 'ОФД', bg: '#1A3A6C' },
	},
	'kontur-markirovka': {
		id: 'kontur-markirovka',
		eyebrow: 'Реклама · Контур.Маркировка',
		title: 'Работа с маркировкой под ключ — скидка 20% при онлайн-оплате',
		description:
			'Полный цикл: от нанесения кода на производстве до выбытия из оборота через кассу. Интеграция с 1С, ERP и «Честным знаком».',
		cta: 'Подробнее →',
		ctaHref: 'https://kontur.ru/markirovka?p=f74746',
		visual: { abbrev: 'МК', bg: '#9E2B4F' },
	},
	'kontur-diadoc': {
		id: 'kontur-diadoc',
		eyebrow: 'Реклама · Диадок',
		title: 'ЭДО для приёмки маркированных товаров — скидка 10% онлайн',
		description:
			'УПД с кодами маркировки принимается только через аккредитованного ЭДО-оператора. Диадок используют более 1,5 млн компаний.',
		cta: 'Подключить Диадок →',
		ctaHref: 'https://diadoc.ru/order?p=f74746',
		visual: { abbrev: 'ДД', bg: '#007A6E' },
	},
	'diadoc-logistika': {
		id: 'diadoc-logistika',
		eyebrow: 'Реклама · Диадок: Логистика',
		title: 'Обязательный переход на ЭТрН с 1 сентября 2026 по 140-ФЗ',
		description:
			'Сервис Логистика от Контура обеспечивает юридически значимый ЭДО между всеми участниками грузоперевозок с передачей данных в ГИС ЭПД.',
		cta: 'Подготовиться к переходу →',
		ctaHref: 'https://kontur.ru/logistika?p=f74746',
		visual: { abbrev: 'ЭТрН', bg: '#1E4A7A' },
	},
	'kontur-elba': {
		id: 'kontur-elba',
		eyebrow: 'Реклама · Контур.Эльба',
		title: '30 дней бесплатно: налоги и отчётность для ИП и ООО на УСН',
		description:
			'Эльба сама считает налоги, формирует уведомления по ЕНС и сдаёт отчётность. Работает с УСН, патентом, НДС 5% и 7%.',
		cta: 'Попробовать бесплатно →',
		ctaHref: 'https://e-kontur.ru/?p=f74746',
		visual: { abbrev: 'ЭЛБ', bg: '#C25000' },
	},
	'kontur-extern': {
		id: 'kontur-extern',
		eyebrow: 'Реклама · Контур.Экстерн',
		title: 'Отчётность в ФНС, СФР и Росстат — скидка 15% при онлайн-оплате',
		description:
			'Актуальные формы деклараций, сверка с ЕНС, электронная подпись в комплекте. Подходит для ИП и ООО на любом режиме налогообложения.',
		cta: 'Подключить Экстерн →',
		ctaHref: 'https://kontur.ru/extern/price?p=f74746',
		visual: { abbrev: 'ЭКС', bg: '#1A3A6C' },
	},
	'kontur-focus': {
		id: 'kontur-focus',
		eyebrow: 'Реклама · Контур.Фокус',
		title: 'Проверьте контрагента до сделки — скидка 7% онлайн',
		description:
			'Данные из реестров ФНС, судов, ЕГРЮЛ и ЕГРИП. Проверка директора, учредителей, аффилированных лиц и арбитражных дел.',
		cta: 'Проверить контрагента →',
		ctaHref: 'https://focus.kontur.ru/site/buy?p=f74746',
		visual: { abbrev: 'ФОК', bg: '#2D6A4F' },
	},
	'diadoc-kedo': {
		id: 'diadoc-kedo',
		eyebrow: 'Реклама · Диадок: КЭДО',
		title: 'Переведите кадровые документы в электронный вид — экономия до 5 800 ₽ на сотрудника',
		description:
			'Трудовые договоры, приказы и заявления без бумаги и курьеров. Юридически значимый КЭДО, интеграция с 1С:ЗУП.',
		cta: 'Подключить КЭДО →',
		ctaHref: 'https://kontur.ru/kedo?p=f74746',
		visual: { abbrev: 'КДО', bg: '#007A6E' },
	},
	'kontur-mchd': {
		id: 'kontur-mchd',
		eyebrow: 'Реклама · Контур.Доверенность',
		title: 'МЧД за 5 минут: сотрудники подписывают документы своей ЭП',
		description:
			'С 01.09.2024 сотрудники подписывают документы только через машиночитаемую доверенность. Оформите МЧД онлайн без визита в офис.',
		cta: 'Оформить МЧД →',
		ctaHref: 'https://kontur.ru/mchd/price?p=f74746',
		visual: { abbrev: 'МЧД', bg: '#4A1A7A' },
	},
	'kontur-market': {
		id: 'kontur-market',
		eyebrow: 'Реклама · Контур.Маркет',
		title: 'Учёт товаров и работа на кассе — бесплатный доступ 14 дней',
		description:
			'Товарный учёт с маркировкой, кассовая программа по 54-ФЗ, инвентаризация. Скидка 15% при онлайн-оплате.',
		cta: 'Попробовать 14 дней →',
		ctaHref: 'https://kontur.ru/market/kkt?p=f74746',
		visual: { abbrev: 'МРТ', bg: '#1A3A6C' },
		widget: {
			productId: 'Egais',
			productName: 'market',
			supplierUid: '0d1c45d7-c296-4b0a-bb3c-72cac0b27d60',
			source: 'etiketka: Маркет',
		},
	},
	'bank-elba': {
		id: 'bank-elba',
		eyebrow: 'Реклама · Контур.Банк + Эльба',
		title: 'Расчётный счёт + бухгалтерия — обслуживание 0 ₽ по тарифу «Ноль»',
		description:
			'Счёт в Контур.Банке открывается онлайн. В комплекте — Эльба для учёта налогов и отчётности. Без скрытых комиссий.',
		cta: 'Открыть счёт →',
		ctaHref: 'https://kontur.ru/lp/bank_and_elba?p=f74746',
		visual: { abbrev: 'БНК', bg: '#0A5C36' },
	},

	// ─── Контур: продукты для витрины (DRAFT — НЕ ПОКАЗЫВАТЬ) ────────────────
	//
	// ⚠️  ЗАГОТОВКИ под раздел /produkty/. НЕ добавлять в PRODUCT_CATALOG,
	//    CATEGORY_DEFAULT_CPA(2) и не вставлять в cpa: фронтматтера, пока:
	//
	//    1. В ctaHref не подставлены РЕАЛЬНЫЕ партнёрские ссылки с тегом p=.
	//    2. Креативы не зарегистрированы в Яндекс.ОРД (38-ФЗ) —
	//       scripts/ord-register.mjs → ord-erids.json получит erid.
	//
	// Без erid партнёрскую ссылку показывать нельзя (нарушение 38-ФЗ).
	// Тексты можно править на любом этапе.

	'kontur-podpis': {
		id: 'kontur-podpis',
		eyebrow: 'Реклама · Контур.Удостоверяющий центр',
		title: 'Электронная подпись для кассы, ЭДО и торгов',
		description:
			'КЭП для руководителя и сотрудников: работа с Честным знаком, ЭДО, госпорталами и торговыми площадками. Выпуск в день обращения.',
		cta: 'Получить подпись →',
		ctaHref: 'https://kontur.ru/ca', // TODO: партнёрская ссылка с тегом
		visual: { abbrev: 'ЭП', bg: '#1A3A6C' },
	},
	'kontur-merkuriy': {
		id: 'kontur-merkuriy',
		eyebrow: 'Реклама · Контур.Меркурий',
		title: 'Ветеринарные сертификаты ВСД для продуктов животного происхождения',
		description:
			'Гашение и оформление ВСД в системе «Меркурий» (ВетИС): мясо, молоко, рыба, яйца. Без установки ПО, прямо в браузере.',
		cta: 'Подключить Меркурий →',
		ctaHref: 'https://kontur.ru/merkuriy', // TODO: партнёрская ссылка с тегом
		visual: { abbrev: 'ВСД', bg: '#2D6A4F' },
	},
	'kontur-zarplata': {
		id: 'kontur-zarplata',
		eyebrow: 'Реклама · Контур.Зарплата',
		title: 'Расчёт зарплаты, отпускных и взносов без ошибок',
		description:
			'Считает НДФЛ, страховые взносы и больничные по актуальным правилам. Формирует отчётность в СФР и ФНС. Для компаний с наёмными сотрудниками.',
		cta: 'Попробовать →',
		ctaHref: 'https://kontur.ru/zarplata', // TODO: партнёрская ссылка с тегом
		visual: { abbrev: 'ЗП', bg: '#1E4A7A' },
	},
	'kontur-nds': {
		id: 'kontur-nds',
		eyebrow: 'Реклама · Контур.НДС+',
		title: 'Сверка НДС с контрагентами до сдачи декларации',
		description:
			'Находит расхождения в книгах покупок и продаж, снижает риск требований от ФНС. Сверка по всем контрагентам в одном окне.',
		cta: 'Проверить НДС →',
		ctaHref: 'https://kontur.ru/ndsplus', // TODO: партнёрская ссылка с тегом
		visual: { abbrev: 'НДС', bg: '#1A3A6C' },
	},
	'kontur-prizma': {
		id: 'kontur-prizma',
		eyebrow: 'Реклама · Контур.Призма',
		title: 'Проверка клиентов и операций по 115-ФЗ',
		description:
			'Оценка риска по антиотмывочному законодательству, скоринг контрагентов и операций. Снижает риск блокировки счёта банком.',
		cta: 'Подробнее →',
		ctaHref: 'https://kontur.ru/prizma', // TODO: партнёрская ссылка с тегом
		visual: { abbrev: '115', bg: '#9E2B4F' },
	},
	'kontur-dokumenty': {
		id: 'kontur-dokumenty',
		eyebrow: 'Реклама · Контур.Документы',
		title: 'Простой обмен документами для малого бизнеса',
		description:
			'Лёгкий вход в ЭДО без интеграций: счета, акты, договоры с контрагентами. Для тех, кому Диадок пока избыточен.',
		cta: 'Начать →',
		ctaHref: 'https://kontur.ru/documents', // TODO: партнёрская ссылка с тегом
		visual: { abbrev: 'ДОК', bg: '#007A6E' },
	},

	// ─── Банковские партнёрки (DRAFT — НЕ ИСПОЛЬЗОВАТЬ) ──────────────────────
	//
	// ⚠️  ЭТИ 5 БАННЕРОВ — ЗАГОТОВКИ. НЕ ВСТАВЛЯТЬ В ФРОНТМАТТЕР СТАТЕЙ (cpa:)
	//    И НЕ ДОБАВЛЯТЬ В CATEGORY_DEFAULT_CPA / CATEGORY_DEFAULT_CPA2, ПОКА:
	//
	//    1. Не одобрены заявки в партнёрках Т-Банк Бизнес / Точка / Альфа.
	//    2. В ctaHref не подставлены РЕАЛЬНЫЕ партнёрские ссылки с ID.
	//    3. Креативы не зарегистрированы в Яндекс.ОРД (38-ФЗ) —
	//       scripts/ord-register.mjs → ord-erids.json получит erid.
	//
	// Если показать эти баннеры на сайте без erid — это нарушение 38-ФЗ.
	// Текущие ctaHref ведут на лендинги БЕЗ партнёрского хвоста: технически
	// рабочая ссылка, но БЕЗ ВЫПЛАТЫ нам. Не показываем.
	//
	// Содержимое (заголовки/описания) можно править на любом этапе — это
	// просто заготовка слов под будущие баннеры.

	'tbank-rko': {
		id: 'tbank-rko',
		eyebrow: 'Реклама · Т-Банк Бизнес',
		title: 'Расчётный счёт для ИП и ООО — 3 месяца обслуживания 0 ₽',
		description:
			'Открытие за 1 день онлайн без визита в офис. Бесплатные платежи юрлицам, бизнес-карта в подарок, поддержка 24/7.',
		cta: 'Открыть счёт в Т-Банке →',
		ctaHref: 'https://www.tbank.ru/business/account/', // TODO: заменить на партнёрскую ссылку
		visual: { abbrev: 'РКО', bg: '#FFDD2D' },
	},

	'tochka-rko': {
		id: 'tochka-rko',
		eyebrow: 'Реклама · Точка Банк',
		title: 'Расчётный счёт «Простой» — 0 ₽ за обслуживание навсегда',
		description:
			'Бесплатные переводы юрлицам и физлицам в рамках тарифа. Бухгалтерия для ИП на УСН в подарок. Открытие за 20 минут онлайн.',
		cta: 'Открыть счёт в Точке →',
		ctaHref: 'https://tochka.com/lp/start/', // TODO: заменить на партнёрскую ссылку
		visual: { abbrev: 'ТЧК', bg: '#5B47FF' },
	},

	'tbank-acquiring': {
		id: 'tbank-acquiring',
		eyebrow: 'Реклама · Т-Банк Эквайринг',
		title: 'Интернет-эквайринг и торговый эквайринг от 1,2%',
		description:
			'Подключение к онлайн-кассе и сайту за 1 день. Поддержка СБП, оплата по QR, AppleCare для терминалов. Совместим с 54-ФЗ и ТС ПИоТ.',
		cta: 'Подключить эквайринг →',
		ctaHref: 'https://www.tbank.ru/business/acquiring/', // TODO: заменить на партнёрскую ссылку
		visual: { abbrev: 'ЭКВ', bg: '#FFDD2D' },
	},

	'tochka-acquiring': {
		id: 'tochka-acquiring',
		eyebrow: 'Реклама · Точка Эквайринг',
		title: 'Эквайринг от 1,3% с интеграцией кассы и СБП',
		description:
			'Один договор на торговый и интернет-эквайринг. Поддерживает СБП, оплату по QR-коду. Терминалы Ingenico/Verifone в аренду от 0 ₽.',
		cta: 'Подключить эквайринг Точки →',
		ctaHref: 'https://tochka.com/acquiring/', // TODO: заменить на партнёрскую ссылку
		visual: { abbrev: 'ЭКВ', bg: '#5B47FF' },
	},

	'alfa-credit-msb': {
		id: 'alfa-credit-msb',
		eyebrow: 'Реклама · Альфа-Банк Бизнес',
		title: 'Кредит для МСБ на закупку маркированного товара — от 12% годовых',
		description:
			'Кредитная линия до 100 млн ₽ без залога для ИП и ООО с оборотом от 1 млн ₽/мес. Решение за 1 день, деньги на счёт за 3 дня.',
		cta: 'Подать заявку в Альфу →',
		ctaHref: 'https://alfabank.ru/sme/credits/', // TODO: заменить на партнёрскую ссылку
		visual: { abbrev: 'КР', bg: '#EF3124' },
	},
};

export const CPA_BANNERS: Record<string, CpaBanner> = Object.fromEntries(
	Object.entries(_BANNERS_RAW).map(([id, banner]) => [
		id,
		{ ...banner, ...(id in _erids ? { erid: _erids[id] } : {}) },
	])
);

/** Дефолтный баннер по категории статьи. */
export const CATEGORY_DEFAULT_CPA: Record<string, string> = {
	'ts-piot': 'chestny-znak',
	'markirovka': 'kontur-markirovka',
	'zakonodatelstvo': 'default-zakonodatelstvo',
	'kkt': 'kontur-ofd',
	'egais': 'kontur-market',
};

/** Второй CPA-баннер по категории (необязательный). */
export const CATEGORY_DEFAULT_CPA2: Record<string, string> = {
	'ts-piot': 'ts-piot-provider',
	'markirovka': 'ts-piot-provider',
};

// ─── Витрина продуктов /produkty/ ──────────────────────────────────────────
// План и обоснование — docs/cpa-storefront-roadmap.md.

/** Раздел витрины (группировка по задаче бизнеса, а не по названиям). */
export interface CatalogGroup {
	id: string;
	title: string;
	description: string;
}

export const CATALOG_GROUPS: CatalogGroup[] = [
	{
		id: 'kassa-markirovka',
		title: 'Касса и маркировка',
		description:
			'Онлайн-касса по 54-ФЗ, передача чеков в ФНС, ТС ПИоТ и работа с кодами «Честного знака».',
	},
	{
		id: 'buhgalteriya',
		title: 'Бухгалтерия и отчётность',
		description:
			'Расчёт налогов, уведомления по ЕНС и сдача отчётности в ФНС, СФР и Росстат.',
	},
	{
		id: 'dokumenty-kadry',
		title: 'Документы и кадры',
		description:
			'Электронный документооборот с контрагентами, кадровый ЭДО, МЧД и транспортные накладные.',
	},
	{
		id: 'proverki-dengi',
		title: 'Проверки и деньги',
		description:
			'Проверка контрагентов перед сделкой и расчётный счёт с бухгалтерией в комплекте.',
	},
];

/** Карточка продукта в витрине. bannerId — ключ в CPA_BANNERS. */
export interface ProductCatalogEntry {
	/** slug страницы: /produkty/<slug>/ */
	slug: string;
	/** ключ в CPA_BANNERS — источник заголовка, оффера, визуала и erid */
	bannerId: string;
	/** id раздела из CATALOG_GROUPS */
	group: string;
	/** для кого продукт */
	audience: string;
	/** что внутри — буллеты выгод */
	bullets: string[];
	/** кластеры сайта, к которым относится продукт */
	clusters: string[];
}

/**
 * Продукты витрины. Только офферы с erid (см. ord-erids.json) —
 * показывать партнёрскую ссылку без erid нельзя (38-ФЗ).
 * Заготовки без erid (kontur-podpis, -merkuriy, -zarplata, -nds,
 * -prizma, -dokumenty) добавлять сюда после регистрации в ОРД.
 */
export const PRODUCT_CATALOG: ProductCatalogEntry[] = [
	{
		slug: 'kontur-market',
		bannerId: 'kontur-market',
		group: 'kassa-markirovka',
		audience:
			'Розница, общепит и услуги, которые продают маркированный или алкогольный товар через кассу.',
		bullets: [
			'Кассовая программа по 54-ФЗ',
			'Модуль ТС ПИоТ для разрешительного режима',
			'Товарный учёт с кодами маркировки',
			'ЕГАИС для алкоголя и регистрация в «Честном знаке»',
		],
		clusters: ['ts-piot', 'kkt', 'markirovka', 'egais'],
	},
	{
		slug: 'kontur-ofd',
		bannerId: 'kontur-ofd',
		group: 'kassa-markirovka',
		audience: 'Любой бизнес с онлайн-кассой по 54-ФЗ.',
		bullets: [
			'Передача чеков в ФНС',
			'Регистрация и перерегистрация кассы онлайн',
			'Совместимость со всеми моделями ККТ',
			'Личный кабинет с аналитикой продаж',
		],
		clusters: ['kkt', 'ts-piot'],
	},
	{
		slug: 'kontur-markirovka',
		bannerId: 'kontur-markirovka',
		group: 'kassa-markirovka',
		audience: 'Производители, импортёры и оптовики маркированных товаров.',
		bullets: [
			'Заказ и нанесение кодов маркировки',
			'Поэкземплярный учёт',
			'Вывод товара из оборота',
			'Интеграция с 1С, ERP и «Честным знаком»',
		],
		clusters: ['markirovka'],
	},
	{
		slug: 'kontur-elba',
		bannerId: 'kontur-elba',
		group: 'buhgalteriya',
		audience: 'ИП и небольшие ООО на УСН без штатного бухгалтера.',
		bullets: [
			'Расчёт налогов и страховых взносов',
			'Уведомления по ЕНС',
			'Отчётность в ФНС и СФР',
			'Выставление счетов и актов',
		],
		clusters: ['zakonodatelstvo'],
	},
	{
		slug: 'kontur-extern',
		bannerId: 'kontur-extern',
		group: 'buhgalteriya',
		audience: 'Бухгалтеры и компании на любом режиме налогообложения.',
		bullets: [
			'Отчётность в ФНС, СФР и Росстат',
			'Сверка с ЕНС',
			'Актуальные формы деклараций',
			'Электронная подпись в комплекте',
		],
		clusters: ['zakonodatelstvo'],
	},
	{
		slug: 'kontur-diadoc',
		bannerId: 'kontur-diadoc',
		group: 'dokumenty-kadry',
		audience:
			'Кто принимает и отправляет УПД, акты и счета-фактуры, особенно с кодами маркировки.',
		bullets: [
			'Юридически значимый ЭДО',
			'Приёмка УПД с кодами маркировки',
			'Передача сведений в «Честный знак»',
			'Интеграция с 1С и учётными системами',
		],
		clusters: ['markirovka', 'zakonodatelstvo'],
	},
	{
		slug: 'diadoc-kedo',
		bannerId: 'diadoc-kedo',
		group: 'dokumenty-kadry',
		audience: 'Компании с наёмными сотрудниками, переходящие на электронный кадровый учёт.',
		bullets: [
			'Трудовые договоры и приказы без бумаги',
			'Заявления и ознакомления онлайн',
			'Юридически значимый КЭДО по ТК РФ',
			'Интеграция с 1С:ЗУП',
		],
		clusters: ['zakonodatelstvo'],
	},
	{
		slug: 'kontur-mchd',
		bannerId: 'kontur-mchd',
		group: 'dokumenty-kadry',
		audience: 'Сотрудники, подписывающие документы от имени компании своей ЭП.',
		bullets: [
			'Оформление МЧД онлайн',
			'Хранение в распределённом реестре ФНС',
			'Подпись документов без визита в офис',
			'Соответствие требованиям с 01.09.2024',
		],
		clusters: ['zakonodatelstvo'],
	},
	{
		slug: 'diadoc-logistika',
		bannerId: 'diadoc-logistika',
		group: 'dokumenty-kadry',
		audience: 'Грузоотправители, перевозчики и грузополучатели перед переходом на ЭТрН.',
		bullets: [
			'Электронные транспортные накладные',
			'Передача данных в ГИС ЭПД',
			'ЭДО между всеми участниками перевозки',
			'Соответствие 140-ФЗ с 01.09.2026',
		],
		clusters: ['zakonodatelstvo'],
	},
	{
		slug: 'kontur-focus',
		bannerId: 'kontur-focus',
		group: 'proverki-dengi',
		audience: 'Кто проверяет контрагентов перед сделкой и снижает налоговые риски.',
		bullets: [
			'Данные из ЕГРЮЛ/ЕГРИП, судов и реестров',
			'Проверка директора и учредителей',
			'Арбитражные дела и банкротства',
			'Мониторинг изменений контрагентов',
		],
		clusters: ['zakonodatelstvo'],
	},
	{
		slug: 'bank-elba',
		bannerId: 'bank-elba',
		group: 'proverki-dengi',
		audience: 'ИП и ООО, которым нужен расчётный счёт и бухгалтерия в одном окне.',
		bullets: [
			'Открытие счёта онлайн',
			'Тариф «Ноль» — обслуживание 0 ₽',
			'Эльба для налогов и отчётности в комплекте',
			'Без скрытых комиссий',
		],
		clusters: ['zakonodatelstvo'],
	},
];
