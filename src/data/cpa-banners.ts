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
		cta: 'Перейти →',
		ctaHref: '/',
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
		eyebrow: 'Следующий шаг',
		title: 'Выберите провайдера ТС ПИоТ',
		description:
			'Подключение занимает от 1 до 5 рабочих дней при совместимой кассе. До 1 июля 2026 осталось немного времени.',
		cta: 'Выбрать провайдера →',
		ctaHref: '/',
		visual: { abbrev: 'ТС', bg: '#9E2B4F' },
	},
	'online-buh': {
		id: 'online-buh',
		eyebrow: 'Автоматизация учёта',
		title: 'Онлайн-бухгалтерия справится с ЕНС, налогами и отчётностью',
		description:
			'Сервис сам рассчитывает налоги, формирует уведомления по ЕНС и напоминает о сроках. Подходит для ИП и ООО на УСН.',
		cta: 'Подобрать сервис →',
		ctaHref: '/',
		visual: { abbrev: 'БУХ', bg: '#1E4A7A' },
	},
	'edo-operator': {
		id: 'edo-operator',
		eyebrow: 'Обязательный шаг',
		title: 'Подключите ЭДО — без него приёмка маркированных товаров невозможна',
		description:
			'УПД с кодами маркировки принимается только через аккредитованного ЭДО-оператора. До дедлайна осталось немного времени.',
		cta: 'Подключить ЭДО →',
		ctaHref: '/',
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
	'egais': 'default-zakonodatelstvo',
};

/** Второй CPA-баннер по категории (необязательный). */
export const CATEGORY_DEFAULT_CPA2: Record<string, string> = {
	'ts-piot': 'ts-piot-provider',
	'markirovka': 'ts-piot-provider',
};
