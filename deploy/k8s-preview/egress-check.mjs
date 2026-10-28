import assert from 'node:assert/strict';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

const api = await fetch('http://surajdrive-backend:4001/api/health', { signal: AbortSignal.timeout(10000) });
assert.equal(api.status, 200);
assert.deepEqual(await api.json(), { status: 'ok' });
console.log('PASS allowed pod DNS and existing backend connection');
const { address } = await lookup('drive-gateway');
await new Promise((resolve, reject) => {
  const socket = net.connect({ host: address, port: 80 });
  socket.setTimeout(3000);
  socket.on('connect', () => { socket.destroy(); reject(new Error('Unexpected frontend -> gateway connection: check NetworkPolicy')); });
  socket.on('timeout', () => { socket.destroy(); console.log('PASS disallowed frontend -> gateway connection timed out'); resolve(); });
  socket.on('error', (error) => {
    if (['ECONNREFUSED', 'EHOSTUNREACH', 'ETIMEDOUT', 'ENETUNREACH'].includes(error.code)) {
      console.log(`PASS disallowed frontend -> gateway connection rejected (${error.code}); host control must separately confirm gateway availability`);
      resolve();
    } else reject(error);
  });
});
