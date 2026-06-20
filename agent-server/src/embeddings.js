import OpenAI from 'openai';
import { selectLlmProfile } from './config.js';

// 调用 OpenAI 兼容的 /embeddings 接口。
// 并非所有供应商/模型都支持 embeddings，调用方需捕获失败并降级。
export async function createEmbeddings(input, config) {
  const requestConfig = resolveEmbeddingsConfig(input, config);
  if (!requestConfig.llmApiKey) {
    throw createEmbeddingsError('缺少 LLM_API_KEY，无法生成向量。', 'EMBEDDINGS_CONFIG_MISSING', 500);
  }
  if (!requestConfig.llmApiBaseUrl) {
    throw createEmbeddingsError('缺少 LLM_API_BASE_URL，无法生成向量。', 'EMBEDDINGS_CONFIG_MISSING', 500);
  }
  if (!requestConfig.embeddingsModel) {
    throw createEmbeddingsError('未配置 EMBEDDINGS_MODEL，无法生成向量。', 'EMBEDDINGS_MODEL_MISSING', 500);
  }

  const texts = Array.isArray(input.input) ? input.input : [input.input];
  if (!texts.length) return { embeddings: [], model: requestConfig.embeddingsModel };

  let data;
  try {
    data = await createOpenAiClient(requestConfig, config).embeddings.create({
      model: requestConfig.embeddingsModel,
      input: texts.map(text => String(text || '')),
    }, {
      timeout: config.llmTimeoutMs,
    });
  } catch (error) {
    throw createEmbeddingsProviderError(error);
  }

  const embeddings = Array.isArray(data.data)
    ? data.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map(item => normalizeVector(item.embedding))
    : [];

  return {
    embeddings,
    model: data.model || requestConfig.embeddingsModel,
  };
}

function resolveEmbeddingsConfig(input, config) {
  const profile = selectLlmProfile(config.llmProfiles || [], input.profileId || config.llmSelectedProfileId);
  return {
    llmApiBaseUrl: normalizeBaseUrl(profile?.baseUrl || config.llmApiBaseUrl),
    llmApiKey: profile?.apiKey || config.llmApiKey,
    embeddingsModel: String(input.model || config.embeddingsModel || '').trim(),
  };
}

export function isEmbeddingsConfigured(config) {
  return Boolean(config.embeddingsModel && config.llmApiKey && config.llmApiBaseUrl);
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeVector(value) {
  if (!Array.isArray(value)) return [];
  return value.map(number => Number(number) || 0);
}

function createOpenAiClient(requestConfig, config) {
  return new OpenAI({
    apiKey: requestConfig.llmApiKey,
    baseURL: requestConfig.llmApiBaseUrl,
    timeout: config.llmTimeoutMs,
    maxRetries: 0,
  });
}

function createEmbeddingsError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function createEmbeddingsProviderError(error) {
  if (error?.code === 'ETIMEDOUT' || error?.name === 'TimeoutError') {
    return createEmbeddingsError('生成向量请求超时。', 'EMBEDDINGS_TIMEOUT', 504);
  }
  const status = error?.status || error?.response?.status || '未知';
  const message = extractErrorMessage(error) || error?.message || String(error || '');
  return createEmbeddingsError(
    `生成向量失败 (${status}): ${String(message).slice(0, 500)}`,
    'EMBEDDINGS_PROVIDER_ERROR',
    502,
  );
}

function extractErrorMessage(value) {
  if (!value || typeof value !== 'object') return '';
  for (const key of ['message', 'error_msg', 'error_message', 'errmsg', 'msg', 'status_msg', 'detail']) {
    if (typeof value[key] === 'string') return value[key];
  }
  if (value.error) {
    const nested = extractErrorMessage(value.error);
    if (nested) return nested;
  }
  return '';
}
