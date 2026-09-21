import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_FILE = path.join(ROOT, 'src', 'data', 'cpa-banners.ts');
const SLUG_FILE = path.join(ROOT, 'src', 'pages', 'produkty', '[slug].astro');

const src = fs.readFileSync(DATA_FILE, 'utf8');
const astroSrc = fs.readFileSync(SLUG_FILE, 'utf8');

/** Текст массива PRODUCT_CATALOG (до секции CTA/валидации). */
function catalogSection() {
	const start = src.indexOf('PRODUCT_CATALOG');
	assert.ok(start !== -1, 'PRODUCT_CATALOG не найден');
	const endMarker = src.indexOf('// ─── Режим покупки');
	const end = endMarker !== -1 ? endMarker : src.length;
	return src.slice(start, end);
}

/** Карта slug -> purchaseMode внутри PRODUCT_CATALOG. */
function catalogModes(section) {
	const slugRe = /slug:\s*'([^']+)'/g;
	const slugs = [];
	let m;
	while ((m = slugRe.exec(section)) !== null) {
		slugs.push({ slug: m[1], index: m.index });
	}
	const modes = new Map();
	for (let i = 0; i < slugs.length; i++) {
		const from = slugs[i].index;
		const to = i + 1 < slugs.length ? slugs[i + 1].index : section.length;
		const block = section.slice(from, to);
		const pm = block.match(/purchaseMode:\s*'([^']+)'/);
		modes.set(slugs[i].slug, pm ? pm[1] : null);
	}
	return modes;
}

test('ETK-P0-10 а) у каждого элемента PRODUCT_CATALOG есть purchaseMode', () => {
	const section = catalogSection();
	const modes = catalogModes(section);
	assert.ok(modes.size > 0, 'в каталоге нет элементов');
	const missing = [...modes.entries()].filter(([, v]) => !v).map(([k]) => k);
	assert.deepEqual(missing, [], `без purchaseMode: ${missing.join(', ')}`);
});

test('ETK-P0-10 б) значения purchaseMode только easy-buy или consultative', () => {
	const section = catalogSection();
	const modes = catalogModes(section);
	for (const [slug, mode] of modes) {
		assert.ok(
			mode === 'easy-buy' || mode === 'consultative',
			`${slug}: недопустимый purchaseMode "${mode}"`,
		);
	}
	const countModes = (section.match(/purchaseMode:\s*'[^']+'/g) || []).length;
	assert.equal(countModes, modes.size, 'число purchaseMode не совпадает с числом продуктов');
});

test('ETK-P0-10 в) kontur-diadoc имеет purchaseMode easy-buy', () => {
	const modes = catalogModes(catalogSection());
	assert.equal(modes.get('kontur-diadoc'), 'easy-buy');
});

test('ETK-P0-10 г) ОФД и Эльба имеют purchaseMode easy-buy', () => {
	const modes = catalogModes(catalogSection());
	assert.equal(modes.get('kontur-ofd'), 'easy-buy', 'kontur-ofd должен быть easy-buy');
	assert.equal(modes.get('kontur-elba'), 'easy-buy', 'kontur-elba должен быть easy-buy');
});

test('ETK-P0-10 д) kontur-market и kontur-markirovka имеют purchaseMode consultative', () => {
	const modes = catalogModes(catalogSection());
	assert.equal(modes.get('kontur-market'), 'consultative');
	assert.equal(modes.get('kontur-markirovka'), 'consultative');
});

test('ETK-P0-10 е) в файле есть валидация, ломающая сборку при неизвестном purchaseMode', () => {
	assert.ok(/export type PurchaseMode/.test(src), 'нет экспортируемого типа PurchaseMode');
	assert.ok(/export function resolveProductCta/.test(src), 'нет resolveProductCta');
	assert.ok(/throw new Error/.test(src), 'нет throw в валидации');
	assert.ok(
		/throw[\s\S]{0,300}purchaseMode/.test(src),
		'рядом с throw нет упоминания purchaseMode',
	);
	assert.ok(
		/validateProductCatalog\(\)|validateCatalog\(\)/.test(src),
		'валидация не вызывается на этапе импорта',
	);
});

test('ETK-P0-10 ж) в [slug].astro покупательские внешние ссылки помечены rel со sponsored', () => {
	assert.ok(
		/resolveProductCta/.test(astroSrc),
		'[slug].astro не читает CTA из resolveProductCta',
	);
	assert.ok(
		/rel="[^"]*sponsored[^"]*"/.test(astroSrc),
		'нет rel со sponsored для покупательских ссылок',
	);
	assert.ok(
		/target="_blank"/.test(astroSrc),
		'внешние покупательские ссылки должны открываться в новой вкладке',
	);
});
