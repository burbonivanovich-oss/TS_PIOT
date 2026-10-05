// Bounded commercial-conversion tests: exact referral mapping + invariants.
// Source-readback style (no TS imports): asserts on file text and on the
// referral contract, not on repeated copy. Covers the home → /produkty/
// task → 3 product pages path and its negative guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const HOME = read('src/pages/index.astro');
const CATALOG = read('src/pages/produkty/index.astro');
const SLUG = read('src/pages/produkty/[slug].astro');
const BANNERS = read('src/data/cpa-banners.ts');
const COPY = read('src/data/product-commercial-copy.ts');

const SUPPLIER_UID = '0d1c45d7-c296-4b0a-bb3c-72cac0b27d60';
const EXPECTED_HREF = {
	'kontur-market': 'https://kontur.ru/market/kkt?p=f74746',
	'kontur-ofd': 'https://kontur.ru/ofd/price?p=f74746',
	'kontur-markirovka': 'https://kontur.ru/markirovka?p=f74746',
};
const EXPECTED_WIDGET = {
	'kontur-market': { productId: 'Egais', productName: 'market', source: 'etiketka: Маркет' },
	'kontur-ofd': { productId: 'Ofd', productName: 'ofd', source: 'etiketka: ОФД' },
	'kontur-markirovka': { productId: 'Marking', productName: 'markirovka', source: 'etiketka: Маркировка' },
};
/** Независимое определение атрибуции: внешний URL с непустым параметром p=. */
function isAttributed(href) {
	if (!href || href.startsWith('/') || href.startsWith('#')) return false;
	if (!/^https?:\/\//i.test(href)) return false;
	const m = href.match(/[?&]p=([^&#]*)/);
	return !!m && m[1].length > 0;
}
function bannerBlock(id) {
	const i = BANNERS.indexOf(`'${id}':`);
	assert.ok(i !== -1, `баннер ${id} не найден`);
	// Баланс скобок от открывающей «{» баннера: вложенные visual/widget не обрезают блок.
	let depth = 0;
	let started = false;
	for (let j = i; j < BANNERS.length; j++) {
		const ch = BANNERS[j];
		if (ch === '{') { depth++; started = true; }
		if (ch === '}') {
			depth--;
			if (started && depth === 0) return BANNERS.slice(i, j + 1);
		}
	}
	throw new Error(`блок баннера ${id} не закрыт`);
}

// 1. Главная: коммерческий CTA — прямой статический маршрут, не /podbor/.
test('home: коммерческий hero-CTA ведёт на /produkty/#retail-tasks, читательский — на статьи', () => {
	assert.ok(HOME.includes('/produkty/#retail-tasks'), 'нет прямого маршрута на задачу каталога');
	const heroCta = HOME.slice(HOME.indexOf('hero-cta'), HOME.indexOf('hero-cta') + 600);
	assert.ok(!heroCta.includes('/podbor/'), 'коммерческий CTA всё ещё требует /podbor/');
	assert.ok(heroCta.includes('/blog/'), 'читательский маршрут на статьи потерян');
});

// 2. Каталог: статичный блок розничных задач с тремя прямыми внутренними путями.
test('catalog: #retail-tasks с тремя прямыми ссылками на страницы продуктов', () => {
	assert.ok(CATALOG.includes('id="retail-tasks"'), 'нет блока с id retail-tasks');
	assert.ok(CATALOG.includes('RETAIL_TASKS'), 'блок не связан с данными задач');
	for (const slug of Object.keys(EXPECTED_HREF)) {
		assert.ok(
			COPY.includes(`href: '/produkty/${slug}/'`),
			`задача без прямого пути на /produkty/${slug}/`,
		);
	}
	const taskCount = (COPY.match(/href: '\/produkty\//g) || []).length;
	assert.equal(taskCount, 3, `задач должно быть ровно 3, найдено ${taskCount}`);
});

// 3. Точные внешние назначения + атрибуция (никаких перекрёстных офферов).
test('referral: три продукта указывают на точные URL с p=f74746, без перекрёста', () => {
	for (const [id, href] of Object.entries(EXPECTED_HREF)) {
		const block = bannerBlock(id);
		assert.ok(block.includes(`ctaHref: '${href}'`), `${id}: ctaHref не совпадает с контрактом`);
		assert.ok(isAttributed(href), `${id}: ссылка не проходит независимую проверку атрибуции`);
	}
	const market = bannerBlock('kontur-market');
	assert.ok(!market.includes('/ofd/'), 'kontur-market указывает на чужой оффер ОФД');
	const ofd = bannerBlock('kontur-ofd');
	assert.ok(ofd.includes('/ofd/price'), 'kontur-ofd не ведёт на прайс-путь');
	assert.ok(!ofd.includes('/market/'), 'kontur-ofd указывает на чужой оффер Маркета');
});

// 4. Виджет-конфиги трёх продуктов — дословно (ProductId/ProductName/SupplierUid/Source).
test('widget: ProductId/ProductName/SupplierUid/Source трёх продуктов без изменений', () => {
	for (const [id, w] of Object.entries(EXPECTED_WIDGET)) {
		const block = bannerBlock(id);
		assert.ok(block.includes(`productId: '${w.productId}'`), `${id}: ProductId изменён`);
		assert.ok(block.includes(`productName: '${w.productName}'`), `${id}: ProductName изменён`);
		assert.ok(block.includes(`supplierUid: '${SUPPLIER_UID}'`), `${id}: SupplierUid изменён`);
		assert.ok(block.includes(`source: '${w.source}'`), `${id}: Source изменён`);
	}
});

// 5. Негативы атрибуции: пустой/неверный партнёрский параметр и generic-главная отвергаются.
test('attribution negatives: пустой p, неверный оффер и внутренняя ссылка — не атрибуция', () => {
	assert.equal(isAttributed('https://kontur.ru/ofd/price'), false, 'URL без p= принят');
	assert.equal(isAttributed('https://kontur.ru/ofd/price?p='), false, 'пустой p= принят');
	assert.equal(isAttributed('https://kontur.ru/?p=f74746'), true, 'базовая проверка сломана');
	for (const href of Object.values(EXPECTED_HREF)) {
		assert.ok(href !== 'https://kontur.ru/?p=f74746', 'продукт ведёт на generic-главную вместо своего URL');
		assert.ok(href.includes('p=f74746'), 'партнёрский тег потерян');
	}
	assert.equal(isAttributed('/produkty/kontur-ofd/'), false, 'внутренняя ссылка принята за атрибуцию');
	assert.equal(isAttributed('#lead'), false, 'якорь принят за атрибуцию');
});

// 6. Переопределения только для трёх продуктов; без недоказанных гарантий.
test('overrides: только три продукта, без сроков «15 минут/от 1 дня/тот же день/без простоя»', () => {
	for (const slug of Object.keys(EXPECTED_HREF)) {
		assert.ok(COPY.includes(`'${slug}':`), `нет переопределения для ${slug}`);
	}
	const overrideSlugs = (COPY.match(/'(kontur-(market|ofd|markirovka))':/g) || []).length;
	assert.ok(overrideSlugs >= 3, 'переопределения трёх продуктов отсутствуют');
	for (const banned of ['15 минут', 'от 1 дня', 'тот же рабочий день', 'без простоя']) {
		assert.ok(!COPY.includes(banned), `недоказанная гарантия в переопределениях: «${banned}»`);
	}
	assert.ok(!COPY.includes('p=f74746'), 'внешние URL не должны дублироваться в copy-хелпере');
});

// 7. Страница продукта: decision-контент трёх продуктов берётся из переопределений.
test('slug: override-продукты рендерят свой сценарий/подготовку/FAQ, остальные — как раньше', () => {
	assert.ok(SLUG.includes('PRODUCT_COMMERCIAL_OVERRIDES'), 'нет импорта переопределений');
	assert.ok(SLUG.includes('override ? override.stats'), 'stats не переключаются на override');
	assert.ok(SLUG.includes('override ? override.faq'), 'faq не переключаются на override');
	assert.ok(SLUG.includes('Что подготовить'), 'нет блока подготовки решения');
	assert.ok(SLUG.includes('Что определяет Контур'), 'нет блока решения Контура');
	assert.ok(SLUG.includes('разберёт вашу задачу'), 'нейтральный заголовок виджета для override отсутствует');
});

// 8. Двойной CTA: консультация и внешняя ссылка рядом, на всех ширинах, с маркировкой.
test('slug: attributed external CTA виден рядом с консультацией, с rel/disclosure', () => {
	assert.ok(SLUG.includes('pp-hero-cta'), 'нет блока двойного CTA в hero');
	assert.ok(SLUG.includes('pp-btn-outline'), 'нет видимой второй кнопки');
	assert.ok(SLUG.includes('pp-cta-btns'), 'нет двойного CTA в финальном блоке');
	assert.ok(SLUG.includes('rel="sponsored nofollow noopener"'), 'потерян sponsored-rel у внешних CTA');
	assert.ok(SLUG.includes('target="_blank"'), 'внешние CTA не открываются в новой вкладке');
	assert.ok(SLUG.includes('data-cpa-id'), 'потеряна CPA-привязка внешних CTA');
	assert.ok(SLUG.includes('Без JavaScript'), 'нет честной no-JS подсказки у двойного CTA');
	assert.ok(SLUG.includes('ни к чему не обязывает'), 'нет честной оговорки про заявку');
});

// 9. Режимы покупки трёх продуктов не тронуты (Market/Markirovka consultative, OFD easy-buy).
test('purchase modes: Market/Markirovka consultative, OFD easy-buy — без регресса', () => {
	const entryMode = slug => {
		const i = BANNERS.indexOf(`slug: '${slug}'`);
		const block = BANNERS.slice(i, BANNERS.indexOf('},', BANNERS.indexOf(`slug: '${slug}'`)) + 2);
		return (block.match(/purchaseMode: '([^']+)'/) || [])[1];
	};
	assert.equal(entryMode('kontur-market'), 'consultative');
	assert.equal(entryMode('kontur-markirovka'), 'consultative');
	assert.equal(entryMode('kontur-ofd'), 'easy-buy');
	assert.ok(SLUG.includes('resolveProductCta'), 'CTA берутся не из единого источника');
});

// 10. erid-сторож и виджет-фолбэк сохранены.
test('guards: страницы только с erid, форма только с erid, CTA-ссылки не выдуманы', () => {
	assert.ok(SLUG.includes('CPA_BANNERS[product.bannerId]?.erid'), 'getStaticPaths не фильтрует по erid');
	assert.ok(SLUG.includes('banner.widget && banner.erid'), 'форма рендерится без erid-сторожа');
	assert.ok(SLUG.includes('KonturOrderWidget'), 'официальный виджет потерян');
	assert.ok(SLUG.includes('CpaCallout'), 'реферальный фолбэк потерян');
	assert.ok(!SLUG.includes('kontur.ru/market/kkt?p=') || SLUG.includes('cta.primary.href'), 'URL вшит в шаблон вместо единого источника');
});

// 11. CV-A1: retail-блок вне pill-навигации, селекторы ограничены прямыми детьми.
test('cv-a1: retail-tasks вне .catalog-nav, pill-стили только для прямых детей', () => {
	const navStart = CATALOG.indexOf('class="catalog-nav"');
	assert.ok(navStart !== -1, 'нет .catalog-nav');
	const retailPos = CATALOG.indexOf('id="retail-tasks"');
	assert.ok(retailPos !== -1, 'нет #retail-tasks');
	// retail-секция не должна быть внутри .catalog-nav (ищем закрытие nav до retail).
	const navSlice = CATALOG.slice(navStart, retailPos);
	assert.ok(navSlice.includes('</div>'), 'retail-tasks всё ещё внутри .catalog-nav');
	// Каскад пилюль ограничен прямыми детьми: нет голого ".catalog-nav a".
	const barePill = /\.catalog-nav\s+a\s*\{/.test(CATALOG);
	assert.equal(barePill, false, 'селектор .catalog-nav a задевает карточки');
	assert.ok(CATALOG.includes('.catalog-nav > a'), 'нет scoped-селектора .catalog-nav > a');
	// Карточки всё ещё ровно три и ведут на те же внутренние маршруты.
	for (const slug of Object.keys(EXPECTED_HREF)) {
		assert.ok(COPY.includes(`href: '/produkty/${slug}/'`), `потерян маршрут /produkty/${slug}/`);
	}
});

// 12. CV-A1: карточки прямоугольные со скруглением, паддинг, hover/focus, без прозрачного текста на тёмном.
test('cv-a1: retail-карточки читаемы: radius/padding/hover-focus, без прозрачности на тёмном', () => {
	assert.ok(CATALOG.includes('.retail-card'), 'нет стилей .retail-card');
	// Прямоугольное скругление карточки (10-14px), а не пилюля 999px.
	assert.ok(/\.retail-card\s*\{[^}]*border-radius:\s*10px/.test(CATALOG), 'у карточки нет прямоугольного radius 10px');
	assert.ok(!/\.retail-card\s*\{[^}]*border-radius:\s*999px/.test(CATALOG), 'карточка стала пилюлей 999px');
	assert.ok(/\.retail-card\s*\{[^}]*padding:\s*1\.1rem 1\.2rem/.test(CATALOG), 'у карточки нет достаточного паддинга');
	assert.ok(CATALOG.includes('.retail-card:hover'), 'нет hover у карточки');
	assert.ok(CATALOG.includes('.retail-card:focus-visible'), 'нет focus-visible у карточки');
	// Подзаголовок на тёмном фоне — непрозрачный светлый текст.
	assert.ok(CATALOG.includes('.retail-head p'), 'нет стилей подзаголовка retail');
	const headPara = (CATALOG.match(/\.retail-head p\s*\{[^}]*\}/) || [])[0] || '';
	assert.ok(headPara.includes('#E8E8E8'), 'подзаголовок на тёмном фоне не сплошной (#E8E8E8)');
	assert.ok(!headPara.includes('rgba(255,255,255'), 'прозрачный белый текст на тёмном фоне остался');
});

// 13. CV-A2: якорь #retail-tasks с запасом под sticky-шапку 56px (scoped clearance).
test('cv-a2: #retail-tasks имеет scoped scroll-margin под sticky-шапку', () => {
	const m = CATALOG.match(/\.retail-tasks\s*\{[^}]*scroll-margin-top:\s*([^;]+);/);
	assert.ok(m, 'нет scoped scroll-margin-top у .retail-tasks');
	const val = m[1].trim();
	const px = parseInt(val, 10);
	assert.ok(px >= 72, `#retail-tasks clearance ${val} меньше высоты шапки 56px+зазор`);
	assert.ok(!/^\s*1\.5rem/.test(val), 'остался старый clearance 1.5rem — заголовок уйдёт под шапку');
});
