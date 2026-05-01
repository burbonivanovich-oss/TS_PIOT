import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			previewImage: z.string().optional(),
			tags: z.array(z.string()).default([]),
			categories: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			author: z.string().default('Beard Blog'),
			readingTime: z.string().optional(),
			lastModified: z.coerce.date().optional(),
			seo: z.object({
				canonical: z.string().optional(),
				noindex: z.boolean().default(false),
				keywords: z.array(z.string()).default([]),
			}).optional(),
			faq: z.array(z.object({
				question: z.string(),
				answer: z.string(),
			})).optional(),
		}),
});

const wiki = defineCollection({
	// Load wiki/research files
	loader: glob({ base: './src/content/wiki', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().optional(),
			createdDate: z.coerce.date(),
			lastModified: z.coerce.date().optional(),
			tags: z.array(z.string()).default([]),
			type: z.enum(['research', 'note', 'reference']).default('note'),
			status: z.enum(['draft', 'published', 'archived']).default('draft'),
		}),
});

const pillars = defineCollection({
	// Pillar-страницы категорий: тело Markdown + ключевые даты + FAQ.
	// id файла должен совпадать со slug категории из CATEGORIES в src/consts.ts.
	loader: glob({ base: './src/content/pillars', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string().optional(),
		summary: z.string().optional(),
		keyDates: z
			.array(
				z.object({
					date: z.string(),
					event: z.string(),
				}),
			)
			.default([]),
		faq: z
			.array(
				z.object({
					question: z.string(),
					answer: z.string(),
				}),
			)
			.default([]),
	}),
});

const glossary = defineCollection({
	// Глоссарий ключевых терминов: тело Markdown + связанные ссылки.
	loader: glob({ base: './src/content/glossary', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		term: z.string(),
		aliases: z.array(z.string()).default([]),
		summary: z.string().optional(),
		category: z
			.enum(['ts-piot', 'markirovka', 'zakonodatelstvo'])
			.optional(),
		relatedLinks: z
			.array(
				z.object({
					label: z.string(),
					url: z.string(),
				}),
			)
			.default([]),
	}),
});

export const collections = { blog, wiki, pillars, glossary };
