import { useState } from 'react';

type Q1 = 'ip' | 'ooo';
type Q2 = 'marked' | 'unmarked';
type Q3 = 'kassa' | 'buh' | 'edo' | 'reporting';
type Q4 = 'usn' | 'osno';
type Step = 'q1' | 'q2' | 'q3' | 'q4' | 'result';

interface Product {
	name: string;
	tagline: string;
	description: string;
	cta: string;
	href: string;
	color: string;
	abbrev: string;
}

const PRODUCTS: Record<string, Product> = {
	'ip-kassa-unmarked': {
		name: 'Контур.ОФД',
		tagline: 'Передача чеков в ФНС онлайн',
		description:
			'Аккредитованный оператор фискальных данных. Подключение онлайн за 15 минут, единый кабинет для всех касс, техподдержка 24/7. Первые 3 месяца бесплатно для новых клиентов.',
		cta: 'Подключить Контур.ОФД',
		href: 'https://kontur.ru/ofd/price?p=f74746',
		color: '#C8003A',
		abbrev: 'ОФД',
	},
	'ip-kassa-marked': {
		name: 'Контур.ОФД',
		tagline: 'ОФД с поддержкой «Честного знака» и ТС ПИоТ',
		description:
			'Полная поддержка разрешительного режима: проверка кодов маркировки при продаже, передача данных в ГИС МТ. Готовность к ТС ПИоТ с 01.07.2026. Первые 3 месяца бесплатно.',
		cta: 'Подключить Контур.ОФД',
		href: 'https://kontur.ru/ofd/price?p=f74746',
		color: '#C8003A',
		abbrev: 'ОФД',
	},
	'ip-buh-usn': {
		name: 'Контур.Эльба',
		tagline: 'Бухгалтерия для ИП на УСН и патенте',
		description:
			'Считает налоги, формирует декларации, сдаёт отчёты в ФНС и СФР — автоматически. Без бухгалтера. Подходит ИП на УСН (доходы, доходы минус расходы) и патенте. Первый год бесплатно для новых ИП.',
		cta: 'Попробовать Контур.Эльба',
		href: 'https://e-kontur.ru/?p=f74746',
		color: '#1E4A7A',
		abbrev: 'ЭЛБ',
	},
	'ip-buh-osno': {
		name: 'Контур.Бухгалтерия',
		tagline: 'Онлайн-бухгалтерия для ИП на ОСНО',
		description:
			'Учёт НДС, НДФЛ, страховых взносов. Выставление счетов, первичка, зарплата сотрудников. Совместная работа с бухгалтером в одном кабинете. Пробный период 14 дней.',
		cta: 'Попробовать Контур.Бухгалтерию',
		href: 'https://kontur.ru/buhgalteriya?p=f74746',
		color: '#1E4A7A',
		abbrev: 'БУХ',
	},
	'ip-edo': {
		name: 'Контур.Диадок',
		tagline: 'ЭДО с поставщиками и покупателями',
		description:
			'Юридически значимый обмен УПД с кодами маркировки, счетами-фактурами и актами через аккредитованного оператора. Без бумаги и почты. Входящие документы — бесплатно.',
		cta: 'Начать с Контур.Диадок',
		href: 'https://diadoc.ru/order?p=f74746',
		color: '#1E4A7A',
		abbrev: 'ДДК',
	},
	'ip-reporting': {
		name: 'Контур.Экстерн',
		tagline: 'Отчётность в ФНС, СФР и Росстат',
		description:
			'Сдача деклараций и расчётов онлайн прямо из браузера. Проверка перед отправкой, уведомления о статусе, квитанции. Подходит ИП, которым нужна отчётность без полного бухучёта.',
		cta: 'Попробовать Контур.Экстерн',
		href: 'https://kontur-extern.ru/price?p=f74746',
		color: '#1A5C3A',
		abbrev: 'ЭКС',
	},
	'ooo-kassa-unmarked': {
		name: 'Контур.ОФД',
		tagline: 'ОФД для сетей и нескольких торговых точек',
		description:
			'Пакетные тарифы для сетей, единый кабинет для нескольких касс. Интеграция с популярными кассовыми системами, аналитика продаж, бесплатные уведомления об ошибках ФН.',
		cta: 'Подключить Контур.ОФД',
		href: 'https://kontur.ru/ofd/price?p=f74746',
		color: '#C8003A',
		abbrev: 'ОФД',
	},
	'ooo-kassa-marked': {
		name: 'Контур.ОФД',
		tagline: 'ОФД с маркировкой и ТС ПИоТ для организации',
		description:
			'Пакетные тарифы для сетей, поддержка разрешительного режима «Честного знака», передача данных в ГИС МТ. Готовность к ТС ПИоТ с 01.07.2026. Единый кабинет для всех точек.',
		cta: 'Подключить Контур.ОФД',
		href: 'https://kontur.ru/ofd/price?p=f74746',
		color: '#C8003A',
		abbrev: 'ОФД',
	},
	'ooo-buh': {
		name: 'Контур.Бухгалтерия',
		tagline: 'Онлайн-бухгалтерия для ООО',
		description:
			'Учёт, зарплата, налоги и отчётность для ООО на УСН и ОСНО. Несколько сотрудников в одном кабинете, интеграция с банком и ЭДО. Пробный период 14 дней.',
		cta: 'Попробовать Контур.Бухгалтерию',
		href: 'https://kontur.ru/buhgalteriya?p=f74746',
		color: '#1E4A7A',
		abbrev: 'БУХ',
	},
	'ooo-edo': {
		name: 'Контур.Диадок',
		tagline: 'ЭДО для компаний с поставщиками',
		description:
			'Обмен документами с любым контрагентом, поддержка УПД с кодами маркировки. Интегрируется с 1С, SAP и другими учётными системами. Роуминг с другими ЭДО-операторами.',
		cta: 'Начать с Контур.Диадок',
		href: 'https://diadoc.ru/order?p=f74746',
		color: '#1E4A7A',
		abbrev: 'ДДК',
	},
	'ooo-reporting': {
		name: 'Контур.Экстерн',
		tagline: 'Отчётность и сверки для организации',
		description:
			'Декларации по НДС, налогу на прибыль, имущество. РСВ, 6-НДФЛ, отчёты в СФР и Росстат. Выгрузка из 1С, проверка на ошибки, квитанции о приёме. Мультипользовательский доступ.',
		cta: 'Попробовать Контур.Экстерн',
		href: 'https://kontur-extern.ru/price?p=f74746',
		color: '#1A5C3A',
		abbrev: 'ЭКС',
	},
};

