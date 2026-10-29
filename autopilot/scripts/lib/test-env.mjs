// Tests own their fixture paths; production overrides must not leak into children.
export function isolatedTestEnv(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) =>
    key !== 'CONTENT_ROOT' && key !== 'CLAUDE_CODE_OAUTH_TOKEN' && !key.startsWith('AUTOPILOT_')));
}
