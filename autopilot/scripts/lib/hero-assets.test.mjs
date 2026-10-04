import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkHeroAssets, imageSize } from './hero-assets.mjs';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=', 'base64');

test('reads PNG metadata and refuses truncated/unknown data', () => {
  assert.deepEqual(imageSize(png), { width: 1, height: 1, format: 'png' });
  assert.throws(() => imageSize(png.subarray(0, 30)), /PNG/);
  assert.throws(() => imageSize(Buffer.alloc(100)), /поддерживаемого/);
});

test('hero must exist inside public; optional preview must also be valid', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'hero-assets-'));
  try {
    mkdirSync(path.join(root, 'public/images'), { recursive: true });
    writeFileSync(path.join(root, 'public/images/hero.png'), png);
    const check = data => checkHeroAssets({ data, contentRoot: root });
    assert.equal(check({ heroImage: '/images/hero.png' }).ok, true);
    assert.equal(check({}).ok, false);
    assert.equal(check({ heroImage: '/images/missing.png' }).ok, false);
    assert.equal(check({ heroImage: '/images/hero.png', previewImage: '/images/missing.png' }).ok, false);
    for (const url of ['https://example.org/a.png', '//example.org/a.png', '/images/../hero.png', '/images/%2e%2e/a.png']) assert.equal(check({ heroImage: url }).ok, false);
    writeFileSync(path.join(root, 'outside.png'), png);
    symlinkSync(path.join(root, 'outside.png'), path.join(root, 'public/images/escape.png'));
    assert.equal(check({ heroImage: '/images/escape.png' }).ok, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
