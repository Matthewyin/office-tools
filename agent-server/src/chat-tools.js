import { callTool } from './tools.js';
import { getConversationContext, recordToolCall } from './context-store.js';

export async function prepareChatWithTools(input, config) {
  const userInput = String(input.input || input.query || '').trim();
  const conversationId = String(input.conversationId || '').trim();
  const host = String(input.host || optionsHost(input.options)).trim();
  const options = input.options || {};
  const webSearchEnabled = Boolean(options.webSearchEnabled);
  const forceWebSearch = Boolean(options.forceWebSearch);
  const shouldSearch = webSearchEnabled && (forceWebSearch || isWebSearchIntent(userInput));

  if (!userInput) {
    const error = new Error('缺少用户输入。');
    error.code = 'INVALID_CHAT_INPUT';
    error.statusCode = 400;
    throw error;
  }

  if (!shouldSearch) {
    const context = getConversationContext(conversationId);
    return {
      mode: 'chat',
      toolEvidence: [],
      context: summarizeContext(context),
      answerInput: {
        userInput,
        evidenceText: '',
      },
    };
  }

  const searchResult = await callTool('web_search', {
    query: userInput,
    host,
    maxResults: options.maxResults,
    includeAnswer: options.includeAnswer ?? 'basic',
    topic: options.topic,
    searchDepth: options.searchDepth,
  }, config, { host });

  const evidence = normalizeWebSearchEvidence(searchResult);
  let context = recordToolCall(conversationId, {
    type: 'web_search',
    query: userInput,
    provider: evidence.provider,
    elapsedMs: evidence.meta.elapsedMs,
    sources: evidence.sources,
  });

  // 搜索结果过少或无摘要时，自动抓取首个来源正文补强证据（受 maxDepth 限制，避免递归抓取）。
  const evidenceWeak = evidence.sources.length <= 1 || evidence.sources.every(source => !source.snippet);
  if (evidenceWeak && evidence.sources[0]?.url && options.deepFetch !== false) {
    try {
      const fetched = await callTool('fetch_url', { url: evidence.sources[0].url, maxChars: 4000 }, config, { host });
      const fetchedOutput = fetched.output || {};
      evidence.deepFetch = {
        url: fetchedOutput.url,
        title: fetchedOutput.title,
        text: fetchedOutput.text,
      };
      context = recordToolCall(conversationId, {
        type: 'fetch_url',
        query: evidence.sources[0].url,
        provider: 'fetch_url',
        elapsedMs: fetched.elapsedMs,
        sources: [{ title: fetchedOutput.title, url: fetchedOutput.url, snippet: fetchedOutput.text.slice(0, 200) }],
      });
    } catch {
      // 抓取失败不阻塞，仍返回原搜索证据。
    }
  }

  return {
    mode: 'with_tools',
    toolEvidence: [evidence],
    context: summarizeContext(context),
    answerInput: {
      userInput,
      evidenceText: formatEvidenceText(evidence),
    },
  };
}

function optionsHost(options) {
  return options?.host || '';
}

function summarizeContext(context) {
  return {
    conversationId: context.conversationId,
    updatedAt: context.updatedAt,
    toolCallCount: context.toolCalls.length,
    webEvidenceCount: context.webEvidence.length,
    toolCalls: context.toolCalls.slice(0, 5).map(call => ({
      type: call.type,
      query: call.query,
      provider: call.provider,
      createdAt: call.createdAt,
      elapsedMs: call.elapsedMs,
      sourceCount: call.sources.length,
    })),
    webEvidence: context.webEvidence.map(item => ({
      title: item.title,
      url: item.url,
      source: item.source,
      publishedDate: item.publishedDate,
    })),
  };
}

function isWebSearchIntent(input) {
  return /(搜索|联网|网页|查一下|查找资料|查资料|最新|新闻|资料来源|外部资料|网上|政策|价格|官网)/.test(input);
}

function normalizeWebSearchEvidence(result) {
  const output = result.output || {};
  const sources = Array.isArray(output.results)
    ? output.results.map(item => ({
      title: item.title || item.url || '未命名来源',
      url: item.url || '',
      snippet: item.snippet || '',
      source: item.source || output.provider || '',
      publishedDate: item.publishedDate || '',
      favicon: item.favicon || '',
      score: item.score ?? null,
    }))
    : [];

  return {
    tool: result.tool,
    provider: output.provider || '',
    query: output.query || '',
    answer: output.answer || '',
    sources,
    meta: {
      ...(output.meta || {}),
      elapsedMs: result.elapsedMs,
    },
  };
}

function formatEvidenceText(evidence) {
  const lines = [
    evidence.provider ? `搜索 Provider：${evidence.provider}` : '',
    evidence.answer ? `搜索摘要：${evidence.answer}` : '',
    '',
    '搜索结果：',
  ].filter(Boolean);

  if (!evidence.sources.length) {
    lines.push('无搜索结果。');
    return lines.join('\n');
  }

  for (const [index, source] of evidence.sources.entries()) {
    lines.push([
      `## 来源 ${index + 1}`,
      `标题：${source.title || '未命名'}`,
      `链接：${source.url || '无'}`,
      source.publishedDate ? `发布时间：${source.publishedDate}` : '',
      `摘要：${source.snippet || '无'}`,
    ].filter(Boolean).join('\n'));
  }

  if (evidence.deepFetch?.text) {
    lines.push('', `## 来源正文（${evidence.deepFetch.title || evidence.deepFetch.url}）`, evidence.deepFetch.text);
  }

  return lines.join('\n\n');
}
