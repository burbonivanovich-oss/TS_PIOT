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
};

type Props = {
	posts: PostData[];
	categories: Record<string, { title: string }>;
	allTags: string[];
	pageSize?: number;
};

// Format date as "25 апр."
function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Get 2-letter abbreviation from title
function abbrev(title: string): string {
	const words = title
		.replace(/[«»"']/g, '')
		.split(/\s+/)
		.filter((w) => /^[А-ЯЁA-Z]/i.test(w) && w.length > 2);
	if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
	return title.slice(0, 2).toUpperCase();
}

// Deterministic hash for pool image selection
function slugHash(slug: string): number {
	let h = 0;
	for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
	return h;
}

// Pick preview image from pool (or use manual override from frontmatter)
function poolPreview(post: PostData): string {
	if (post.previewImage) return post.previewImage;
	const cat = post.categories[0] ?? 'zakonodatelstvo';
	const n = slugHash(post.id) % 3;
	return `/images/preview/${cat}-${n}.jpg`;
}

// Get card colors by category
function cardBg(cat?: string): { bg: string; letterColor: string; tagBg: string; tagColor: string; dateColor: string } {
	if (cat === 'ts-piot')
		return { bg: '#111', letterColor: '#AFCC00', tagBg: '#111', tagColor: '#fff', dateColor: 'rgba(255,255,255,.6)' };
	if (cat === 'markirovka')
		return { bg: '#9E2B4F', letterColor: '#fff', tagBg: '#9E2B4F', tagColor: '#fff', dateColor: 'rgba(255,255,255,.6)' };
	if (cat === 'zakonodatelstvo')
		return { bg: '#1E4A7A', letterColor: '#fff', tagBg: '#1E4A7A', tagColor: '#fff', dateColor: 'rgba(255,255,255,.6)' };
	return { bg: '#222', letterColor: '#fff', tagBg: '#111', tagColor: '#fff', dateColor: 'rgba(255,255,255,.5)' };
}

// Month name in Russian
function archiveMonthLabel(iso: string): string {
	const d = new Date(iso);
	const month = d.toLocaleDateString('ru-RU', { month: 'long' });
	const year = d.getFullYear();
	return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
}

// Category display names
const CAT_NAMES: Record<string, string> = {
	'ts-piot': 'ТС ПИоТ',
	'markirovka': 'Маркировка',
	'zakonodatelstvo': 'Законодательство',
};

export default function BlogFilter({ posts, categories, allTags, pageSize = 9 }: Props) {
	const [activeCategory, setActiveCategory] = useState<string>('all');
	const [sortDesc, setSortDesc] = useState(true);
	const [page, setPage] = useState(1);

	const filtered = useMemo(() => {
		const result = posts.filter((p) => {
			return activeCategory === 'all' || p.categories.includes(activeCategory);
		});
		return sortDesc ? result : [...result].reverse();
	}, [posts, activeCategory, sortDesc]);

	const totalPages = Math.ceil(Math.max(0, filtered.length - 3) / pageSize);
	const heroItems = filtered.slice(0, 3);
	const archiveItems = filtered.slice(3);
	const paginatedArchive = archiveItems.slice((page - 1) * pageSize, page * pageSize);
	const pages = buildPageList(page, totalPages);

	const resetPage = () => setPage(1);

	// Category counts
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
					{/* Hero grid — first 3 posts */}
					{heroItems.length > 0 && (
						<div className="bf-hero-grid">
							{/* Hero main card */}
							<a href={u(`/blog/${heroItems[0].id}/`)} className="bf-hero-main">
								<span className="bf-hero-bg-letter">{abbrev(heroItems[0].title)}</span>
								<div className="bf-hero-tags">
									<span className="bf-htag bf-htag--pink">
										{heroItems[0].categories[0] ? (CAT_NAMES[heroItems[0].categories[0]] ?? heroItems[0].categories[0]) : 'Статья'}
									</span>
									{heroItems[0].tags[0] && (
										<span className="bf-htag bf-htag--lime">#{heroItems[0].tags[0]}</span>
									)}
								</div>
								<div className="bf-hero-title">{heroItems[0].title}</div>
								<div className="bf-hero-meta">{fmtDate(heroItems[0].pubDate)}</div>
							</a>

							{/* Hero side cards */}
							<div className="bf-hero-side">
								{heroItems[1] && (
									<a href={u(`/blog/${heroItems[1].id}/`)} className="bf-hero-card bf-hero-card--lime">
										<div>
											<span className="bf-card-tag bf-card-tag--lime-inner">
												{heroItems[1].categories[0] ? (CAT_NAMES[heroItems[1].categories[0]] ?? heroItems[1].categories[0]) : 'Статья'}
											</span>
											<div className="bf-side-title">{heroItems[1].title}</div>
										</div>
										<div className="bf-side-meta">{fmtDate(heroItems[1].pubDate)}</div>
									</a>
								)}
								{heroItems[2] && (
									<a href={u(`/blog/${heroItems[2].id}/`)} className="bf-hero-card bf-hero-card--white">
										<div>
											<span className="bf-card-tag bf-card-tag--pink-inner">
												{heroItems[2].categories[0] ? (CAT_NAMES[heroItems[2].categories[0]] ?? heroItems[2].categories[0]) : 'Статья'}
											</span>
											<div className="bf-side-title bf-side-title--dark">{heroItems[2].title}</div>
										</div>
										<div className="bf-side-meta bf-side-meta--dark">{fmtDate(heroItems[2].pubDate)}</div>
									</a>
								)}
							</div>
						</div>
					)}

					{/* Archive section */}
					{paginatedArchive.length > 0 && (
						<>
							<div className="bf-archive-header">
								<span className="bf-archive-title">
									Архив — {archiveMonthLabel(paginatedArchive[0].pubDate)}
								</span>
								<span className="bf-archive-count">
									{pluralize(archiveItems.length, ['материал', 'материала', 'материалов'])}
								</span>
							</div>

							<div className="bf-cards-grid">
								{paginatedArchive.map((post) => {
									const cat = post.categories[0];
									const colors = cardBg(cat);
									const catName = cat ? (CAT_NAMES[cat] ?? cat) : null;
									return (
										<a key={post.id} href={u(`/blog/${post.id}/`)} className="bf-card">
											<div className="bf-card-img">
												<img src={poolPreview(post)} alt="" loading="lazy" />
											</div>
											<div className="bf-card-body">
												{catName && (
													<span
														className="bf-card-pill"
														style={{ background: colors.tagBg, color: colors.tagColor }}
													>
														{catName}
													</span>
												)}
												<div className="bf-card-title">{post.title}</div>
												<div className="bf-card-desc">{post.description}</div>
												<div className="bf-card-meta">
													<span className="bf-card-author">Редакция</span>
													<span className="bf-card-date">{fmtDate(post.pubDate)}</span>
												</div>
											</div>
										</a>
									);
								})}
							</div>
						</>
					)}

					{/* Pagination */}
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

				/* ── Hero grid ── */
				.bf-hero-grid {
					display: grid;
					grid-template-columns: 2fr 1fr;
					gap: 8px;
					margin-bottom: 8px;
				}
				.bf-hero-main {
					background: #111;
					color: #fff;
					padding: 24px;
					position: relative;
					overflow: hidden;
					min-height: 260px;
					display: flex;
					flex-direction: column;
					justify-content: flex-end;
					text-decoration: none;
				}
				.bf-hero-bg-letter {
					position: absolute;
					right: -10px;
					top: -20px;
					font-family: 'Bebas Neue', sans-serif;
					font-size: 18rem;
					line-height: 1;
					color: #9E2B4F;
					opacity: .35;
					pointer-events: none;
					letter-spacing: -.02em;
				}
				.bf-hero-tags {
					display: flex;
					gap: 4px;
					margin-bottom: 12px;
					position: relative;
					z-index: 1;
				}
				.bf-htag {
					font-size: .65rem;
					font-weight: 700;
					letter-spacing: .1em;
					text-transform: uppercase;
					padding: 4px 8px;
				}
				.bf-htag--pink {
					background: #9E2B4F;
					color: #fff;
				}
				.bf-htag--lime {
					background: #AFCC00;
					color: #111;
				}
				.bf-hero-title {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 2.8rem;
					line-height: 1.0;
					letter-spacing: .03em;
					color: #fff;
					text-transform: uppercase;
					position: relative;
					z-index: 1;
				}
				.bf-hero-meta {
					font-size: .65rem;
					letter-spacing: .1em;
					text-transform: uppercase;
					color: #777;
					margin-top: 8px;
					position: relative;
					z-index: 1;
				}

				/* Hero side cards */
				.bf-hero-side {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}
				.bf-hero-card {
					padding: 16px;
					display: flex;
					flex-direction: column;
					justify-content: space-between;
					flex: 1;
					min-height: 124px;
					text-decoration: none;
				}
				.bf-hero-card--lime {
					background: #AFCC00;
				}
				.bf-hero-card--white {
					background: #fff;
				}
				.bf-card-tag {
					font-size: .6rem;
					font-weight: 700;
					letter-spacing: .12em;
					text-transform: uppercase;
					padding: 3px 7px;
					display: inline-block;
					margin-bottom: 8px;
				}
				.bf-card-tag--lime-inner {
					background: #111;
					color: #AFCC00;
				}
				.bf-card-tag--pink-inner {
					background: #9E2B4F;
					color: #fff;
				}
				.bf-side-title {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 1.45rem;
					line-height: 1.1;
					text-transform: uppercase;
					letter-spacing: .02em;
					color: #111;
				}
				.bf-side-title--dark {
					color: #111;
				}
				.bf-side-meta {
					font-size: .6rem;
					letter-spacing: .1em;
					text-transform: uppercase;
					color: #555;
					margin-top: 8px;
				}
				.bf-side-meta--dark {
					color: #666;
				}

				/* ── Archive header ── */
				.bf-archive-header {
					display: flex;
					align-items: baseline;
					justify-content: space-between;
					margin: 48px 0 20px;
					border-bottom: 1px solid rgba(0,0,0,.15);
					padding-bottom: 8px;
				}
				.bf-archive-title {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 1.8rem;
					letter-spacing: .04em;
					text-transform: uppercase;
					color: #111;
				}
				.bf-archive-count {
					font-size: .65rem;
					letter-spacing: .12em;
					text-transform: uppercase;
					color: #999;
				}

				/* ── Archive cards grid ── */
				.bf-cards-grid {
					display: grid;
					grid-template-columns: repeat(3, 1fr);
					gap: 8px;
				}
				.bf-card {
					background: #fff;
					display: flex;
					flex-direction: column;
					text-decoration: none;
					color: #111;
					transition: opacity .15s;
				}
				.bf-card:hover {
					opacity: .9;
				}
				.bf-card-img {
					width: 100%;
					aspect-ratio: 4/3;
					overflow: hidden;
				}
				.bf-card-img img {
					width: 100%;
					height: 100%;
					object-fit: cover;
					display: block;
				}
				.bf-card-meta {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-top: 8px;
					font-size: .65rem;
					color: #999;
					letter-spacing: .04em;
				}
				.bf-card-body {
					padding: 16px;
				}
				.bf-card-pill {
					font-size: .6rem;
					font-weight: 700;
					letter-spacing: .12em;
					text-transform: uppercase;
					padding: 3px 7px;
					display: inline-block;
					margin-bottom: 10px;
				}
				.bf-card-title {
					font-family: 'Bebas Neue', sans-serif;
					font-size: 1.45rem;
					line-height: 1.05;
					text-transform: uppercase;
					letter-spacing: .02em;
					color: #111;
					margin-bottom: 6px;
				}
				.bf-card-desc {
					font-size: .78rem;
					color: #666;
					line-height: 1.5;
					margin-bottom: 8px;
				}
				.bf-card-author {
					font-size: .6rem;
					letter-spacing: .06em;
					color: #999;
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
				@media (max-width: 820px) {
					.bf-hero-grid {
						grid-template-columns: 1fr;
					}
					.bf-hero-side {
						flex-direction: row;
					}
					.bf-cards-grid {
						grid-template-columns: repeat(2, 1fr);
					}
				}
				@media (max-width: 560px) {
					.bf-hero-bg-letter {
						font-size: 10rem;
					}
					.bf-hero-title {
						font-size: 2rem;
					}
					.bf-hero-side {
						flex-direction: column;
					}
					.bf-cards-grid {
						grid-template-columns: 1fr;
					}
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
