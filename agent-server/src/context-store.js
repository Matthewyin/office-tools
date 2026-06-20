import fs from 'fs';
import path from 'path';
import process from 'process';

const MAX_TOOL_CALLS = 30;
const MAX_WEB_EVIDENCE = 50;
const PERSIST_PATH = resolvePersistPath();
const contexts = new Map();
let persistTimer = null;

loadPersistedContexts();

export function getConversationContext(conversationId) {
  const id = normalizeConversationId(conversationId);
  if (!id) return createEmptyContext('');
  return contexts.get(id) || createEmptyContext(id);
}

export function recordToolCall(conversationId, toolCall) {
  const id = normalizeConversationId(conversationId);
  if (!id) return createEmptyContext('');

  const context = contexts.get(id) || createEmptyContext(id);
  const now = new Date().toISOString();
  const call = {
    id: `tool_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    type: toolCall.type || 'tool',
    query: toolCall.query || '',
    provider: toolCall.provider || '',
    createdAt: now,
    elapsedMs: toolCall.elapsedMs ?? null,
    sources: normalizeSources(toolCall.sources),
  };

  context.toolCalls.unshift(call);
  context.toolCalls = context.toolCalls.slice(0, MAX_TOOL_CALLS);
  context.webEvidence = mergeWebEvidence(call.sources, context.webEvidence);
  context.updatedAt = now;
  contexts.set(id, context);
  schedulePersist();
  return context;
}

export function clearConversationContext(conversationId) {
  const id = normalizeConversationId(conversationId);
  if (!id) return createEmptyContext('');

  contexts.delete(id);
  schedulePersist();
  return createEmptyContext(id);
}

function createEmptyContext(conversationId) {
  return {
    conversationId,
    updatedAt: '',
    toolCalls: [],
    webEvidence: [],
  };
}

function normalizeConversationId(value) {
  return String(value || '').trim().slice(0, 120);
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .map(source => ({
      title: String(source.title || source.url || '未命名来源'),
      url: String(source.url || ''),
      snippet: String(source.snippet || ''),
      source: String(source.source || ''),
      publishedDate: String(source.publishedDate || ''),
      favicon: String(source.favicon || ''),
      score: typeof source.score === 'number' ? source.score : null,
    }))
    .filter(source => source.title || source.url);
}

function mergeWebEvidence(newSources, existingSources) {
  const byKey = new Map();
  for (const source of [...newSources, ...existingSources]) {
    const key = source.url || source.title;
    if (!key || byKey.has(key)) continue;
    byKey.set(key, source);
  }
  return Array.from(byKey.values()).slice(0, MAX_WEB_EVIDENCE);
}

// ==================== 持久化（JSON 落盘，跨重启/多实例共享）====================

function resolvePersistPath() {
  if (path.basename(process.cwd()) === 'agent-server') {
    return path.resolve(process.cwd(), '.data', 'contexts.json');
  }
  return path.resolve(process.cwd(), 'agent-server', '.data', 'contexts.json');
}

function loadPersistedContexts() {
  try {
    if (!fs.existsSync(PERSIST_PATH)) return;
    const raw = fs.readFileSync(PERSIST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [id, context] of Object.entries(parsed)) {
      if (id && context && Array.isArray(context.toolCalls)) {
        contexts.set(id, {
          ...createEmptyContext(id),
          ...context,
          toolCalls: context.toolCalls.slice(0, MAX_TOOL_CALLS),
          webEvidence: Array.isArray(context.webEvidence) ? context.webEvidence.slice(0, MAX_WEB_EVIDENCE) : [],
        });
      }
    }
  } catch {
    // 持久化文件损坏不影响内存上下文。
  }
}

// 写盘做防抖，避免高频工具调用每次都同步写文件。
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistContexts();
  }, 500);
}

function persistContexts() {
  try {
    const snapshot = Object.fromEntries(contexts.entries());
    fs.mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(snapshot), { mode: 0o600 });
  } catch {
    // 落盘失败不阻塞主流程，下次变更会再次尝试。
  }
}
