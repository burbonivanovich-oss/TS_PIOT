// Сценарии штрафов для калькулятора. Цифры согласованы с публикациями
// и сверены с действующими редакциями КоАП РФ на момент составления.
// Калькулятор не заменяет юридическую консультацию.

export type SubjectType = 'ip' | 'legal';

export type FineRange = {
	min: number;
	max: number;
	floor?: number;
};

export type PercentRange = {
	minPct: number;
	maxPct: number;
	floor: number;
};

export type ScenarioGroup = 'kkt' | 'markirovka' | 'egais' | 'merkuriy';

export type Scenario = {
	id: string;
	group: ScenarioGroup;
	label: string;
	short: string;
	article: string;
	articleUrl?: string;
	calc:
		| { type: 'fixed'; ip: FineRange; legal: FineRange }
		| { type: 'percent'; ip: PercentRange; legal: PercentRange };
	confiscation?: boolean;
	note?: string;
};

export const SCENARIO_GROUPS: Record<ScenarioGroup, string> = {
	kkt: 'Онлайн-касса (ст. 14.5 КоАП)',
	markirovka: 'Маркировка «Честный знак» (ст. 15.12 КоАП)',
	egais: 'ЕГАИС — оборот алкоголя (ст. 14.16 КоАП)',
	merkuriy: 'Меркурий / ВетИС — ветеринарная сертификация (ст. 10.8 КоАП)',
};

