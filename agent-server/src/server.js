import http from 'http';
import { loadConfig } from './config.js';
import { readJsonBody, sendJson, sendNoContent } from './http.js';
import { searchWeb } from './search.js';

const config = loadConfig();

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendNoContent(response);
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'office-agent-server',
        port: config.port,
        searchProvider: config.searchProvider,
        time: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/search') {
      const body = await readJsonBody(request);
      const results = await searchWeb(String(body.query || ''), config);
      sendJson(response, 200, {
        ok: true,
        query: body.query || '',
        results,
      });
      return;
    }

    sendJson(response, 404, {
      ok: false,
      error: '接口不存在。',
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message,
    });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Office Agent Server 已启动：http://${config.host}:${config.port}`);
});
