const http = require('http');

function request(app, { method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            ...(body != null ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            server.close();
            resolve({
              status: res.statusCode,
              headers: res.headers,
              text: data,
              json() {
                try {
                  return JSON.parse(data || '{}');
                } catch {
                  return null;
                }
              },
            });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (body != null) req.write(JSON.stringify(body));
      req.end();
    });
    server.on('error', reject);
  });
}

module.exports = { request };
