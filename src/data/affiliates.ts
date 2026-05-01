export type AffiliateProduct = {
	id: string;
	name: string;
	vendor: string;
	tagline: string;
	description: string;
	cpaUrl: string;
	ctaLabel: string;
	note?: string;
};

// CPA-ссылки: заменить на реальные партнёрские URL из личного кабинета Контур.Партнёр
// Структура UTM: utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=<product-id>
export const AFFILIATE_PRODUCTS: Record<string, AffiliateProduct> = {
	'kontur-ofd': {
		id: 'kontur-ofd',
		name: 'Контур.ОФД',
		vendor: 'СКБ Контур',
		tagline: 'Оператор фискальных данных',
		description:
			'Передаёт чеки в ФНС и данные в «Честный знак». Подключение за 1 день, совместим с кассами всех производителей, поддерживает ТС ПИоТ.',
		cpaUrl: 'https://kontur.ru/ofd?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-ofd',
		ctaLabel: 'Подключить ОФД',
		note: '3 месяца бесплатно при первом подключении',
	},
	'kontur-diadok': {
		id: 'kontur-diadok',
		name: 'Контур.Диадок',
		vendor: 'СКБ Контур',
		tagline: 'Электронный документооборот',
		description:
			'ЭДО для работы с маркированным товаром: УПД, накладные, счета-фактуры. Аккредитован, интегрирован с «Честным знаком», поддерживает коды Data Matrix.',
		cpaUrl: 'https://kontur.ru/diadoc?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-diadok',
		ctaLabel: 'Попробовать бесплатно',
	},
	'kontur-market': {
		id: 'kontur-market',
		name: 'Контур.Маркет',
		vendor: 'СКБ Контур',
		tagline: 'Управление маркировкой',
		description:
			'Регистрация в «Честном знаке», работа с кодами DataMatrix, приёмка и вывод из оборота, интеграция с кассой и ЭДО — в одном сервисе.',
		cpaUrl: 'https://kontur.ru/market?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-market',
		ctaLabel: 'Начать работу',
	},
	'kontur-elba': {
		id: 'kontur-elba',
		name: 'Контур.Эльба',
		vendor: 'СКБ Контур',
		tagline: 'Бухгалтерия для ИП',
		description:
			'Считает налоги УСН и патента, формирует уведомления ЕНП, сдаёт отчётность в ФНС. Подходит для ИП без бухгалтера.',
		cpaUrl: 'https://kontur.ru/elba?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-elba',
		ctaLabel: 'Попробовать 3 месяца бесплатно',
		note: '3 месяца бесплатно для новых пользователей',
	},
	'kontur-buhgalteriya': {
		id: 'kontur-buhgalteriya',
		name: 'Контур.Бухгалтерия',
		vendor: 'СКБ Контур',
		tagline: 'Онлайн-бухгалтерия для ООО',
		description:
			'Учёт, зарплата, отчётность для ООО на УСН и ОСН. Работает с НДС, ЕНС/ЕНП, КЭДО. Подходит для бухгалтера и директора в одном лице.',
		cpaUrl: 'https://kontur.ru/buhgalteriya?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-buhgalteriya',
		ctaLabel: 'Начать бесплатно',
		note: '14 дней бесплатного доступа',
	},
	'kontur-extern': {
		id: 'kontur-extern',
		name: 'Контур.Экстерн',
		vendor: 'СКБ Контур',
		tagline: 'Сдача отчётности через интернет',
		description:
			'Отправка деклараций, уведомлений ЕНП и расчётов в ФНС, СФР, Росстат. Проверка перед отправкой, история всех документов.',
		cpaUrl: 'https://kontur.ru/extern?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-extern',
		ctaLabel: 'Подключить',
	},
	'kontur-kedo': {
		id: 'kontur-kedo',
		name: 'Контур.КЭДО',
		vendor: 'СКБ Контур',
		tagline: 'Кадровый электронный документооборот',
		description:
			'Перевод кадровых документов в электронный вид: приказы, трудовые договоры, согласия. Сотрудники подписывают через Госключ.',
		cpaUrl: 'https://kontur.ru/kedo?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-kedo',
		ctaLabel: 'Узнать подробнее',
	},
	'kontur-merkuriy': {
		id: 'kontur-merkuriy',
		name: 'Контур.Меркурий',
		vendor: 'СКБ Контур',
		tagline: 'Работа с ВСД в системе Меркурий',
		description:
			'Оформление и гашение ветеринарных сопроводительных документов. Интеграция с ФГИС «Меркурий» для розницы и общепита.',
		cpaUrl: 'https://kontur.ru/merkuriy?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-merkuriy',
		ctaLabel: 'Подключить',
	},
	'kontur-egais': {
		id: 'kontur-egais',
		name: 'Контур.ЕГАИС',
		vendor: 'СКБ Контур',
		tagline: 'Учёт алкоголя в ЕГАИС',
		description:
			'Подключение УТМ, ведение журнала розничных продаж, сдача алкогольных деклараций. Для магазинов, баров и ресторанов.',
		cpaUrl: 'https://kontur.ru/egais?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-egais',
		ctaLabel: 'Подключить ЕГАИС',
	},
	'kontur-focus': {
		id: 'kontur-focus',
		name: 'Контур.Фокус',
		vendor: 'СКБ Контур',
		tagline: 'Проверка контрагентов',
		description:
			'Актуальные данные о компаниях и ИП: финансовая отчётность, суды, долги, связи. Снижает риск при работе с новыми поставщиками.',
		cpaUrl: 'https://kontur.ru/focus?utm_source=reglament-biznes&utm_medium=cpa&utm_campaign=kontur-focus',
		ctaLabel: 'Проверить контрагента',
	},
};

// Рекомендации по умолчанию для каждой категории
// Используются как fallback, если в frontmatter статьи не указаны affiliates
export const CATEGORY_DEFAULT_AFFILIATES: Record<string, string[]> = {
	'ts-piot': ['kontur-ofd', 'kontur-market'],
	'markirovka': ['kontur-market', 'kontur-diadok'],
	'zakonodatelstvo': ['kontur-elba', 'kontur-extern'],
};
