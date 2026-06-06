import type { APIRoute } from 'astro';
import { CATEGORIES, SITE_URL } from '../consts';
import { collectTags } from '../utils/tags';
import { publishedPosts } from '../utils/posts';
import { SHOP_SECTIONS } from '../data/shop-catalog';
import { STOREFRONT_PRODUCTS } from '../data/cpa-banners';
import { COMPARISONS } from '../data/comparisons';

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

	// Paginated blog pages (page 1 = /blog/, page 2+ = /blog/2/ etc.)
	const totalBlogPages = Math.ceil(posts.length / BLOG_PAGE_SIZE);
	const blogPageEntries: SitemapEntry[] = Array.from({ length: totalBlogPages }, (_, i) => {
		const pageNum = i + 1;
		const path = pageNum === 1 ? '/blog/' : `/blog/${pageNum}/`;
		return entry(path, '0.7', 'daily');
	});

	// Tag pages
	const tagSlugs = Object.keys(collectTags(posts));
	const tagEntries: SitemapEntry[] = tagSlugs.map((slug) =>
		entry(`/tag/${slug}/`, '0.4', 'weekly'),
	);

	const staticEntries: SitemapEntry[] = [
		entry('/', '1.0', 'daily'),
		entry('/slovar/', '0.7', 'weekly'),
		entry('/kalkulyator-shtrafov/', '0.7', 'monthly'),
		entry('/kalendar-markirovki/', '0.6', 'weekly'),
		entry('/about/', '0.4', 'monthly'),
		entry('/about/avtor/', '0.4', 'monthly'),
		entry('/privacy/', '0.2', 'yearly'),
	];

	const categoryEntries: SitemapEntry[] = Object.keys(CATEGORIES).map((slug) =>
		entry(`/category/${slug}/`, '0.9', 'weekly'),
	);

	const postEntries: SitemapEntry[] = posts.map((post) =>
		entry(
			`/blog/${post.id}/`,
			'0.8',
			'monthly',
			toDate(post.data.updatedDate ?? post.data.pubDate),
		),
	);

	// Магазин: витрина, воронка, страницы товаров и сервисов, сравнения.
	const shopEntries: SitemapEntry[] = [
		entry('/produkty/', '0.9', 'daily'),
		entry('/produkty/sravnenie/', '0.4', 'weekly'),
		entry('/podbor/', '0.6', 'monthly'),
		entry('/sravneniya/', '0.6', 'monthly'),
	];
	const shopProductEntries: SitemapEntry[] = SHOP_SECTIONS
		.flatMap((s) => s.items)
		.filter((i) => i.slug)
		.map((i) => entry(`/produkty/tovar/${i.slug}/`, '0.7', 'weekly'));
	const serviceEntries: SitemapEntry[] = STOREFRONT_PRODUCTS.map((p) =>
		entry(`/produkty/${p.slug}/`, '0.6', 'weekly'),
	);
	const comparisonEntries: SitemapEntry[] = COMPARISONS.map((c) =>
		entry(`/sravneniya/${c.slug}/`, '0.5', 'monthly'),
	);

	const all = [
		...staticEntries,
		...shopEntries,
		...shopProductEntries,
		...serviceEntries,
		...comparisonEntries,
		...blogPageEntries,
		...categoryEntries,
		...tagEntries,
		...postEntries,
	];

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