export default function Quiz() {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<Step>('q1');
	const [q1, setQ1] = useState<Q1 | null>(null);
	const [q2, setQ2] = useState<Q2 | null>(null);
	const [q3, setQ3] = useState<Q3 | null>(null);
	const [product, setProduct] = useState<Product | null>(null);

	const reset = () => {
		setStep('q1');
		setQ1(null);
		setQ2(null);
		setQ3(null);
		setProduct(null);
	};

	const close = () => {
		setOpen(false);
		setTimeout(reset, 300);
	};

	const handleQ1 = (answer: Q1) => {
		setQ1(answer);
		setStep('q2');
	};

	const handleQ2 = (answer: Q2) => {
		setQ2(answer);
		setStep('q3');
	};

	const handleQ3 = (answer: Q3) => {
		setQ3(answer);
		if (answer === 'buh' && q1 === 'ip') {
			setStep('q4');
		} else {
			const key = answer === 'kassa'
				? `${q1}-kassa-${q2 ?? 'unmarked'}`
				: `${q1}-${answer}`;
			setProduct(PRODUCTS[key] ?? null);
			setStep('result');
		}
	};

	const handleQ4 = (answer: Q4) => {
		setProduct(PRODUCTS[`ip-buh-${answer}`] ?? null);
		setStep('result');
	};

	const totalSteps = q1 === 'ip' && q3 === 'buh' ? 4 : 3;

	const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.target === e.currentTarget) close();
	};

	return (
		<>
			<style>{`
				.quiz-trigger {
					background: none;
					border: none;
					padding: 0;
					cursor: pointer;
					font-size: .78rem;
					font-weight: 700;
					letter-spacing: .1em;
					text-transform: uppercase;
					color: #888;
					text-decoration: underline;
					text-underline-offset: 3px;
					transition: color .15s;
				}
				.quiz-trigger:hover { color: #111; }

				.quiz-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0,0,0,.55);
					z-index: 200;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 16px;
					backdrop-filter: blur(2px);
				}
				.quiz-modal {
					background: #fff;
					width: 100%;
					max-width: 520px;
					position: relative;
					padding: 40px 40px 36px;
					box-shadow: 0 24px 64px rgba(0,0,0,.2);
				}
				.quiz-close {
					position: absolute;
					top: 16px;
					right: 16px;
					background: none;
					border: none;
					cursor: pointer;
					font-size: 1.1rem;
					color: #aaa;
					line-height: 1;
					padding: 4px;
					transition: color .15s;
				}
				.quiz-close:hover { color: #111; }

				.quiz-step {
					font-size: .65rem;
					font-weight: 700;
					letter-spacing: .12em;
					text-transform: uppercase;
					color: #aaa;
					margin-bottom: 16px;
				}
				.quiz-question {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 2rem;
					letter-spacing: .04em;
					line-height: 1.05;
					color: #111;
					margin: 0 0 24px;
					text-transform: uppercase;
				}
				.quiz-options {
					display: flex;
					flex-direction: column;
					gap: 8px;
					margin-bottom: 20px;
				}
				.quiz-opt {
					display: flex;
					flex-direction: column;
					align-items: flex-start;
					gap: 3px;
					background: #F6F4F0;
					border: 1px solid transparent;
					padding: 16px 20px;
					cursor: pointer;
					text-align: left;
					transition: border-color .12s, background .12s;
					width: 100%;
				}
				.quiz-opt:hover {
					background: #EDE8DF;
					border-color: rgba(0,0,0,.15);
				}
				.quiz-opt strong {
					font-size: .88rem;
					font-weight: 700;
					color: #111;
					letter-spacing: .01em;
				}
				.quiz-opt span {
					font-size: .78rem;
					color: #666;
					line-height: 1.4;
				}
				.quiz-back {
					background: none;
					border: none;
					cursor: pointer;
					font-size: .72rem;
					font-weight: 600;
					letter-spacing: .08em;
					color: #999;
					padding: 0;
					transition: color .15s;
				}
				.quiz-back:hover { color: #111; }

				/* Result */
				.quiz-result { text-align: center; }
				.quiz-badge {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 64px;
					height: 64px;
					font-family: 'Bebas Neue', sans-serif;
					font-size: 1.1rem;
					letter-spacing: .08em;
					color: #fff;
					margin-bottom: 20px;
				}
				.quiz-product-name {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 2.2rem;
					letter-spacing: .04em;
					color: #111;
					margin-bottom: 4px;
				}
				.quiz-product-tagline {
					font-size: .8rem;
					font-weight: 600;
					letter-spacing: .06em;
					text-transform: uppercase;
					color: #888;
					margin-bottom: 20px;
				}
				.quiz-product-desc {
					font-size: .9rem;
					color: #444;
					line-height: 1.6;
					margin-bottom: 28px;
					text-align: left;
				}
				.quiz-cta {
					display: block;
					background: #111;
					color: #AFCC00;
					text-decoration: none;
					padding: .7em 1.4em;
					font-size: .78rem;
					font-weight: 700;
					letter-spacing: .1em;
					text-transform: uppercase;
					text-align: center;
					margin-bottom: 12px;
					transition: background .12s;
				}
				.quiz-cta:hover { background: #9E2B4F; color: #fff; }
				.quiz-restart {
					background: none;
					border: none;
					cursor: pointer;
					font-size: .72rem;
					font-weight: 600;
					letter-spacing: .08em;
					color: #999;
					text-decoration: underline;
					text-underline-offset: 3px;
					padding: 0;
					transition: color .15s;
				}
				.quiz-restart:hover { color: #111; }

				@media (max-width: 560px) {
					.quiz-modal { padding: 28px 20px 24px; }
					.quiz-question { font-size: 1.6rem; }
				}
			`}</style>

			<button className="quiz-trigger" onClick={() => setOpen(true)}>
				Подобрать сервис для вашего бизнеса
			</button>

			{open && (
				<div className="quiz-overlay" onClick={handleOverlayClick}>
					<div className="quiz-modal">
						<button className="quiz-close" onClick={close} aria-label="Закрыть">✕</button>

						{step === 'q1' && (
							<div>
								<div className="quiz-step">Вопрос 1 из 3</div>
								<h2 className="quiz-question">Как зарегистрирован ваш бизнес?</h2>
								<div className="quiz-options">
									<button className="quiz-opt" onClick={() => handleQ1('ip')}>
										<strong>ИП</strong>
										<span>Индивидуальный предприниматель на УСН, патенте или ОСНО</span>
									</button>
									<button className="quiz-opt" onClick={() => handleQ1('ooo')}>
										<strong>ООО или другая организация</strong>
										<span>Юридическое лицо, несколько собственников или подразделений</span>
									</button>
								</div>
							</div>
						)}

						{step === 'q2' && (
							<div>
								<div className="quiz-step">Вопрос 2 из 3</div>
								<h2 className="quiz-question">Торгуете маркированными товарами?</h2>
								<div className="quiz-options">
									<button className="quiz-opt" onClick={() => handleQ2('marked')}>
										<strong>Да</strong>
										<span>Молочная продукция, одежда, обувь, вода, лекарства, табак и другие категории «Честного знака»</span>
									</button>
									<button className="quiz-opt" onClick={() => handleQ2('unmarked')}>
										<strong>Нет</strong>
										<span>Услуги, общепит или товары без обязательной маркировки</span>
									</button>
								</div>
								<button className="quiz-back" onClick={() => setStep('q1')}>← Назад</button>
							</div>
						)}

						{step === 'q3' && (
							<div>
								<div className="quiz-step">Вопрос 3 из {totalSteps}</div>
								<h2 className="quiz-question">Что решаем в первую очередь?</h2>
								<div className="quiz-options">
									<button className="quiz-opt" onClick={() => handleQ3('kassa')}>
										<strong>Касса, ОФД и учёт маркировки</strong>
										<span>Фискальные данные в ФНС, «Честный знак», ТС ПИоТ</span>
									</button>
									<button className="quiz-opt" onClick={() => handleQ3('buh')}>
										<strong>Бухгалтерия и налоги</strong>
										<span>Декларации, взносы, расчёт налогов, первичные документы</span>
									</button>
									<button className="quiz-opt" onClick={() => handleQ3('edo')}>
										<strong>Документы с контрагентами</strong>
										<span>УПД, счета-фактуры, акты и накладные через ЭДО</span>
									</button>
									<button className="quiz-opt" onClick={() => handleQ3('reporting')}>
										<strong>Отчётность в ФНС, СФР и Росстат</strong>
										<span>Декларации и расчёты без ведения полного бухучёта</span>
									</button>
								</div>
								<button className="quiz-back" onClick={() => setStep('q2')}>← Назад</button>
							</div>
						)}

						{step === 'q4' && (
							<div>
								<div className="quiz-step">Вопрос 4 из 4</div>
								<h2 className="quiz-question">Режим налогообложения?</h2>
								<div className="quiz-options">
									<button className="quiz-opt" onClick={() => handleQ4('usn')}>
										<strong>УСН или патент</strong>
										<span>Упрощённая система (6% или 15%) или патентная система</span>
									</button>
									<button className="quiz-opt" onClick={() => handleQ4('osno')}>
										<strong>ОСНО</strong>
										<span>Общая система — НДС, НДФЛ, налог на имущество</span>
									</button>
								</div>
								<button className="quiz-back" onClick={() => setStep('q3')}>← Назад</button>
							</div>
						)}

						{step === 'result' && product && (
							<div className="quiz-result">
								<div className="quiz-badge" style={{ background: product.color }}>
									{product.abbrev}
								</div>
								<div className="quiz-product-name">{product.name}</div>
								<div className="quiz-product-tagline">{product.tagline}</div>
								<p className="quiz-product-desc">{product.description}</p>
								<a href={product.href} className="quiz-cta">{product.cta} →</a>
								<button className="quiz-restart" onClick={reset}>Пройти ещё раз</button>
							</div>
						)}
					</div>
				</div>
			)}
		</>
	);
}
