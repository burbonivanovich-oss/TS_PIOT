// Глобальные константы сайта.
// Импортируйте их в любых компонентах и страницах.

export const SITE_TITLE = 'Этикетка';
export const SITE_DESCRIPTION =
	'Всё, что нужно малому бизнесу: налоги и отчётность, кассы, маркировка, ЕГАИС, сотрудники и ЭДО. Понятные разборы законов 2026 года со ссылками на источники.';
// Заголовок главной для поисковиков: одно слово «Этикетка» не говорит, о чём сайт.
export const SITE_HOME_TITLE = 'Этикетка — налоги, кассы, маркировка и законы для малого бизнеса';
export const SITE_URL = 'https://etiketka-media.ru';
export const SITE_AUTHOR = 'Этикетка';
export const SITE_LOCALE = 'ru-RU';

// Полный плоский список — для подвала и карты сайта.
export const NAV_LINKS = [
	{ href: '/', label: 'Главная' },
	{ href: '/blog/', label: 'Статьи' },
	{ href: '/category/nalogi/', label: 'Налоги и отчётность' },
	{ href: '/category/kkt/', label: 'Кассы' },
	{ href: '/category/markirovka/', label: 'Маркировка' },
	{ href: '/category/egais/', label: 'ЕГАИС' },
	{ href: '/category/sotrudniki/', label: 'Сотрудники' },
	{ href: '/category/dokumenty/', label: 'Документы и ЭДО' },
	{ href: '/category/biznes/', label: 'Открытие бизнеса' },
	{ href: '/category/ts-piot/', label: 'ТС ПИоТ' },
	{ href: '/category/zakonodatelstvo/', label: 'Законы и проверки' },
	{ href: '/instrumenty/', label: 'Инструменты' },
	{ href: '/produkty/', label: 'Сервисы' },
	{ href: '/podbor/', label: 'Подбор сервиса' },
	{ href: '/sravneniya/', label: 'Сравнения' },
	{ href: '/slovar/', label: 'Словарь' },
	{ href: '/about/', label: 'О проекте' },
	{ href: '/search/', label: 'Поиск' },
];

// Сгруппированная навигация для шапки: разделы свёрнуты в «Темы»,
// «Сервисы» и «Инструменты» вынесены как самостоятельные акценты.
export const NAV = [
	{
		label: 'Темы',
		children: [
			{ href: '/category/nalogi/', label: 'Налоги и отчётность' },
			{ href: '/category/kkt/', label: 'Кассы' },
			{ href: '/category/markirovka/', label: 'Маркировка' },
			{ href: '/category/egais/', label: 'ЕГАИС' },
			{ href: '/category/sotrudniki/', label: 'Сотрудники' },
			{ href: '/category/dokumenty/', label: 'Документы и ЭДО' },
			{ href: '/category/biznes/', label: 'Открытие бизнеса' },
			{ href: '/category/ts-piot/', label: 'ТС ПИоТ' },
			{ href: '/category/zakonodatelstvo/', label: 'Законы и проверки' },
			{ href: '/sravneniya/', label: 'Сравнения и выбор' },
			{ href: '/blog/', label: 'Все статьи' },
		],
	},
	{ href: '/instrumenty/', label: 'Инструменты' },
	{ href: '/produkty/', label: 'Сервисы' },
	{ href: '/slovar/', label: 'Словарь' },
] as const;

export const SIDEBAR_BANNER = {
	eyebrow: 'Дайджест',
	title: 'Только важное — раз в две недели',
	description:
		'Изменения в законодательстве, новые требования к маркировке и ТС ПИоТ — коротко и по делу для вашего бизнеса.',
	cta: 'Подписаться →',
	ctaHref: 'https://t.me/etiketka_media',
} as const;

export const INLINE_SUBSCRIBE = {
	title: 'Не пропустите следующий материал',
	description: 'Дайджест раз в две недели: только важные изменения для МСБ.',
	placeholder: 'ваш@email.ru',
	cta: 'Подписаться',
	/* Укажите action вашего сервиса рассылок (Mailchimp, Unisender и др.) */
	formAction: '#',
} as const;

/* Курируемый список ключевых статей для 404 и других fallback-блоков.
   До подключения аналитики (#6–8) — список ведётся вручную. */
export const POPULAR_POSTS = [
	'2026-01-15-chto-takoe-ts-piot',
	'2026-02-10-kategorii-markirovki-2026',
	'2026-05-01-kalendar-markirovki-2026',
	'2026-05-01-shtraf-za-markirovku',
] as const;

export const CATEGORIES = {
	'ts-piot': {
		title: 'ТС ПИоТ',
		fullTitle: 'Техническое средство получения информации о товаре',
		description:
			'Программный модуль для онлайн-кассы, обеспечивающий прямую защищённую связь с системой «Честный знак». Проверяет маркировку в реальном времени и блокирует продажу нелегальных или просроченных товаров. Обязателен для разрешительного режима с 1 июля 2026 года.',
	},
	'markirovka': {
		title: 'Маркировка',
		fullTitle: 'Маркировка «Честный знак» и ветеринарный контроль',
		description:
			'Категории товаров, подлежащих обязательной маркировке. Сроки введения, штрафы, регистрация в системе, разрешительный режим, поэкземплярный учёт. Ветеринарные документы в ФГИС «Меркурий».',
	},
	'nalogi': {
		title: 'Налоги и отчётность',
		fullTitle: 'Налоги, взносы и отчётность малого бизнеса',
		description:
			'УСН, патент, НПД и НДС, ЕНС и уведомления, страховые взносы, сдача отчётности и онлайн-бухгалтерия для ИП и ООО.',
	},
	'biznes': {
		title: 'Открытие бизнеса',
		fullTitle: 'Открытие, развитие и закрытие бизнеса',
		description:
			'Как выбрать форму — ИП или ООО, открыть и закрыть компанию, проверить контрагента, получить господдержку и льготы МСП.',
	},
	'sotrudniki': {
		title: 'Сотрудники',
		fullTitle: 'Сотрудники и кадровые документы',
		description:
			'Первый сотрудник, МРОТ и зарплата, электронные трудовые книжки и КЭДО, работа с самозанятыми.',
	},
	'dokumenty': {
		title: 'Документы и ЭДО',
		fullTitle: 'Электронный документооборот и перевозочные документы',
		description:
			'ЭДО и УПД, машиночитаемые доверенности, электронные транспортные накладные и ГИС ЭПД, EDI с торговыми сетями.',
	},
	'zakonodatelstvo': {
		title: 'Законы и проверки',
		fullTitle: 'Законы и проверки бизнеса',
		description:
			'Проверки и мораторий, контрольные закупки, штрафы КоАП, персональные данные, закон о маркетплейсах — правила, которые касаются любого бизнеса.',
	},
	'kkt': {
		title: 'Кассы',
		fullTitle: 'Онлайн-кассы и фискальные накопители',
		description:
			'Выбор и регистрация онлайн-кассы, фискальные накопители ФН-1.1М и ФН-1.2, ОФД, пошаговые инструкции по настройке. Модели: Эвотор, АТОЛ, Штрих, MSPOS.',
	},
	'egais': {
		title: 'ЕГАИС',
		fullTitle: 'ЕГАИС и учёт алкоголя',
		description:
			'Подключение ЕГАИС и УТМ, лицензия, журнал учёта алкоголя, списание, декларации по формам 7 и 8. Для магазинов, кафе и баров.',
	},
} as const;
