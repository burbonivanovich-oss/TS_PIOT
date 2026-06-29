import type { APIRoute } from 'astro';
import { CATEGORIES, SITE_URL } from '../consts';
import { collectTags } from '../utils/tags';
import { publishedPosts } from '../utils/posts';
import { PRODUCT_CATALOG, CPA_BANNERS } from '../data/cpa-banners';

const BLOG_PAGE_SIZE = 12;

type SitemapEntry = {
	url: string;
	priority: string;
	changefreq: string;
	lastmod?: string;
};

function toDate(d: Date): string {
	return d.toISOString().split('T')[0];
}

function entry(
	path: string,
	priority: string,
	changefreq: string,
	lastmod?: string,
): SitemapEntry {
	return { url: `${SITE_URL}${path}`, priority, changefreq, lastmod };
}

export const GET: APIRoute = async () => {
	const posts = await publishedPosts((p) => !p.data.seo?.noindex);

	// Блог — одна страница (BlogFilter: клиентская фильтрация и пагинация).
	const blogPageEntries: SitemapEntry[] = [entry('/blog/', '0.7', 'daily')];

	// Tag pages
	const tagSlugs = Object.keys(collectTags(posts));
	const tagEntries: SitemapEntry[] = tagSlugs.map((slug) =>
		entry(`/tag/${slug}/`, '0.4', 'weekly'),
	);

	const staticEntries: SitemapEntry[] = [
		entry('/', '1.0', 'daily'),
		// Витрина и воронка
		entry('/produkty/', '0.8', 'weekly'),
		entry('/podbor/', '0.7', 'monthly'),
		entry('/sravneniya/', '0.7', 'weekly'),
		// Инструменты и посадочные
		entry('/instrumenty/', '0.7', 'weekly'),
		entry('/kak-rabotaet-ts-piot/', '0.7', 'monthly'),
		entry('/zakon-2026/', '0.7', 'weekly'),
		entry('/test-ts-piot/', '0.6', 'monthly'),
		entry('/test-tsepochka-edo/', '0.6', 'monthly'),
		entry('/scenario/kofeynya-za-30-dney/', '0.6', 'monthly'),
		entry('/scenario/perekhod-ip-na-ooo-za-60-dney/', '0.6', 'monthly'),
		entry('/kalkulyator-shtrafov/', '0.7', 'monthly'),
		entry('/kalendar-markirovki/', '0.6', 'weekly'),
		// Справочные
		entry('/slovar/', '0.7', 'weekly'),
		entry('/tags/', '0.4', 'weekly'),
		entry('/about/', '0.4', 'monthly'),
		entry('/about/avtor/', '0.4', 'monthly'),
		entry('/privacy/', '0.2', 'yearly'),
	];

	const categoryEntries: SitemapEntry[] = Object.keys(CATEGORIES).map((slug) =>
		entry(`/category/${slug}/`, '0.9', 'weekly'),
	);

	// Страницы продуктов витрины — только с erid (как и рендер страниц).
	const productEntries: SitemapEntry[] = PRODUCT_CATALOG
		.filter((p) => CPA_BANNERS[p.bannerId]?.erid)
		.map((p) => entry(`/produkty/${p.slug}/`, '0.7', 'monthly'));

	const postEntries: SitemapEntry[] = posts.map((post) =>
		entry(
			`/blog/${post.id}/`,
			'0.8',
			'monthly',
			toDate(post.data.updatedDate ?? post.data.pubDate),
		),
	);

	const all = [...staticEntries, ...productEntries, ...blogPageEntries, ...categoryEntries, ...tagEntries, ...postEntries];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
	.map(
		(e) => `  <url>
    <loc>${e.url}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`,
	)
	.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};
