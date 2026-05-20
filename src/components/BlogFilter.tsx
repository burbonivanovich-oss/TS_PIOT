import { useState, useMemo } from 'react';
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const u = (path: string) => base + path;

export type PostData = {
	id: string;
	title: string;
	description: string;
	pubDate: string;
	updatedDate?: string;
	categories: string[];
	tags: string[];
	previewImage?: string;
	heroImage?: string;
};

type Props = {
	posts: PostData[];
	categories: Record<string, { title: string }>;
	allTags: string[];
	pageSize?: number;
};

function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

const CAT_COLOR: Record<string, string> = {
	'ts-piot':         '#111',
	'markirovka':      '#9E2B4F',
	'zakonodatelstvo': '#1E4A7A',
	'kkt':             '#5A3E7A',
	'egais':           '#1A5C3A',
};

const CAT_NAMES: Record<string, string> = {
	'ts-piot': 'ТС ПИоТ',
	'markirovka': 'Маркировка',
	'zakonodatelstvo': 'Законодательство',
	'kkt': 'ККТ',
	'egais': 'ЕГАИС',
};

function postImage(post: PostData): string | null {
	return post.previewImage ?? post.heroImage ?? `/og/${post.slug}.png`;
}

export default function BlogFilter({ posts, categories, allTags, pageSize = 12 }: Props) {
	const [activeCategory, setActiveCategory] = useState<string>('all');
	const [sortDesc, setSortDesc] = useState(true);
	const [page, setPage] = useState(1);

	const filtered = useMemo(() => {
		const result = posts.filter((p) => {
			return activeCategory === 'all' || p.categories.includes(activeCategory);
		});
		return sortDesc ? result : [...result].reverse();
	}, [posts, activeCategory, sortDesc]);

	const totalPages = Math.ceil(filtered.length / pageSize);
	const paginatedItems = filtered.slice((page - 1) * pageSize, page * pageSize);
	const pages = buildPageList(page, totalPages);

	const resetPage = () => setPage(1);

	const catCounts: Record<string, number> = { all: posts.length };
	Object.keys(categories).forEach((slug) => {
		catCounts[slug] = posts.filter((p) => p.categories.includes(slug)).length;
	});

	return (
		<div className="bf">
			{/* Filter bar */}
			<div className="bf-filter-bar">
				<div className="bf-filter-left">
					<span className="bf-filter-label">Раздел:</span>
					<div className="bf-filter-tags">
						<button
							type="button"
							className={`bf-ftag${activeCategory === 'all' ? ' bf-ftag--active' : ''}`}
							onClick={() => { setActiveCategory('all'); resetPage(); }}
						>
							Все {catCounts.all}
						</button>
						{Object.entries(categories).map(([slug, cat]) => (
							<button
								key={slug}
								type="button"
								className={`bf-ftag${activeCategory === slug ? ' bf-ftag--active' : ''}`}
								onClick={() => { setActiveCategory(slug); resetPage(); }}
							>
								{cat.title} {catCounts[slug] ?? 0}
							</button>
						))}
					</div>
				</div>
				<button
					type="button"
					className="bf-sort"
					onClick={() => { setSortDesc((v) => !v); resetPage(); }}
				>
					{sortDesc ? 'Сначала новые ↓' : 'Сначала старые ↑'}
				</button>
			</div>

			{filtered.length === 0 ? (
				<p className="bf-empty">По выбранным фильтрам материалов нет.</p>
			) : (
				<>
					<div className="bf-grid">
						{paginatedItems.map((post, i) => {
							const cat = post.categories[0];
							const accentColor = cat ? (CAT_COLOR[cat] ?? '#111') : '#111';
							const catName = cat ? (CAT_NAMES[cat] ?? categories[cat]?.title ?? cat) : null;
							const img = postImage(post);
							const isFeatured = page === 1 && i === 0;
							return (
								<a
									key={post.id}
									href={u(`/blog/${post.id}/`)}
									className={`bf-card${isFeatured ? ' bf-card--featured' : ''}`}
								>
									<div className="bf-card-img" style={{ '--accent': accentColor } as React.CSSProperties}>
										{img
											? (() => {
												const src = u(img);
												const webp = /\.(jpe?g|png)$/i.test(src) ? src.replace(/\.(jpe?g|png)$/i, '.webp') : null;
												const imgEl = <img src={src} alt={post.title} loading={isFeatured ? 'eager' : 'lazy'} />;
												return webp ? (
													<picture>
														<source srcSet={webp} type="image/webp" />
														{imgEl}
													</picture>
												) : imgEl;
											})()
											: <span className="bf-card-placeholder" style={{ background: accentColor }}></span>
										}
									</div>
									<div className="bf-card-body">
										{catName && (
											<span
												className="bf-card-pill"
												style={{ background: accentColor, color: '#fff' }}
											>
												{catName}
											</span>
										)}
										<div className="bf-card-title">{post.title}</div>
										{isFeatured && post.description && (
											<div className="bf-card-desc">{post.description}</div>
										)}
										<div className="bf-card-meta">{fmtDate(post.pubDate)}</div>
									</div>
								</a>
							);
						})}
					</div>

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
				</>
			)}

			<style>{`
				.bf {
					margin-top: 0;
				}

				/* ── Filter bar ── */
				.bf-filter-bar {
					display: flex;
					align-items: center;
					justify-content: space-between;
					margin-bottom: 36px;
					font-size: .7rem;
					font-weight: 700;
					letter-spacing: .1em;
					text-transform: uppercase;
					flex-wrap: wrap;
					gap: 8px;
				}
				.bf-filter-left {
					display: flex;
					align-items: center;
					gap: 0;
					flex-wrap: wrap;
				}
				.bf-filter-label {
					color: #999;
					margin-right: 8px;
					white-space: nowrap;
				}
				.bf-filter-tags {
					display: flex;
					gap: 4px;
					flex-wrap: wrap;
				}
				.bf-ftag {
					padding: 5px 12px;
					background: none;
					border: none;
					color: #111;
					font-size: .7rem;
					font-weight: 700;
					letter-spacing: .1em;
					text-transform: uppercase;
					cursor: pointer;
					font-family: 'Inter', sans-serif;
					transition: background .15s;
					line-height: 1;
				}
				.bf-ftag:hover {
					background: rgba(0,0,0,.08);
				}
				.bf-ftag--active {
					background: #111;
					color: #EDE8DF;
				}
				.bf-sort {
					color: #666;
					font-size: .7rem;
					font-weight: 700;
					letter-spacing: .08em;
					text-transform: uppercase;
					background: none;
					border: none;
					cursor: pointer;
					font-family: 'Inter', sans-serif;
					white-space: nowrap;
				}
				.bf-sort:hover {
					color: #111;
				}

				/* ── Posts grid ── */
				.bf-grid {
					display: grid;
					grid-template-columns: repeat(3, minmax(0, 1fr));
					gap: 8px;
				}

				/* Featured card: горизонтальный layout, картинка слева 58% */
				.bf-card--featured {
					grid-column: 1 / -1;
					flex-direction: row;
					align-items: stretch;
				}
				.bf-card--featured .bf-card-img {
					width: 58%;
					flex-shrink: 0;
					min-height: 320px;
					overflow: hidden;
				}
				.bf-card--featured .bf-card-body {
					padding: 32px 36px;
					display: flex;
					flex-direction: column;
					justify-content: flex-start;
				}
				.bf-card--featured .bf-card-title {
					font-size: clamp(1.6rem, 2.5vw, 2.4rem);
					margin-bottom: 14px;
				}
				.bf-card--featured .bf-card-desc {
					font-size: .95rem;
					line-height: 1.6;
					color: #444;
				}

				/* All cards */
				.bf-card {
					background: #fff;
					display: flex;
					flex-direction: column;
					text-decoration: none;
					color: #111;
					border: 1px solid rgba(0,0,0,.08);
					transition: box-shadow .15s, transform .15s;
				}
				.bf-card:hover {
					box-shadow: 0 4px 20px rgba(0,0,0,.1);
					transform: translateY(-2px);
				}
				.bf-card-img {
					width: 100%;
					aspect-ratio: 16/9;
					overflow: hidden;
					position: relative;
					background: var(--accent, #111);
				}
				.bf-card-img img {
					width: 100%;
					height: 100%;
					object-fit: cover;
					display: block;
				}
				.bf-card-placeholder {
					display: block;
					width: 100%;
					height: 100%;
				}
				.bf-card-body {
					padding: 20px;
					flex: 1;
					display: flex;
					flex-direction: column;
				}
				.bf-card-pill {
					font-size: .6rem;
					font-weight: 700;
					letter-spacing: .12em;
					text-transform: uppercase;
					padding: 3px 8px;
					display: inline-block;
					margin-bottom: 10px;
					align-self: flex-start;
				}
				.bf-card-title {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 1.45rem;
					line-height: 1.05;
					letter-spacing: .02em;
					text-transform: uppercase;
					color: #111;
					flex: 1;
					margin-bottom: 8px;
				}
				.bf-card-desc {
					font-size: .88rem;
					color: #555;
					line-height: 1.55;
					margin-bottom: 12px;
				}
				.bf-card-meta {
					font-size: .65rem;
					letter-spacing: .08em;
					text-transform: uppercase;
					color: #aaa;
					margin-top: auto;
				}

				/* ── Pagination ── */
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
					border: 1.5px solid rgba(0,0,0,.15);
					background: #fff;
					color: #111;
					font-size: 0.88rem;
					font-weight: 600;
					cursor: pointer;
					transition: all 0.12s ease;
					font-family: 'Inter', sans-serif;
					display: inline-flex;
					align-items: center;
					justify-content: center;
				}
				.bf-page-btn:hover:not(:disabled) {
					background: #111;
					border-color: #111;
					color: #EDE8DF;
				}
				.bf-page-btn--active {
					background: #111;
					border-color: #111;
					color: #EDE8DF;
				}
				.bf-page-btn:disabled {
					opacity: 0.3;
					cursor: default;
				}
				.bf-page-ellipsis {
					color: #999;
					padding: 0 0.3em;
				}

				.bf-empty {
					color: #666;
					font-size: 1rem;
					padding: 3rem 0;
					text-align: center;
				}

				/* ── Responsive ── */
				@media (max-width: 960px) {
					.bf-card--featured { flex-direction: column; }
					.bf-card--featured .bf-card-img { width: 100%; aspect-ratio: 16/9; }
				}
				@media (max-width: 820px) {
					.bf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
				}
				@media (max-width: 560px) {
					.bf-grid { grid-template-columns: 1fr; }
					.bf-card--featured { grid-column: auto; }
					.bf-filter-bar {
						flex-direction: column;
						align-items: flex-start;
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
