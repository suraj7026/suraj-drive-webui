import assert from 'node:assert/strict';

const origin = process.argv[2];
assert.ok(origin, 'Supply an isolated fixture gateway');
const cookie = 'drive_preview=k8s-20b42a8';
let checks = 0;
const request = (path, init = {}) => fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(10000), ...init });
for (const [value, preview] of [[null, false], ['drive_preview=invalid', false], ['drive_preview=K8S-20b42a8', false], [cookie, true]]) {
  for (const path of ['/example?q=a%2Fb', '/drive-api/api/files?q=a%2Fb']) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const body = method === 'GET' ? undefined : '{"fixture":"body-preserved"}';
      const response = await request(path, { method, body, headers: { ...(value ? { cookie: value } : {}), 'content-type': 'application/json' } });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.target, preview ? 'preview' : path.startsWith('/drive-api/') ? 'legacy-api' : 'legacy-web');
      assert.equal(result.method, method);
      assert.equal(result.body, body ?? '');
      assert.equal(result.uri, !preview && path.startsWith('/drive-api/') ? path.slice('/drive-api'.length) : path);
      assert.equal(response.headers.get('x-drive-route'), preview ? 'k8s-preview-20b42a8' : 'docker');
      if (preview || path.startsWith('/drive-api/')) {
        assert.equal(result.host, 'drive.sudarshanrajagopalan.one');
        assert.equal(result.proto, 'https');
      }
      if (preview) {
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        assert.ok(response.headers.get('vary').includes('Cookie'));
      }
      checks++;
    }
  }
}
for (const [path, status] of [['/unauthorized', 401], ['/unavailable', 503]]) {
  const response = await request(path, { headers: { cookie } });
  assert.equal(response.status, status);
  assert.equal((await response.json()).target, 'preview', 'Never silently fall back to Docker');
  checks++;
}
for (const [path, maxAge] of [['enable', '1800'], ['disable', '0']]) {
  const response = await request('/__migration-preview/' + path);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/login');
  const setCookie = response.headers.get('set-cookie');
  for (const attribute of ['Path=/', `Max-Age=${maxAge}`, 'Secure', 'HttpOnly', 'SameSite=Lax']) assert.ok(setCookie.includes(attribute));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  checks++;
}
for (const path of ['enable', 'disable', 'status']) {
  const response = await request('/__migration-preview/' + path, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('set-cookie'), null);
  checks++;
}
console.log(`PASS ${checks} fixture cases: default/opt-in routing, verbs, bodies, prefixes/query strings, identity headers, no-store, opt-out and failure preservation`);
