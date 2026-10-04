import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { verifyLiveRelease } from './live-release.mjs';

const revision = 'a'.repeat(40);
async function fixture(t, { sha = revision, sourceClean = true, status = 200, content = 'Published article', redirect = false } = {}) {
  const server = createServer((req, res) => {
    if (redirect) { res.writeHead(302, { Location: '/other' }); return res.end(); }
    res.statusCode = status;
    if (req.url.startsWith('/release.json')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ version: 1, revision: sha, sourceClean, builtAt: '2026-10-04T00:00:00.000Z' })); }
    else { res.setHeader('Content-Type', 'text/html'); res.end(`<h1>${content}</h1>`); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { site: `http://127.0.0.1:${server.address().port}/`, expectedCommit: revision, now: new Date('2026-10-04T06:00:00Z') };
}
test('real HTTP verifies exact release SHA and actual page content', async t => {
  const f = await fixture(t); const result = await verifyLiveRelease({ ...f, pages: [{ path: '/blog/article/', requiredText: 'Published article' }] });
  assert.equal(result.liveVerified, true); assert.equal(result.pages[0].contentVerified, true);
});
test('stale build, missing content and HTTP failure never confirm publication', async t => {
  await assert.rejects(verifyLiveRelease(await fixture(t, { sha: 'b'.repeat(40) })), /revision/);
  await assert.rejects(verifyLiveRelease(await fixture(t, { sourceClean: false })), /revision/);
  await assert.rejects(verifyLiveRelease({ ...await fixture(t), pages: [{ path: '/blog/article/', requiredText: 'New rewrite' }] }), /content missing/);
  await assert.rejects(verifyLiveRelease(await fixture(t, { status: 503 })), /HTTP 503/);
});
test('redirects and off-site paths cannot provide release proof', async t => {
  await assert.rejects(verifyLiveRelease(await fixture(t, { redirect: true })));
  await assert.rejects(verifyLiveRelease({ ...await fixture(t), pages: [{ path: 'https://other.test/', requiredText: 'article' }] }), /outside/);
});
