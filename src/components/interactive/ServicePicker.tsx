import { useState } from 'react';
import { u } from '../../utils/url';
import { track, trackOnce } from '../../utils/track';

// Полностраничный мастер-подбор сервиса Контура (верх воронки).
// 3 шага с дорожкой прогресса. Ведёт на страницу продукта
// /produkty/<slug>/, где лежит лид-форма. События в Метрику:
//   podbor-started        — на первый ответ (один раз)
//   podbor-result {product} — при показе результата
//   podbor-cta-click {product} — клик «Открыть сервис»

// Приоритетная задача — шаг 1.
type Task =
	| 'kassa'
	| 'buh'
	| 'edo'
	| 'kadry'
	| 'proverka'
	| 'schet';

type Step = 'q1' | 'q2' | 'result';

interface Product {
	name: string;
	tagline: string;
	description: string;
	color: string;
	abbrev: string;
	slug: string;
}

// Данные продуктов. Формулировки переиспользованы из
// src/data/cpa-banners.ts и src/components/Quiz.tsx.
const PRODUCTS: Record<string, Product> = {
	'kontur-market': {
		name: 'Контур.Маркет',
		tagline: 'Касса и учёт маркированного товара',
		description:
			'Кассовая программа по 54-ФЗ, модуль ТС ПИоТ для разрешительного режима и товарный учёт с кодами «Честного знака». ЕГАИС для алкоголя. Бесплатный доступ 14 дней.',
		color: '#1A3A6C',
		abbrev: 'МРТ',
		slug: 'kontur-market',
	},
	'kontur-ofd': {
		name: 'Контур.ОФД',
		tagline: 'Передача чеков в ФНС по 54-ФЗ',
		description:
			'Оператор фискальных данных: передача чеков в ФНС, регистрация и перерегистрация кассы онлайн без визита в налоговую. Совместим со всеми моделями касс. Единый кабинет с аналитикой продаж.',
		color: '#1A3A6C',
		abbrev: 'ОФД',
		slug: 'kontur-ofd',
	},
	'kontur-markirovka': {
		name: 'Контур.Маркировка',
		tagline: 'Маркировка под ключ для производства',
		description:
			'Полный цикл: заказ и нанесение кодов маркировки, поэкземплярный учёт, вывод товара из оборота. Интеграция с 1С, ERP и «Честным знаком». Для производителей, импортёров и оптовиков.',
		color: '#9E2B4F',
		abbrev: 'МК',
		slug: 'kontur-markirovka',
	},
	'kontur-elba': {
		name: 'Контур.Эльба',
		tagline: 'Бухгалтерия для ИП и небольших ООО',
		description:
			'Считает налоги и страховые взносы, формирует уведомления по ЕНС, сдаёт отчётность в ФНС и СФР. Выставление счетов и актов. Подходит ИП и небольшим ООО на УСН без штатного бухгалтера.',
		color: '#C25000',
		abbrev: 'ЭЛБ',
		slug: 'kontur-elba',
	},
	'kontur-extern': {
		name: 'Контур.Экстерн',
		tagline: 'Отчётность для компании на любом режиме',
		description:
			'Отчётность в ФНС, СФР и Росстат, сверка с ЕНС, актуальные формы деклараций. Электронная подпись в комплекте. Мультипользовательский доступ для бухгалтеров и компаний на любом режиме налогообложения.',
		color: '#1A3A6C',
		abbrev: 'ЭКС',
		slug: 'kontur-extern',
	},
	'kontur-diadoc': {
		name: 'Контур.Диадок',
		tagline: 'ЭДО с поставщиками и покупателями',
		description:
			'Юридически значимый обмен УПД, счетами-фактурами и актами через аккредитованного оператора. Приёмка УПД с кодами маркировки, передача сведений в «Честный знак». Интеграция с 1С и учётными системами.',
		color: '#007A6E',
		abbrev: 'ДД',
		slug: 'kontur-diadoc',
	},
	'diadoc-kedo': {
		name: 'Диадок: КЭДО',
		tagline: 'Кадровый документооборот без бумаги',
		description:
			'Трудовые договоры, приказы и заявления без бумаги и курьеров. Юридически значимый КЭДО по ТК РФ, интеграция с 1С:ЗУП. Для компаний с наёмными сотрудниками, которые переходят на электронный кадровый учёт.',
		color: '#007A6E',
		abbrev: 'КДО',
		slug: 'diadoc-kedo',
	},
	'kontur-mchd': {
		name: 'Контур.Доверенность',
		tagline: 'Машиночитаемая доверенность онлайн',
		description:
			'Оформление МЧД онлайн без визита в офис, хранение в распределённом реестре ФНС. Сотрудники подписывают документы от имени компании своей электронной подписью. Соответствие требованиям с 01.09.2024.',
		color: '#4A1A7A',
		abbrev: 'МЧД',
		slug: 'kontur-mchd',
	},
	'kontur-focus': {
		name: 'Контур.Фокус',
		tagline: 'Проверка контрагентов перед сделкой',
		description:
			'Данные из ЕГРЮЛ и ЕГРИП, судов и реестров ФНС. Проверка директора и учредителей, арбитражные дела и банкротства, мониторинг изменений контрагентов. Снижает налоговые риски до сделки.',
		color: '#2D6A4F',
		abbrev: 'ФОК',
		slug: 'kontur-focus',
	},
	'bank-elba': {
		name: 'Контур.Банк + Эльба',
		tagline: 'Расчётный счёт с бухгалтерией',
		description:
			'Открытие расчётного счёта онлайн, тариф «Ноль» с обслуживанием 0 ₽. В комплекте — Эльба для расчёта налогов и отчётности. Без скрытых комиссий. Для ИП и ООО, которым нужен счёт и учёт в одном окне.',
		color: '#0A5C36',
		abbrev: 'БНК',
		slug: 'bank-elba',
	},
};

