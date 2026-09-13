import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGates } from './gates.mjs';

// Свой набор существующих статей: тесты не должны зависеть от того, что
// сейчас лежит в принимающем репозитории.
const KNOWN = new Set([
  '2026-05-25-140-fz-epd-perehod-msb0',
  '2026-05-25-140-fz-epd-perehod-msb1',
  '2026-05-25-140-fz-epd-perehod-msb2',
  '2026-02-10-kategorii-markirovki-20260',
  '2026-02-10-kategorii-markirovki-20261',
  '2026-02-10-kategorii-markirovki-20262',
]);

const good = (overrides = {}) => {
  const base = {
    title: 'ГИС ЭПД: сроки 2026 года',
    description: 'Сроки перехода на ГИС ЭПД в 2026 году: что обязательно для перевозчиков и грузоотправителей, какие документы нужны и чем грозит опоздание.',
    body:
      'Вводный абзац достаточной длины, чтобы движок счёл строку содержательной и пригодной для анализа текста.\n\n' +
      ['Первый', 'Второй', 'Третий'].map((h, i) =>
        `## ${h} раздел\n\nАбзац раздела ${i + 1} с осмысленным содержанием и достаточной длиной строки для проверок движка. ` +
        'Норма вступает в силу с 01.09.2026 согласно [закону](https://publication.pravo.gov.ru/document/1) и требует подготовки. ' +
        `Смежные темы: [ЭПД](/blog/2026-05-25-140-fz-epd-perehod-msb${i}/), ` +
        `[маркировка](/blog/2026-02-10-kategorii-markirovki-2026${i}/).\n`,
      ).join('\n') +
      '\n'.padEnd(4200, 'Дополнительный связный текст для добора объёма до нормы гейта. '),
  };
  const data = { ...base, ...overrides };
  return `---\ntitle: "${data.title}"\ndescription: "${data.description}"\npubDate: "2026-08-10"\ndraft: true\n---\n\n${data.body}`;
};

test('нормальная статья проходит гейты', () => {
  const result = runGates({ file: null, source: good(), knownSlugs: KNOWN });
  assert.equal(result.passed, true, JSON.stringify(result.checks.filter((c) => !c.ok), null, 2));
});

test('утверждение о сроке без первоисточника — блокер', () => {
  // Скобки экранированы: без этого `[закону]` читается как класс символов.
  const source = good().replace(/\[закону\]\(https:\/\/[^)]*\)/g, 'закону');
  const result = runGates({ file: null, source, knownSlugs: KNOWN });
  assert.equal(result.passed, false);
  assert.ok(result.blockers.includes('sources'));
});

test('короткий текст — блокер, а не просто минус балл', () => {
  const source = `---\ntitle: "Тест"\ndescription: "${'о'.repeat(120)}"\npubDate: "2026-08-10"\n---\n\nКоротко.`;
  const result = runGates({ file: null, source, knownSlugs: KNOWN });
  assert.equal(result.passed, false);
  assert.ok(result.blockers.includes('length'));
});

test('штампы роняют балл', () => {
  const withMarkers = good().replace(
    'Вводный абзац',
    'В современном мире стоит отметить, что важно отметить и таким образом подводя итог — вводный абзац',
  );
  const clean = runGates({ file: null, source: good(), knownSlugs: KNOWN });
  const dirty = runGates({ file: null, source: withMarkers, knownSlugs: KNOWN });
  assert.ok(dirty.score < clean.score);
  assert.ok(dirty.checks.find((c) => c.id === 'ai-markers').ok === false);
});

test('отсутствие обязательных полей frontmatter — блокер', () => {
  const source = good().replace(/^description:.*$/m, '');
  const result = runGates({ file: null, source, knownSlugs: KNOWN });
  assert.ok(result.blockers.includes('frontmatter'));
});

test('ценник не считается утверждением о норме, штраф считается', () => {
  // Обзор оборудования полон крупных сумм в рублях, но это цены, а не
  // санкции. Пока шаблон не различал их, гейт требовал ссылку на КоАП под
  // стоимость смарт-терминала и заворачивал нормальный текст.
  const withPrices = good().replace(
    'Вводный абзац',
    'Смарт-терминал стоит от 20 000 до 30 000 рублей, накопитель — от 6 000 рублей. Вводный абзац',
  );
  const withFine = good().replace(
    'Вводный абзац',
    'Штраф по части 4 статьи 14.5 КоАП РФ для организаций — от 5 000 до 10 000 рублей. Вводный абзац',
  );

  const priceClaims = claimCount(runGates({ file: null, source: withPrices, knownSlugs: KNOWN }));
  const fineClaims = claimCount(runGates({ file: null, source: withFine, knownSlugs: KNOWN }));
  assert.ok(fineClaims > priceClaims, `штрафы (${fineClaims}) должны считаться чаще ценников (${priceClaims})`);
});

