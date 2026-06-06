#!/usr/bin/env node
/**
 * Генерирует src/data/shop-catalog.ts из эталонного фида товаров
 * (workhardmarish.github.io/kontur-feed). Переносит товары, цены и
 * ссылки на фото; наши сервисы Контура добавляются секцией из
 * STOREFRONT_PRODUCTS уже в самом TS-модуле (здесь не трогаются).
 *
 * Запуск:
 *   node scripts/shop/sync-feed.mjs
 *   FEED_URL=https://.../ node scripts/shop/sync-feed.mjs
 *
 * Требует доступ в сеть к домену фида. Цены в шапке файла помечаются
 * датой запуска.
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'src/data/shop-catalog.ts');
const FEED_URL = process.env.FEED_URL || 'https://workhardmarish.github.io/kontur-feed/';

const grab = (re, s, d = '') => {
	const m = s.match(re);
	if (!m) return d;
	for (let i = 1; i < m.length; i++) if (m[i]) return m[i].trim();
	return d;
};
const clean = s => (s || '').replace(/ /g, ' ').replace(/&nbsp;/g, ' ').trim();
const num = txt => {
	const t = clean(txt).replace(/[^\d]/g, '');
	return t ? parseInt(t, 10) : null;
};
const cartId = c => grab(/^\s*'([^']*)'/, c || '');
const cartPrice = c => {
	const m = (c || '').match(/,\s*([\d.]+)\s*$/);
	return m ? Math.round(parseFloat(m[1])) : null;
};

function parse(html) {
	const sections = [];
	const secRe = /<section class="sec"([^>]*)>([\s\S]*?)<\/section>/g;
	let s;
	while ((s = secRe.exec(html))) {
		const [, attrs, body] = s;
		const title = clean(grab(/<h2 class="sec-h">([^<]*)<\/h2>/, body));
		let id = grab(/id="([^"]*)"/, attrs);
		if (!id) id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ofd';
		const eyeM = body.match(/<div class="sec-eye"[^>]*style="color:([^"]*)"[^>]*>([^<]*)<\/div>/);
		const items = [];
		const pRe = /<div class="pcard">([\s\S]*?)(?=<div class="pcard">|<\/div><\/div><\/section>|$)/g;
		let p;
		while ((p = pRe.exec(body))) {
			const blk = p[1];
			const name = clean(grab(/class="pcard-name">([^<]*)</, blk));
			if (!name) continue;
			const cart = grab(/addToCart\(([^)]*)\)/, blk);
			items.push({
				id: cartId(cart) || name.slice(0, 8),
				name,
				desc: clean(grab(/class="pcard-desc">([^<]*)</, blk)),
				img: grab(/<img src="([^"]*)"/, blk),
				cat: clean(grab(/class="pcard-cat">([^<]*)</, blk)),
				price: cartPrice(cart) ?? num(grab(/class="pcard-price">([^<]*)</, blk)),
				priceLabel: clean(grab(/class="pcard-price">([^<]*)</, blk)),
			});
		}
		const kRe = /<div class="kcard"([\s\S]*?)(?=<div class="kcard"|<\/div><\/div><\/section>|$)/g;
		let k;
		while ((k = kRe.exec(body))) {
			const blk = k[1];
			const name = clean(grab(/class="kcard-name">([^<]*)</, blk));
			if (!name) continue;
			const cart = grab(/addToCart\(([^)]*)\)/, blk);
			items.push({
				id: cartId(cart) || name.slice(0, 8),
				name,
				desc: clean(grab(/class="kcard-desc">([^<]*)</, blk)),
				img: grab(/<img src="([^"]*)"/, blk),
				cat: '',
				price: cartPrice(cart) ?? num(grab(/<strong>([^<]*)<\/strong>/, blk)),
				priceLabel: clean(grab(/<strong>([^<]*)<\/strong>/, blk)),
				oldPrice: num(grab(/class="old-price">([^<]*)</, blk)),
				oldLabel: clean(grab(/class="old-price">([^<]*)</, blk)),
				badge: 'Скидка',
				kit: true,
			});
		}
		sections.push({ id, eye: clean(eyeM?.[2] || ''), color: eyeM?.[1] || '', title, items });
	}
	return sections;
}

function emit(sections) {
	const date = new Date().toISOString().slice(0, 10);
	const ref = JSON.stringify(sections, null, 2);
	return `// Каталог-магазин /produkty/ в формате интернет-магазина.
// REF_SECTIONS сгенерированы scripts/shop/sync-feed.mjs из эталонного
// фида (${FEED_URL}, цены на ${date}). Не редактировать вручную —
// перегенерировать скриптом. Наши сервисы Контура, которых нет в фиде,
// добавляются секцией «Сервисы и софт Контура» из STOREFRONT_PRODUCTS
// (gated по erid, цена — заглушка).
import { CPA_BANNERS, STOREFRONT_PRODUCTS } from './cpa-banners';

export interface ShopItem {
\tid: string;
\tname: string;
\tdesc: string;
\timg?: string;
\tvisual?: { abbrev: string; bg: string };
\tcat?: string;
\tprice: number | null;
\tpriceLabel: string;
\toldPrice?: number | null;
\toldLabel?: string;
\tbadge?: string;
\tkit?: boolean;
\thref?: string;
}

export interface ShopSection {
\tid: string;
\teye: string;
\tcolor: string;
\ttitle: string;
\titems: ShopItem[];
}

const REF_SECTIONS: ShopSection[] = ${ref};

// Наши сервисы Контура, которых нет в фиде. Берём только офферы с
// erid (STOREFRONT_PRODUCTS), исключая те, что уже есть в фиде.
const REF_OVERLAP = ['kontur-market', 'kontur-ofd', 'kontur-diadoc'];
const ourItems: ShopItem[] = STOREFRONT_PRODUCTS
\t.filter(p => !REF_OVERLAP.includes(p.bannerId))
\t.map(p => {
\t\tconst b = CPA_BANNERS[p.bannerId];
\t\treturn {
\t\t\tid: 'svc-' + p.bannerId,
\t\t\tname: b.eyebrow.replace(/^Реклама\\s*·\\s*/u, '').trim(),
\t\t\tdesc: b.description,
\t\t\tvisual: b.visual,
\t\t\tcat: 'Сервисы Контура',
\t\t\tprice: null,
\t\t\tpriceLabel: 'по запросу',
\t\t\thref: \`/produkty/\${p.slug}/\`,
\t\t};
\t});

const OUR_SECTION: ShopSection = {
\tid: 'servisy',
\teye: 'Сервисы',
\tcolor: '#ff4d8f',
\ttitle: 'Сервисы и софт Контура',
\titems: ourItems,
};

export const SHOP_SECTIONS: ShopSection[] = [...REF_SECTIONS, OUR_SECTION];
`;
}

async function main() {
	console.log(`Загрузка фида: ${FEED_URL}`);
	const res = await fetch(FEED_URL);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	const html = await res.text();
	const sections = parse(html);
	const items = sections.reduce((n, s) => n + s.items.length, 0);
	if (!sections.length || !items) throw new Error('не удалось распарсить товары — изменилась разметка фида?');
	writeFileSync(OUT, emit(sections), 'utf8');
	console.log(`Готово: ${sections.length} секций, ${items} товаров → src/data/shop-catalog.ts`);
}

main().catch(e => {
	console.error('Ошибка:', e.message);
	process.exit(1);
});
