export type MarkingStatus = 'active' | 'upcoming' | 'soon';

export type MarkingEntry = {
	id: string;
	product: string;
	group: string;
	date: string;
	isoDate: string;
	requirement: string;
	status: MarkingStatus;
};

export const MARKING_GROUPS = [
	'Косметика и парфюмерия',
	'Бытовая химия и гигиена',
	'Напитки',
	'Продукты питания',
	'Лёгкая промышленность',
	'Табак',
	'Молочная продукция',
	'Пиво',
	'Прочее',
] as const;

export type MarkingGroup = (typeof MARKING_GROUPS)[number];

export const MARKING_CALENDAR: MarkingEntry[] = [
	// Уже действуют
	{
		id: 'milk',
		product: 'Молочная продукция',
		group: 'Молочная продукция',
		date: '1 сентября 2022',
		isoDate: '2022-09-01',
		requirement: 'Обязательная маркировка для производителей и оптовиков. Розница — с 1 декабря 2023.',
		status: 'active',
	},
	{
		id: 'beer',
		product: 'Пиво и слабоалкогольные напитки',
		group: 'Пиво',
		date: '1 апреля 2023',
		isoDate: '2023-04-01',
		requirement: 'Маркировка в разливных ёмкостях. Баночное и бутылочное — поэтапно до 2023–2024.',
		status: 'active',
	},
	{
		id: 'shoes',
		product: 'Обувь',
		group: 'Лёгкая промышленность',
		date: '1 июля 2020',
		isoDate: '2020-07-01',
		requirement: 'Полный запрет оборота немаркированной обуви. Разрешительный режим на кассе.',
		status: 'active',
	},
	{
		id: 'tobacco',
		product: 'Табачная продукция',
		group: 'Табак',
		date: '1 июля 2020',
		isoDate: '2020-07-01',
		requirement: 'Полный запрет оборота без маркировки. С 2026 — проверка минимальной цены.',
		status: 'active',
	},
	{
		id: 'water',
		product: 'Вода питьевая упакованная',
		group: 'Напитки',
		date: '1 марта 2023',
		isoDate: '2023-03-01',
		requirement: 'Розница обязана работать в разрешительном режиме.',
		status: 'active',
	},
	// С 1 июля 2026
	{
		id: 'cosmetics-2026',
		product: 'Косметика и парфюмерия',
		group: 'Косметика и парфюмерия',
		date: '1 июля 2026',
		isoDate: '2026-07-01',
		requirement: 'Запрет оборота немаркированных остатков. Разрешительный режим на кассе.',
		status: 'upcoming',
	},
	{
		id: 'household-chem-2026',
		product: 'Бытовая химия',
		group: 'Бытовая химия и гигиена',
		date: '1 июля 2026',
		isoDate: '2026-07-01',
		requirement: 'Запрет оборота без маркировки. Регистрация в «Честном знаке» уже сейчас.',
		status: 'upcoming',
	},
	{
		id: 'hygiene-2026',
		product: 'Средства личной гигиены',
		group: 'Бытовая химия и гигиена',
		date: '1 июля 2026',
		isoDate: '2026-07-01',
		requirement: 'Запрет продажи без Data Matrix. Включает зубные щётки, мыло, шампуни.',
		status: 'upcoming',
	},
	// С 1 сентября 2026
	{
		id: 'softdrinks-2026',
		product: 'Безалкогольные напитки',
		group: 'Напитки',
		date: '1 сентября 2026',
		isoDate: '2026-09-01',
		requirement: 'Проверка кодов маркировки при продаже. Подготовьте кассу к разрешительному режиму.',
		status: 'upcoming',
	},
	{
		id: 'sportfood-2026',
		product: 'Спортивное питание',
		group: 'Продукты питания',
		date: '1 сентября 2026',
		isoDate: '2026-09-01',
		requirement: 'Запрет оборота немаркированных остатков. Поэкземплярный учёт обязателен.',
		status: 'upcoming',
	},
	{
		id: 'snacks-2026',
		product: 'Снеки, соусы, специи',
		group: 'Продукты питания',
		date: '1 сентября 2026',
		isoDate: '2026-09-01',
		requirement: 'Маркировка при производстве и импорте. Розница — разрешительный режим.',
		status: 'upcoming',
	},
	{
		id: 'toys-2026',
		product: 'Игрушки',
		group: 'Прочее',
		date: '1 сентября 2026',
		isoDate: '2026-09-01',
		requirement: 'Поэкземплярный учёт. Каждая единица — отдельный код Data Matrix.',
		status: 'upcoming',
	},
	// С 1 октября 2026
	{
		id: 'autofluids-2026',
		product: 'Автомобильные жидкости',
		group: 'Прочее',
		date: '1 октября 2026',
		isoDate: '2026-10-01',
		requirement: 'Разрешительный режим на кассе. Нельзя продавать без проверки кода.',
		status: 'upcoming',
	},
	{
		id: 'canned-2026',
		product: 'Консервы',
		group: 'Продукты питания',
		date: '1 октября 2026',
		isoDate: '2026-10-01',
		requirement: 'Обязательная маркировка. Производители и импортёры обязаны нанести Data Matrix.',
		status: 'upcoming',
	},
];