/** Число утверждений из строки отчёта проверки sources. */
function claimCount(result) {
  const detail = result.checks.find((c) => c.id === 'sources').detail;
  return Number(detail.match(/НПА: (\d+)/)[1]);
}

/** Обёртка тела в валидный frontmatter; ссылки задаёт сам тест. */
function wrap(bodyText) {
  return `---\ntitle: "Тест источников"\ndescription: "${'о'.repeat(120)}"\npubDate: "2026-08-10"\ndraft: true\n---\n\n${bodyText}`;
}

/** Добивка объёма без утверждений, ссылок и AI-маркеров. */
const padding = () => '\n\n' + 'Нейтральный наполнитель для объёма текста без правовых утверждений. '.repeat(70);

function sourcesCheck(result) {
  return result.checks.find((c) => c.id === 'sources');
}

test('AP-P1-03: невозможная и будущая дата у не-черновика — блокер', () => {
  const impossible = good().replace('pubDate: "2026-08-10"', 'pubDate: "2026-02-30"');
  const bad = runGates({ file: null, source: impossible, knownSlugs: KNOWN });
  assert.ok(bad.blockers.includes('dates'), JSON.stringify(bad.checks.find((c) => c.id === 'dates')));

  const future = good().replace('pubDate: "2026-08-10"', 'pubDate: "2099-01-01"').replace('draft: true', 'draft: false');
  const ahead = runGates({ file: null, source: future, knownSlugs: KNOWN });
  assert.ok(ahead.blockers.includes('dates'));
  assert.match(ahead.checks.find((c) => c.id === 'dates').detail, /в будущем/);
});

test('AP-P1-03: будущий pubDate у черновика — расписание, не блокер', () => {
  const scheduled = good().replace('pubDate: "2026-08-10"', 'pubDate: "2099-01-01"');
  const result = runGates({ file: null, source: scheduled, knownSlugs: KNOWN });
  assert.equal(result.checks.find((c) => c.id === 'dates').ok, true);
  assert.ok(!result.blockers.includes('dates'));
});

test('AP-P1-03: просроченный reviewDate — сигнал, а не блокер', () => {
  const source = good().replace('draft: true', 'draft: true\nreviewDate: "2020-01-01"');
  const result = runGates({ file: null, source, knownSlugs: KNOWN });
  const dates = result.checks.find((c) => c.id === 'dates');
  assert.equal(dates.ok, true);
  assert.match(dates.detail, /reviewDate просрочен/);
});

test('AP-P0-24: четыре утверждения и одна случайная ссылка не проходят', () => {
  const bodyText =
    'Срок наступает с 01.03.2026. Второй этап начинается с 01.04.2026. ' +
    'Третий этап стартует с 01.05.2026. Четвёртый этап стартует с 01.06.2026. ' +
    'Подробности приведены в [обзоре](https://consultant.ru/obzor).';
  const result = runGates({ file: null, source: wrap(bodyText + padding()), knownSlugs: KNOWN });
  assert.equal(claimCount(result), 4);
  assert.equal(sourcesCheck(result).ok, false, 'случайная ссылка не подтверждает несвязанные даты');
  assert.ok(result.blockers.includes('sources'));
  assert.equal(result.claims.filter((c) => !c.covered).length, 4);
});

test('AP-P0-24: каждый claim со своим источником в том же предложении проходит', () => {
  const linked = (date, doc) =>
    `Срок наступает с ${date} согласно [норме](https://publication.pravo.gov.ru/document/${doc}).`;
  const bodyText = [
    linked('01.03.2026', 1),
    linked('01.04.2026', 2),
    linked('01.05.2026', 3),
    linked('01.06.2026', 4),
  ].join(' ');
  const result = runGates({ file: null, source: wrap(bodyText + padding()), knownSlugs: KNOWN });
  assert.equal(claimCount(result), 4);
  assert.equal(sourcesCheck(result).ok, true, sourcesCheck(result).detail);
  assert.ok(!result.blockers.includes('sources'));
  assert.equal(result.claims.filter((c) => c.covered).length, 4);
  assert.ok(result.claims.every((c) => c.source.includes('publication.pravo.gov.ru')));
});

