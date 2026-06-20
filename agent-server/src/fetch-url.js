// 抓取网页正文，剥离大量 HTML 噪声，返回可喂给 LLM 的纯文本。
// 无第三方依赖，仅用 Node 内置 + 正则做轻量清洗；目标是“够用且可控”，不追求完美解析。
const MAX_CONTENT_CHARS = 8000;
const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT = 'OfficeAI-Assistant/1.0 (+local-agent-server)';

export async function fetchUrl(url, options = {}) {
  const targetUrl = normalizeUrl(url);
  if (!targetUrl) throw createFetchError('缺少 url。', 'INVALID_FETCH_URL', 400);

  const maxChars = Number(options.maxChars) || MAX_CONTENT_CHARS;

  const response = await fetchWithRedirect(targetUrl, FETCH_TIMEOUT_MS);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('html') && !contentType.includes('text')) {
    throw createFetchError(`不支持的正文类型：${contentType || '未知'}。`, 'UNSUPPORTED_CONTENT_TYPE', 415);
  }

  const html = await response.text();
  const { title, text } = extractReadableText(html);
  if (!text.trim()) {
    throw createFetchError('页面没有可提取的正文。', 'EMPTY_CONTENT', 422);
  }

  return {
    url: response.url || targetUrl,
    title: title || targetUrl,
    text: clipText(text, maxChars),
    contentLength: text.length,
    truncated: text.length > maxChars,
  };
}

function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^https?:\/\//i.test(text)) return `https://${text}`;
  return text;
}

async function fetchWithRedirect(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1' },
      redirect: 'follow',
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createFetchError('抓取网页超时。', 'FETCH_TIMEOUT', 504);
    }
    throw createFetchError(`抓取网页失败：${error.message}`, 'FETCH_FAILED', 502);
  } finally {
    clearTimeout(timer);
  }
}

export function extractReadableText(html) {
  const cleaned = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, '');

  const titleMatch = cleaned.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : '';

  // 把块级标签转成换行，再剥所有标签。
  const withBreaks = cleaned
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)\s*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const stripped = withBreaks.replace(/<[^>]+>/g, '');

  const text = decodeEntities(stripped)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title, text };
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function clipText(text, maxChars) {
  const value = String(text || '').trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n...[已截断，原长度 ${value.length} 字]`;
}

function createFetchError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}
