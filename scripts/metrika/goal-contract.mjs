// Yandex Management API: number uses depth, visit_duration uses duration.
// https://yandex.ru/dev/metrika/ru/management/openapi/goal/addGoal
function threshold(g) {
  const n = Number(g.value);
  if (!Number.isSafeInteger(n) || n < 1 || !['gt', 'gte'].includes(g.operator)) throw new Error(`Unsupported threshold: ${g.id}`);
  return n;
}
export function buildPayload(g) {
  if (g.type === 'action') return { goal: { name: g.name, type: 'action', conditions: [{ type: 'exact', url: g.id }] } };
  const n = threshold(g);
  if (g.type === 'number') {
    const depth = n + (g.operator === 'gt' ? 1 : 0);
    if (!Number.isSafeInteger(depth) || depth < 2) throw new Error(`Unsupported depth: ${g.id}`);
    return { goal: { name: g.name, type: 'number', depth } };
  }
  if (g.type === 'time') {
    const duration = n - (g.operator === 'gte' ? 1 : 0);
    if (duration < 1) throw new Error(`Unsupported duration: ${g.id}`);
    return { goal: { name: g.name, type: 'visit_duration', duration } };
  }
  throw new Error(`Unsupported goal type: ${g.type}`);
}
export function declaredKey(g) {
  const { goal } = buildPayload(g);
  return remoteKey(goal);
}
export function remoteKey(r) {
  if (r.type === 'action') {
    const conditions = r.conditions || [];
    return conditions.length === 1 && conditions[0].type === 'exact' ? `action:${conditions[0].url}` : null;
  }
  if (r.type === 'number' && Number.isSafeInteger(r.depth) && r.depth >= 2) return `number:${r.depth}`;
  if (r.type === 'visit_duration' && Number.isSafeInteger(r.duration) && r.duration >= 1) return `visit_duration:${r.duration}`;
  return null;
}
