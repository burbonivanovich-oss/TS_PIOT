export type AffiliateProduct = {
	id: string;
	name: string;
	vendor: string;
	tagline: string;
	description: string;
	cpaUrl: string;
	ctaLabel: string;
	commission: number;    // ₽ за продажу — для сортировки и аналитики
	commissionRate: number; // % ставка
	note?: string;
};

// CPA-ссылки: заменить на реальные из личного кабинета Контур.Партнёр
// utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=<id>
export const AFFILIATE_PRODUCTS: Record<string, AffiliateProduct> = {

	// ── ЭДО и документооборот ──────────────────────────────────────────────

	'kontur-diadok': {
		id: 'kontur-diadok',
		name: 'Контур.Диадок',
		vendor: 'СКБ Контур',
		tagline: 'Электронный документооборот',
		description:
			'ЭДО для работы с маркированным товаром: УПД, накладные, счета-фактуры. Аккредитован, интегрирован с «Честным знаком», поддерживает коды Data Matrix.',
		cpaUrl: 'https://kontur.ru/diadoc?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-diadok',
		ctaLabel: 'Попробовать бесплатно',
		commission: 3255,
		commissionRate: 30,
	},

	'kontur-kadrovyj-edo': {
		id: 'kontur-kadrovyj-edo',
		name: 'Контур.КЭДО',
		vendor: 'СКБ Контур',
		tagline: 'Кадровый электронный документооборот',
		description:
			'Трудовые договоры, приказы и кадровые документы в электронном виде. Сотрудники подписывают через Госключ — без похода в офис.',
		cpaUrl: 'https://kontur.ru/kedo?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-kadrovyj-edo',
		ctaLabel: 'Подключить КЭДО',
		commission: 18000,
		commissionRate: 30,
		note: 'Высокая ставка — 30%',
	},

	'kontur-sign': {
		id: 'kontur-sign',
		name: 'Контур.Сайн',
		vendor: 'СКБ Контур',
		tagline: 'Подписание документов онлайн',
		description:
			'Контрагенты подписывают договоры и акты без ЭЦП — через SMS или Госуслуги. Подходит для разовых сделок и работы с физлицами.',
		cpaUrl: 'https://kontur.ru/sign?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-sign',
		ctaLabel: 'Попробовать',
		commission: 1649,
		commissionRate: 10,
	},

	// ── Отчётность и бухгалтерия ──────────────────────────────────────────

	'kontur-extern-uchetniy': {
		id: 'kontur-extern-uchetniy',
		name: 'Контур.Экстерн',
		vendor: 'СКБ Контур',
		tagline: 'Тариф «Учётный» — отчётность + бухгалтерия',
		description:
			'Сдача деклараций УСН, уведомлений ЕНП, расчётов в СФР. Встроенный учёт доходов и расходов. Подходит для небольшого ООО с бухгалтером.',
		cpaUrl: 'https://kontur.ru/extern?tariff=uchetniy&utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-extern-uchetniy',
		ctaLabel: 'Подключить',
		commission: 8475,
		commissionRate: 25,
	},

	'kontur-extern': {
		id: 'kontur-extern',
		name: 'Контур.Экстерн',
		vendor: 'СКБ Контур',
		tagline: 'Сдача отчётности через интернет',
		description:
			'Декларации, уведомления ЕНП, расчёты в ФНС, СФР и Росстат. Проверка перед отправкой, история всех документов.',
		cpaUrl: 'https://kontur.ru/extern?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-extern',
		ctaLabel: 'Подключить',
		commission: 2150,
		commissionRate: 10,
	},

	'kontur-elba': {
		id: 'kontur-elba',
		name: 'Контур.Эльба',
		vendor: 'СКБ Контур',
		tagline: 'Бухгалтерия для ИП',
		description:
			'Считает налоги УСН и патента, формирует уведомления ЕНП, сдаёт отчётность в ФНС. Подходит для ИП без бухгалтера.',
		cpaUrl: 'https://kontur.ru/elba?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-elba',
		ctaLabel: 'Попробовать бесплатно',
		commission: 0, // уточнить ставку в Контур.Партнёр
		commissionRate: 0,
		note: '3 месяца бесплатно для новых пользователей',
	},

	'kontur-zarplata': {
		id: 'kontur-zarplata',
		name: 'Контур.Зарплата',
		vendor: 'СКБ Контур',
		tagline: 'Расчёт зарплаты и взносов',
		description:
			'Автоматический расчёт зарплаты, НДФЛ и страховых взносов. Формирует платёжки, уведомления ЕНП и отчётность в СФР.',
		cpaUrl: 'https://kontur.ru/zarplata?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-zarplata',
		ctaLabel: 'Попробовать',
		commission: 3840,
		commissionRate: 10,
	},

	'kontur-nds-plus': {
		id: 'kontur-nds-plus',
		name: 'Контур.НДС+',
		vendor: 'СКБ Контур',
		tagline: 'Проверка и сверка НДС',
		description:
			'Сверяет счета-фактуры с контрагентами до подачи декларации. Снижает риск расхождений с ФНС и налоговых разрывов.',
		cpaUrl: 'https://kontur.ru/nds?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-nds-plus',
		ctaLabel: 'Попробовать',
		commission: 1900,
		commissionRate: 10,
	},

	// ── Маркировка и ОФД ──────────────────────────────────────────────────

	'kontur-market': {
		id: 'kontur-market',
		name: 'Контур.Маркет',
		vendor: 'СКБ Контур',
		tagline: 'Управление маркировкой',
		description:
			'Регистрация в «Честном знаке», работа с кодами Data Matrix, приёмка и вывод из оборота, интеграция с кассой и ЭДО.',
		cpaUrl: 'https://kontur.ru/market?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-market',
		ctaLabel: 'Начать работу',
		commission: 990,
		commissionRate: 10,
	},

	'kontur-markirovka': {
		id: 'kontur-markirovka',
		name: 'Контур.Маркировка',
		vendor: 'СКБ Контур',
		tagline: 'Полный цикл работы с «Честным знаком»',
		description:
			'Заказ кодов, нанесение, ввод в оборот, поэкземплярный учёт, разрешительный режим — в одном сервисе для розницы и производства.',
		cpaUrl: 'https://kontur.ru/markirovka?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-markirovka',
		ctaLabel: 'Подключить',
		commission: 3017,
		commissionRate: 10,
	},

	'kontur-ofd': {
		id: 'kontur-ofd',
		name: 'Контур.ОФД',
		vendor: 'СКБ Контур',
		tagline: 'Оператор фискальных данных',
		description:
			'Передаёт чеки в ФНС и данные в «Честный знак». Поддерживает ТС ПИоТ, совместим с кассами всех производителей.',
		cpaUrl: 'https://kontur.ru/ofd?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-ofd',
		ctaLabel: 'Подключить ОФД',
		commission: 450,
		commissionRate: 10,
		note: '3 месяца бесплатно при первом подключении',
	},

	// ── Проверка контрагентов ─────────────────────────────────────────────

	'kontur-fokus': {
		id: 'kontur-fokus',
		name: 'Контур.Фокус',
		vendor: 'СКБ Контур',
		tagline: 'Проверка контрагентов',
		description:
			'Финансовая отчётность, суды, долги, связи между компаниями. Снижает риск при работе с новыми поставщиками и покупателями.',
		cpaUrl: 'https://kontur.ru/focus?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-fokus',
		ctaLabel: 'Проверить контрагента',
		commission: 17800,
		commissionRate: 20,
	},

	'kontur-fokus-compliance': {
		id: 'kontur-fokus-compliance',
		name: 'Контур.Фокус Комплаенс',
		vendor: 'СКБ Контур',
		tagline: 'Комплаенс и проверка по 115-ФЗ',
		description:
			'Автоматическая проверка клиентов и контрагентов на признаки отмывания и финансирования терроризма. Для бизнеса с требованиями ПОД/ФТ.',
		cpaUrl: 'https://kontur.ru/focus/compliance?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-fokus-compliance',
		ctaLabel: 'Узнать подробнее',
		commission: 38640,
		commissionRate: 20,
	},

	// ── Спецрежимы: Меркурий, ЕГАИС ──────────────────────────────────────

	'kontur-merkuriy': {
		id: 'kontur-merkuriy',
		name: 'Контур.Меркурий',
		vendor: 'СКБ Контур',
		tagline: 'Работа с ВСД в системе Меркурий',
		description:
			'Оформление и гашение ветеринарных сопроводительных документов во ФГИС «Меркурий» для розницы и общепита.',
		cpaUrl: 'https://kontur.ru/merkuriy?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-merkuriy',
		ctaLabel: 'Подключить',
		commission: 2290,
		commissionRate: 10,
	},

	'kontur-egais': {
		id: 'kontur-egais',
		name: 'Контур.ЕГАИС',
		vendor: 'СКБ Контур',
		tagline: 'Учёт алкоголя в ЕГАИС',
		description:
			'Подключение УТМ, ведение журнала розничных продаж, сдача алкогольных деклараций для магазинов, баров и ресторанов.',
		cpaUrl: 'https://kontur.ru/egais?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-egais',
		ctaLabel: 'Подключить ЕГАИС',
		commission: 0, // уточнить — в таблице отдельной строки нет
		commissionRate: 0,
	},

	// ── Госзакупки ────────────────────────────────────────────────────────

	'kontur-zakupki': {
		id: 'kontur-zakupki',
		name: 'Контур.Закупки',
		vendor: 'СКБ Контур',
		tagline: 'Поиск тендеров и госзакупок',
		description:
			'Поиск подходящих закупок по 44-ФЗ и 223-ФЗ, уведомления о новых лотах, анализ конкурентов и история побед.',
		cpaUrl: 'https://kontur.ru/zakupki?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-zakupki',
		ctaLabel: 'Найти тендеры',
		commission: 7740,
		commissionRate: 20,
	},

	'kontur-torgi': {
		id: 'kontur-torgi',
		name: 'Контур.Сопровождение торгов',
		vendor: 'СКБ Контур',
		tagline: 'Помощь в участии в тендере',
		description:
			'Специалисты Контура готовят заявку, проверяют документы и сопровождают участие в торгах под ключ.',
		cpaUrl: 'https://kontur.ru/torgi?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-torgi',
		ctaLabel: 'Узнать подробнее',
		commission: 5000,
		commissionRate: 10,
	},

	// ── ВЭД и таможня ────────────────────────────────────────────────────

	'kontur-deklarant': {
		id: 'kontur-deklarant',
		name: 'Контур.Декларант',
		vendor: 'СКБ Контур',
		tagline: 'Таможенное декларирование',
		description:
			'Подготовка и подача таможенных деклараций через интернет. Для импортёров и экспортёров, работающих с ФТС напрямую.',
		cpaUrl: 'https://kontur.ru/deklarant?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-deklarant',
		ctaLabel: 'Попробовать',
		commission: 13800,
		commissionRate: 20,
	},

	// ── Электронная подпись ───────────────────────────────────────────────

	'kontur-ep': {
		id: 'kontur-ep',
		name: 'КЭП от Контура',
		vendor: 'СКБ Контур',
		tagline: 'Квалифицированная электронная подпись',
		description:
			'КЭП для ЭДО, ЕГАИС, госзакупок, отчётности в ФНС и СФР. Выдаётся в удостоверяющем центре Контура.',
		cpaUrl: 'https://kontur.ru/ep?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-ep',
		ctaLabel: 'Получить КЭП',
		commission: 790,
		commissionRate: 10,
	},

	// ── Логистика ────────────────────────────────────────────────────────

	'kontur-logistika': {
		id: 'kontur-logistika',
		name: 'Контур.Логистика',
		vendor: 'СКБ Контур',
		tagline: 'Управление доставкой и ТТН',
		description:
			'Электронные транспортные накладные (ЭТТН), маршрутные листы, интеграция с перевозчиками. Для интернет-магазинов и дистрибьюторов.',
		cpaUrl: 'https://kontur.ru/logistika?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-logistika',
		ctaLabel: 'Подключить',
		commission: 17400,
		commissionRate: 30,
	},
};

