// product-decision-enrichment: static Market/OFD situations, CTA preservation, negatives.
// Source-readback style: asserts on file text only, no TS imports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const COPY = read('src/data/product-commercial-copy.ts');
const SLUG = read('src/pages/produkty/[slug].astro');
const BANNERS = read('src/data/cpa-banners.ts');

function bannerBlock(id) {
	const i = BANNERS.indexOf(`'${id}':`);
	assert.ok(i !== -1, `баннер ${id} не найден`);
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

// 1. Market: ровно две ситуации — новая точка и существующая касса.
// Условная формулировка: спрашивает модель/программу, ждёт вердикта Контура.
// Неблагоприятный случай: неизвестная/неподдерживаемая касса — комплект не навязывается и не исключается заранее.
test('market: две статичные ситуации, условный вердикт совместимости', () => {
	assert.ok(COPY.includes("'market-new-point'"), 'нет ситуации открытия точки');
	assert.ok(COPY.includes("'market-existing-kassa'"), 'нет ситуации существующей кассы');
	assert.ok(
		!COPY.includes('Покупать новый комплект при этом не требуется'),
		'осталось абсолютное обещание про комплект',
	);
	const from = COPY.indexOf("'market-existing-kassa'");
	const marketChunk = COPY.slice(from, COPY.indexOf("'kontur-ofd'"));
	assert.ok(marketChunk.includes('модель кассы'), 'не спрашивает модель кассы');
	assert.ok(marketChunk.includes('текущей кассовой программы'), 'не спрашивает текущую программу');
	assert.ok(marketChunk.includes('совместима ли ваша модель кассы'), 'нет вопроса о совместимости');
	assert.ok(marketChunk.includes('что из имеющегося может остаться'), 'нет разбора что остаётся');
	assert.ok(marketChunk.includes('Дождитесь вердикта Контура'), 'нет ожидания вердикта Контура');
	assert.ok(marketChunk.includes('заранее не предполагается'), 'нет немандаторной по умолчанию формулировки');
	assert.ok(!/обязательн.*купить.*комплект|купить комплект обязательно/i.test(marketChunk), 'комплект подан как обязательная покупка');
});

// 2. OFD: ровно две ситуации — продление и замена/перерегистрация.
// Условная формулировка: спрашивает срок/статус ФН, разделяет продление и замену.
// Неблагоприятные случаи: (а) работающий ФН с истекающим сроком — замена отдельно;
// (б) обычный рабочий ФН с действующим сроком — продление без подразумеваемой замены.
test('ofd: продление отдельно от замены, условный статус ФН', () => {
	assert.ok(COPY.includes("'ofd-renew'"), 'нет ситуации продления ОФД');
	assert.ok(COPY.includes("'ofd-fn-change'"), 'нет ситуации замены/перерегистрации');
	assert.ok(
		!COPY.includes('менять и покупать его для продления ОФД не требуется'),
		'осталось абсолютное обещание про ФН',
	);
	const ofdChunk = COPY.slice(COPY.indexOf("'ofd-renew'"), COPY.indexOf("'kontur-markirovka'"));
	assert.ok(ofdChunk.includes('срок действия и статус фискального накопителя'), 'не спрашивает срок/статус ФН');
	assert.ok(ofdChunk.includes('относится ли ваша задача к продлению ОФД или к замене накопителя'), 'не разделяет задачи продления и замены вопросом');
	assert.ok(ofdChunk.includes('оформляется отдельно, только если'), 'замена не помечена как отдельная условная задача');
	assert.ok(ofdChunk.includes('только если срок заканчивается или Контур подтвердит'), 'нет покрытия истекающего ФН');
	assert.ok(ofdChunk.includes('отдельная задача, а не обязательная часть продления'), 'замена подана как обязательный бандл');
	assert.ok(!/продление ОФД требует покупку ФН|ФН обязателен для продления/i.test(ofdChunk), 'продление требует покупку ФН');
	assert.ok(!/продление.*включает.*замену.*в любом случае/i.test(ofdChunk), 'замена навязана при обычном продлении');
});

// 3. Шаблон рендерит situations статично, без полей ввода и JS.
test('slug: situations рендерятся статичным HTML с якорем #lead', () => {
	assert.ok(SLUG.includes('override.situations'), 'шаблон не читает situations');
	assert.ok(SLUG.includes('pp-situations'), 'нет контейнера ситуаций');
	assert.ok(SLUG.includes('pp-situation-cta'), 'нет якорной ссылки ситуации на #lead');
	assert.ok(!/override\.situations[\s\S]{0,800}<input/.test(SLUG), 'в ситуациях появилось поле ввода');
	assert.ok(!/override\.situations[\s\S]{0,800}on:click/.test(SLUG), 'в ситуациях появился JS-обработчик');
});

// 4. Адаптив и фокус: одна колонка на узком, видимый focus, нет overflow.
test('slug: ситуации читаемы на 375/1280, фокус виден, overflow закрыт', () => {
	assert.ok(SLUG.includes('.pp-situations { display: grid; grid-template-columns: 1fr 1fr;'), 'нет двухколоночной сетки ситуаций');
	assert.ok(SLUG.includes('.pp-situations { grid-template-columns: 1fr; }'), 'нет одноколоночного collapse на узком');
	assert.ok(SLUG.includes(':focus-visible'), 'нет видимого фокуса');
	assert.ok(SLUG.includes('overflow-wrap'), 'нет защиты от горизонтального overflow');
	assert.ok(SLUG.includes('scroll-margin-top: 80px'), 'якорь #lead может уйти под шапку 56px');
});

// 5. CTA-режим и точные ссылки не тронуты.
test('cta: Market consultative + OFD easy-buy и точные href сохранены', () => {
	const market = bannerBlock('kontur-market');
	const ofd = bannerBlock('kontur-ofd');
	assert.ok(market.includes("ctaHref: 'https://kontur.ru/market/kkt?p=f74746'"), 'вторичная ссылка Маркета изменена');
	assert.ok(ofd.includes("ctaHref: 'https://kontur.ru/ofd/price?p=f74746'"), 'первичная ссылка ОФД изменена');
	assert.ok(SLUG.includes('resolveProductCta'), 'CTA берутся не из единого источника');
	assert.ok(SLUG.includes('rel="sponsored nofollow noopener"'), 'потерян sponsored-rel');
	assert.ok(SLUG.includes('data-cpa-id'), 'потеряна CPA-привязка');
});

// 6. Негативы: нет цен, сроков, скидок, доставки, blanket-ЕГАИС, моделей.
test('negatives: нет числовых цен, сроков, скидок, доставки, blanket-ЕГАИС', () => {
	const marketSituations = COPY.slice(COPY.indexOf("'market-new-point'"), COPY.indexOf("'kontur-ofd'"));
	const ofdSituations = COPY.slice(COPY.indexOf("'ofd-renew'"), COPY.indexOf("'kontur-markirovka'"));
	for (const [name, chunk] of [['market', marketSituations], ['ofd', ofdSituations]]) {
		assert.ok(!/\d+\s?(₽|руб|мес|год|дн)/.test(chunk), `${name}: числовая цена/срок в ситуациях`);
		assert.ok(!/скидк/i.test(chunk), `${name}: скидка в ситуациях`);
		assert.ok(!/бесплатн/i.test(chunk), `${name}: «бесплатно» в ситуациях`);
		assert.ok(!/доставк/i.test(chunk), `${name}: доставка в ситуациях`);
		assert.ok(!/ЕГАИС/i.test(chunk), `${name}: blanket-ЕГАИС в ситуациях`);
		assert.ok(!/ФН[-\s]?\d|Меркурий|Атол|Эвотор/i.test(chunk), `${name}: модель оборудования в ситуациях`);
	}
	assert.ok(!/на каждый срок|УСН.*срок|срок.*налог/i.test(COPY), 'рекомендация срока по налогу');
});

// 7. Маркировка и немаркет/не-ОФД контент не тронуты ситуациями.
test('scope: Маркировка без situations, переопределений ровно три', () => {
	const markStart = COPY.indexOf("'kontur-markirovka'");
	assert.ok(markStart !== -1, 'нет переопределения Маркировки');
	const markChunk = COPY.slice(markStart);
	assert.ok(!markChunk.includes('situations'), 'Маркировка получила situations');
	const overrideSlugs = (COPY.match(/'(kontur-(market|ofd|markirovka))':/g) || []).length;
	assert.equal(overrideSlugs, 3, `переопределений должно быть 3, найдено ${overrideSlugs}`);
	assert.ok(!COPY.includes('p=f74746'), 'внешние URL продублированы в copy-файле');
});

// 8. Рендер следует данным: шаблон выводит points из copy, а не захардкоженные фразы.
test('render: ситуации рендерятся из данных copy динамически', () => {
	assert.ok(SLUG.includes('s.points.map'), 'шаблон не выводит points из данных');
	assert.ok(SLUG.includes('s.title'), 'шаблон не выводит title ситуации из данных');
	assert.ok(SLUG.includes('s.lead'), 'шаблон не выводит lead ситуации из данных');
});
