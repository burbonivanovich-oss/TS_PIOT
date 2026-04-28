import type { CollectionEntry } from 'astro:content';

export function tagSlug(tag: string): string {
	return tag
		.toLowerCase()
		.replace(/[^а-яёa-z0-9]+/gu, '-')
		.replace(/^-+|-+$/g, '');
}

export type TagInfo = {
	name: string;
	posts: CollectionEntry<'blog'>[];
};

export function collectTags(
	posts: CollectionEntry<'blog'>[],
): Record<string, TagInfo> {
	const map: Record<string, TagInfo> = {};
	for (const post of posts) {
		for (const tag of post.data.tags ?? []) {
			const slug = tagSlug(tag);
			if (!slug) continue;
			if (!map[slug]) {
				map[slug] = { name: tag, posts: [] };
			}
			map[slug].posts.push(post);
		}
	}
	return map;
}

export function pluralPosts(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'материал';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'материала';
	return 'материалов';
}
