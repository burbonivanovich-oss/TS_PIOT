// Раздельные бюджеты новых материалов и обновлений. Принятые материалы
// текущего месяца уже включены в counters; перенесённая очередь резервирует
// бюджет нового месяца отдельно. Эта арифметика не доказывает live-выпуск.
export function productionCapacity({ state, now, config, waiting = [], urgentRewrites = 0 }) {
  if (!Number.isInteger(urgentRewrites) || urgentRewrites < 0) throw new Error('Invalid urgent rewrite count');
  const T = config.throughput;
  const month = now.toISOString().slice(0, 7);
  const day = now.getUTCDate();
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const byKind = {};
  for (const kind of ['new', 'rewrite']) {
    const target = kind === 'new' ? T.monthlyTarget : T.monthlyRewriteTarget;
    const done = state.month === month ? (state.counters[kind] || 0) : 0;
    const active = state.inFlight.filter(t => t.kind === kind).length;
    const carriedAccepted = waiting.filter(t => t.kind === kind && !String(t.acceptedAt || '').startsWith(month)).length;
    const expectedByToday = Math.round(target * day / days);
    byKind[kind] = {
      target, done, active, carriedAccepted, expectedByToday,
      debt: Math.max(0, expectedByToday - done),
      remaining: Math.max(0, target - done - active - carriedAccepted),
    };
  }
  const totalTarget = T.monthlyTarget + T.monthlyRewriteTarget;
  const totalDone = byKind.new.done + byKind.rewrite.done;
  const totalDebt = byKind.new.debt + byKind.rewrite.debt;
  const ceil = x => Math.ceil(Math.round(x * 1e6) / 1e6);
  const todayTarget = Math.min(ceil(totalTarget / days + totalDebt * (T.catchUpFactor - 1)), ceil(totalTarget / days * T.catchUpFactor * T.batchesPerDay));
  const freeSlots = Math.max(0, T.maxParallelWriting - state.inFlight.length);
  const remaining = byKind.new.remaining + byKind.rewrite.remaining;
  const canTake = Math.min(freeSlots, remaining, todayTarget, Math.max(0, T.maxBatchSize - state.inFlight.length));
  const urgentRewriteSlots = Math.min(urgentRewrites, byKind.rewrite.remaining, canTake);
  const takeByKind = { new: 0, rewrite: urgentRewriteSlots };
  // Следующий слот получает вид с наименьшей долей зарезервированной нормы.
  // Это сохраняет рерайты даже при батчах по одному материалу.
  for (let i = urgentRewriteSlots; i < canTake; i++) {
    const eligible = ['new', 'rewrite'].filter(k => takeByKind[k] < byKind[k].remaining);
    eligible.sort((a, b) => {
      const progress = k => (byKind[k].done + byKind[k].active + byKind[k].carriedAccepted + takeByKind[k]) / byKind[k].target;
      return progress(a) - progress(b);
    });
    takeByKind[eligible[0]]++;
  }
  return {
    month, done: byKind.new.done, monthlyTarget: T.monthlyTarget,
    totalDone, totalTarget, expectedByToday: byKind.new.expectedByToday,
    debt: byKind.new.debt, todayTarget, inFlight: state.inFlight.length,
    freeSlots, remaining, canTake, byKind, takeByKind, urgentRewriteSlots,
  };
}
