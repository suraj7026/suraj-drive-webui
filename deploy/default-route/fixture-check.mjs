import assert from 'node:assert/strict';
const origin = process.argv[2];
assert.ok(origin, 'Supply the isolated fixture gateway');
const request = (path, init = {}) => fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(10000), ...init });
let checks = 0;
for (const cookie of [null, 'drive_preview=k8s-20b42a8', 'drive_preview=invalid', 'drive_preview=docker']) {
  for (const path of ['/example?q=a%2Fb', '/drive-api/api/files?q=a%2Fb']) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const body = method === 'GET' ? undefined : '{"fixture":"body-preserved"}';
      const response = await request(path, { method, body, headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json' } });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.deepEqual(result, { target: 'preview', method, uri: path, host: 'drive.sudarshanrajagopalan.one', proto: 'https', body: body ?? '' });
      assert.equal(response.headers.get('x-drive-route'), 'k8s-20b42a8');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      checks++;
    }
  }
}
for (const [path, status] of [['/unauthorized', 401], ['/unavailable', 503]]) {
  const response = await request(path);
  assert.equal(response.status, status);
  assert.equal((await response.json()).target, 'preview');
  checks++;
}
for (const action of ['enable', 'disable']) {
  const response = await request('/__migration-preview/' + action);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/login');
  for (const attribute of ['Max-Age=0', 'Secure', 'HttpOnly', 'SameSite=Lax']) assert.ok(response.headers.get('set-cookie').includes(attribute));
  checks++;
}
for (const action of ['enable', 'disable', 'status']) {
  const response = await request('/__migration-preview/' + action, { method: 'POST' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('set-cookie'), null);
  checks++;
}
const status = await request('/__migration-preview/status');
assert.equal(status.status, 200);
assert.equal(await status.text(), 'k8s-20b42a8\n');
checks++;
console.log(`PASS ${checks} default-route fixture cases: all cookie variants use Kubernetes; verbs, bodies, query/prefix, identity, errors and retired controls preserved`);
