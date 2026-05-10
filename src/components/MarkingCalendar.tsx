import { useState, useMemo } from 'react';
import { MARKING_CALENDAR, MARKING_GROUPS } from '../data/markingCalendar';

const STATUS_LABELS: Record<string, string> = {
	active: 'Действует',
	upcoming: 'С 2026 года',
	soon: 'Скоро',
};

const STATUS_COLORS: Record<string, string> = {
	active: '#16a34a',
	upcoming: '#d97706',
	soon: '#dc2626',
};

const STATUS_BG: Record<string, string> = {
	active: '#f0fdf4',
	upcoming: '#fffbeb',
	soon: '#fef2f2',
};

export default function MarkingCalendar() {
	const [selectedGroup, setSelectedGroup] = useState<string>('all');
	const [showOnly, setShowOnly] = useState<'all' | 'active' | 'upcoming'>('all');

	const filtered = useMemo(() => {
		return MARKING_CALENDAR.filter((e) => {
			const groupOk = selectedGroup === 'all' || e.group === selectedGroup;
			const statusOk = showOnly === 'all' || e.status === showOnly;
			return groupOk && statusOk;
		}).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
	}, [selectedGroup, showOnly]);

	return (
		<div className="mc">
			{/* Фильтры */}
			<div className="mc-filters">
				<div className="mc-filter-group">
					<span className="mc-filter-label">Статус:</span>
					{(['all', 'active', 'upcoming'] as const).map((s) => (
						<button
							key={s}
							type="button"
							className={`mc-pill${showOnly === s ? ' mc-pill--active' : ''}`}
							onClick={() => setShowOnly(s)}
						>
							{s === 'all' ? 'Все' : STATUS_LABELS[s]}
						</button>
					))}
				</div>

				<div className="mc-filter-group">
					<span className="mc-filter-label">Группа товаров:</span>
					<select
						className="mc-select"
						value={selectedGroup}
						onChange={(e) => setSelectedGroup(e.target.value)}
						aria-label="Фильтр по группе товаров"
					>
						<option value="all">Все группы</option>
						{MARKING_GROUPS.map((g) => (
							<option key={g} value={g}>{g}</option>
						))}
					</select>
				</div>
			</div>

			{/* Счётчик */}
			<p className="mc-count">
				Показано: {filtered.length} из {MARKING_CALENDAR.length} категорий
			</p>

			{/* Таблица */}
			{filtered.length === 0 ? (
				<p className="mc-empty">По выбранным фильтрам ничего не найдено.</p>
			) : (
				<div className="mc-table-wrap">
					<table className="mc-table">
						<thead>
							<tr>
								<th>Категория товаров</th>
								<th className="mc-th-group">Группа</th>
								<th>Дата</th>
								<th>Требование</th>
								<th>Статус</th>
							</tr>
						</thead>
						<tbody>
							{filtered.map((entry) => (
								<tr key={entry.id}>
									<td className="mc-td-product">
										<strong>{entry.product}</strong>
									</td>
									<td className="mc-td-group">{entry.group}</td>
									<td className="mc-td-date" style={{ whiteSpace: 'nowrap' }}>
										{entry.date}
									</td>
									<td className="mc-td-req">{entry.requirement}</td>
									<td className="mc-td-status">
										<span
											className="mc-badge"
											style={{
												color: STATUS_COLORS[entry.status],
												background: STATUS_BG[entry.status],
											}}
										>
											{STATUS_LABELS[entry.status]}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<style>{`
				.mc { margin-top: 1.5rem; }
				.mc-filters {
					display: flex;
					flex-wrap: wrap;
					gap: 1rem 2rem;
					margin-bottom: 0.8rem;
					padding: 1rem 1.2rem;
					background: #f8fafc;
					border-radius: 10px;
					border: 1px solid rgb(226, 232, 240);
				}
				.mc-filter-group {
					display: flex;
					align-items: center;
					flex-wrap: wrap;
					gap: 0.4rem;
				}
				.mc-filter-label {
					font-size: 0.88rem;
					font-weight: 600;
					color: rgb(100, 116, 139);
					margin-right: 0.2rem;
				}
				.mc-pill {
					padding: 0.3em 0.85em;
					border-radius: 999px;
					border: 1.5px solid rgb(226, 232, 240);
					background: #fff;
					color: rgb(30, 41, 59);
					font-size: 0.85rem;
					cursor: pointer;
					transition: all 0.15s ease;
					font-family: inherit;
				}
				.mc-pill:hover {
					border-color: #1d4ed8;
					background: #eff6ff;
				}
				.mc-pill--active {
					background: #1d4ed8;
					border-color: #1d4ed8;
					color: #fff;
				}
				.mc-select {
					padding: 0.35em 0.8em;
					border: 1px solid rgb(226, 232, 240);
					border-radius: 8px;
					font-size: 0.88rem;
					font-family: inherit;
					background: #fff;
					color: rgb(30, 41, 59);
				}
				.mc-select:focus {
					outline: 2px solid #1d4ed8;
					outline-offset: 1px;
				}
				.mc-count {
					font-size: 0.85rem;
					color: rgb(100, 116, 139);
					margin: 0 0 0.8rem;
				}
				.mc-empty {
					color: rgb(100, 116, 139);
					padding: 1.5rem 0;
				}
				.mc-table-wrap {
					overflow-x: auto;
					border-radius: 10px;
					border: 1px solid rgb(226, 232, 240);
				}
				.mc-table {
					width: 100%;
					border-collapse: collapse;
					font-size: 0.92rem;
					margin: 0;
				}
				.mc-table th {
					background: #f1f5f9;
					font-weight: 600;
					font-size: 0.85rem;
					color: rgb(30, 41, 59);
					padding: 0.7em 0.9em;
					text-align: left;
					border-bottom: 2px solid rgb(226, 232, 240);
				}
				.mc-table td {
					padding: 0.75em 0.9em;
					border-bottom: 1px solid rgb(226, 232, 240);
					vertical-align: top;
					color: rgb(30, 41, 59);
				}
				.mc-table tr:last-child td {
					border-bottom: none;
				}
				.mc-table tr:hover td {
					background: #f8fafc;
				}
				.mc-td-product strong {
					color: rgb(15, 23, 42);
				}
				.mc-td-group {
					font-size: 0.83rem;
					color: rgb(100, 116, 139);
				}
				.mc-td-date {
					font-weight: 600;
					font-size: 0.88rem;
				}
				.mc-td-req {
					font-size: 0.88rem;
					max-width: 320px;
					line-height: 1.5;
				}
				.mc-badge {
					display: inline-block;
					padding: 0.2em 0.7em;
					border-radius: 999px;
					font-size: 0.78rem;
					font-weight: 600;
					white-space: nowrap;
				}
				@media (max-width: 640px) {
					.mc-th-group, .mc-td-group { display: none; }
				}
			`}</style>
		</div>
	);
}
