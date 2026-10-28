import http from 'node:http';

for (const [port, target] of [[4000, 'legacy-web'], [4001, 'legacy-api'], [8080, 'preview']]) {
  http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) { response.writeHead(413).end(); return; }
    }
    const status = request.url.includes('/unavailable') ? 503 : request.url.includes('/unauthorized') ? 401 : 200;
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' });
    response.end(JSON.stringify({ target, method: request.method, uri: request.url, host: request.headers.host, proto: request.headers['x-forwarded-proto'], body }));
  }).listen(port, '0.0.0.0');
}
