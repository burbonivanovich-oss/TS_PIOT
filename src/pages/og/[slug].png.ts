import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { CollectionEntry } from 'astro:content';
import { publishedPosts } from '../../utils/posts';
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
const fontHeadRegular = fs.readFileSync(path.join(fontsDir, 'commissioner-regular.woff'));
const fontHeadBold = fs.readFileSync(path.join(fontsDir, 'commissioner-bold.woff'));
const fontBodyRegular = fs.readFileSync(path.join(fontsDir, 'geologica-regular.woff'));
const fontBodyBold = fs.readFileSync(path.join(fontsDir, 'geologica-bold.woff'));
const fontLatRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-regular.woff'));
const fontLatBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-bold.woff'));
const fontLatExtRegular = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-regular.woff'));
const fontLatExtBold = fs.readFileSync(path.join(fontsDir, 'inter-latin-ext-bold.woff'));

export async function getStaticPaths() {
	const posts = await publishedPosts();
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

// Цвета по категории — полоса и бейдж
const CAT_STRIPE: Record<string, string> = {
	'ts-piot':         '#AFCC00',
	'markirovka':      '#9E2B4F',
	'zakonodatelstvo': '#AFCC00',
	'kkt':             '#AFCC00',
	'egais':           '#AFCC00',
};
const CAT_BADGE_BG: Record<string, string> = {
	'ts-piot':         '#AFCC00',
	'markirovka':      '#9E2B4F',
	'zakonodatelstvo': '#AFCC00',
	'kkt':             '#AFCC00',
	'egais':           '#AFCC00',
};
const CAT_BADGE_COLOR: Record<string, string> = {
	'ts-piot':         '#111',
	'markirovka':      '#fff',
	'zakonodatelstvo': '#111',
	'kkt':             '#111',
	'egais':           '#111',
};

export async function GET({ props }: { props: Props }) {
	const { post } = props;
	const cat = post.data.categories[0] as keyof typeof CATEGORIES | undefined;
	const catLabel = cat ? CATEGORIES[cat]?.title?.toUpperCase() : '';
	const stripe    = (cat && CAT_STRIPE[cat])     ?? '#AFCC00';
	const badgeBg   = (cat && CAT_BADGE_BG[cat])   ?? '#AFCC00';
	const badgeColor = (cat && CAT_BADGE_COLOR[cat]) ?? '#111';

	const bgDataUri = cat ? loadBgDataUri(cat) : null;

	const headingStack = "'Commissioner', 'InterLat', 'InterLatExt'";
	const bodyStack    = "'Geologica', 'InterLat', 'InterLatExt'";
	const titleText = escapeHtml(post.data.title);
	const catText   = escapeHtml(catLabel ?? '');

	// Размер заголовка под длину
	const titleLen  = post.data.title.length;
	const titleSize = titleLen > 80 ? 46 : titleLen > 55 ? 56 : 66;

	const catBadge = catText
		? `<div style="display:flex; padding:5px 16px; background:${badgeBg}; color:${badgeColor}; font-size:18px; font-weight:700; letter-spacing:3px; margin-bottom:32px; align-self:flex-start; font-family:${bodyStack};">${catText}</div>`
		: '';

	const outerBg = bgDataUri
		? `background-image:url(${bgDataUri}); background-size:cover; background-position:center;`
		: `background:#111;`;
	const overlayBg = bgDataUri ? `background:rgba(0,0,0,0.68);` : '';

	const markupString = `
		<div style="display:flex; width:100%; height:100%; ${outerBg} font-family:${bodyStack};">
			<div style="display:flex; flex-direction:row; width:100%; height:100%; ${overlayBg}">
				<div style="display:flex; width:10px; background:${stripe}; flex-shrink:0;"></div>
				<div style="display:flex; flex-direction:column; flex:1; padding:52px 68px;">

					<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:auto;">
						<div style="display:flex; font-size:28px; font-weight:700; color:#fff; letter-spacing:3px; font-family:${headingStack};">ЭТИКЕТКА</div>
						<div style="display:flex; font-size:13px; font-weight:600; color:rgba(255,255,255,0.4); letter-spacing:4px; text-transform:uppercase; margin-left:4px;">МЕДИА</div>
					</div>

					<div style="display:flex; flex-direction:column; flex:1; justify-content:center; padding:24px 0;">
						${catBadge}
						<div style="display:flex; font-size:${titleSize}px; font-weight:700; color:#ffffff; line-height:1.12; letter-spacing:0.5px; font-family:${headingStack}; text-transform:uppercase;">${titleText}</div>
					</div>

					<div style="display:flex; align-items:center; gap:16px; font-size:18px; color:rgba(255,255,255,0.3); font-family:${bodyStack}; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
						<div style="display:flex;">этикетка.рф</div>
						<div style="display:flex; width:4px; height:4px; background:rgba(255,255,255,0.2);"></div>
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
			{ name: 'Commissioner', data: fontHeadRegular, weight: 400, style: 'normal' },
			{ name: 'Commissioner', data: fontHeadBold, weight: 700, style: 'normal' },
			{ name: 'Geologica', data: fontBodyRegular, weight: 400, style: 'normal' },
			{ name: 'Geologica', data: fontBodyBold, weight: 700, style: 'normal' },
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
