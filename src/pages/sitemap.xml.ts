import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CATEGORIES, SITE_URL } from '../consts';
import { collectTags } from '../utils/tags';

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
	const now = new Date();
	const posts = await getCollection(
		'blog',
		({ data }) => !data.draft && !data.seo?.noindex && data.pubDate <= now,
	);

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

	const all = [...staticEntries, ...blogPageEntries, ...categoryEntries, ...tagEntries, ...postEntries];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
	.map(
		(e) => `  <url>
    <loc>${e.url}</loc>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
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
