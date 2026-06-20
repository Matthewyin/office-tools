import fs from 'fs';
import path from 'path';
import process from 'process';

const LOG_LEVEL = normalizeLevel(process.env.LOG_LEVEL || 'info');
const LOG_DIR = resolveLogDir();
const ACCESS_LOG_PATH = path.join(LOG_DIR, 'access.log');
const ERROR_LOG_PATH = path.join(LOG_DIR, 'error.log');
const MAX_LOG_LINE_CHARS = 2000;

let accessStream = null;
let errorStream = null;

export function logRequest({ requestId, method, pathname, status, durationMs, error }) {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  const entry = {
    time: new Date().toISOString(),
    level,
    requestId,
    method,
    pathname,
    status,
    durationMs,
  };
  if (error) {
    entry.errorCode = error.code || '';
    entry.errorMessage = clip(error.message);
  }

  const line = JSON.stringify(entry);
  // 控制台始终输出，便于本地开发观察。
  if (level === 'error') console.error(line);
  else if (LOG_LEVEL <= 2) console.log(line);

  // 文件落盘：访问日志与错误日志分开，便于排查。
  writeLine(level === 'error' ? ERROR_LOG_PATH : ACCESS_LOG_PATH, line);
}

export function logError(message, context = {}) {
  const entry = JSON.stringify({
    time: new Date().toISOString(),
    level: 'error',
    message: clip(message),
    ...context,
  });
  console.error(entry);
  writeLine(ERROR_LOG_PATH, entry);
}

function writeLine(filePath, line) {
  try {
    const stream = getStream(filePath);
    stream.write(`${line}\n`);
  } catch {
    // 日志写入失败不影响主流程。
  }
}

function getStream(filePath) {
  if (filePath === ACCESS_LOG_PATH && accessStream) return accessStream;
  if (filePath === ERROR_LOG_PATH && errorStream) return errorStream;

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // 目录已存在或无权限，交给 createWriteStream 处理。
  }

  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  if (filePath === ACCESS_LOG_PATH) accessStream = stream;
  else errorStream = stream;
  return stream;
}

function resolveLogDir() {
  if (path.basename(process.cwd()) === 'agent-server') {
    return path.resolve(process.cwd(), '.data', 'logs');
  }
  return path.resolve(process.cwd(), 'agent-server', '.data', 'logs');
}

function normalizeLevel(value) {
  const map = { error: 1, warn: 2, info: 3, debug: 4 };
  return map[String(value).toLowerCase()] ?? 3;
}

function clip(text) {
  const value = String(text || '');
  if (value.length <= MAX_LOG_LINE_CHARS) return value;
  return `${value.slice(0, MAX_LOG_LINE_CHARS)}...`;
}
