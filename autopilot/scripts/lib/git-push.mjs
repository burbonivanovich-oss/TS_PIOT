import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { mkdtempSync, rmSync, existsSync, symlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runSiteBuild } from './site.mjs';
import { readDeliveryJournal } from './git-delivery.mjs';
import { writeJson } from './content.mjs';

function git(root, args, { input } = {}) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[key];
  const r = spawnSync('git', args, { cwd: root, env, input, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
  // Authentication failures may contain credential-bearing URLs. Do not export stderr.
  if (r.error || r.status !== 0) {
    const category = gitFailureCategory(r);
    const error = new Error(`Git ${args[0]} failed (${r.status ?? 'timeout'}; ${category})`);
    error.category = category;
    throw error;
  }
  return r.stdout.trim();
}

// Only allowlisted categories leave the process boundary; stderr stays private.
export function gitFailureCategory(result) {
  const text = String(result.stderr || '').toLowerCase();
  if (/authentication failed|could not read username|terminal prompts disabled|permission denied|repository not found|http.*(?:401|403)/.test(text)) return 'access_denied';
  if (result.error?.code === 'ETIMEDOUT' || /timed out/.test(text)) return 'timeout';
  if (/could not resolve host/.test(text)) return 'dns';
  if (/ssl|tls|certificate/.test(text)) return 'tls';
  if (/connection reset|connection refused|http\/2|rpc failed|remote end hung up|http.*5\d\d/.test(text)) return 'transport';
  return 'unknown';
}

export function readRemoteRef({ root, remote, targetRef, read = () => git(root, ['ls-remote', '--refs', remote, targetRef]), pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return read(); }
    catch (error) {
      if (!['timeout', 'dns', 'tls', 'transport', 'unknown'].includes(error.category) || attempt === 3) throw error;
      pause(250 * attempt);
    }
  }
}

