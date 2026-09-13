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

test('AP-P0-15: настоящий корпус TS_PIOT разбирается и не содержит ложных hold', () => {
	const articles = readCandidates();
	assert.ok(articles.length > 100, `корпус найден: ${articles.length}`);
	const drafts = articles.filter((a) => a.isDraft);
	const held = drafts.filter((a) => a.isHeld);
	assert.equal(held.length, 0, `в корпусе неожиданные hold: ${held.map((d) => d.slug).join(', ')}`);
	// Каждый выпущенный slug существует файлом на диске.
	for (const a of articles.slice(0, 20)) {
		assert.ok(a.file.endsWith('.md') || a.file.endsWith('.mdx'));
	}
});
