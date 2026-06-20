import { searchWeb } from './search.js';
import { fetchUrl } from './fetch-url.js';
import { searchDocumentHybrid } from './document-service.js';

export class ToolError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const webSearchTool = {
  name: 'web_search',
  hosts: ['common'],
  description: '使用本地配置的搜索 Provider 查询网页资料。',
  inputSchema: {
    query: 'string 必填',
    maxResults: 'number 可选，默认 5，范围 1-10',
    topic: 'general | news | finance 可选',
    searchDepth: 'basic | advanced 可选',
    includeAnswer: 'boolean | basic | advanced 可选',
  },
  handler: async (input, config) => {
    const normalized = normalizeSearchInput(input, config);
    return await searchWeb(normalized.query, config, normalized);
  },
};

const fetchUrlTool = {
  name: 'fetch_url',
  hosts: ['common'],
  description: '抓取指定网页正文，返回清洗后的纯文本，便于让模型读懂整篇文章。',
  inputSchema: {
    url: 'string 必填',
    maxChars: 'number 可选，默认 8000，范围 500-20000',
  },
  handler: async (input) => {
    const url = String(input.url || '').trim();
    if (!url) {
      throw new ToolError('INVALID_TOOL_INPUT', '抓取工具缺少 url。');
    }
    const maxChars = normalizeNumber(input.maxChars, 8000, 500, 20000);
    return await fetchUrl(url, { maxChars });
  },
};

const documentSearchTool = {
  name: 'document_search',
  hosts: ['word'],
  description: '在传入的文档正文中检索与问题最相关的段落（优先向量召回，可降级关键词）。',
  inputSchema: {
    text: 'string 必填，文档正文',
    query: 'string 必填，检索问题',
    limit: 'number 可选，默认 5，范围 1-10',
    mode: 'auto | keyword 可选，默认 auto',
  },
  handler: async (input, config) => {
    const text = String(input.text || '').trim();
    const query = String(input.query || '').trim();
    if (!text) throw new ToolError('INVALID_TOOL_INPUT', 'document_search 缺少 text。');
    if (!query) throw new ToolError('INVALID_TOOL_INPUT', 'document_search 缺少 query。');
    const result = await searchDocumentHybrid({
      text,
      query,
      limit: normalizeNumber(input.limit, 5, 1, 10),
      modelSelection: { profileId: input.profileId, model: input.model },
      config,
    });
    return {
      mode: result.mode,
      fallbackReason: result.fallbackReason || '',
      matches: result.matches,
    };
  },
};

const toolRegistry = {
  web_search: webSearchTool,
  search: {
    ...webSearchTool,
    name: 'search',
    hosts: ['common'],
    description: '兼容旧前端的网页搜索工具，等价于 web_search。',
    inputSchema: {
      ...webSearchTool.inputSchema,
    },
  },
  fetch_url: fetchUrlTool,
  document_search: documentSearchTool,
};

export function listTools(options = {}) {
  const host = normalizeHost(options.host);
  return Object.values(toolRegistry).filter(tool => isToolAvailableForHost(tool, host)).map(tool => ({
    name: tool.name,
    hosts: tool.hosts,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export async function callTool(name, input, config, options = {}) {
  const tool = toolRegistry[name];
  if (!tool) {
    throw new ToolError('TOOL_NOT_FOUND', `未知工具：${name}`, 404);
  }
  const host = normalizeHost(options.host || input?.host);
  if (!isToolAvailableForHost(tool, host)) {
    throw new ToolError('TOOL_NOT_AVAILABLE_FOR_HOST', `工具 ${tool.name} 不支持当前宿主：${host || '未指定'}`, 404);
  }

  const startedAt = Date.now();
  return {
    tool: tool.name,
    output: await withTimeout(
      tool.handler(input || {}, config),
      config.toolTimeoutMs,
      `工具执行超时：${tool.name}`,
    ),
    elapsedMs: Date.now() - startedAt,
  };
}

export function normalizeHost(value) {
  const text = String(value || '').toLowerCase();
  const map = {
    word: 'word',
    document: 'word',
    excel: 'excel',
    workbook: 'excel',
    ppt: 'ppt',
    powerpoint: 'ppt',
    presentation: 'ppt',
  };
  return map[text] || '';
}

function isToolAvailableForHost(tool, host) {
  if (!host) return true;
  const hosts = Array.isArray(tool.hosts) ? tool.hosts : ['common'];
  return hosts.includes('common') || hosts.includes(host);
}

function normalizeSearchInput(input, config) {
  const query = String(input.query || '').trim();
  if (!query) {
    throw new ToolError('INVALID_TOOL_INPUT', '搜索工具缺少 query。');
  }

  return {
    query,
    maxResults: normalizeNumber(input.maxResults, config.searchMaxResults || 5, 1, 10),
    topic: normalizeEnum(input.topic, ['general', 'news', 'finance'], 'general'),
    searchDepth: normalizeEnum(input.searchDepth, ['basic', 'advanced'], 'basic'),
    includeAnswer: normalizeIncludeAnswer(input.includeAnswer),
  };
}

function normalizeNumber(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeIncludeAnswer(value) {
  if (value === true || value === 'advanced') return 'advanced';
  if (value === false) return false;
  return 'basic';
}

async function withTimeout(promise, timeoutMs, message) {
  if (!timeoutMs || timeoutMs <= 0) return await promise;

  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new ToolError('TOOL_TIMEOUT', message, 504));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
