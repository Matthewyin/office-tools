import fs from 'fs';
import path from 'path';
import process from 'process';

export function loadConfig() {
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  return {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 30031),
    searchProvider: process.env.SEARCH_PROVIDER || 'mock',
    braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY || '',
  };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
