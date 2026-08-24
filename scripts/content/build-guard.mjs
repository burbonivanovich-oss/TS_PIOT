#!/usr/bin/env node
/**
 * Страховка сборки для автономных прогонов: запускает `npm run build`, и если
 * сборку роняет свежесгенерированная статья — уносит её в `.claude/quarantine/`
 * и пробует снова. Одна битая статья не должна съедать всю месячную норму.
 *
 *   node scripts/content/build-guard.mjs [--attempts=3]
 *
 * Выход 0 — сборка зелёная (возможно, после карантина части статей),
 * выход 1 — сборку роняет что-то, к чему автопилот отношения не имеет.
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const QUARANTINE = path.join(ROOT, '.claude/quarantine');
const attempts = Number((process.argv.find((a) => a.startsWith('--attempts=')) ?? '').split('=')[1] ?? 3);

/** Свежие (незакоммиченные) статьи блога — только их можно карантинить. */
function freshArticles() {
	try {
		return execSync('git status --porcelain -- src/content/blog', { cwd: ROOT, encoding: 'utf8' })
			.split('\n')
			.filter(Boolean)
			.map((l) => l.slice(3).trim().replace(/^"|"$/g, ''))
			.filter((f) => /\.(md|mdx)$/.test(f));
	} catch {
		return [];
	}
}

function runBuild() {
	const res = spawnSync('npm', ['run', 'build'], { cwd: ROOT, encoding: 'utf8' });
	return { ok: res.status === 0, output: `${res.stdout ?? ''}\n${res.stderr ?? ''}` };
}

for (let attempt = 1; attempt <= attempts; attempt++) {
	console.log(`Сборка, попытка ${attempt}/${attempts}…`);
	const { ok, output } = runBuild();
	if (ok) {
		console.log('Сборка зелёная.');
		process.exit(0);
	}

	console.error(output.slice(-3000));

	const fresh = freshArticles();
	const guilty = fresh.filter((f) => output.includes(path.basename(f)) || output.includes(f));

	if (guilty.length === 0) {
		console.error('Сборка падает не из-за свежих статей — разбираться нужно руками.');
		process.exit(1);
	}

	fs.mkdirSync(QUARANTINE, { recursive: true });
	for (const file of guilty) {
		const dest = path.join(QUARANTINE, path.basename(file));
		fs.renameSync(path.join(ROOT, file), dest);
		console.error(`В карантин: ${file} → .claude/quarantine/${path.basename(file)}`);
	}
}

console.error(`Сборка не позеленела за ${attempts} попыток.`);
process.exit(1);
