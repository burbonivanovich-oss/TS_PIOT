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

export type Scenario = {
	id: string;
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

export const SCENARIOS: Scenario[] = [
	{
		id: 'no-kkt',
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
];
