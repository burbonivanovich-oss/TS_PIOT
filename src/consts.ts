// Глобальные константы сайта.
// Импортируйте их в любых компонентах и страницах.

export const SITE_TITLE = 'Этикетка';
export const SITE_DESCRIPTION =
	'Медиа для предпринимателей: маркировка «Честный знак», ТС ПИоТ, кассы, штрафы, изменения в законодательстве 2025–2026. Разбираем понятно — без паники.';
export const SITE_URL = 'https://etiketka-media.ru';
export const SITE_AUTHOR = 'Этикетка';
export const SITE_LOCALE = 'ru-RU';

export const NAV_LINKS = [
	{ href: '/', label: 'Главная' },
	{ href: '/blog/', label: 'Статьи' },
	{ href: '/category/ts-piot/', label: 'ТС ПИоТ' },
	{ href: '/category/kkt/', label: 'Кассы' },
	{ href: '/category/markirovka/', label: 'Маркировка' },
	{ href: '/category/egais/', label: 'ЕГАИС' },
	{ href: '/category/zakonodatelstvo/', label: 'Законодательство' },
	{ href: '/instrumenty/', label: 'Инструменты' },
	{ href: '/slovar/', label: 'Словарь' },
	{ href: '/about/', label: 'О проекте' },
	{ href: '/search/', label: 'Поиск' },
];

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
			'Программный модуль для онлайн-кассы, обеспечивающий прямую защищённую связь с системой «Честный знак». Проверяет маркировку в реальном времени и блокирует продажу нелегальных или просроченных товаров. Обязателен с 28 декабря 2025 года.',
	},
	'markirovka': {
		title: 'Маркировка',
		fullTitle: 'Обязательная маркировка «Честный знак»',
		description:
			'Категории товаров, подлежащих обязательной маркировке. Сроки введения, штрафы, регистрация в системе, разрешительный режим, поэкземплярный учёт.',
	},
	'zakonodatelstvo': {
		title: 'Законодательство',
		fullTitle: 'Изменения в законодательстве для бизнеса',
		description:
			'Налоги, ЭДО, КЭДО, ЕНС/ЕНП, маркетплейсы, проверки, трудовое право — изменения, которые касаются МСБ в 2025–2026 годах.',
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
			'Подключение ЕГАИС, УТМ, Меркурий, гашение ВСД, журнал учёта алкоголя, декларации по формам 7 и 8. Для магазинов, кафе и баров.',
	},
} as const;
