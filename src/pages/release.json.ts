import { execFileSync } from 'node:child_process';

export const prerender = true;

export function GET() {
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sourceClean = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim() === '';
  if (!/^[a-f0-9]{40,64}$/.test(revision)) throw new Error('Cannot identify release revision');
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== revision) throw new Error('Build revision differs from GitHub checkout');
  return new Response(JSON.stringify({ version: 1, revision, sourceClean, builtAt: new Date().toISOString() }) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
