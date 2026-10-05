import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleProductEntry, RETAIL_PRODUCT_IDS } from '../../src/utils/article-product-entry.mjs';
import { articleCpa } from '../../src/utils/article-cpa.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const liveCatalog = [
  { slug: 'kontur-market', bannerId: 'kontur-market' },
  { slug: 'kontur-ofd', bannerId: 'kontur-ofd' },
  { slug: 'kontur-markirovka', bannerId: 'kontur-markirovka' },
];
const liveBanners = {
  'kontur-market': { erid: 'live', ctaHref: 'https://kontur.ru/market/kkt?p=f74746' },
  'kontur-ofd': { erid: 'live', ctaHref: 'https://kontur.ru/ofd/price?p=f74746' },
  'kontur-markirovka': { erid: 'live', ctaHref: 'https://kontur.ru/markirovka?p=f74746' },
};
const live = { catalog: liveCatalog, banners: liveBanners };

test('retail ids resolve to exact internal product paths', () => {
  assert.deepEqual([...RETAIL_PRODUCT_IDS].sort(), ['kontur-market', 'kontur-markirovka', 'kontur-ofd']);
  assert.equal(articleProductEntry('kontur-market', live), '/produkty/kontur-market/');
  assert.equal(articleProductEntry('kontur-ofd', live), '/produkty/kontur-ofd/');
  assert.equal(articleProductEntry('kontur-markirovka', live), '/produkty/kontur-markirovka/');
});

test('non-retail offers never gain a retail link', () => {
  const catalog = [...liveCatalog,
    { slug: 'kontur-diadoc', bannerId: 'kontur-diadoc' },
    { slug: 'kontur-elba', bannerId: 'kontur-elba' },
  ];
  const banners = { ...liveBanners,
    'kontur-diadoc': { erid: 'live', ctaHref: 'https://diadoc.ru/order?p=f74746' },
    'kontur-elba': { erid: 'live', ctaHref: 'https://e-kontur.ru/?p=f74746' },
    'kontur-dokumenty': { erid: 'live', ctaHref: 'https://kontur.ru/documents?p=f74746' },
    'chestny-znak': { erid: '', ctaHref: '/blog/2026-05-31-chestny-znak-registraciya/' },
    'default-ts-piot': { ctaHref: '/blog/2026-05-01-ts-piot-podklyuchenie-instrukciya/' },
    'default-markirovka': { ctaHref: '/category/markirovka/' },
    'edo-operator': { erid: 'live', ctaHref: 'https://diadoc.ru/order?p=f74746' },
    'ts-piot-provider': { erid: 'live', ctaHref: 'https://kontur.ru/lp/market-ts-piot?p=f74746' },
    'online-buh': { erid: 'live', ctaHref: 'https://e-kontur.ru/?p=f74746' },
    'diadoc-logistika': { erid: 'live', ctaHref: 'https://kontur.ru/logistika?p=f74746' },
  };
  for (const id of ['kontur-diadoc', 'kontur-elba', 'kontur-dokumenty', 'chestny-znak',
    'default-ts-piot', 'default-markirovka', 'default-zakonodatelstvo',
    'edo-operator', 'ts-piot-provider', 'online-buh', 'diadoc-logistika']) {
    assert.equal(articleProductEntry(id, { catalog, banners }), null, id);
  }
});

test('unknown ids and missing data yield no link; no substring guessing', () => {
  assert.equal(articleProductEntry('no-such-offer', live), null);
  assert.equal(articleProductEntry('', live), null);
  assert.equal(articleProductEntry(null, live), null);
  assert.equal(articleProductEntry(undefined, live), null);
  assert.equal(articleProductEntry(42, live), null);
  assert.equal(articleProductEntry('market', live), null);
  assert.equal(articleProductEntry('kontur-market-extra', live), null);
  assert.equal(articleProductEntry('Kontur-Market', live), null);
  assert.equal(articleProductEntry('kontur-market', { catalog: [], banners: liveBanners }), null);
  assert.equal(articleProductEntry('kontur-market', { catalog: liveCatalog, banners: {} }), null);
  assert.equal(articleProductEntry('kontur-ofd',
    { catalog: liveCatalog, banners: { 'kontur-ofd': { ctaHref: 'https://kontur.ru/ofd/price?p=f74746' } } }), null);
  assert.equal(articleProductEntry('kontur-ofd',
    { catalog: liveCatalog, banners: { 'kontur-ofd': { erid: '  ', ctaHref: 'https://kontur.ru/ofd/price?p=f74746' } } }), null);
});

