import { useState, useCallback } from 'react';
import { SCENARIOS, SCENARIO_GROUPS, type Scenario, type ScenarioGroup } from '../data/penalties';

const formatRub = (v: number) =>
	new Intl.NumberFormat('ru-RU').format(Math.round(v)) + ' ₽';

type Subject = 'ip' | 'legal';

function calcFine(scenario: Scenario, subject: Subject, amount: number) {
	const c = scenario.calc;
	if (c.type === 'fixed') {
		const r = c[subject];
		return { min: r.min, max: r.max, kind: 'fixed' as const };
	}
	const r = c[subject];
	const baseMin = (amount * r.minPct) / 100;
	const baseMax = (amount * r.maxPct) / 100;
	return {
		min: Math.max(baseMin, r.floor),
		max: Math.max(baseMax, r.floor),
		kind: 'percent' as const,
		floor: r.floor,
		minPct: r.minPct,
		maxPct: r.maxPct,
	};
}

export default function PenaltyCalculator() {
	const [group, setGroup] = useState<ScenarioGroup>('kkt');
	const [scenarioId, setScenarioId] = useState('no-kkt');
	const [subject, setSubject] = useState<Subject>('ip');
	const [amount, setAmount] = useState('');

	const groupScenarios = SCENARIOS.filter((s) => s.group === group);

	const handleGroupChange = useCallback((g: ScenarioGroup) => {
		setGroup(g);
		const first = SCENARIOS.find((s) => s.group === g);
		if (first) setScenarioId(first.id);
	}, []);

	const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? groupScenarios[0];
	const isPercent = scenario?.calc.type === 'percent';
	const amountNum = parseFloat(amount) || 0;
	const result = scenario ? calcFine(scenario, subject, amountNum) : null;

	const range =
		result && result.min === result.max
			? formatRub(result.min)
			: result
			? `${formatRub(result.min)} — ${formatRub(result.max)}`
			: '';

	return (
		<div className="rcalc">
			{/* Шаг 1: группа */}
			<div className="rcalc-step">
				<p className="rcalc-label">1. Область нарушения</p>
				<div className="rcalc-pills">
					{(Object.keys(SCENARIO_GROUPS) as ScenarioGroup[]).map((g) => (
						<button
							key={g}
							type="button"
							className={`rcalc-pill${group === g ? ' rcalc-pill--active' : ''}`}
							onClick={() => handleGroupChange(g)}
						>
							{SCENARIO_GROUPS[g]}
						</button>
					))}
				</div>
			</div>

			{/* Шаг 2: сценарий */}
			<div className="rcalc-step">
				<label className="rcalc-label" htmlFor="rc-scenario">
					2. Что произошло?
				</label>
				<select
					id="rc-scenario"
					className="rcalc-select"
					value={scenarioId}
					onChange={(e) => setScenarioId(e.target.value)}
				>
					{groupScenarios.map((s) => (
						<option key={s.id} value={s.id}>
							{s.label}
						</option>
					))}
				</select>
			</div>

			{/* Шаг 3: субъект */}
			<div className="rcalc-step">
				<p className="rcalc-label">3. Кто нарушил?</p>
				<div className="rcalc-pills">
					<button
						type="button"
						className={`rcalc-pill${subject === 'ip' ? ' rcalc-pill--active' : ''}`}
						onClick={() => setSubject('ip')}
					>
						ИП / должностное лицо
					</button>
					<button
						type="button"
						className={`rcalc-pill${subject === 'legal' ? ' rcalc-pill--active' : ''}`}
						onClick={() => setSubject('legal')}
					>
						Юридическое лицо
					</button>
				</div>
			</div>

			{/* Шаг 4: сумма (только для процентных) */}
			{isPercent && (
				<div className="rcalc-step">
					<label className="rcalc-label" htmlFor="rc-amount">
						4. Сумма расчёта без ККТ, ₽
					</label>
					<input
						id="rc-amount"
						type="number"
						className="rcalc-input"
						min="0"
						step="100"
						inputMode="numeric"
						placeholder="например, 50 000"
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
					/>
					<small className="rcalc-hint">
						Сумма всех продаж, проведённых без кассы.
					</small>
				</div>
			)}

			{/* Результат */}
			{result && scenario && (
				<div className="rcalc-result" key={`${scenarioId}-${subject}-${amount}`}>
					<p className="rcalc-result-label">
						Размер штрафа для «{subject === 'ip' ? 'ИП / должностное лицо' : 'юридическое лицо'}»
					</p>
					<p className="rcalc-result-amount">{range}</p>
					<p className="rcalc-result-article">{scenario.article}</p>

					{result.kind === 'percent' && (
						<p className="rcalc-result-hint">
							{amountNum > 0
								? `Расчёт: ${result.minPct}–${result.maxPct}% от суммы, но не менее ${formatRub(result.floor)}.`
								: `Введите сумму расчёта выше. Минимум — ${formatRub(result.floor)}.`}
						</p>
					)}

					{scenario.confiscation && (
						<p className="rcalc-result-conf">Дополнительно — конфискация продукции.</p>
					)}

					{scenario.note && (
						<p className="rcalc-result-note">{scenario.note}</p>
					)}
				</div>
			)}

			<style>{`
				.rcalc {
					background: var(--accent-soft);
					border-radius: 12px;
					padding: 1.5rem;
					max-width: 820px;
					display: flex;
					flex-direction: column;
					gap: 1.2rem;
					margin-top: 1.5rem;
				}
				.rcalc-step {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;
				}
				.rcalc-label {
					font-weight: 600;
					font-size: 0.92rem;
					color: rgb(30, 41, 59);
					margin: 0;
				}
				.rcalc-pills {
					display: flex;
					flex-wrap: wrap;
					gap: 0.5rem;
				}
				.rcalc-pill {
					padding: 0.45em 1em;
					border-radius: 999px;
					border: 1.5px solid #93c5fd;
					background: #fff;
					color: rgb(30, 41, 59);
					font-size: 0.9rem;
					cursor: pointer;
					transition: all 0.15s ease;
					font-family: inherit;
					text-align: left;
					word-break: break-word;
					hyphens: auto;
				}
				.rcalc-pill:hover {
					border-color: #1d4ed8;
					background: #eff6ff;
				}
				.rcalc-pill--active {
					background: #1d4ed8;
					border-color: #1d4ed8;
					color: #fff;
				}
				.rcalc-select,
				.rcalc-input {
					padding: 0.65em 0.9em;
					border: 1px solid rgb(226, 232, 240);
					border-radius: 8px;
					font-size: 1rem;
					font-family: inherit;
					background: #fff;
					color: rgb(30, 41, 59);
					max-width: 100%;
				}
				.rcalc-select:focus,
				.rcalc-input:focus {
					outline: 2px solid #1d4ed8;
					outline-offset: 1px;
				}
				.rcalc-hint {
					font-size: 0.82rem;
					color: rgb(100, 116, 139);
				}
				.rcalc-result {
					background: #fff;
					border: 1px solid rgb(226, 232, 240);
					border-left: 4px solid #1d4ed8;
					border-radius: 10px;
					padding: 1.4rem;
					animation: rcalc-fade 0.2s ease;
				}
				@keyframes rcalc-fade {
					from { opacity: 0; transform: translateY(6px); }
					to   { opacity: 1; transform: translateY(0); }
				}
				.rcalc-result-label {
					font-size: 0.9rem;
					color: rgb(100, 116, 139);
					margin: 0;
				}
				.rcalc-result-amount {
					font-size: 2rem;
					font-weight: 700;
					color: rgb(15, 23, 42);
					margin: 0.3rem 0 0.5rem;
				}
				.rcalc-result-article {
					font-size: 1rem;
					color: #1d4ed8;
					font-weight: 600;
					margin: 0 0 0.5rem;
				}
				.rcalc-result-hint {
					font-size: 0.9rem;
					color: rgb(30, 41, 59);
					margin: 0 0 0.4rem;
				}
				.rcalc-result-conf {
					font-size: 0.92rem;
					color: #b45309;
					background: #fef3c7;
					padding: 0.5em 0.8em;
					border-radius: 6px;
					margin: 0.6rem 0 0;
				}
				.rcalc-result-note {
					font-size: 0.88rem;
					color: rgb(30, 41, 59);
					border-top: 1px solid rgb(226, 232, 240);
					padding-top: 0.8rem;
					margin: 0.8rem 0 0;
				}
			`}</style>
		</div>
	);
}