// Дефолтные рекомендации по категориям статьи.
// Принцип: сначала релевантность, потом — выше комиссия среди релевантных.
export const CATEGORY_DEFAULT_AFFILIATES: Record<string, string[]> = {
	// Контур.Маркет включает кассу + управление маркировкой. ОФД — обязателен для ТС ПИоТ.
	'ts-piot': ['kontur-ofd', 'kontur-market'],

	// Маркировка — полный цикл работы с «Честным знаком». Маркет — касса + учёт кодов.
	'markirovka': ['kontur-markirovka', 'kontur-market'],

	// Экстерн «Учётный» релевантен для статей про налоги/ЕНС. КЭДО — для трудовых статей.
	// Выбрать один или оба зависит от статьи — переопределяется через affiliates: [] в frontmatter.
	'zakonodatelstvo': ['kontur-extern-uchetniy', 'kontur-kadrovyj-edo'],
};

// Рекомендации для новых кластеров (использовать в affiliates: [] frontmatter статьи)
export const CLUSTER_AFFILIATES: Record<string, string[]> = {
	'ofd':           ['kontur-ofd'],
	'kedo':          ['kontur-kadrovyj-edo'],
	'merkuriy':      ['kontur-merkuriy', 'kontur-diadok'],
	'egais':         ['kontur-egais'],
	'goszakupki':    ['kontur-zakupki', 'kontur-torgi'],
	'ved':           ['kontur-deklarant', 'kontur-ep'],
	'kontragenty':   ['kontur-fokus', 'kontur-fokus-compliance'],
	'buhgalteriya':  ['kontur-extern-uchetniy', 'kontur-elba'],
	'zarplata':      ['kontur-zarplata', 'kontur-kadrovyj-edo'],
	'nds':           ['kontur-nds-plus', 'kontur-extern-uchetniy'],
	'marketplace':   ['kontur-diadok', 'kontur-logistika'],
	'ep':            ['kontur-ep'],
};
