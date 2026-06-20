import OpenAI from 'openai';
import { selectLlmProfile } from './config.js';

const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const RESPONSE_CACHE_MAX_ENTRIES = 64;
const responseCache = new Map();

export async function completeLlmChat(input, config) {
  const requestConfig = resolveRequestConfig(input, config);
  const body = normalizeLlmRequest(input, requestConfig, false);

  // 推理模型输出不稳定，且测试调用无意义，均不缓存。
  const cacheKey = input.cacheable && !input.reasoningEnabled ? buildCacheKey(body) : null;
  if (cacheKey) {
    const cached = readCache(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  let completion;
  try {
    completion = await createOpenAiClient(requestConfig).chat.completions.create(body, {
      timeout: requestConfig.llmTimeoutMs,
    });
  } catch (error) {
    throw createLlmError(error);
  }

  const result = {
    model: completion.model || body.model,
    content: completion.choices?.[0]?.message?.content || '',
  };

  if (cacheKey) writeCache(cacheKey, result);
  return result;
}

function buildCacheKey(body) {
  const seed = JSON.stringify({ model: body.model, messages: body.messages });
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `llm_${hash.toString(16)}`;
}

function readCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > RESPONSE_CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  responseCache.set(key, { value, createdAt: Date.now() });
  if (responseCache.size > RESPONSE_CACHE_MAX_ENTRIES) {
    const oldest = Array.from(responseCache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);
    while (responseCache.size > RESPONSE_CACHE_MAX_ENTRIES && oldest.length) {
      const [k] = oldest.shift();
      responseCache.delete(k);
    }
  }
}

export async function streamLlmChat(input, response, config) {
  const requestConfig = resolveRequestConfig(input, config);
  const body = normalizeLlmRequest(input, requestConfig, true);
  let upstream;
  try {
    upstream = await createOpenAiClient(requestConfig).chat.completions.create(body, {
      timeout: requestConfig.llmTimeoutMs,
    });
  } catch (error) {
    throw createLlmError(error);
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'https://localhost:30030',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });

  try {
    for await (const chunk of upstream) {
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  } catch (error) {
    throw createLlmError(error);
  }
  response.write('data: [DONE]\n\n');
  response.end();
}

export async function testLlm(input, config) {
  const result = await completeLlmChat({
    profileId: input.profileId,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    model: input.model,
    reasoningEnabled: input.reasoningEnabled,
    reasoningEffort: input.reasoningEffort,
    messages: [
      { role: 'user', content: '请只回复 OK。' },
    ],
  }, config);
  return {
    content: result.content || 'OK',
    model: result.model,
  };
}

function normalizeLlmRequest(input, config, stream) {
  if (!config.llmApiKey) {
    throw createConfigError('缺少 LLM_API_KEY，请在 agent-server/.env.local 中配置。');
  }
  if (!config.llmApiBaseUrl) {
    throw createConfigError('缺少 LLM_API_BASE_URL，请在 agent-server/.env.local 中配置。');
  }

  const messages = Array.isArray(input.messages) ? input.messages : [];
  if (!messages.length) {
    const error = new Error('缺少 messages。');
    error.code = 'INVALID_LLM_INPUT';
    error.statusCode = 400;
    throw error;
  }

  const body = {
    model: String(input.model || config.llmModel || '').trim(),
    stream,
    messages: messages.map(message => ({
      role: normalizeRole(message.role),
      content: String(message.content || ''),
    })),
  };

  if (!body.model) {
    throw createConfigError('缺少 LLM_MODEL，或前端未选择模型。');
  }

  if (input.reasoningEnabled) {
    body.reasoning_effort = normalizeReasoningEffort(input.reasoningEffort);
  }

  return body;
}

function resolveRequestConfig(input, config) {
  if (input.baseUrl || input.apiKey) {
    const existing = selectLlmProfile(config.llmProfiles || [], input.profileId || config.llmSelectedProfileId);
    return {
      ...config,
      llmApiBaseUrl: normalizeBaseUrl(input.baseUrl || existing?.baseUrl || config.llmApiBaseUrl),
      llmApiKey: input.apiKey || existing?.apiKey || config.llmApiKey,
      llmModel: input.model || existing?.model || config.llmModel,
    };
  }

  const profile = selectLlmProfile(config.llmProfiles || [], input.profileId || config.llmSelectedProfileId);
  if (!profile) return config;

  return {
    ...config,
    llmApiBaseUrl: profile.baseUrl,
    llmApiKey: profile.apiKey,
    llmModel: profile.model,
  };
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function createOpenAiClient(config) {
  return new OpenAI({
    apiKey: config.llmApiKey,
    baseURL: config.llmApiBaseUrl,
    timeout: config.llmTimeoutMs,
    maxRetries: 0,
  });
}

function createLlmError(cause) {
  const status = cause?.status || cause?.response?.status || 0;
  if (cause?.code === 'ETIMEDOUT' || cause?.name === 'TimeoutError') {
    const timeoutError = new Error('LLM 请求超时。');
    timeoutError.code = 'LLM_TIMEOUT';
    timeoutError.statusCode = 504;
    return timeoutError;
  }
  const error = new Error(`LLM 请求失败 (${status || '未知'}): ${formatProviderError(cause)}`);
  error.code = 'LLM_PROVIDER_ERROR';
  error.statusCode = 502;
  return error;
}

function formatProviderError(cause) {
  const message = extractErrorMessage(cause) || cause?.message || String(cause || '');
  const unknownModel = message.match(/unknown model ['"]([^'"]+)['"]/i);
  if (unknownModel) {
    return `模型不存在或当前账号不可用：${unknownModel[1]}`;
  }
  return clipErrorText(message);
}

function extractErrorMessage(value) {
  if (typeof value === 'string') {
    const parsed = parseJsonObject(value);
    return parsed ? findErrorMessage(parsed) : value;
  }
  return findErrorMessage(value?.error || value);
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(String(text || ''));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function findErrorMessage(value) {
  if (!value || typeof value !== 'object') return '';
  for (const key of ['message', 'error_msg', 'error_message', 'errmsg', 'msg', 'status_msg', 'detail']) {
    if (typeof value[key] === 'string') return value[key];
  }
  if (value.error) {
    const nested = findErrorMessage(value.error);
    if (nested) return nested;
  }
  return '';
}

function createConfigError(message) {
  const error = new Error(message);
  error.code = 'LLM_CONFIG_MISSING';
  error.statusCode = 500;
  return error;
}

function normalizeRole(role) {
  return ['system', 'user', 'assistant', 'tool'].includes(role) ? role : 'user';
}

function normalizeReasoningEffort(value) {
  return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
}

function clipErrorText(text) {
  return String(text || '').slice(0, 500);
}
