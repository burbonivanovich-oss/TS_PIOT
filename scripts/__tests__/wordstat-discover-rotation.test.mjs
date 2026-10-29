import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lastCollected, orderByStaleness } from '../wordstat/discover.mjs';

test('weekly rotation puts never-collected seeds first, then the oldest, file order on ties', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'discover-'));
  try {
    for (const [day, files] of [['2026-09-28', ['офд', 'этрн']], ['2026-10-05', ['офд']], ['diffs', ['ignored']]]) {
      mkdirSync(path.join(root, day));
      for (const f of files) writeFileSync(path.join(root, day, f + '.json'), '{}');
    }
    const last = lastCollected(root);
    assert.equal(last.get('офд'), '2026-10-05');
    assert.equal(last.get('этрн'), '2026-09-28');
    assert.equal(last.has('ignored'), false);
    const seeds = ['ОФД', 'ЭТрН', 'налоги для фрилансера', 'касса для салона красоты'].map((phrase) => ({ phrase }));
    assert.deepEqual(orderByStaleness(seeds, last).map((s) => s.phrase), ['налоги для фрилансера', 'касса для салона красоты', 'ЭТрН', 'ОФД']);
    assert.deepEqual(lastCollected(path.join(root, 'missing')), new Map());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
