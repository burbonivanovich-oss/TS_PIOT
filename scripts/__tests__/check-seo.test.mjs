import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'check-seo.mjs');

/** Запуск скрипта по файлам, возврат { status, stdout, stderr }. */
function run(files) {
	const r = spawnSync('node', [SCRIPT, ...files], { encoding: 'utf8' });
	return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Временный каталог с файлами { имя: содержимое }, возврат { dir, paths }. */
function mktmp(entries) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-seo-'));
	const paths = {};
	for (const [name, content] of Object.entries(entries)) {
		const p = path.join(dir, name);
		fs.writeFileSync(p, content, 'utf8');
		paths[name] = p;
	}
	return { dir, paths };
}

function rmtmp(dir) {
	fs.rmSync(dir, { recursive: true, force: true });
}

/** Заготовка валидной статьи (P0 нет). */
function validArticle() {
	return `---
title: "Тестовая статья про маркировку"
description: "${'а'.repeat(150)}"
pubDate: "2026-09-01"
categories:
  - markirovka
tags:
  - маркировка
  - честный знак
seo:
  keywords:
    - маркировка
---

Текст со [ссылкой](/blog/test/).
`;
}

test('ETK-P1-09: markdown без frontmatter — адресная P0 без TypeError', () => {
	const { dir, paths } = mktmp({ 'nofm.md': 'Просто текст без frontmatter.\n' });
	try {
		const r = run([paths['nofm.md']]);
		assert.equal(r.status, 1, `ожидался exit 1, stdout: ${r.stdout}`);
		assert.ok(r.stdout.includes('Не распознан frontmatter'), `нет ошибки про frontmatter: ${r.stdout}`);
		assert.ok(r.stdout.includes('nofm.md'), `нет имени файла: ${r.stdout}`);
		assert.ok(!r.stderr.includes('TypeError'), `TypeError в stderr: ${r.stderr}`);
		assert.ok(!r.stdout.includes('TypeError'), `TypeError в stdout: ${r.stdout}`);
	} finally {
		rmtmp(dir);
	}
});

test('ETK-P1-09: categories отсутствует — P0 «Не указана категория»', () => {
	const { dir, paths } = mktmp({
		'nocat.md': `---
title: "Тестовая статья про маркировку"
description: "${'а'.repeat(150)}"
pubDate: "2026-09-01"
tags:
  - маркировка
  - честный знак
seo:
  keywords:
    - маркировка
---

Текст со [ссылкой](/blog/test/).
`,
	});
	try {
		const r = run([paths['nocat.md']]);
		assert.equal(r.status, 1, `ожидался exit 1, stdout: ${r.stdout}`);
		assert.ok(r.stdout.includes('Не указана категория'), `нет P0 про категорию: ${r.stdout}`);
		assert.ok(!r.stderr.includes('TypeError'), `TypeError в stderr: ${r.stderr}`);
	} finally {
		rmtmp(dir);
	}
});

test('ETK-P1-09: пустой список categories — та же P0', () => {
	const { dir, paths } = mktmp({
		'emptycat.md': `---
title: "Тестовая статья про маркировку"
description: "${'а'.repeat(150)}"
pubDate: "2026-09-01"
categories:
tags:
  - маркировка
  - честный знак
seo:
  keywords:
    - маркировка
---

Текст со [ссылкой](/blog/test/).
`,
	});
	try {
		const r = run([paths['emptycat.md']]);
		assert.equal(r.status, 1, `ожидался exit 1, stdout: ${r.stdout}`);
		assert.ok(r.stdout.includes('Не указана категория'), `нет P0 про категорию: ${r.stdout}`);
		assert.ok(!r.stderr.includes('TypeError'), `TypeError в stderr: ${r.stderr}`);
	} finally {
		rmtmp(dir);
	}
});

test('ETK-P1-09: categories неверного типа — P0, а не TypeError', () => {
	const { dir, paths } = mktmp({
		'badcat.md': `---
title: "Тестовая статья про маркировку"
description: "${'а'.repeat(150)}"
pubDate: "2026-09-01"
categories: "строка"
tags:
  - маркировка
  - честный знак
seo:
  keywords:
    - маркировка
---

Текст со [ссылкой](/blog/test/).
`,
	});
	try {
		const r = run([paths['badcat.md']]);
		assert.equal(r.status, 1, `ожидался exit 1, stdout: ${r.stdout}`);
		assert.ok(r.stdout.includes('Не указана категория'), `нет P0 про категорию: ${r.stdout}`);
		assert.ok(!r.stderr.includes('TypeError'), `TypeError в stderr: ${r.stderr}`);
		assert.ok(!r.stdout.includes('TypeError'), `TypeError в stdout: ${r.stdout}`);
	} finally {
		rmtmp(dir);
	}
});

test('ETK-P1-09: валидная статья — exit 0 и SEO OK', () => {
	const { dir, paths } = mktmp({ 'valid.md': validArticle() });
	try {
		const r = run([paths['valid.md']]);
		assert.equal(r.status, 0, `ожидался exit 0, stdout: ${r.stdout}, stderr: ${r.stderr}`);
		assert.ok(r.stdout.includes('SEO OK'), `нет SEO OK: ${r.stdout}`);
	} finally {
		rmtmp(dir);
	}
});

test('ETK-P1-09: несколько файлов — валидный и битый', () => {
	const { dir, paths } = mktmp({
		'valid.md': validArticle(),
		'broken.md': 'Просто текст без frontmatter.\n',
	});
	try {
		const r = run([paths['valid.md'], paths['broken.md']]);
		assert.equal(r.status, 1, `ожидался exit 1, stdout: ${r.stdout}`);
		assert.ok(r.stdout.includes('valid.md'), `нет имени валидного файла: ${r.stdout}`);
		assert.ok(r.stdout.includes('broken.md'), `нет имени битого файла: ${r.stdout}`);
		assert.ok(r.stdout.includes('SEO OK: ') && r.stdout.includes('valid.md'), `валидный не помечен SEO OK: ${r.stdout}`);
		assert.ok(!r.stderr.includes('TypeError'), `TypeError в stderr: ${r.stderr}`);
	} finally {
		rmtmp(dir);
	}
});
