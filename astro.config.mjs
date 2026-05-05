// @ts-check

import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: process.env.ASTRO_SITE ?? 'https://etiketka.media',
	base: process.env.ASTRO_BASE ?? '/',
	trailingSlash: 'always',
	integrations: [
		react(),
		mdx(),
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
