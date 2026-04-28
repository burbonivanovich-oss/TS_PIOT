import { useState, useMemo } from 'react';

export type PostData = {
	id: string;
	title: string;
	description: string;
	pubDate: string;
	updatedDate?: string;
	categories: string[];
	tags: string[];
};

type Props = {
	posts: PostData[];
	categories: Record<string, { title: string }>;
	allTags: string[];
	pageSize?: number;
};

const fmt = (iso: string) =>
	new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export default function BlogFilter({ posts, categories, allTags, pageSize = 10 }: Props) {
	const [activeCategory, setActiveCategory] = useState<string>('all');
	const [activeTag, setActiveTag] = useState<string>('');
	const [page, setPage] = useState(1);

	const filtered = useMemo(() => {
		return posts.filter((p) => {
			const catOk = activeCategory === 'all' || p.categories.includes(activeCategory);
			const tagOk = !activeTag || p.tags.includes(activeTag);
			return catOk && tagOk;
		});
	}, [posts, activeCategory, activeTag]);

	const totalPages = Math.ceil(filtered.length / pageSize);
	const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

	const resetFilters = (fn: () => void) => {
		fn();
		setPage(1);
	};

	const pages = buildPageList(page, totalPages);

	return (
		<div className="bf">
			{/* Фильтр по категориям */}
			<div className="bf-cats">
				<button
					type="button"
					className={`bf-cat${activeCategory === 'all' ? ' bf-cat--active' : ''}`}
					onClick={() => resetFilters(() => { setActiveCategory('all'); setActiveTag(''); })}
				>
					Все
				</button>
				{Object.entries(categories).map(([slug, cat]) => (
					<button
						key={slug}
						type="button"
						className={`bf-cat${activeCategory === slug ? ' bf-cat--active' : ''}`}
						onClick={() => resetFilters(() => { setActiveCategory(slug); setActiveTag(''); })}
					>
						{cat.title}
					</button>
				))}
			</div>

			{/* Фильтр по тегу */}
			<div className="bf-tag-row">
				<select
					className="bf-tag-select"
					value={activeTag}
					onChange={(e) => resetFilters(() => setActiveTag(e.target.value))}
					aria-label="Фильтр по тегу"
				>
					<option value="">Все теги</option>
					{allTags.map((tag) => (
						<option key={tag} value={tag}>{tag}</option>
					))}
				</select>
				{activeTag && (
					<button type="button" className="bf-reset" onClick={() => resetFilters(() => setActiveTag(''))}>
						× Сбросить тег
					</button>
				)}
				<span className="bf-count">
					{pluralize(filtered.length, ['материал', 'материала', 'материалов'])}
				</span>
			</div>

			{/* Список */}
			{paginated.length === 0 ? (
				<p className="bf-empty">По выбранным фильтрам материалов нет.</p>
			) : (
				<ul className="bf-list">
					{paginated.map((post) => {
						const cat = post.categories[0];
						const catTitle = cat ? categories[cat]?.title : null;
						const date = post.updatedDate ?? post.pubDate;
						const isUpdated = !!post.updatedDate;
						return (
							<li key={post.id} className="bf-card">
								<a href={`/blog/${post.id}/`}>
									{catTitle && <span className="bf-card-cat">{catTitle}</span>}
									<h2 className="bf-card-title">{post.title}</h2>
									<p className="bf-card-desc">{post.description}</p>
									<p className="bf-card-date">
										{isUpdated ? 'обновлено ' : ''}{fmt(date)}
									</p>
								</a>
							</li>
						);
					})}
				</ul>
			)}

			{/* Пагинация */}
			{totalPages > 1 && (
				<nav className="bf-pages" aria-label="Страницы">
					<button
						type="button"
						className="bf-page-btn"
						onClick={() => setPage((p) => p - 1)}
						disabled={page === 1}
						aria-label="Предыдущая страница"
					>
						←
					</button>

					{pages.map((p, i) =>
						p === '…' ? (
							<span key={`ellipsis-${i}`} className="bf-page-ellipsis">…</span>
						) : (
							<button
								key={p}
								type="button"
								className={`bf-page-btn${page === p ? ' bf-page-btn--active' : ''}`}
								onClick={() => setPage(p as number)}
								aria-current={page === p ? 'page' : undefined}
							>
								{p}
							</button>
						)
					)}

					<button
						type="button"
						className="bf-page-btn"
						onClick={() => setPage((p) => p + 1)}
						disabled={page === totalPages}
						aria-label="Следующая страница"
					>
						→
					</button>
				</nav>
			)}

			<style>{`
				.bf { margin-top: 1.5rem; }
				.bf-cats {
					display: flex;
					flex-wrap: wrap;
					gap: 0.5rem;
					margin-bottom: 1rem;
				}
				.bf-cat {
					padding: 0.4em 1em;
					border-radius: 999px;
					border: 1.5px solid rgb(226, 232, 240);
					background: #fff;
					color: rgb(30, 41, 59);
					font-size: 0.9rem;
					cursor: pointer;
					transition: all 0.15s ease;
					font-family: inherit;
				}
				.bf-cat:hover {
					border-color: #1d4ed8;
					background: #eff6ff;
				}
				.bf-cat--active {
					background: #1d4ed8;
					border-color: #1d4ed8;
					color: #fff;
				}
				.bf-tag-row {
					display: flex;
					align-items: center;
					flex-wrap: wrap;
					gap: 0.6rem;
					margin-bottom: 1.2rem;
				}
				.bf-tag-select {
					padding: 0.45em 0.8em;
					border: 1px solid rgb(226, 232, 240);
					border-radius: 8px;
					font-size: 0.9rem;
					font-family: inherit;
					background: #fff;
					color: rgb(30, 41, 59);
				}
				.bf-tag-select:focus {
					outline: 2px solid #1d4ed8;
					outline-offset: 1px;
				}
				.bf-reset {
					padding: 0.35em 0.8em;
					border-radius: 6px;
					border: 1px solid #fca5a5;
					background: #fef2f2;
					color: #b91c1c;
					font-size: 0.85rem;
					cursor: pointer;
					font-family: inherit;
				}
				.bf-count {
					font-size: 0.88rem;
					color: rgb(100, 116, 139);
					margin-left: auto;
				}
				.bf-empty {
					color: rgb(100, 116, 139);
					font-size: 1rem;
					padding: 2rem 0;
				}
				.bf-list {
					list-style: none;
					padding: 0;
					margin: 0;
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
					gap: 1rem;
				}
				.bf-card a {
					display: block;
					padding: 1.4rem;
					border: 1px solid rgb(226, 232, 240);
					border-radius: 10px;
					background: #fff;
					color: rgb(30, 41, 59);
					text-decoration: none;
					height: 100%;
					transition: all 0.15s ease;
				}
				.bf-card a:hover {
					border-color: #1d4ed8;
					box-shadow: 0 2px 6px rgba(15,23,42,.08), 0 8px 24px rgba(15,23,42,.05);
				}
				.bf-card-cat {
					display: inline-block;
					font-size: 0.78rem;
					font-weight: 600;
					color: #1d4ed8;
					background: #dbeafe;
					padding: 0.2em 0.7em;
					border-radius: 999px;
					margin-bottom: 0.5rem;
				}
				.bf-card-title {
					margin: 0 0 0.5rem;
					font-size: 1.15rem;
					color: rgb(15, 23, 42);
					line-height: 1.3;
				}
				.bf-card-desc {
					font-size: 0.93rem;
					margin-bottom: 0.8rem;
					color: rgb(30, 41, 59);
				}
				.bf-card-date {
					font-size: 0.83rem;
					color: rgb(100, 116, 139);
					margin: 0;
				}
				.bf-pages {
					display: flex;
					align-items: center;
					gap: 0.4rem;
					margin-top: 2rem;
					flex-wrap: wrap;
				}
				.bf-page-btn {
					min-width: 2.2rem;
					height: 2.2rem;
					padding: 0 0.5em;
					border-radius: 8px;
					border: 1px solid rgb(226, 232, 240);
					background: #fff;
					color: rgb(30, 41, 59);
					font-size: 0.9rem;
					cursor: pointer;
					transition: all 0.15s ease;
					font-family: inherit;
					display: inline-flex;
					align-items: center;
					justify-content: center;
				}
				.bf-page-btn:hover:not(:disabled) {
					border-color: #1d4ed8;
					background: #eff6ff;
					color: #1d4ed8;
				}
				.bf-page-btn--active {
					background: #1d4ed8;
					border-color: #1d4ed8;
					color: #fff;
					font-weight: 600;
				}
				.bf-page-btn:disabled {
					opacity: 0.35;
					cursor: default;
				}
				.bf-page-ellipsis {
					color: rgb(100, 116, 139);
					padding: 0 0.3em;
				}
			`}</style>
		</div>
	);
}

function pluralize(n: number, forms: [string, string, string]) {
	const abs = Math.abs(n) % 100;
	const rem = abs % 10;
	if (abs >= 11 && abs <= 19) return `${n} ${forms[2]}`;
	if (rem === 1) return `${n} ${forms[0]}`;
	if (rem >= 2 && rem <= 4) return `${n} ${forms[1]}`;
	return `${n} ${forms[2]}`;
}

function buildPageList(current: number, total: number): (number | '…')[] {
	if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
	const pages: (number | '…')[] = [];
	const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
	add(1);
	if (current > 3) pages.push('…');
	for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) add(i);
	if (current < total - 2) pages.push('…');
	add(total);
	return pages;
}