// Уточняющие вопросы по ветке шага 1.
interface FollowupOption {
	value: string;
	title: string;
	hint: string;
	product: string;
}
interface Followup {
	question: string;
	options: FollowupOption[];
}

const FOLLOWUPS: Partial<Record<Task, Followup>> = {
	kassa: {
		question: 'Торгуете маркированным товаром?',
		options: [
			{
				value: 'marked',
				title: 'Да',
				hint: 'Молочная продукция, одежда, обувь, вода, лекарства, табак и другие категории «Честного знака»',
				product: 'kontur-market',
			},
			{
				value: 'unmarked',
				title: 'Нет',
				hint: 'Услуги, общепит или товары без обязательной маркировки',
				product: 'kontur-ofd',
			},
		],
	},
	buh: {
		question: 'Как зарегистрирован бизнес?',
		options: [
			{
				value: 'ip',
				title: 'ИП',
				hint: 'Индивидуальный предприниматель на УСН или патенте без штатного бухгалтера',
				product: 'kontur-elba',
			},
			{
				value: 'ooo',
				title: 'ООО или другая организация',
				hint: 'Юридическое лицо, полная отчётность в ФНС, СФР и Росстат',
				product: 'kontur-extern',
			},
		],
	},
};

// Ветки без уточнения — сразу результат.
const DIRECT: Partial<Record<Task, string>> = {
	edo: 'kontur-diadoc',
	kadry: 'diadoc-kedo',
	proverka: 'kontur-focus',
	schet: 'bank-elba',
};

interface TaskOption {
	value: Task;
	title: string;
	hint: string;
}

const TASKS: TaskOption[] = [
	{
		value: 'kassa',
		title: 'Касса и маркировка',
		hint: 'Онлайн-касса по 54-ФЗ, передача чеков в ФНС, ТС ПИоТ и коды «Честного знака»',
	},
	{
		value: 'buh',
		title: 'Бухгалтерия и налоги',
		hint: 'Расчёт налогов, уведомления по ЕНС, декларации и первичные документы',
	},
	{
		value: 'edo',
		title: 'Документы с контрагентами (ЭДО)',
		hint: 'УПД, счета-фактуры, акты и накладные через электронный документооборот',
	},
	{
		value: 'kadry',
		title: 'Кадровый ЭДО',
		hint: 'Трудовые договоры, приказы и заявления сотрудников без бумаги',
	},
	{
		value: 'proverka',
		title: 'Проверка контрагентов',
		hint: 'Данные из ЕГРЮЛ, судов и реестров перед сделкой',
	},
	{
		value: 'schet',
		title: 'Расчётный счёт с бухгалтерией',
		hint: 'Открытие счёта онлайн и учёт налогов в одном окне',
	},
];

