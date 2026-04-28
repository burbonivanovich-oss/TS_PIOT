import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { type CollectionEntry, getCollection } from 'astro:content';
import satori from 'satori';
import { html } from 'satori-html';
import { CATEGORIES, SITE_TITLE } from '../../consts';

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

export async function GET({ props }: { props: Props }) {
	const { post } = props;
	const cat = post.data.categories[0] as keyof typeof CATEGORIES | undefined;
	const catLabel = cat ? CATEGORIES[cat]?.title : '';

	const fontStack = "'InterCyr', 'InterLat', 'InterLatExt'";
	const titleText = escapeHtml(post.data.title);
	const descText = escapeHtml(post.data.description ?? '');
	const siteText = escapeHtml(SITE_TITLE);
	const catText = escapeHtml(catLabel ?? '');

	const catChip = catText
		? `<div style="display:flex; padding:8px 20px; background:#dbeafe; color:#1d4ed8; border-radius:999px; font-size:24px; font-weight:600; margin-bottom:24px; align-self:flex-start;">${catText}</div>`
		: '';
	const descBlock = descText
		? `<div style="display:flex; font-size:28px; color:#475569; line-height:1.4; margin-top:24px;">${descText}</div>`
		: '';

	const markupString = `
		<div style="display:flex; flex-direction:column; height:100%; width:100%; background:linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%); padding:60px; box-sizing:border-box; font-family:${fontStack};">
			<div style="display:flex; align-items:center; gap:16px;">
				<div style="display:flex; width:64px; height:64px; border-radius:14px; background:#1d4ed8; color:#fff; align-items:center; justify-content:center; font-size:24px; font-weight:700;">Р·Б</div>
				<div style="display:flex; font-size:28px; font-weight:700; color:#0f172a;">${siteText}</div>
			</div>
			<div style="display:flex; flex-direction:column; flex:1; justify-content:center; padding:40px 0;">
				${catChip}
				<div style="display:flex; font-size:58px; font-weight:700; color:#0f172a; line-height:1.15;">${titleText}</div>
				${descBlock}
			</div>
			<div style="display:flex; justify-content:space-between; align-items:center; font-size:22px; color:#64748b;">
				<div style="display:flex;">reglament-biznes.ru</div>
				<div style="display:flex;">Информационный портал для МСБ</div>
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
