import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const origins = ['http://127.0.0.1:4080', 'https://drive.sudarshanrajagopalan.one'];
const baselineFile = process.argv[3];
assert.ok(baselineFile, 'Supply a baseline file');
const get = (origin, path, cookie) => fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(15000), headers: cookie ? { Cookie: cookie } : {} });
const assets = html => [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.(?:js|css))"/g)].map(match => match[1]))].sort();
const digest = buffer => createHash('sha256').update(Buffer.from(buffer)).digest('hex');
if (process.argv[2] === 'capture') {
  const baseline = {};
  for (const origin of origins) {
    const response = await get(origin, '/login');
    assert.equal(response.status, 200);
    baseline[origin] = assets(await response.text());
    assert.ok(baseline[origin].length > 0);
  }
  await fs.writeFile(baselineFile, JSON.stringify(baseline, null, 2), { mode: 0o600, flag: 'wx' });
  console.log('Captured public/static asset identifiers from both existing Docker routes; no credentials recorded.');
  process.exit(0);
}
assert.equal(process.argv[2], 'verify');
const baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
const previewCookie = 'drive_preview=k8s-20b42a8';
function notSharedCache(response) {
  assert.ok(!['HIT', 'STALE', 'UPDATING', 'REVALIDATED'].includes(response.headers.get('cf-cache-status')), 'Unexpected shared-cache response');
}
for (const origin of origins) {
  for (const cookie of [null, 'drive_preview=invalid', previewCookie, null, previewCookie, null]) {
    const preview = cookie === previewCookie;
    const expected = preview ? 'k8s-preview-20b42a8' : 'docker';
    const response = await get(origin, '/login', cookie);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-drive-route'), expected);
    notSharedCache(response);
    const html = await response.text();
    if (!preview) assert.deepEqual(assets(html), baseline[origin], 'Legacy asset identifiers changed');
    else {
      assert.ok(html.includes('Sign in to open your personal bucket.'));
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
  }
  for (const cookie of [null, previewCookie]) {
    const expected = cookie ? 'k8s-preview-20b42a8' : 'docker';
    for (const [path, status] of [['/__migration-preview/status', 200], ['/drive-api/api/health', 200], ['/drive-api/api/auth/me', 401]]) {
      const response = await get(origin, path, cookie);
      assert.equal(response.status, status);
      assert.equal(response.headers.get('x-drive-route'), expected);
      notSharedCache(response);
      if (path.endsWith('/status')) assert.equal(await response.text(), expected + '\n');
      if (path.endsWith('/health')) assert.deepEqual(await response.json(), { status: 'ok' });
    }
    const oauth = await get(origin, '/drive-api/api/auth/google/login', cookie);
    assert.equal(oauth.status, 307);
    assert.equal(oauth.headers.get('x-drive-route'), expected);
    notSharedCache(oauth);
    const location = new URL(oauth.headers.get('location'));
    assert.equal(location.hostname, 'accounts.google.com');
    const callback = new URL(location.searchParams.get('redirect_uri'));
    assert.ok(callback.origin === 'https://drive.sudarshanrajagopalan.one' && callback.pathname === '/drive-api/api/auth/google/callback', 'Unexpected OAuth callback (redacted)');
  }
  const preview = await get(origin, '/login', previewCookie);
  const references = assets(await preview.text());
  assert.ok(references.length > 0);
  for (const reference of references) {
    assert.equal(new URL(reference, origin).origin, origin);
    const [response, direct] = await Promise.all([
      get(origin, reference, previewCookie), get('http://10.43.53.78', reference),
    ]);
    assert.equal(response.status, 200);
    assert.equal(direct.status, 200);
    assert.equal(digest(await response.arrayBuffer()), digest(await direct.arrayBuffer()), 'Preview asset differs from direct Kubernetes content');
  }
  for (const [action, maxAge] of [['enable', 1800], ['disable', 0]]) {
    const response = await get(origin, '/__migration-preview/' + action);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/login');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    notSharedCache(response);
    const cookie = response.headers.get('set-cookie') ?? '';
    for (const attribute of ['Path=/', `Max-Age=${maxAge}`, 'Secure', 'HttpOnly', 'SameSite=Lax']) assert.ok(cookie.includes(attribute), 'Routing cookie attribute missing');
  }
  console.log(`PASS ${origin}: default preserved, opt-in/opt-out, alternating cache isolation, API health/auth denial, OAuth redirect, ${references.length} matching assets`);
}
console.log('Completed Google sign-in and authenticated file operations still require operator validation in a normal browser.');
