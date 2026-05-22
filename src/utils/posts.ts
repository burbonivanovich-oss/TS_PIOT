import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/**
 * Все опубликованные посты блога: не draft и с прошедшим
 * pubDate. Единый источник правды — чтобы фильтр не разъезжался
 * между sitemap, related, OG-генерацией, тегами и т. д.
 *
 * Принимает опциональный дополнительный фильтр для специальных
 * случаев (например, sitemap исключает noindex):
 *
 *   const posts = await publishedPosts();
 *   const sitemapPosts = await publishedPosts(p => !p.data.seo?.noindex);
 */
export async function publishedPosts(
	extra?: (entry: Post) => boolean,
): Promise<Post[]> {
	const now = new Date();
	return getCollection('blog', (entry) => {
		if (entry.data.draft) return false;
		if (entry.data.pubDate > now) return false;
		if (extra && !extra(entry as Post)) return false;
		return true;
	});
}
