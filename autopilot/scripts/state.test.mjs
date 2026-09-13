import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claim, done, fail, capacity } from './state.mjs';

const fresh = () => ({
  version: 1,
  month: '2026-08',
  counters: { new: 0, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0 },
  inFlight: [],
  quarantine: [],
  history: [],
});

test('одна и та же тема не берётся в работу дважды', () => {
  // Защита от повторного прогона крона: без неё два запуска подряд выдают
  // один наряд дважды и получаются две статьи на одну тему.
  const state = fresh();
  claim(state, { slug: 'a', kind: 'new' });
  assert.throws(() => claim(state, { slug: 'a', kind: 'new' }), /Уже в работе/);
});

test('тема из карантина не возвращается в работу', () => {
  const state = fresh();
  state.quarantine.push({ slug: 'bad' });
  assert.throws(() => claim(state, { slug: 'bad', kind: 'new' }), /карантин/);
});

test('после порога неудач тема уходит в карантин, а не крутится вечно', () => {
  const state = fresh();
  claim(state, { slug: 'a', kind: 'new' });
  const first = fail(state, { slug: 'a', reason: 'gates' });
  assert.equal(first.quarantined, false);
  assert.equal(state.inFlight.length, 1);
  const second = fail(state, { slug: 'a', reason: 'gates' });
  assert.equal(second.quarantined, true);
  assert.equal(state.inFlight.length, 0);
  assert.equal(state.quarantine.length, 1);
});

test('счётчики месяца разделяют новые статьи и рерайты', () => {
  const state = fresh();
  claim(state, { slug: 'a', kind: 'new' });
  claim(state, { slug: 'b', kind: 'rewrite' });
  done(state, { slug: 'a', published: true });
  done(state, { slug: 'b', published: true });
  assert.equal(state.counters.new, 1);
  assert.equal(state.counters.rewrite, 1);
  assert.equal(state.counters.published, 2);
});

test('done по невзятой теме — ошибка, а не тихий инкремент', () => {
  const state = fresh();
  assert.throws(() => done(state, { slug: 'нет-такой' }), /Не в работе/);
});

test('AP-P0-12: два инфраструктурных пропуска не карантинят тему', () => {
  // Выключенный исполнитель не должен превращать нормальную тему в карантин:
  // это не редакционный провал.
  const state = fresh();
  claim(state, { slug: 'a', kind: 'new' });
  const first = fail(state, { slug: 'a', reason: 'файл не создан', kind: 'infra' });
  const second = fail(state, { slug: 'a', reason: 'файл не создан', kind: 'infra' });
  assert.equal(first.quarantined, false);
  assert.equal(second.quarantined, false);
  assert.equal(state.inFlight.length, 1);
  assert.equal(state.quarantine.length, 0);
  assert.equal(state.inFlight[0].failures, 0, 'редакционные неудачи не растут');
  assert.equal(state.inFlight[0].infraFailures, 2);
});

test('AP-P0-12: после лимита инфраструктурных повторов слот освобождается, тема не в карантине', () => {
  const state = fresh();
  claim(state, { slug: 'a', kind: 'new' });
  let res;
  for (let i = 0; i < 3; i++) res = fail(state, { slug: 'a', reason: 'файл не создан', kind: 'infra' });
  assert.equal(res.released, true);
  assert.equal(res.quarantined, false);
  assert.equal(state.inFlight.length, 0);
  assert.equal(state.quarantine.length, 0);
  assert.equal(state.counters.infraReleases, 1);
});

test('AP-P0-12: редакционный отказ по-прежнему уходит в карантин после порога', () => {
  const state = fresh();
  claim(state, { slug: 'a', kind: 'new' });
  assert.equal(fail(state, { slug: 'a', reason: 'sources' }).quarantined, false);
  assert.equal(fail(state, { slug: 'a', reason: 'sources' }).quarantined, true);
  assert.equal(state.quarantine.length, 1);
});

test('AP-P1-04: темп и остаток по таблице контрольных дат (UTC, calendar-day)', () => {
  const at = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const withDone = (n, inFlight = 0) => ({
    ...fresh(),
    counters: { new: n, rewrite: 0, published: 0, blockedDupes: 0, quarantined: 0, infraReleases: 0 },
    inFlight: Array.from({ length: inFlight }, (_, i) => ({ slug: `f${i}` })),
  });

  // Сентябрь 2026: 30 дней, цель 200.
  assert.deepEqual(
    pick(capacity(withDone(0), at(2026, 9, 1))),
    { expectedByToday: 7, debt: 7, todayTarget: 10, canTake: 8 },
  );
  assert.deepEqual(
    pick(capacity(withDone(0), at(2026, 9, 15))),
    { expectedByToday: 100, debt: 100, todayTarget: 18, canTake: 8 },
  );
  assert.deepEqual(
    pick(capacity(withDone(0), at(2026, 9, 30))),
    { expectedByToday: 200, debt: 200, todayTarget: 18, canTake: 8 },
  );
  // Долг уменьшается на сделанное.
  assert.deepEqual(
    pick(capacity(withDone(3), at(2026, 9, 1))),
    { expectedByToday: 7, debt: 4, todayTarget: 9, canTake: 8 },
  );
  // Февраль 2026: 28 дней (не leap).
  assert.deepEqual(
    pick(capacity(withDone(0), at(2026, 2, 1))),
    { expectedByToday: 7, debt: 7, todayTarget: 10, canTake: 8 },
  );
  // Конец года.
  assert.deepEqual(
    pick(capacity(withDone(0), at(2026, 12, 31))),
    { expectedByToday: 200, debt: 200, todayTarget: 18, canTake: 8 },
  );
  // Занятые слоты урезают canTake.
  assert.equal(capacity(withDone(0, 7), at(2026, 9, 1)).canTake, 1);
});

/** Только интересующие поля расчёта темпа. */
function pick(cap) {
  return {
    expectedByToday: cap.expectedByToday,
    debt: cap.debt,
    todayTarget: cap.todayTarget,
    canTake: cap.canTake,
  };
}
