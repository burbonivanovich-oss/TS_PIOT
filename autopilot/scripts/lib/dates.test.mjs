import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIsoDate, isFutureIso, isPastIso } from './dates.mjs';

test('AP-P1-03: строгий ISO-формат и реальная календарная дата', () => {
  assert.equal(parseIsoDate('2026-09-13').ok, true);
  assert.equal(parseIsoDate('2026-02-30').ok, false, '30 февраля не существует');
  assert.equal(parseIsoDate('2026-13-01').ok, false);
  assert.equal(parseIsoDate('2026-00-10').ok, false);
  assert.equal(parseIsoDate('2026-1-1').ok, false, 'нужен двузначный месяц/день');
  assert.equal(parseIsoDate('2026-09-13T00:00:00Z').ok, false);
  assert.equal(parseIsoDate('').ok, false);
  assert.equal(parseIsoDate(null).ok, false);
  assert.equal(parseIsoDate(undefined).ok, false);
  assert.equal(parseIsoDate('2026-2-3').ok, false);
  assert.equal(parseIsoDate('01.02.2026').ok, false);
});

test('AP-P1-03: границы месяцев и годов считаются в UTC', () => {
  assert.equal(parseIsoDate('2026-12-31').ok, true);
  assert.equal(parseIsoDate('2027-01-01').ok, true);
  assert.equal(parseIsoDate('2026-04-31').ok, false, 'в апреле 30 дней');
  const leap = parseIsoDate('2024-02-29');
  assert.equal(leap.ok, true);
  assert.equal(leap.date.toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(parseIsoDate('2026-02-29').ok, false, '2026 не leap');
});

test('AP-P1-03: будущее и прошлое относительно UTC-сегодня', () => {
  const now = new Date('2026-09-13T23:59:00Z');
  assert.equal(isFutureIso('2026-09-14', now), true);
  assert.equal(isFutureIso('2026-09-13', now), false, 'сегодня — не будущее');
  assert.equal(isPastIso('2026-09-12', now), true);
  assert.equal(isPastIso('2026-09-13', now), false);
  assert.equal(isFutureIso('мусор', now), false);
});
