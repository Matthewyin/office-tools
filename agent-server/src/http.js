export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function createRequestId() {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'https://localhost:30030',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(body);
}

export function sendOk(response, requestId, payload = {}) {
  sendJson(response, 200, {
    ok: true,
    requestId,
    ...payload,
  });
}

export function sendError(response, requestId, error) {
  const statusCode = Number(error.statusCode) || 500;
  sendJson(response, statusCode, {
    ok: false,
    requestId,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误。',
    },
  });
}

export function sendNoContent(response) {
  response.writeHead(204, {
    'Access-Control-Allow-Origin': 'https://localhost:30030',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end();
}
