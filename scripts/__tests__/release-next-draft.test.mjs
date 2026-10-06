import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFlags, selectCandidate, readCandidates } from '../release-next-draft.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TODAY = '2026-09-13';

/** Статья с заданным frontmatter. */
function article(title, pubDate, extra = '') {
	const body = '---\ntitle: "' + title + '"\npubDate: "' + pubDate + '"\n' + extra + '---\n\nТекст.\n';
	return { file: `${title}.md`, slug: title, content: body, pubDate, ...parseFlags(body) };
}

test('AP-P0-15: таблица контракта autopilotHold', () => {
	// draft: true, без hold → может быть выбрана.
	const plain = article('plain', '2026-01-01', 'draft: true\n');
	assert.equal(plain.isDraft, true);
	assert.equal(plain.isHeld, false);
	assert.ok(selectCandidate([plain], { today: TODAY }));

	// draft: true, autopilotHold: false → может быть выбрана.
	const explicitlyFalse = article('explicit-false', '2026-01-01', 'draft: true\nautopilotHold: false\n');
	assert.equal(explicitlyFalse.isHeld, false);
	assert.ok(selectCandidate([explicitlyFalse], { today: TODAY }));

	// draft: true, autopilotHold: true → никогда.
	const held = article('held', '2026-01-01', 'draft: true\nautopilotHold: true\n');
	assert.equal(held.isHeld, true);
	assert.equal(selectCandidate([held], { today: TODAY }), null);
	assert.equal(selectCandidate([held], { today: TODAY, forceDate: true }), null);

	// draft: false, без hold → не выбирается.
	const published = article('published', '2026-01-01', 'draft: false\n');
	assert.equal(selectCandidate([published], { today: TODAY }), null);

	// draft: false, autopilotHold: true → не выбирается.
	const publishedHeld = article('published-held', '2026-01-01', 'draft: false\nautopilotHold: true\n');
	assert.equal(selectCandidate([publishedHeld], { today: TODAY }), null);

	// Первая held, вторая допустимая → выбирается вторая.
	assert.equal(
		selectCandidate([held, plain], { today: TODAY }).slug,
		'plain',
	);
	// Все held → штатный no-op.
	assert.equal(selectCandidate([held, publishedHeld], { today: TODAY }), null);
});

test('AP-P0-15: malformed hold безопасен, отсутствие — нет', () => {
	const weird = article('weird', '2026-01-01', 'draft: true\nautopilotHold: yes\n');
	assert.equal(weird.isHeld, true, 'неразбираемое значение трактуется как удержание');
	const quoted = article('quoted', '2026-01-01', 'draft: true\nautopilotHold: "false"\n');
	assert.equal(quoted.isHeld, true, 'кавычки не считаются явным false');
	const empty = article('empty', '2026-01-01', 'draft: true\nautopilotHold:\n');
	assert.equal(empty.isHeld, true, 'пустое значение — удержание');
	const absent = article('absent', '2026-01-01', 'draft: true\n');
	assert.equal(absent.isHeld, false, 'без поля — не удержание (совместимость)');
});

test('AP-P0-15: будущее не публикуется, FORCE_DATE не обходит hold', () => {
	const future = article('future', '2099-01-01', 'draft: true\n');
	assert.equal(selectCandidate([future], { today: TODAY }), null);
	assert.ok(selectCandidate([future], { today: TODAY, forceDate: true }));

	const futureHeld = article('future-held', '2099-01-01', 'draft: true\nautopilotHold: true\n');
	assert.equal(selectCandidate([futureHeld], { today: TODAY, forceDate: true }), null);
});

test('AP-P0-15: файловый корпус разбирается, удержанные статьи не выбираются', () => {
	// Hold — штатное состояние контура, а не ошибка реального корпуса.
	// Проверяем чтение MD/MDX и выбор релизера на фиксированных данных.
	const root = mkdtempSync(path.join(tmpdir(), 'release-hold-'));
	const fixtures = {
		'held.md': article('held', '2026-01-01', 'draft: true\nautopilotHold: true\n').content,
		'malformed.mdx': article('malformed', '2026-01-02', 'draft: true\nautopilotHold: yes\n').content,
		'eligible.mdx': article('eligible', '2026-01-03', 'draft: true\nautopilotHold: false\n').content,
		'published.md': article('published', '2025-01-01', 'draft: false\n').content,
		'future.md': article('future', '2099-01-01', 'draft: true\n').content,
		'future-held.mdx': article('future-held', '2099-01-01', 'draft: true\nautopilotHold: true\n').content,
	};
	try {
		for (const [file, content] of Object.entries(fixtures)) writeFileSync(path.join(root, file), content);
		writeFileSync(path.join(root, 'ignore.json'), '{}');
		const articles = readCandidates(root);
		assert.deepEqual(articles.map((a) => a.file).sort(), Object.keys(fixtures).sort());
		const held = articles.filter((a) => a.isDraft && a.isHeld);
		assert.deepEqual(held.map((a) => a.slug).sort(), ['future-held', 'held', 'malformed']);
		assert.equal(selectCandidate(articles, { today: TODAY }).slug, 'eligible');
		assert.equal(selectCandidate(articles, { today: TODAY, forceDate: true }).slug, 'eligible');
		assert.equal(selectCandidate(held, { today: TODAY }), null);
		assert.equal(selectCandidate(held, { today: TODAY, forceDate: true }), null);
		for (const [file, content] of Object.entries(fixtures)) assert.equal(readFileSync(path.join(root, file), 'utf8'), content);
	} finally { rmSync(root, { recursive: true, force: true }); }
});

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../autopilot/scripts/lib/config.mjs';

test('calendar owner blocks legacy release even with FORCE_DATE and SKIP_GATE', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'legacy-calendar-'));
  try {
    const file = path.join(root, 'config.json');
    const { resolved, ...base } = loadConfig();
    writeFileSync(file, JSON.stringify({ ...base, publish: { ...base.publish, calendar: true }, throughput: { ...base.throughput, monthlyRewriteTarget: 14 } }));
    const before = readCandidates(path.join(ROOT, 'src/content/blog'));
    const result = spawnSync(process.execPath, ['scripts/release-next-draft.mjs'], {
      cwd: ROOT, encoding: 'utf8', env: { ...process.env, AUTOPILOT_CONFIG: file, FORCE_DATE: '1', SKIP_GATE: '1' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /календарём автопилота/);
    assert.deepEqual(readCandidates(path.join(ROOT, 'src/content/blog')), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