test('AP-P0-24: одна ссылка не подтверждает утверждение из соседнего предложения', () => {
  const bodyText =
    'Срок наступает с 01.03.2026 согласно [норме](https://publication.pravo.gov.ru/document/1). ' +
    'Штраф за нарушение составляет от 5 000 до 10 000 рублей.';
  const result = runGates({ file: null, source: wrap(bodyText + padding()), knownSlugs: KNOWN });
  const check = sourcesCheck(result);
  assert.equal(check.ok, false);
  assert.ok(result.blockers.includes('sources'));
  // Оба утверждения (дата и штраф) нашлись, покрыта только дата.
  assert.equal(result.claims.length, 2);
  assert.equal(result.claims.filter((c) => !c.covered).length, 1);
});

test('AP-P0-24: несколько утверждений в одном предложении покрываются одной ссылкой', () => {
  const bodyText =
    'Штраф по статье 14.5 КоАП РФ составит от 5 000 до 10 000 рублей, срок наступает с 01.03.2026 ' +
    'согласно [норме](https://consultant.ru/dokument).';
  const result = runGates({ file: null, source: wrap(bodyText + padding()), knownSlugs: KNOWN });
  assert.equal(sourcesCheck(result).ok, true, sourcesCheck(result).detail);
  assert.ok(result.claims.length >= 2);
  assert.equal(result.claims.filter((c) => !c.covered).length, 0);
});

test('AP-P1-02: ссылка на главную страницу не подтверждает утверждение', () => {
  const bodyText = 'Срок наступает с 01.03.2026 согласно [норме](https://consultant.ru/).';
  const result = runGates({ file: null, source: wrap(bodyText + padding()), knownSlugs: KNOWN });
  assert.equal(sourcesCheck(result).ok, false);
  assert.equal(result.claims[0].covered, false);
  assert.match(result.claims[0].reason, /главную/);
  assert.ok(result.blockers.includes('sources'));
});

test('AP-P1-02: пустая карта evidence не блокирует подтверждённые claims', () => {
  // Регресс, найденный интеграционным fixture: отсутствующий
  // source-evidence.json читался как {} и truthy, из-за чего каждый claim
  // получал «нет evidence» и всё с датами заворачивалось.
  const result = runGates({ file: null, source: good(), knownSlugs: KNOWN, sourceEvidence: {} });
  assert.equal(sourcesCheck(result).ok, true, sourcesCheck(result).detail);
  assert.equal(result.claims.filter((c) => !c.covered).length, 0);
});

test('AP-P1-02: сохранённый evidence 404/устаревания блокирует, свежий — нет', () => {
  const url = 'https://consultant.ru/doc/1';
  const source = wrap(`Срок наступает с 01.03.2026 согласно [норме](${url}).` + padding());
  const entry = (overrides) => ({ [url]: { url, status: 200, finalUrl: url, checkedAt: new Date().toISOString(), ...overrides } });

  const fresh = runGates({ file: null, source, knownSlugs: KNOWN, sourceEvidence: entry({}) });
  assert.equal(sourcesCheck(fresh).ok, true, sourcesCheck(fresh).detail);

  const stale = runGates({ file: null, source, knownSlugs: KNOWN, sourceEvidence: entry({ checkedAt: '2020-01-01T00:00:00Z' }) });
  assert.equal(sourcesCheck(stale).ok, false);
  assert.match(stale.claims[0].reason, /устарело/);

  const notFound = runGates({ file: null, source, knownSlugs: KNOWN, sourceEvidence: entry({ status: 404 }) });
  assert.equal(sourcesCheck(notFound).ok, false);
  assert.match(notFound.claims[0].reason, /404/);

  const redirect = runGates({ file: null, source, knownSlugs: KNOWN, sourceEvidence: entry({ finalUrl: 'https://evil.example/x' }) });
  assert.equal(sourcesCheck(redirect).ok, false);
  assert.match(redirect.claims[0].reason, /редирект/);
});

test('AP-P1-07: query/hash и дубли — те же ссылки, links-valid не страдает', () => {
  const [a, b, c] = [...KNOWN];
  const bodyText =
    `## Один\n\nЕсть [первая](/blog/${a}/?utm=1#x), её дубль [ещё](/blog/${a}) и [вторая](/blog/${b}/). ` +
    `Третья [ссылка](/blog/${c}). ` +
    'Наполнитель для длины строки и абзаца. '.repeat(8);
  const result = runGates({ file: null, source: wrap(bodyText + padding()), knownSlugs: KNOWN });
  const links = result.checks.find((ch) => ch.id === 'links-valid');
  assert.equal(links.ok, true, links.detail);
});

