import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { type CollectionEntry, getCollection } from 'astro:content';
import satori from 'satori';
import { html } from 'satori-html';
import { CATEGORIES, SITE_TITLE } from '../../consts';

function loadBgDataUri(cat: string): string | null {
	// Предпочитаем JPEG (меньше размер → быстрый data URI), PNG — фолбэк
	for (const [ext, mime] of [['jpg', 'image/jpeg'], ['png', 'image/png']] as const) {
		const bgPath = path.resolve(`./public/og-backgrounds/${cat}.${ext}`);
		if (fs.existsSync(bgPath)) {
			return `data:${mime};base64,${fs.readFileSync(bgPath).toString('base64')}`;
		}
	}
	return null;
}

const fontsDir = path.resolve('./public/fonts');
const fontCyrRegular = fs.readFileSync(path.join(fontsDir, 'inter-regular.woff'));
const fontCyrBold = fs.readFileSync(path.join(fontsDir, 'inter-bold.woff'));
const fontLatRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff'));
const fontLatBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff'));
const fontLatExtRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff'));
const fontLatExtBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff'));

export async function getStaticPaths() {
	const posts = await getCollection('blog', ({ data }) => !data.draft);
	return posts.map((post) => ({
		params: { slug: post.id },
		props: { post },
	}));
}

interface Props {
	post: CollectionEntry<'blog'>;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// Цвет акцента по категории — левая вертикальная полоса и тег
const CAT_ACCENT: Record<string, string> = {
	'ts-piot':        '#3b82f6', // blue-500
	'markirovka':     '#10b981', // emerald-500
	'zakonodatelstvo':'#f59e0b', // amber-500
};

export async function GET({ props }: { props: Props }) {
	const { post } = props;
	const cat = post.data.categories[0] as keyof typeof CATEGORIES | undefined;
	const catLabel = cat ? CATEGORIES[cat]?.title?.toUpperCase() : '';
	const accent = (cat && CAT_ACCENT[cat]) ?? '#3b82f6';

	const bgDataUri = cat ? loadBgDataUri(cat) : null;

	const fontStack = "'InterCyr', 'InterLat', 'InterLatExt'";
	const titleText = escapeHtml(post.data.title);
	const siteText = escapeHtml(SITE_TITLE);
	const catText = escapeHtml(catLabel ?? '');

	// Подбираем размер заголовка под длину — длинные заголовки уменьшаем
	const titleLen = post.data.title.length;
	const titleSize = titleLen > 80 ? 48 : titleLen > 55 ? 56 : 64;

	const catTag = catText
		? `<div style="display:flex; padding:6px 18px; background:${accent}22; color:${accent}; border:1px solid ${accent}44; border-radius:4px; font-size:20px; font-weight:700; letter-spacing:2px; margin-bottom:28px; align-self:flex-start;">${catText}</div>`
		: '';

	// bgDataUri используется как background-image на внешнем wrapper.
	// Overlay rgba(0,0,0,0.6) — на вложенном flex-контейнере, без position:absolute.
	const outerBg = bgDataUri
		? `background-image:url(${bgDataUri}); background-size:cover; background-position:center;`
		: `background:#0d0d0d;`;
	const overlayBg = bgDataUri ? `background:rgba(0,0,0,0.60);` : '';

	const markupString = `
		<div style="display:flex; width:100%; height:100%; ${outerBg} font-family:${fontStack};">
			<div style="display:flex; flex-direction:row; width:100%; height:100%; ${overlayBg}">
				<div style="display:flex; width:8px; background:${accent}; flex-shrink:0;"></div>
				<div style="display:flex; flex-direction:column; flex:1; padding:56px 64px;">
					<div style="display:flex; align-items:center; gap:14px;">
						<div style="display:flex; width:52px; height:52px; border-radius:10px; background:${accent}; color:#fff; align-items:center; justify-content:center; font-size:20px; font-weight:700; letter-spacing:-0.5px;">Р·Б</div>
						<div style="display:flex; font-size:22px; font-weight:700; color:rgba(255,255,255,0.5); letter-spacing:0.5px;">${siteText}</div>
					</div>
					<div style="display:flex; flex-direction:column; flex:1; justify-content:center; padding:32px 0 24px;">
						${catTag}
						<div style="display:flex; font-size:${titleSize}px; font-weight:700; color:#ffffff; line-height:1.15; letter-spacing:-0.5px;">${titleText}</div>
					</div>
					<div style="display:flex; align-items:center; gap:12px; font-size:20px; color:rgba(255,255,255,0.25);">
						<div style="display:flex;">reglament-biznes.ru</div>
						<div style="display:flex; width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,0.2);"></div>
						<div style="display:flex;">Для малого и среднего бизнеса</div>
					</div>
				</div>
			</div>
		</div>
	`;

	const markup = html(markupString);

	const svg = await satori(markup as Parameters<typeof satori>[0], {
		width: 1200,
		height: 630,
		fonts: [
			{ name: 'InterCyr', data: fontCyrRegular, weight: 400, style: 'normal' },
			{ name: 'InterCyr', data: fontCyrBold, weight: 700, style: 'normal' },
			{ name: 'InterLat', data: fontLatRegular, weight: 400, style: 'normal' },
			{ name: 'InterLat', data: fontLatBold, weight: 700, style: 'normal' },
			{ name: 'InterLatExt', data: fontLatExtRegular, weight: 400, style: 'normal' },
			{ name: 'InterLatExt', data: fontLatExtBold, weight: 700, style: 'normal' },
		],
	});

	const png = new Resvg(svg).render().asPng();

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=31536000, immutable',
		},
	});
}
