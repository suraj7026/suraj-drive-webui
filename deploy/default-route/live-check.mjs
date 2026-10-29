import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const origins = ['http://127.0.0.1:4080', 'https://drive.sudarshanrajagopalan.one'];
const get = (origin, path, cookie) => fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: cookie ? { Cookie: cookie } : {} });
const digest = buffer => createHash('sha256').update(Buffer.from(buffer)).digest('hex');
function routed(response) {
  assert.equal(response.headers.get('x-drive-route'), 'k8s-20b42a8');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.ok(!['HIT', 'STALE', 'UPDATING', 'REVALIDATED'].includes(response.headers.get('cf-cache-status')), 'Unexpected shared-cache response');
}
for (const origin of origins) {
  for (const cookie of [null, 'drive_preview=k8s-20b42a8', 'drive_preview=invalid', 'drive_preview=docker', null]) {
    const login = await get(origin, '/login', cookie);
    assert.equal(login.status, 200);
    routed(login);
    const html = await login.text();
    assert.ok(html.includes('Sign in to open your personal bucket.'));
    assert.ok(html.includes('/drive-api/api/auth/google/login'));
    const status = await get(origin, '/__migration-preview/status', cookie);
    assert.equal(status.status, 200);
    routed(status);
    assert.equal(await status.text(), 'k8s-20b42a8\n');
  }
  const login = await get(origin, '/login');
  const html = await login.text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.(?:js|css))"/g)].map(match => match[1]))];
  assert.ok(assets.length > 0);
  for (const asset of assets) {
    assert.equal(new URL(asset, origin).origin, origin);
    const [response, direct] = await Promise.all([get(origin, asset), get('http://10.43.53.78', asset)]);
    assert.equal(response.status, 200);
    assert.equal(direct.status, 200);
    assert.equal(digest(await response.arrayBuffer()), digest(await direct.arrayBuffer()));
  }
  const health = await get(origin, '/drive-api/api/health');
  assert.equal(health.status, 200);
  routed(health);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const me = await get(origin, '/drive-api/api/auth/me');
  assert.equal(me.status, 401);
  routed(me);
  const archive = await get(origin, '/archive');
  assert.equal(archive.status, 307);
  routed(archive);
  assert.equal(new URL(archive.headers.get('location'), origin).pathname, '/login');
  const oauth = await get(origin, '/drive-api/api/auth/google/login');
  assert.equal(oauth.status, 307);
  routed(oauth);
  const location = new URL(oauth.headers.get('location'));
  assert.equal(location.hostname, 'accounts.google.com');
  const callback = new URL(location.searchParams.get('redirect_uri'));
  assert.ok(callback.origin === 'https://drive.sudarshanrajagopalan.one' && callback.pathname === '/drive-api/api/auth/google/callback', 'Unexpected OAuth callback (redacted)');
  for (const action of ['enable', 'disable']) {
    const response = await get(origin, '/__migration-preview/' + action);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/login');
    assert.ok(response.headers.get('set-cookie')?.includes('Max-Age=0'));
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  console.log(`PASS ${origin}: Kubernetes default regardless of cookie, ${assets.length} exact assets, API health/auth denial, protected-page and OAuth redirects, cache controls and retired opt-in links`);
}
console.log('These are automated unauthenticated post-cutover checks; signed-in pre-cutover validation was reported by the operator.');
