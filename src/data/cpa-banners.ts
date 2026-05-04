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
}

export const CPA_BANNERS: Record<string, CpaBanner> = {
	'chestny-znak': {
		id: 'chestny-znak',
		eyebrow: 'Честный знак',
		title: 'Зарегистрируйтесь в системе маркировки бесплатно',
		description:
			'Личный кабинет участника оборота — обязательный первый шаг перед подключением ТС ПИоТ и работой с маркированными товарами.',
		cta: 'Перейти →',
		ctaHref: 'https://честныйзнак.рф/',
		visual: { abbrev: 'ЧЗ', bg: '#111' },
	},
	'default-ts-piot': {
		id: 'default-ts-piot',
		eyebrow: 'Полезно знать',
		title: 'Подключите ТС ПИоТ до 28 декабря 2025',
		description:
			'Срок обязателен для всех касс с разрешительным режимом «Честного знака». Без модуля — касса заблокирует продажи маркированных товаров.',
		cta: 'Инструкция по подключению →',
		ctaHref: '/blog/',
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
};

/** Дефолтный баннер по категории статьи. */
export const CATEGORY_DEFAULT_CPA: Record<string, string> = {
	'ts-piot': 'chestny-znak',
	'markirovka': 'default-markirovka',
	'zakonodatelstvo': 'default-zakonodatelstvo',
};