test('AP-P1-07: ссылка на черновик считается битой', () => {
  const contentRoot = mkdtempSync(path.join(tmpdir(), 'gates-draft-'));
  const blog = path.join(contentRoot, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  const body = `---\ntitle: "T"\ndescription: "${'о'.repeat(120)}"\npubDate: "2026-01-01"\ndraft: false\n---\n\nТело.`;
  writeFileSync(path.join(blog, 'published.md'), body, 'utf8');
  writeFileSync(path.join(blog, 'draft-target.md'), body.replace('draft: false', 'draft: true'), 'utf8');
  const articleSource = `---\ntitle: "S"\ndescription: "${'о'.repeat(120)}"\npubDate: "2026-01-01"\ndraft: true\n---\n\n` +
    `Текст со [ссылкой](/blog/published/) и [черновиком](/blog/draft-target/) и обычным текстом для длины строки. `.repeat(3);
  const { result } = runGatesInCorpus({ articleSource, contentRoot });
  const links = result.checks.find((c) => c.id === 'links-valid');
  assert.equal(links.ok, false);
  assert.match(links.detail, /draft-target/);
  assert.ok(!links.detail.includes('published'), links.detail);
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/** Прогон гейтов в дочернем процессе со своим CONTENT_ROOT (конфиг кэшируется при импорте). */
function runGatesInCorpus({ articleSource, contentRoot }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'gates-'));
  const file = path.join(dir, 'article.md');
  writeFileSync(file, articleSource, 'utf8');
  const proc = spawnSync(process.execPath, ['scripts/gates.mjs', 'check', '--file', file, '--json'], {
    cwd: ROOT,
    env: { ...process.env, CONTENT_ROOT: contentRoot },
    encoding: 'utf8',
  });
  assert.notEqual(proc.status, 1, `гейт не должен падать с ошибкой запуска: ${proc.stderr}`);
  return { proc, result: JSON.parse(proc.stdout) };
}

/** Статья с ровно тремя исходящими ссылками на заданные слаги (норма interlink закрыта). */
function linkedArticle(slugs) {
  const links = slugs.map((s) => `[связь](/blog/${s}/)`).join(', ');
  return good()
    .replace(/\[ЭПД\]\(\/blog\/[^)]*\)/g, 'ЭПД')
    .replace(/\[маркировка\]\(\/blog\/[^)]*\)/g, 'маркировка')
    .replace(/Смежные темы:.*/, `Смежные темы: ${links}.`);
}

test('AP-P0-06: отсутствующий корпус даёт blocker links-valid, а не пропуск', () => {
  const { proc, result } = runGatesInCorpus({
    articleSource: linkedArticle(['a', 'b', 'c']),
    contentRoot: path.join(tmpdir(), 'gates-missing-corpus-definitely-not-exists'),
  });
  const links = result.checks.find((c) => c.id === 'links-valid');
  assert.equal(links.ok, false, JSON.stringify(links));
  assert.match(links.detail, /корпус недоступен/);
  assert.ok(result.blockers.includes('links-valid'));
  assert.equal(result.passed, false);
  assert.equal(proc.status, 2);
});

test('AP-P0-06: нечитаемая статья корпуса даёт blocker links-valid', () => {
  const contentRoot = mkdtempSync(path.join(tmpdir(), 'gates-corrupt-'));
  const blog = path.join(contentRoot, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  // Битая ссылка: readdir её видит, readFileSync падает с ENOENT.
  symlinkSync(path.join(tmpdir(), 'gates-target-not-exists'), path.join(blog, 'broken.md'));
  const { result } = runGatesInCorpus({ articleSource: linkedArticle(['a', 'b', 'c']), contentRoot });
  const links = result.checks.find((c) => c.id === 'links-valid');
  assert.equal(links.ok, false, JSON.stringify(links));
  assert.ok(result.blockers.includes('links-valid'));
  assert.equal(result.passed, false);
});

test('AP-P0-06: целый корпус с известными слагами проходит links-valid', () => {
  const contentRoot = mkdtempSync(path.join(tmpdir(), 'gates-ok-'));
  const blog = path.join(contentRoot, 'src', 'content', 'blog');
  mkdirSync(blog, { recursive: true });
  for (const slug of ['a', 'b', 'c']) {
    writeFileSync(
      path.join(blog, `${slug}.md`),
      `---\ntitle: "${slug}"\ndescription: "${'о'.repeat(120)}"\npubDate: "2026-08-10"\n---\n\nТело ${slug}.`,
      'utf8',
    );
  }
  const { result } = runGatesInCorpus({ articleSource: linkedArticle(['a', 'b', 'c']), contentRoot });
  const links = result.checks.find((c) => c.id === 'links-valid');
  assert.equal(links.ok, true, JSON.stringify(links));
  assert.ok(!result.blockers.includes('links-valid'));
});
