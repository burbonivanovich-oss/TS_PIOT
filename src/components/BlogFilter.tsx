import { useState, useMemo } from 'react';

export type PostData = {
	id: string;
	title: string;
	description: string;
	pubDate: string;
	updatedDate?: string;
	categories: string[];
	tags: string[];
	previewImage?: string;
};

type Props = {
	posts: PostData[];
	categories: Record<string, { title: string }>;
	allTags: string[];
	pageSize?: number;
};

const fmt = (iso: string) =>
	new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

const CAT_COLORS: Record<string, string> = {
	'ts-piot': 'lime',
	'markirovka': 'pink',
	'zakonodatelstvo': 'dark',
};

function getCatColor(cat: string) {
	return CAT_COLORS[cat] ?? 'dark';
}

export default function BlogFilter({ posts, categories, allTags, pageSize = 12 }: Props) {
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

	const resetFilters = (fn: () => void) => { fn(); setPage(1); };

	const pages = buildPageList(page, totalPages);

	return (
		<div className="bf">
			{/* Фильтр */}
			<div className="bf-toolbar">
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
							className={`bf-cat bf-cat--${getCatColor(slug)}${activeCategory === slug ? ' bf-cat--active' : ''}`}
							onClick={() => resetFilters(() => { setActiveCategory(slug); setActiveTag(''); })}
						>
							{cat.title}
						</button>
					))}
				</div>

				<div className="bf-right">
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
							✕
						</button>
					)}
					<span className="bf-count">
						{pluralize(filtered.length, ['материал', 'материала', 'материалов'])}
					</span>
				</div>
			</div>

			{/* Список */}
			{paginated.length === 0 ? (
				<p className="bf-empty">По выбранным фильтрам материалов нет.</p>
			) : (
				<ul className="bf-list">
					{paginated.map((post, idx) => {
						const cat = post.categories[0];
						const catTitle = cat ? categories[cat]?.title : null;
						const catColor = cat ? getCatColor(cat) : 'dark';
						const date = post.updatedDate ?? post.pubDate;
						const isUpdated = !!post.updatedDate;
						const isFeatured = idx === 0 && page === 1;
						return (
							<li key={post.id} className={`bf-card${isFeatured ? ' bf-card--featured' : ''}`}>
								<a href={`/blog/${post.id}/`}>
									{post.previewImage && (
										<div className="bf-card-img">
											<img src={post.previewImage} alt="" loading={idx < 3 ? 'eager' : 'lazy'} width="800" height="420" />
										</div>
									)}
									{!post.previewImage && isFeatured && (
										<div className="bf-card-placeholder" />
									)}
									<div className="bf-card-body">
										{catTitle && (
											<span className={`bf-tag bf-tag--${catColor}`}>{catTitle}</span>
										)}
										<h2 className="bf-card-title">{post.title}</h2>
										{isFeatured && <p className="bf-card-desc">{post.description}</p>}
										<p className="bf-card-date">
											{isUpdated ? 'обновлено ' : ''}{fmt(date)}
										</p>
									</div>
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
						aria-label="Предыдущая"
					>←</button>

					{pages.map((p, i) =>
						p === '…' ? (
							<span key={`e-${i}`} className="bf-page-ellipsis">…</span>
						) : (
							<button
								key={p}
								type="button"
								className={`bf-page-btn${page === p ? ' bf-page-btn--active' : ''}`}
								onClick={() => setPage(p as number)}
								aria-current={page === p ? 'page' : undefined}
							>{p}</button>
						)
					)}

					<button
						type="button"
						className="bf-page-btn"
						onClick={() => setPage((p) => p + 1)}
						disabled={page === totalPages}
						aria-label="Следующая"
					>→</button>
				</nav>
			)}

			<style>{`
				.bf { margin-top: 0; }

				/* Toolbar */
				.bf-toolbar {
					display: flex;
					align-items: center;
					flex-wrap: wrap;
					gap: 0.75rem;
					margin-bottom: 2rem;
					padding-bottom: 1.25rem;
					border-bottom: 1px solid #E8E8E6;
				}
				.bf-cats {
					display: flex;
					flex-wrap: wrap;
					gap: 0.4rem;
					flex: 1;
				}
				.bf-cat {
					padding: 0.38em 1em;
					border-radius: 4px;
					border: 1.5px solid #E8E8E6;
					background: #fff;
					color: #1C1C1C;
					font-size: 0.82rem;
					font-weight: 600;
					letter-spacing: 0.02em;
					cursor: pointer;
					transition: all 0.12s ease;
					font-family: inherit;
					text-transform: uppercase;
				}
				.bf-cat:hover {
					border-color: #0D0D0D;
					background: #0D0D0D;
					color: #fff;
				}
				.bf-cat--active {
					background: #0D0D0D;
					border-color: #0D0D0D;
					color: #C8FF00;
				}
				.bf-right {
					display: flex;
					align-items: center;
					gap: 0.5rem;
					flex-shrink: 0;
				}
				.bf-tag-select {
					padding: 0.4em 0.75em;
					border: 1.5px solid #E8E8E6;
					border-radius: 4px;
					font-size: 0.82rem;
					font-family: inherit;
					background: #fff;
					color: #1C1C1C;
					cursor: pointer;
				}
				.bf-tag-select:focus {
					outline: 2px solid #C8FF00;
					outline-offset: 1px;
					border-color: #0D0D0D;
				}
				.bf-reset {
					width: 2rem;
					height: 2rem;
					border-radius: 4px;
					border: 1.5px solid #E8E8E6;
					background: #fff;
					color: #FF2055;
					font-size: 0.9rem;
					cursor: pointer;
					font-family: inherit;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					transition: all 0.12s ease;
				}
				.bf-reset:hover {
					background: #FF2055;
					border-color: #FF2055;
					color: #fff;
				}
				.bf-count {
					font-size: 0.82rem;
					color: #6B7280;
					white-space: nowrap;
				}
				.bf-empty {
					color: #6B7280;
					font-size: 1rem;
					padding: 3rem 0;
					text-align: center;
				}

				/* Grid */
				.bf-list {
					list-style: none;
					padding: 0;
					margin: 0;
					display: grid;
					grid-template-columns: repeat(3, 1fr);
					gap: 1px;
					background: #E8E8E6;
					border: 1px solid #E8E8E6;
					border-radius: 8px;
					overflow: hidden;
				}
				.bf-card--featured {
					grid-column: 1 / -1;
				}
				.bf-card a {
					display: flex;
					flex-direction: column;
					background: #fff;
					color: #1C1C1C;
					text-decoration: none;
					height: 100%;
					overflow: hidden;
					transition: background 0.12s ease;
				}
				.bf-card--featured a {
					flex-direction: row;
					min-height: 260px;
				}
				.bf-card a:hover {
					background: #F6F6F4;
				}
				.bf-card--featured a:hover {
					background: #0D0D0D;
					color: #fff;
				}
				.bf-card--featured a:hover .bf-card-title {
					color: #C8FF00;
				}
				.bf-card--featured a:hover .bf-card-desc {
					color: rgba(255,255,255,0.7);
				}
				.bf-card--featured a:hover .bf-card-date {
					color: rgba(255,255,255,0.4);
				}

				/* Images */
				.bf-card-img {
					width: 100%;
					aspect-ratio: 16 / 9;
					overflow: hidden;
					flex-shrink: 0;
				}
				.bf-card--featured .bf-card-img {
					width: 42%;
					aspect-ratio: unset;
					flex-shrink: 0;
				}
				.bf-card-img img {
					width: 100%;
					height: 100%;
					object-fit: cover;
					display: block;
					transition: transform 0.4s ease;
				}
				.bf-card a:hover .bf-card-img img {
					transform: scale(1.04);
				}
				.bf-card-placeholder {
					width: 42%;
					flex-shrink: 0;
					background: linear-gradient(135deg, #0D0D0D 0%, #1C1C1C 100%);
				}

				/* Body */
				.bf-card-body {
					padding: 1.4rem 1.5rem 1.6rem;
					display: flex;
					flex-direction: column;
					flex: 1;
					gap: 0.5rem;
				}
				.bf-card--featured .bf-card-body {
					padding: 2rem 2rem 2rem;
					justify-content: flex-end;
				}

				/* Category tag */
				.bf-tag {
					display: inline-block;
					padding: 0.22em 0.6em;
					border-radius: 3px;
					font-size: 0.7rem;
					font-weight: 700;
					letter-spacing: 0.06em;
					text-transform: uppercase;
					line-height: 1.4;
					align-self: flex-start;
				}
				.bf-tag--lime {
					background: #C8FF00;
					color: #0D0D0D;
				}
				.bf-tag--pink {
					background: #FF2055;
					color: #fff;
				}
				.bf-tag--dark {
					background: #0D0D0D;
					color: #C8FF00;
				}

				/* Titles */
				.bf-card-title {
					margin: 0;
					font-size: 1.05rem;
					font-weight: 700;
					color: #0D0D0D;
					line-height: 1.25;
					letter-spacing: -0.01em;
				}
				.bf-card--featured .bf-card-title {
					font-size: 1.6rem;
					line-height: 1.18;
					letter-spacing: -0.02em;
				}
				.bf-card-desc {
					font-size: 0.9rem;
					color: #4B5563;
					margin: 0;
					line-height: 1.5;
				}
				.bf-card-date {
					font-size: 0.76rem;
					color: #9CA3AF;
					margin: 0;
					margin-top: auto;
					padding-top: 0.5rem;
				}

				/* Pagination */
				.bf-pages {
					display: flex;
					align-items: center;
					gap: 0.3rem;
					margin-top: 2.5rem;
					flex-wrap: wrap;
				}
				.bf-page-btn {
					min-width: 2.2rem;
					height: 2.2rem;
					padding: 0 0.5em;
					border-radius: 4px;
					border: 1.5px solid #E8E8E6;
					background: #fff;
					color: #1C1C1C;
					font-size: 0.88rem;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.12s ease;
					font-family: inherit;
					display: inline-flex;
					align-items: center;
					justify-content: center;
				}
				.bf-page-btn:hover:not(:disabled) {
					border-color: #0D0D0D;
					background: #0D0D0D;
					color: #C8FF00;
				}
				.bf-page-btn--active {
					background: #0D0D0D;
					border-color: #0D0D0D;
					color: #C8FF00;
				}
				.bf-page-btn:disabled {
					opacity: 0.3;
					cursor: default;
				}
				.bf-page-ellipsis {
					color: #9CA3AF;
					padding: 0 0.3em;
				}

				/* Responsive */
				@media (max-width: 900px) {
					.bf-list {
						grid-template-columns: repeat(2, 1fr);
					}
					.bf-card--featured {
						grid-column: 1 / -1;
					}
				}
				@media (max-width: 600px) {
					.bf-list {
						grid-template-columns: 1fr;
					}
					.bf-card--featured a {
						flex-direction: column;
					}
					.bf-card--featured .bf-card-img,
					.bf-card-placeholder {
						width: 100%;
						aspect-ratio: 16 / 9;
					}
					.bf-toolbar {
						flex-direction: column;
						align-items: flex-start;
					}
					.bf-right {
						width: 100%;
					}
					.bf-tag-select {
						flex: 1;
					}
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