export const SCENARIOS: Scenario[] = [
	{
		id: 'no-kkt',
		group: 'kkt',
		label: 'Не применил ККТ (продажа без чека)',
		short: 'Не пробил чек через онлайн-кассу',
		article: 'ст. 14.5 ч. 2 КоАП РФ',
		calc: {
			type: 'percent',
			ip: { minPct: 25, maxPct: 50, floor: 10000 },
			legal: { minPct: 75, maxPct: 100, floor: 30000 },
		},
		note: 'Штраф рассчитывается как процент от суммы расчёта, проведённого без применения ККТ. При повторном нарушении и сумме расчётов от 1 млн ₽ — дисквалификация должностного лица или приостановка деятельности до 90 суток.',
	},
	{
		id: 'kkt-violation',
		group: 'kkt',
		label: 'Нарушение в работе ККТ (некорректный чек, ФН, реквизиты)',
		short: 'Касса работает с нарушениями требований',
		article: 'ст. 14.5 ч. 4 КоАП РФ',
		calc: {
			type: 'fixed',
			ip: { min: 1500, max: 3000 },
			legal: { min: 5000, max: 10000 },
		},
		note: 'Возможно предупреждение вместо штрафа, если нарушение совершено впервые и не причинило вреда.',
	},
	{
		id: 'no-electronic-receipt',
		group: 'kkt',
		label: 'Не направил электронный чек покупателю',
		short: 'Покупатель попросил электронный чек, но не получил его',
		article: 'ст. 14.5 ч. 6 КоАП РФ',
		calc: {
			type: 'fixed',
			ip: { min: 2000, max: 2000 },
			legal: { min: 10000, max: 10000 },
		},
		note: 'Возможно предупреждение вместо штрафа.',
	},
	{
		id: 'unmarked-sale',
		group: 'markirovka',
		label: 'Продажа товара без обязательной маркировки',
		short: 'Розничная продажа без кода Data Matrix',
		article: 'ст. 15.12 ч. 2 КоАП РФ',
		calc: {
			type: 'fixed',
			ip: { min: 5000, max: 15000 },
			legal: { min: 50000, max: 300000 },
		},
		confiscation: true,
		note: 'Дополнительно — конфискация немаркированной продукции. Для крупных партий — уголовная ответственность по ст. 171.1 УК РФ.',
	},
	{
		id: 'unmarked-production',
		group: 'markirovka',
		label: 'Производство товара без маркировки',
		short: 'Изготовление продукции без нанесения кода',
		article: 'ст. 15.12 ч. 1 КоАП РФ',
		calc: {
			type: 'fixed',
			ip: { min: 10000, max: 30000 },
			legal: { min: 50000, max: 100000 },
		},
		confiscation: true,
		note: 'Дополнительно — конфискация. Для табачной продукции суммы выше — см. ст. 15.12 ч. 4 КоАП РФ.',
	},
	{
		id: 'mismatch-data',
		group: 'markirovka',
		label: 'Несоответствие данных в системе мониторинга',
		short: 'Сведения в «Честном знаке» не совпадают с фактическим оборотом',
		article: 'ст. 15.12.1 КоАП РФ',
		calc: {
			type: 'fixed',
			ip: { min: 1000, max: 10000 },
			legal: { min: 50000, max: 100000 },
		},
		note: 'Применяется при ошибках поэкземплярного учёта, расхождениях остатков, неверных кодах в УПД.',
	},

	// ЕГАИС — оборот алкоголя
	{
		id: 'egais-no-fix',
		group: 'egais',
		label: 'Продажа алкоголя без фиксации в ЕГАИС',
		short: 'Розничная продажа без отражения в системе ЕГАИС',
		article: 'ст. 14.16 ч. 3 КоАП РФ',
		articleUrl: 'https://www.consultant.ru/document/cons_doc_LAW_34661/статья-14.16/',
		calc: {
			type: 'fixed',
			ip: { min: 10000, max: 15000 },
			legal: { min: 100000, max: 200000 },
		},
		confiscation: true,
		note: 'Дополнительно — конфискация алкогольной продукции. ИП в данном составе несёт ответственность как должностное лицо. При повторном нарушении возможна приостановка деятельности.',
	},
	{
		id: 'egais-order-violation',
		group: 'egais',
		label: 'Нарушение порядка учёта алкоголя в ЕГАИС',
		short: 'Неверная или неполная фиксация остатков, актов списания, возвратов',
		article: 'ст. 14.16 ч. 4 КоАП РФ',
		articleUrl: 'https://www.consultant.ru/document/cons_doc_LAW_34661/статья-14.16/',
		calc: {
			type: 'fixed',
			ip: { min: 5000, max: 10000 },
			legal: { min: 50000, max: 100000 },
		},
		note: 'Включает ошибки при гашении ВСД, несвоевременную передачу актов о расходе, расхождения остатков между учётной системой и ЕГАИС.',
	},
	{
		id: 'egais-min-price',
		group: 'egais',
		label: 'Продажа алкоголя ниже минимальной розничной цены',
		short: 'Розничная цена ниже МРЦ, установленной Росалкогольрегулированием',
		article: 'ст. 14.16 ч. 1 КоАП РФ',
		articleUrl: 'https://www.consultant.ru/document/cons_doc_LAW_34661/статья-14.16/',
		calc: {
			type: 'fixed',
			ip: { min: 50000, max: 200000 },
			legal: { min: 200000, max: 300000 },
		},
		confiscation: true,
		note: 'МРЦ устанавливает Росалкогольрегулирование приказами. На водку, коньяк, шампанское и пиво — отдельные значения. Конфискация продукции, реализованной ниже МРЦ.',
	},

	// Меркурий / ВетИС
	{
		id: 'merkuriy-no-vsd',
		group: 'merkuriy',
		label: 'Оборот продукции животноводства без ВСД',
		short: 'Приёмка, реализация или перевозка без оформленного ветеринарного сопроводительного документа',
		article: 'ст. 10.8 ч. 1 КоАП РФ',
		articleUrl: 'https://www.consultant.ru/document/cons_doc_LAW_34661/статья-10.8/',
		calc: {
			type: 'fixed',
			ip: { min: 3000, max: 5000 },
			legal: { min: 10000, max: 20000 },
		},
		note: 'Применяется при отсутствии ВСД в системе «Меркурий» при приёмке или отгрузке мяса, рыбы, молочной продукции и иных подконтрольных товаров. ИП несёт ответственность как должностное лицо.',
	},
	{
		id: 'merkuriy-late-quench',
		group: 'merkuriy',
		label: 'Нарушение правил перевозки подконтрольных товаров (просрочка гашения ВСД)',
		short: 'ВСД не погашен в установленный срок после получения груза',
		article: 'ст. 10.8 ч. 2 КоАП РФ',
		articleUrl: 'https://www.consultant.ru/document/cons_doc_LAW_34661/статья-10.8/',
		calc: {
			type: 'fixed',
			ip: { min: 5000, max: 7000 },
			legal: { min: 15000, max: 30000 },
		},
		note: 'Получатель обязан погасить ВСД в «Меркурии» в течение 1 рабочего дня с момента поступления товара. Просрочка — нарушение ч. 2 ст. 10.8. При систематических нарушениях возможна приостановка работы.',
	},
];
