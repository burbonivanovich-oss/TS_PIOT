// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://reglament-biznes.ru',
	trailingSlash: 'always',
	integrations: [
		react(),
		mdx(),
		sitemap({
			i18n: {
				defaultLocale: 'ru',
				locales: { ru: 'ru-RU' },
			},
			filter: (page) => !page.includes('/draft/'),
			changefreq: 'weekly',
			priority: 0.7,
		}),
	],
	markdown: {
		shikiConfig: {
			theme: 'github-dark',
			wrap: true,
		},
	},
	build: {
		inlineStylesheets: 'auto',
	},
	server: {
		port: 4321,
		host: true,
	},
});