export default function ServicePicker() {
	const [step, setStep] = useState<Step>('q1');
	const [task, setTask] = useState<Task | null>(null);
	const [product, setProduct] = useState<Product | null>(null);

	// Если у ветки есть уточнение — всего 2 шага, иначе 1.
	const totalSteps = task && FOLLOWUPS[task] ? 2 : 1;
	const stepNumber = step === 'q1' ? 1 : 2;

	const reset = () => {
		setStep('q1');
		setTask(null);
		setProduct(null);
	};

	const showResult = (slug: string) => {
		const p = PRODUCTS[slug] ?? null;
		setProduct(p);
		setStep('result');
		if (p) track('podbor-result', { product: p.slug });
	};

	const handleTask = (value: Task) => {
		trackOnce('podbor-started');
		setTask(value);
		const followup = FOLLOWUPS[value];
		if (followup) {
			setStep('q2');
		} else {
			showResult(DIRECT[value]!);
		}
	};

	const handleFollowup = (slug: string) => {
		showResult(slug);
	};

	const handleCta = (slug: string) => {
		track('podbor-cta-click', { product: slug });
	};

	// Дорожка прогресса: сегменты + подпись «Шаг N из M».
	// На результате показываем все сегменты как пройденные.
	const totalForBar = step === 'result' ? Math.max(totalSteps, 1) : totalSteps;
	const doneForBar = step === 'result' ? totalForBar : stepNumber;

	return (
		<div className="picker">
			<style>{`
				.picker { max-width: 640px; margin: 0 auto; }

				.picker-progress {
					display: flex;
					align-items: center;
					gap: .75rem;
					margin-bottom: 1.75rem;
				}
				.picker-segments {
					display: flex;
					gap: 6px;
					flex: 1;
				}
				.picker-seg {
					height: 6px;
					flex: 1;
					background: rgba(0,0,0,.1);
					border-radius: 999px;
					transition: background .2s ease;
				}
				.picker-seg.is-done { background: var(--pink, #ff4d8f); }
				.picker-step-label {
					font-size: .68rem;
					font-weight: 700;
					letter-spacing: .12em;
					text-transform: uppercase;
					color: #888;
					white-space: nowrap;
				}

				.picker-question {
					font-family: 'Bebas Neue', sans-serif;
					font-size: clamp(1.7rem, 5vw, 2.4rem);
					letter-spacing: .03em;
					line-height: 1.05;
					color: #111;
					margin: 0 0 1.5rem;
					text-transform: uppercase;
				}
				.picker-options {
					display: flex;
					flex-direction: column;
					gap: 10px;
					margin-bottom: 1.25rem;
				}
				.picker-opt {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					gap: 4px;
					background: #fff;
					border: 2px solid rgba(0,0,0,.1);
					border-radius: 12px;
					padding: 1rem 1.25rem;
					cursor: pointer;
					text-align: left;
					width: 100%;
					transition: border-color .12s ease, transform .12s ease;
				}
				.picker-opt:hover {
					border-color: #111;
					transform: translateY(-2px);
				}
				.picker-opt strong {
					font-size: .98rem;
					font-weight: 700;
					color: #111;
				}
				.picker-opt span {
					font-size: .85rem;
					color: #666;
					line-height: 1.45;
				}
				.picker-back {
					background: none;
					border: none;
					cursor: pointer;
					font-size: .75rem;
					font-weight: 600;
					letter-spacing: .08em;
					color: #999;
					padding: 0;
					transition: color .15s ease;
				}
				.picker-back:hover { color: #111; }

				/* Результат */
				.picker-result {
					background: #fff;
					border: 2px solid rgba(0,0,0,.1);
					border-radius: 16px;
					padding: 2rem 2rem 1.75rem;
					text-align: center;
				}
				.picker-badge {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					min-width: 72px;
					height: 72px;
					padding: 0 .6rem;
					border-radius: 12px;
					font-family: 'Bebas Neue', sans-serif;
					font-size: 1.4rem;
					letter-spacing: .06em;
					color: #fff;
					margin-bottom: 1.25rem;
				}
				.picker-result-eyebrow {
					font-size: .72rem;
					font-weight: 700;
					letter-spacing: .12em;
					text-transform: uppercase;
					color: var(--pink, #ff4d8f);
					margin: 0 0 .5rem;
				}
				.picker-product-name {
					font-family: 'Bebas Neue', sans-serif;
					font-size: clamp(1.9rem, 5vw, 2.6rem);
					letter-spacing: .03em;
					text-transform: uppercase;
					color: #111;
					margin: 0 0 .25rem;
				}
				.picker-product-tagline {
					font-size: .85rem;
					font-weight: 600;
					letter-spacing: .04em;
					text-transform: uppercase;
					color: #888;
					margin: 0 0 1.25rem;
				}
				.picker-product-desc {
					font-size: .95rem;
					color: #444;
					line-height: 1.6;
					margin: 0 0 1.75rem;
					text-align: left;
				}
				.picker-cta {
					display: block;
					background: #111;
					color: var(--lime, #afcc00);
					text-decoration: none;
					padding: .85em 1.4em;
					border-radius: 10px;
					font-size: .82rem;
					font-weight: 700;
					letter-spacing: .08em;
					text-transform: uppercase;
					text-align: center;
					margin-bottom: .9rem;
					transition: background .12s ease, color .12s ease;
				}
				.picker-cta:hover { background: #9E2B4F; color: #fff; }
				.picker-alt {
					display: inline-block;
					font-size: .82rem;
					font-weight: 600;
					color: var(--pink, #ff4d8f);
					text-decoration: none;
					margin-bottom: 1rem;
				}
				.picker-alt:hover { text-decoration: underline; }
				.picker-restart {
					display: block;
					background: none;
					border: none;
					cursor: pointer;
					font-size: .75rem;
					font-weight: 600;
					letter-spacing: .06em;
					color: #999;
					text-decoration: underline;
					text-underline-offset: 3px;
					padding: 0;
					margin: 0 auto;
					transition: color .15s ease;
				}
				.picker-restart:hover { color: #111; }

				@media (max-width: 560px) {
					.picker-result { padding: 1.5rem 1.25rem 1.5rem; }
				}
			`}</style>

			{step !== 'result' && (
				<div className="picker-progress">
					<div className="picker-segments">
						{Array.from({ length: totalSteps }).map((_, i) => (
							<div
								key={i}
								className={`picker-seg${i < stepNumber ? ' is-done' : ''}`}
							/>
						))}
					</div>
					<div className="picker-step-label">
						Шаг {stepNumber} из {totalSteps}
					</div>
				</div>
			)}

			{step === 'q1' && (
				<div>
					<h2 className="picker-question">Какая задача в приоритете?</h2>
					<div className="picker-options">
						{TASKS.map(opt => (
							<button
								key={opt.value}
								className="picker-opt"
								onClick={() => handleTask(opt.value)}
							>
								<strong>{opt.title}</strong>
								<span>{opt.hint}</span>
							</button>
						))}
					</div>
				</div>
			)}

			{step === 'q2' && task && FOLLOWUPS[task] && (
				<div>
					<h2 className="picker-question">{FOLLOWUPS[task]!.question}</h2>
					<div className="picker-options">
						{FOLLOWUPS[task]!.options.map(opt => (
							<button
								key={opt.value}
								className="picker-opt"
								onClick={() => handleFollowup(opt.product)}
							>
								<strong>{opt.title}</strong>
								<span>{opt.hint}</span>
							</button>
						))}
					</div>
					<button className="picker-back" onClick={() => setStep('q1')}>
						← Назад
					</button>
				</div>
			)}

			{step === 'result' && product && (
				<div className="picker-result">
					<div
						className="picker-badge"
						style={{ background: product.color }}
					>
						{product.abbrev}
					</div>
					<p className="picker-result-eyebrow">Под вашу задачу подходит</p>
					<div className="picker-product-name">{product.name}</div>
					<div className="picker-product-tagline">{product.tagline}</div>
					<p className="picker-product-desc">{product.description}</p>
					<a
						href={u(`/produkty/${product.slug}/`)}
						className="picker-cta"
						onClick={() => handleCta(product.slug)}
					>
						Открыть сервис →
					</a>
					<a href={u('/sravneniya/')} className="picker-alt">
						Сравнить варианты
					</a>
					<button className="picker-restart" onClick={reset}>
						Пройти ещё раз
					</button>
				</div>
			)}
		</div>
	);
}