export function pushGitDelivery({ root, remote = 'origin', targetRef, build = runSiteBuild, afterPush = () => {} }) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(remote)) throw new Error('Expected a configured remote name');
  if (!targetRef?.startsWith('refs/heads/') || targetRef.includes('*')) throw new Error('Expected an explicit branch ref');
  git(root, ['check-ref-format', targetRef]);
  const journal = readDeliveryJournal(root);
  if (journal?.phase !== 'committed' || journal.root !== path.resolve(root) || !/^[a-f0-9]{40,64}$/.test(journal.metadataCommit)) throw new Error('No committed delivery');
  if (![journal.metadataCommit, journal.push?.recovery?.commit].includes(git(root, ['rev-parse', 'HEAD'])) || git(root, ['symbolic-ref', 'HEAD']) !== journal.branch || git(root, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('Delivery checkout changed');
  if (journal.push && (journal.push.remote !== remote || journal.push.targetRef !== targetRef)) throw new Error('Push destination changed');
  git(root, ['remote', 'get-url', remote]);
  const remoteHead = () => {
    const rows = readRemoteRef({ root, remote, targetRef }).split('\n').filter(Boolean);
    if (rows.length > 1) throw new Error('Ambiguous remote ref');
    if (!rows.length) return null;
    const [sha, ref] = rows[0].split(/\s+/);
    if (ref !== targetRef || !/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('Invalid remote ref response');
    return sha;
  };
  const file = path.resolve(root, git(root, ['rev-parse', '--git-path', 'autopilot-delivery.json']));
  let before = remoteHead();
  let recovery = journal.push?.recovery;
  if (recovery) {
    if (![recovery.commit, recovery.remoteHead, recovery.tree].every(value => /^[a-f0-9]{40,64}$/.test(value || ''))) throw new Error('Invalid recovery identity');
    const proof = inspectWordstatDeliveryRace({ root, remoteHead: recovery.remoteHead });
    if (proof.tree !== recovery.tree || recovery.build?.ok !== true || recovery.build.code !== 0 ||
        git(root, ['show', '-s', '--format=%P', recovery.commit]) !== `${recovery.remoteHead} ${journal.metadataCommit}` ||
        git(root, ['rev-parse', `${recovery.commit}^{tree}`]) !== recovery.tree) throw new Error('Recovery proof changed');
    if (before !== recovery.remoteHead && before !== recovery.commit) throw new Error('Remote branch changed during recovery');
  } else if (before && before !== journal.baseHead && before !== journal.metadataCommit) {
    // Fetch only the explicit destination. The observed SHA must remain the
    // same; a moving collector is never chased in an unbounded retry loop.
    git(root, ['fetch', '--no-tags', remote, targetRef]);
    if (git(root, ['rev-parse', 'FETCH_HEAD']) !== before || remoteHead() !== before) throw new Error('Remote branch changed during recovery');
    const proof = inspectWordstatDeliveryRace({ root, remoteHead: before });
    const commit = git(root, ['-c', 'user.name=autopilot', '-c', 'user.email=autopilot@users.noreply.github.com', 'commit-tree', proof.tree, '-p', before, '-p', journal.metadataCommit], { input: `autopilot: preserve Wordstat delivery ${journal.runId || journal.metadataCommit}\n` });
    const scratch = mkdtempSync(path.join(tmpdir(), 'autopilot-wordstat-build-'));
    const candidate = path.join(scratch, 'candidate');
    let result;
    try {
      git(root, ['worktree', 'add', '--detach', candidate, commit]);
      if (existsSync(path.join(root, 'node_modules'))) {
        // Keep node_modules a real directory so the site's directory ignore
        // applies; a symlink at that path is otherwise an untracked file.
        mkdirSync(path.join(candidate, 'node_modules'));
        for (const entry of readdirSync(path.join(root, 'node_modules'))) symlinkSync(path.join(root, 'node_modules', entry), path.join(candidate, 'node_modules', entry));
      }
      result = build({ contentRoot: candidate });
      if (!result?.ok || result.code !== 0) throw new Error('Merged Wordstat delivery build failed');
      if (git(candidate, ['diff', '--name-only', commit]) || git(candidate, ['ls-files', '-o', '--exclude-standard'])) throw new Error('Build changed candidate files');
    } finally {
      if (existsSync(candidate)) git(root, ['worktree', 'remove', '--force', candidate]);
      rmSync(scratch, { recursive: true, force: true });
    }
    recovery = { ...proof, commit, build: { ok: true, code: 0 }, builtAt: new Date().toISOString() };
    if (remoteHead() !== before) throw new Error('Remote branch changed during recovery');
  }
  if (![journal.metadataCommit, recovery?.commit].includes(git(root, ['rev-parse', 'HEAD'])) || git(root, ['symbolic-ref', 'HEAD']) !== journal.branch || git(root, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('Delivery checkout changed during build');
  const commit = recovery?.commit || journal.metadataCommit;
  // Save the immutable, built candidate before any externally visible action.
  journal.push = { remote, targetRef, phase: 'pending', commit, ...(recovery ? { method: 'wordstat_merge', recovery } : {}) };
  writeJson(file, journal);
  if (before !== commit) git(root, ['push', '--porcelain', remote, `${commit}:${targetRef}`]);
  afterPush({ commit });
  if (remoteHead() !== commit) throw new Error('Remote SHA does not confirm delivery');
  if (recovery && git(root, ['rev-parse', 'HEAD']) !== commit) git(root, ['merge', '--ff-only', commit]);
  if (git(root, ['rev-parse', 'HEAD']) !== commit || git(root, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('Delivery checkout changed after push');
  journal.push.phase = 'verified'; journal.push.verifiedAt = new Date().toISOString(); writeJson(file, journal);
  return { pushed: true, deployed: false, commit, remote, targetRef, ...(recovery ? { method: 'wordstat_merge' } : {}) };
}

/** Read-only planning: produce a merge tree only for disjoint Wordstat data. */
export function inspectWordstatDeliveryRace({ root, remoteHead }) {
  const journal = readDeliveryJournal(root);
  if (journal?.phase !== 'committed' || journal.root !== path.resolve(root) || ![journal.baseHead,journal.metadataCommit,remoteHead].every(s => /^[a-f0-9]{40,64}$/.test(s || ''))) throw new Error('Invalid delivery race identity');
  git(root, ['merge-base', '--is-ancestor', journal.baseHead, remoteHead]);
  const prefix = 'src/data/wordstat/';
  const paths = git(root, ['diff', '--no-renames', '--name-only', '-z', journal.baseHead, remoteHead]).split('\0').filter(Boolean);
  if (!paths.length || paths.some(p => !p.startsWith(prefix) || !/\.(json|md)$/.test(p))) throw new Error('Remote changes outside Wordstat data');
  if (git(root, ['diff', '--name-only', journal.baseHead, journal.metadataCommit, '--', prefix])) throw new Error('Delivery also changed Wordstat data');
  for (const file of paths) {
    const mode = git(root, ['ls-tree', '--format=%(objectmode)', remoteHead, '--', file]);
    if (mode && mode !== '100644') throw new Error('Wordstat change is not a regular data file');
  }
  const tree = git(root, ['merge-tree', '--write-tree', remoteHead, journal.metadataCommit]).split('\n')[0];
  if (!/^[a-f0-9]{40,64}$/.test(tree)) throw new Error('Invalid merged tree');
  if (git(root, ['diff', '--name-only', journal.metadataCommit, tree, '--', '.', ':(exclude)src/data/wordstat']) || git(root, ['diff', '--name-only', remoteHead, tree, '--', prefix])) throw new Error('Merged tree changed delivery or foreign data');
  return { remoteHead, deliveryCommit: journal.metadataCommit, tree, foreignPaths: paths, deliveryBytesUnchanged: true, wordstatBytesUnchanged: true, checkoutChanged: false };
}