test('APE1: non-exact ids (whitespace/newline) gain no retail path', () => {
  for (const id of [' kontur-market', 'kontur-market ', ' kontur-market ',
    'kontur-market\n', '\nkontur-market', ' kontur-ofd ', 'kontur-markirovka\n',
    '\tkontur-market', 'kontur-market\t']) {
    assert.equal(articleProductEntry(id, live), null, JSON.stringify(id));
  }
  // valid exact ids still resolve
  assert.equal(articleProductEntry('kontur-market', live), '/produkty/kontur-market/');
  assert.equal(articleProductEntry('kontur-ofd', live), '/produkty/kontur-ofd/');
  assert.equal(articleProductEntry('kontur-markirovka', live), '/produkty/kontur-markirovka/');
});

test('APE1: articleCpa explicit unknown falls back to default banner, no retail link', () => {
  const banners = { ...liveBanners, 'default-ts-piot': { erid: '', ctaHref: '/blog/x/' } };
  for (const cpa of [' kontur-market ', 'kontur-market\n', ' kontur-ofd']) {
    // articleCpa preserves the explicit unknown value verbatim
    const resolved = articleCpa({ cpa }, 'default-ts-piot');
    assert.equal(resolved, cpa);
    // BlogPost primary selection falls back to default-ts-piot ...
    const banner = banners[resolved] ?? banners['default-ts-piot'];
    assert.equal(banner, banners['default-ts-piot']);
    // ... and the product helper uses the same exact key: no retail path
    assert.equal(articleProductEntry(resolved, { catalog: liveCatalog, banners }), null, JSON.stringify(cpa));
  }
});

test('transport fallback unchanged and gains no retail link', () => {
  for (const title of ['ЭТрН с 1 сентября', '140-ФЗ: переход на ЭПД', 'Как подписать электронную транспортную накладную']) {
    assert.equal(articleCpa({ title }, 'default-zakonodatelstvo'), 'diadoc-logistika');
  }
  assert.equal(articleCpa({ title: 'Как подключить перевозчика', tags: ['ЭТРН'] }, 'default-zakonodatelstvo'), 'diadoc-logistika');
  assert.equal(articleProductEntry('diadoc-logistika', live), null);
  // accepted prior conversion behaviour: non-transport keeps fallback, explicit wins
  for (const title of ['Касса для доставки еды', 'Штрафы за кассу', 'Перевозки товара своим транспортом']) {
    assert.equal(articleCpa({ title }, 'kontur-ofd'), 'kontur-ofd');
  }
  assert.equal(articleCpa({ title: 'ЭТРН', cpa: 'kontur-diadoc' }, 'kontur-ofd'), 'kontur-diadoc');
});

test('live source contract: catalog + banners + erid cover the three retail offers', () => {
  const src = readFileSync(join(root, 'src/data/cpa-banners.ts'), 'utf8');
  const erids = JSON.parse(readFileSync(join(root, 'src/data/ord-erids.json'), 'utf8'));
  for (const id of RETAIL_PRODUCT_IDS) {
    assert.match(src, new RegExp(`slug:\\s*'${id}'[\\s\\S]*?bannerId:\\s*'${id}'`), `catalog ${id}`);
    assert.match(src, new RegExp(`'${id}':\\s*\\{[\\s\\S]*?ctaHref:\\s*'https://[^']*\\?p=`), `banner href ${id}`);
    assert.ok(typeof erids[id] === 'string' && erids[id].length > 10, `erid ${id}`);
    assert.equal(
      articleProductEntry(id, { catalog: liveCatalog, banners: { [id]: { erid: erids[id], ctaHref: 'https://x/?p=f74746' } } }),
      `/produkty/${id}/`,
    );
  }
});

