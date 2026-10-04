// Public HTTP evidence of the deployed build; never infer it from push alone.
export async function verifyLiveRelease({ site, expectedCommit, pages = [], fetchImpl = fetch, now = new Date() }) {
  if (!/^[a-f0-9]{40,64}$/.test(expectedCommit)) throw new Error('Invalid expected revision');
  const base = new URL(site);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('Invalid site URL');
  if (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Public release requires HTTPS');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  const checkedAt = now.toISOString();
  const get = async (url) => {
    const response = await fetchImpl(url, { redirect: 'error', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
    if (response.status !== 200) throw new Error(`Live release HTTP ${response.status}`);
    return response;
  };
  const releaseUrl = new URL('release.json', base); releaseUrl.searchParams.set('revision', expectedCommit);
  const response = await get(releaseUrl);
  if (!/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('Release receipt is not JSON');
  const receipt = await response.json();
  const builtAt = Date.parse(receipt.builtAt);
  if (receipt.version !== 1 || receipt.sourceClean !== true || receipt.revision !== expectedCommit || !Number.isFinite(builtAt) || builtAt > now.getTime() + 300000) throw new Error('Live revision not confirmed');
  const checkedPages = [];
  for (const page of pages) {
    if (typeof page.path !== 'string' || !page.path || !page.requiredText?.trim()) throw new Error('Page needs a path and expected content');
    const url = new URL(page.path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.username || url.password || url.hash || url.search) throw new Error('Page outside release site');
    url.searchParams.set('revision', expectedCommit);
    const pageResponse = await get(url);
    if (!/text\/html/i.test(pageResponse.headers.get('content-type') || '')) throw new Error('Live page is not HTML');
    const html = await pageResponse.text();
    if (!html.includes(page.requiredText)) throw new Error('Expected page content missing');
    checkedPages.push({ path: page.path, status: 200, contentVerified: true });
  }
  return { liveVerified: true, revision: receipt.revision, builtAt: receipt.builtAt, checkedAt, pages: checkedPages };
}
