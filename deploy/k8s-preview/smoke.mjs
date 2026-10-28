import assert from 'node:assert/strict';

const origin = process.argv[2];
assert.ok(origin, 'Supply the private preview origin');
const base = new URL(origin);
assert.ok(['127.0.0.1', 'localhost', '10.43.53.78'].includes(base.hostname), 'Refusing a non-preview origin');
const get = (path) => fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
const health = await get('/healthz');
assert.equal(health.status, 200);
assert.equal(await health.text(), 'OK\n');
const login = await get('/login');
assert.equal(login.status, 200);
const html = await login.text();
assert.ok(html.includes('Sign in to open your personal bucket.'));
assert.ok(html.includes('/drive-api/api/auth/google/login'));
const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.(?:js|css))"/g)].map((match) => match[1]))];
assert.ok(assets.length > 0, 'Expected scripts/styles in the login page');
for (const asset of assets) {
  assert.equal(new URL(asset, base).origin, base.origin);
  const response = await get(asset);
  assert.equal(response.status, 200);
  assert.ok(/(?:javascript|css)/.test(response.headers.get('content-type') ?? ''));
  assert.ok((await response.arrayBuffer()).byteLength > 100);
}
const api = await get('/drive-api/api/health');
assert.equal(api.status, 200);
assert.deepEqual(await api.json(), { status: 'ok' });
const me = await get('/drive-api/api/auth/me');
assert.equal(me.status, 401);
const archive = await get('/archive');
assert.equal(archive.status, 307);
assert.equal(new URL(archive.headers.get('location'), base).pathname, '/login');
const oauth = await get('/drive-api/api/auth/google/login');
// Both the existing production gateway and API source use Temporary Redirect.
assert.equal(oauth.status, 307);
const authURL = new URL(oauth.headers.get('location'));
assert.equal(authURL.hostname, 'accounts.google.com');
// Never print OAuth state, cookies, client IDs or full Location headers.
const callback = new URL(authURL.searchParams.get('redirect_uri'));
assert.ok(callback.origin === 'https://drive.sudarshanrajagopalan.one', 'Unexpected OAuth callback origin (redacted)');
assert.ok(callback.pathname === '/drive-api/api/auth/google/callback', 'Unexpected OAuth callback path (redacted)');
console.log(`PASS gateway health, login content, ${assets.length} JS/CSS assets, existing API health, unauthenticated denial, protected-page redirect and OAuth entry/callback configuration`);
console.log('Not tested: completed OAuth, authenticated browsing, uploads/downloads. No production route changed.');
