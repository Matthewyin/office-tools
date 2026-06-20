import { tavily } from '@tavily/core';

export async function searchWeb(query, config, options = {}) {
  if (!query || !query.trim()) {
    return {
      provider: config.searchProvider,
      query: '',
      answer: '',
      results: [],
    };
  }

  if (config.searchProvider === 'tavily') {
    return await searchWithTavily(query, config, options);
  }

  if (config.searchProvider === 'brave') {
    return await searchWithBrave(query, config, options);
  }

  return {
    provider: 'mock',
    query,
    answer: '当前使用 mock 搜索 Provider，只用于验证本地工具链路。',
    results: [{
      title: '本地搜索后端已连通',
      url: 'http://127.0.0.1:30031/api/health',
      snippet: '配置 TAVILY_API_KEY 后，搜索工具会默认使用 Tavily 返回网页结果。',
      source: 'mock',
      publishedDate: '',
      favicon: '',
      score: 1,
    }],
    meta: {
      resultCount: 1,
      maxResults: normalizeMaxResults(options.maxResults, config),
    },
  };
}

async function searchWithTavily(query, config, options) {
  if (!config.tavilyApiKey) {
    throw createProviderError('SEARCH_CONFIG_MISSING', '缺少 TAVILY_API_KEY。', 500);
  }

  let data;
  try {
    const client = tavily({ apiKey: config.tavilyApiKey });
    data = await client.search(query, {
      searchDepth: options.searchDepth || 'basic',
      topic: options.topic || 'general',
      maxResults: normalizeMaxResults(options.maxResults, config),
      includeAnswer: options.includeAnswer ?? 'basic',
      includeRawContent: false,
      includeFavicon: true,
      timeout: config.toolTimeoutMs,
    });
  } catch (error) {
    throw createProviderError('SEARCH_PROVIDER_ERROR', `Tavily Search 请求失败：${extractProviderMessage(error)}`, 502);
  }

  const results = (data.results || []).map(item => normalizeSearchResult({
    title: item.title,
    url: item.url,
    snippet: item.content,
    score: item.score,
    favicon: item.favicon,
    publishedDate: item.published_date,
    source: 'tavily',
  }));

  return {
    provider: 'tavily',
    query: data.query || query,
    answer: data.answer || '',
    results,
    meta: {
      resultCount: results.length,
      maxResults: normalizeMaxResults(options.maxResults, config),
      topic: options.topic || 'general',
      searchDepth: options.searchDepth || 'basic',
      includeAnswer: options.includeAnswer ?? 'basic',
    },
  };
}

async function searchWithBrave(query, config, options) {
  if (!config.braveSearchApiKey) {
    throw createProviderError('SEARCH_CONFIG_MISSING', '缺少 BRAVE_SEARCH_API_KEY。', 500);
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(normalizeMaxResults(options.maxResults, config)));

  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': config.braveSearchApiKey,
    },
  }, config.toolTimeoutMs);

  if (!response.ok) {
    const text = await response.text();
    throw createProviderError('SEARCH_PROVIDER_ERROR', `Brave Search 请求失败 (${response.status}): ${text}`, 502);
  }

  const data = await response.json();
  const results = (data.web?.results || []).map(item => normalizeSearchResult({
    title: item.title,
    url: item.url,
    snippet: item.description,
    source: 'brave',
  }));

  return {
    provider: 'brave',
    query,
    answer: '',
    results,
    meta: {
      resultCount: results.length,
      maxResults: normalizeMaxResults(options.maxResults, config),
    },
  };
}

function normalizeSearchResult(item) {
  return {
    title: item.title || '',
    url: item.url || '',
    snippet: item.snippet || '',
    source: item.source || '',
    publishedDate: item.publishedDate || '',
    favicon: item.favicon || '',
    score: typeof item.score === 'number' ? item.score : null,
  };
}

function normalizeMaxResults(value, config) {
  const fallback = Number(config.searchMaxResults || 5);
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(10, Math.floor(parsed)));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return await fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createProviderError('SEARCH_TIMEOUT', '搜索 Provider 请求超时。', 504);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function createProviderError(code, message, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function extractProviderMessage(error) {
  if (!error || typeof error !== 'object') return String(error || '未知错误');
  const responseData = error.response?.data;
  if (typeof responseData === 'string') return responseData;
  if (responseData && typeof responseData === 'object') {
    return responseData.message || responseData.detail || JSON.stringify(responseData).slice(0, 500);
  }
  return error.message || '未知错误';
}
