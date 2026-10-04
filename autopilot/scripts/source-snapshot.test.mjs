import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureSource } from './source-snapshot.mjs';

const url = 'https://publication.pravo.gov.ru/document/123';
const body = '<html><script>лишний текст</script><p>Норма действует с 01.10.2026 для организаций указанной категории.</p></html>';
test('PUB-05: снимок сохраняет документ без скриптов и с контрольной суммой', async () => {
  const doc = await captureSource(url, { fetcher: async () => new Response(body, { headers: { 'content-type': 'text/html' } }) });
  assert.match(doc.text, /01.10.2026/);
  assert.ok(!doc.text.includes('лишний'));
  assert.equal(doc.sha256.length, 64);
});
test('PUB-05: 404, PDF, пустой текст и чужой редирект не дают снимок', async () => {
  for (const response of [
    new Response('not found', { status: 404 }),
    new Response('binary', { headers: { 'content-type': 'application/pdf' } }),
    new Response('empty', { headers: { 'content-type': 'text/plain' } }),
    new Response('', { status: 302, headers: { location: 'https://example.org/document' } }),
  ]) await assert.rejects(captureSource(url, { fetcher: async () => response }));
  await assert.rejects(captureSource('https://example.org/document'));
});
