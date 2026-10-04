// Dedicated clean checkout only. No push and no deployment in this adapter.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, lstatSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readJson, writeJson } from './content.mjs';
import { setStage, readRun } from './run.mjs';
import { scanText } from '../secret-scan.mjs';
import { runSiteBuild } from './site.mjs';

function git(root, args, { env = {}, input } = {}) {
  const inherited = { ...process.env };
  for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete inherited[key];
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', input, env: { ...inherited, ...env } });
  if (result.error || result.status !== 0) throw new Error(`Git ${args[0]} не выполнен: ${result.error?.message || result.stderr.trim().slice(0, 500)}`);
  return result.stdout.trim();
}
function localFile(root, name) { return path.resolve(root, git(root, ['rev-parse', '--git-path', name])); }
export function readDeliveryJournal(root) { return readJson(localFile(root, 'autopilot-delivery.json'), null); }
export function corpusHash(blog) {
  const hash = createHash('sha256');
  for (const name of readdirSync(blog).filter(n => /\.mdx?$/.test(n)).sort((a, b) => path.join(blog, a).localeCompare(path.join(blog, b)))) {
    const file = path.join(blog, name); if (lstatSync(file).isSymbolicLink()) throw new Error('Симлинк в корпусе');
    const bytes = readFileSync(file); hash.update(name); hash.update('\0' + bytes.length + '\0'); hash.update(bytes);
  }
  return hash.digest('hex');
}
export function beginGitDelivery(root) {
  const file = localFile(root, 'autopilot-delivery.json');
  if (git(root, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('Доставка требует чистый отдельный checkout до plan');
  if (existsSync(file)) {
    const previous = readJson(file, null);
    if (previous?.phase !== 'committed' || previous.root !== path.resolve(root) || previous.metadataCommit !== git(root, ['rev-parse', 'HEAD']) || !/^\d{4}-\d{2}-\d{2}-[a-f0-9]{8}$/.test(previous.runId)) throw new Error('Незавершённая доставка уже существует');
    writeJson(localFile(root, `autopilot-delivery-${previous.runId}.json`), previous);
    rmSync(file);
  }
  const branch = git(root, ['symbolic-ref', 'HEAD']);
  const blog = path.join(root, 'src/content/blog');
  const journal = { version: 1, root: path.resolve(root), branch, baseHead: git(root, ['rev-parse', 'HEAD']), baseTree: git(root, ['rev-parse', 'HEAD^{tree}']), baseCorpusSha256: existsSync(blog) ? corpusHash(blog) : null, phase: 'baseline' };
  writeJson(file, journal); return journal;
}
function changedFiles(root) {
  if (git(root, ['diff', '--cached', '--name-only'])) throw new Error('Индекс Git содержит посторонние staged-изменения');
  const out = git(root, ['ls-files', '-m', '-d', '-o', '--exclude-standard', '-z']);
  return [...new Set(out.split('\0').filter(Boolean))];
}
export function commitGitDelivery({ root, dataDir, blog = path.join(root, 'src/content/blog'), runId, build = runSiteBuild, afterPrepared = () => {} }) {
  const file = localFile(root, 'autopilot-delivery.json');
  const journal = readJson(file, null);
  if (!journal || journal.version !== 1 || journal.root !== path.resolve(root)) throw new Error('Нет исходной чистой точки доставки');
  if (journal.runId && journal.runId !== runId) throw new Error('Доставка принадлежит другому проходу');
  const dataRelative = path.relative(root, dataDir).split(path.sep).join('/');
  if (!dataRelative || dataRelative.startsWith('../') || path.isAbsolute(dataRelative)) throw new Error('Состояние за пределами репозитория');
  const manifest = readRun(runId, { dir: dataDir });
  if (!manifest?.stages.gated) throw new Error('Нет приёмки прохода');
  const built = manifest.stages.built?.checked === true && manifest.stages.built.ok === true && manifest.stages.built.code === 0;
  const stateOnly = !built && manifest.stages.gated.published === 0 && journal.baseCorpusSha256 === corpusHash(blog);
  if (!built && !stateOnly) throw new Error('Нет фактической успешной сборки прохода');
  if (built && manifest.stages.built.corpusSha256 !== corpusHash(blog)) throw new Error('Корпус изменился после сборки');
  const head = git(root, ['rev-parse', 'HEAD']);
  if (git(root, ['symbolic-ref', 'HEAD']) !== journal.branch) throw new Error('Ветка доставки изменилась');
  if (head !== journal.baseHead && head !== journal.metadataCommit) throw new Error('HEAD изменился после исходной точки');
  const indexFile = localFile(root, 'autopilot-delivery.index');
  const env = { GIT_INDEX_FILE: indexFile, GIT_AUTHOR_NAME: 'autopilot', GIT_AUTHOR_EMAIL: 'autopilot@users.noreply.github.com', GIT_COMMITTER_NAME: 'autopilot', GIT_COMMITTER_EMAIL: 'autopilot@users.noreply.github.com' };
  try {
    const normalTree = git(root, ['write-tree']);
    if (normalTree !== journal.baseTree && normalTree !== journal.metadataTree) throw new Error('Индекс Git изменился вне доставки');
    if (!journal.metadataCommit) {
      const files = changedFiles(root);
      if (stateOnly && files.some(name => !name.startsWith(dataRelative + '/'))) throw new Error('Без сборки допускается только состояние неизменённого корпуса');
      const allowed = ['src/content/blog/', 'public/images/hero/', 'public/images/preview/', '.claude/factchecked/', 'src/data/factcheck/results/', 'src/data/factcheck/claims/', 'autopilot/research/', dataRelative + '/'];
      for (const name of files) {
        if (!allowed.some(prefix => name.startsWith(prefix))) throw new Error(`Посторонняя правка доставки: ${name}`);
        if (/(?:^|\/)(?:\.env(?:\.|$)|\.writer-|\.settle-|chats(?:\/|$))/.test(name) || /\.bak$/.test(name)) throw new Error(`Приватный артефакт доставки: ${name}`);
        const full = path.join(root, name);
        for (let parent = path.dirname(full); parent !== path.resolve(root); parent = path.dirname(parent)) {
          if (lstatSync(parent).isSymbolicLink()) throw new Error(`Симлинк в пути доставки: ${name}`);
        }
        if (!existsSync(full)) continue;
        const stat = lstatSync(full);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error(`Небезопасный файл доставки: ${name}`);
        if (!/\.(?:png|jpe?g|webp)$/i.test(name)) {
          if (stat.size > 32 * 1024 * 1024) throw new Error(`Слишком большой текстовый файл доставки: ${name}`);
          if (scanText(readFileSync(full, 'utf8').replaceAll('secret-scan:allow', '')).length) throw new Error(`В файле доставки обнаружен секрет: ${name}`);
        }
      }
      if (!journal.contentCommit) {
        if (!stateOnly) {
          const verifiedBuild = build({ contentRoot: root });
          if (!verifiedBuild?.ok || verifiedBuild.code !== 0) throw new Error('Финальная сборка доставки не прошла');
          if (manifest.stages.built.corpusSha256 !== corpusHash(blog)) throw new Error('Сборка изменила корпус');
        }
        git(root, ['read-tree', journal.baseHead], { env });
        if (files.length) git(root, ['add', '-A', '--', ...files], { env });
        journal.contentTree = git(root, ['write-tree'], { env });
        journal.contentCommit = git(root, ['commit-tree', journal.contentTree, '-p', journal.baseHead], { env, input: `autopilot: content ${runId}\n` });
        journal.runId = runId; journal.phase = 'content'; writeJson(file, journal);
      } else git(root, ['read-tree', journal.contentCommit], { env });
      // This SHA identifies a real Git object. The second commit carries the
      // manifest proof; both become visible through one atomic ref update.
      setStage(runId, 'committed', { commit: journal.contentCommit, tree: journal.contentTree, stateOnly }, { dir: dataDir });
      git(root, ['add', '--', `${dataRelative}/runs/${runId}.json`], { env });
      journal.metadataTree = git(root, ['write-tree'], { env });
      journal.metadataCommit = git(root, ['commit-tree', journal.metadataTree, '-p', journal.contentCommit], { env, input: `autopilot: receipt ${runId}\n` });
      journal.phase = 'prepared'; writeJson(file, journal);
      afterPrepared(journal);
    }
    // A prepared commit may be resumed much later. Assets/evidence/state must
    // still match its tree before it becomes the branch tip.
    git(root, ['read-tree', journal.metadataCommit], { env });
    const drift = git(root, ['diff', '--name-only', journal.metadataCommit], { env });
    const unexpected = git(root, ['ls-files', '-o', '--exclude-standard'], { env });
    if (drift || unexpected) throw new Error(`Файлы изменились после подготовки доставки: ${(drift || unexpected).slice(0, 500)}`);
    // Ref compare-and-swap refuses a concurrent branch update.
    if (head === journal.baseHead) git(root, ['update-ref', journal.branch, journal.metadataCommit, journal.baseHead]);
    git(root, ['read-tree', journal.metadataCommit]);
    if (git(root, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('После доставки checkout не чист; требуется восстановление');
    journal.phase = 'committed'; writeJson(file, journal);
    return { runId, contentCommit: journal.contentCommit, metadataCommit: journal.metadataCommit, tree: journal.metadataTree, pushed: false, deployed: false };
  } finally { rmSync(indexFile, { force: true }); }
}
