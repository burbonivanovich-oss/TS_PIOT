import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readDeliveryJournal } from './git-delivery.mjs';
import { writeJson } from './content.mjs';

function git(root, args) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[key];
  const r = spawnSync('git', args, { cwd: root, env, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 });
  // Authentication failures may contain credential-bearing URLs. Do not export stderr.
  if (r.error || r.status !== 0) throw new Error(`Git ${args[0]} failed (${r.status ?? 'timeout'})`);
  return r.stdout.trim();
}

export function pushGitDelivery({ root, remote = 'origin', targetRef }) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(remote)) throw new Error('Expected a configured remote name');
  if (!targetRef?.startsWith('refs/heads/') || targetRef.includes('*')) throw new Error('Expected an explicit branch ref');
  git(root, ['check-ref-format', targetRef]);
  const journal = readDeliveryJournal(root);
  if (journal?.phase !== 'committed' || journal.root !== path.resolve(root) || !/^[a-f0-9]{40,64}$/.test(journal.metadataCommit)) throw new Error('No committed delivery');
  if (git(root, ['rev-parse', 'HEAD']) !== journal.metadataCommit || git(root, ['symbolic-ref', 'HEAD']) !== journal.branch || git(root, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('Delivery checkout changed');
  if (journal.push && (journal.push.remote !== remote || journal.push.targetRef !== targetRef)) throw new Error('Push destination changed');
  git(root, ['remote', 'get-url', remote]);
  const remoteHead = () => {
    const rows = git(root, ['ls-remote', '--refs', remote, targetRef]).split('\n').filter(Boolean);
    if (rows.length > 1) throw new Error('Ambiguous remote ref');
    if (!rows.length) return null;
    const [sha, ref] = rows[0].split(/\s+/);
    if (ref !== targetRef || !/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('Invalid remote ref response');
    return sha;
  };
  const file = path.resolve(root, git(root, ['rev-parse', '--git-path', 'autopilot-delivery.json']));
  const before = remoteHead();
  if (before && before !== journal.baseHead && before !== journal.metadataCommit) throw new Error('Remote branch changed outside this delivery');
  journal.push = { remote, targetRef, phase: 'pending', commit: journal.metadataCommit };
  writeJson(file, journal);
  if (before !== journal.metadataCommit) git(root, ['push', '--porcelain', remote, `${journal.metadataCommit}:${targetRef}`]);
  if (remoteHead() !== journal.metadataCommit) throw new Error('Remote SHA does not confirm delivery');
  journal.push.phase = 'verified'; journal.push.verifiedAt = new Date().toISOString(); writeJson(file, journal);
  return { pushed: true, deployed: false, commit: journal.metadataCommit, remote, targetRef };
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