const SSR_CASES = [
  { slug: '2026-09-16-kassa-dlya-ip-bez-rabotnikov', banner: 'kontur-market',
    primary: 'https://kontur.ru/market/kkt?p=f74746', product: '/produkty/kontur-market/' },
  { slug: '2026-09-30-fn-dlya-markirovki', banner: 'kontur-ofd',
    primary: 'https://kontur.ru/ofd/price?p=f74746', product: '/produkty/kontur-ofd/' },
  { slug: '2026-10-01-merkuriy-dlya-roznicy', banner: 'kontur-markirovka',
    primary: 'https://kontur.ru/markirovka?p=f74746', product: '/produkty/kontur-markirovka/' },
];

function cpaBlock(html) {
  const start = html.indexOf('cpa-block');
  assert.ok(start !== -1, 'cpa-block present');
  const end = html.indexOf('funnel-cta', start);
  return html.slice(start, end !== -1 ? end : start + 4000);
}

test('SSR: three built articles expose exact secondary href with protected primary', () => {
  const erids = JSON.parse(readFileSync(join(root, 'src/data/ord-erids.json'), 'utf8'));
  for (const c of SSR_CASES) {
    const file = join(root, 'dist/blog', c.slug, 'index.html');
    assert.ok(existsSync(file), `built ${c.slug}`);
    const html = readFileSync(file, 'utf8');
    const block = cpaBlock(html);
    // primary external CTA intact: href + ref params, rel, erid, tracking attrs
    assert.ok(block.includes(`href="${c.primary}"`), `${c.slug} primary href`);
    assert.ok(block.includes(`data-cpa-id="${c.banner}"`), `${c.slug} data-cpa-id`);
    assert.ok(block.includes('data-cpa-placement="article-footer"'), `${c.slug} placement`);
    assert.ok(block.includes('rel="noopener noreferrer sponsored"'), `${c.slug} rel`);
    assert.ok(block.includes(`erid: ${erids[c.banner]}`), `${c.slug} erid`);
    // secondary internal link: exact href, readable label, no CPA tracking
    assert.ok(block.includes(`href="${c.product}"`), `${c.slug} secondary href`);
    assert.ok(block.includes('cpa-more'), `${c.slug} secondary class`);
    assert.ok(block.includes('Подробнее о продукте и условиях'), `${c.slug} secondary label`);
    const secondaries = [...block.matchAll(/<a[^>]*cpa-more[^>]*>/g)];
    assert.equal(secondaries.length, 1, `${c.slug} single secondary`);
    assert.ok(!secondaries[0][0].includes('data-cpa'), `${c.slug} secondary untracked`);
    assert.ok(!secondaries[0][0].includes('sponsored'), `${c.slug} secondary no sponsored`);
    assert.ok(!secondaries[0][0].includes('_blank'), `${c.slug} secondary same-tab`);
  }
});

test('SSR: transport and non-retail articles gain no retail secondary link', () => {
  for (const slug of ['2026-05-25-140-fz-epd-perehod-msb', '2026-05-31-chestny-znak-registraciya']) {
    const file = join(root, 'dist/blog', slug, 'index.html');
    assert.ok(existsSync(file), `built ${slug}`);
    const block = cpaBlock(readFileSync(file, 'utf8'));
    assert.ok(!block.includes('cpa-more'), `${slug} no secondary`);
    for (const p of ['/produkty/kontur-market/', '/produkty/kontur-ofd/', '/produkty/kontur-markirovka/']) {
      assert.ok(!block.includes(`href="${p}"`), `${slug} no ${p}`);
    }
  }
});
