import http from 'http';
import { prepareChatWithTools } from './chat-tools.js';
import { getPublicLlmProfiles, loadConfig, saveLlmProfiles } from './config.js';
import { clearConversationContext, getConversationContext } from './context-store.js';
import {
  buildDocumentContext,
  formatDocumentMatchesForPrompt,
  getDocumentContextStatus,
  searchDocumentContext,
  searchDocumentHybrid,
  summarizeWordDocument,
} from './document-service.js';
import { createEmbeddings, isEmbeddingsConfigured } from './embeddings.js';
import { createRequestId, readJsonBody, sendError, sendNoContent, sendOk } from './http.js';
import { completeLlmChat, streamLlmChat, testLlm } from './llm.js';
import { handleMcpRequest } from './mcp-server.js';
import { callTool, listTools } from './tools.js';
import { logRequest } from './logger.js';

const config = loadConfig();

const server = http.createServer(async (request, response) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  let url;
  try {
    if (request.method === 'OPTIONS') {
      sendNoContent(response);
      logRequest({ requestId, method: request.method, pathname: '', status: 204, durationMs: Date.now() - startedAt });
      return;
    }

    url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === '/mcp' || url.pathname === '/api/mcp') {
      await handleMcpRequest(request, response, config);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      const publicLlm = getPublicLlmProfiles(config);
      sendOk(response, requestId, {
        service: 'office-agent-server',
        port: config.port,
        searchProvider: config.searchProvider,
        llmConfigured: publicLlm.profiles.some(profile => profile.baseUrl && profile.hasApiKey),
        llmModel: config.llmModel,
        llmProfiles: publicLlm.profiles,
        llmSelectedProfileId: publicLlm.selectedProfileId,
        embeddingsConfigured: isEmbeddingsConfigured(config),
        embeddingsModel: config.embeddingsModel || '',
        tools: listTools().map(tool => tool.name),
        time: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/tools') {
      sendOk(response, requestId, {
        host: url.searchParams.get('host') || '',
        tools: listTools({ host: url.searchParams.get('host') || '' }),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/context') {
      const conversationId = url.searchParams.get('conversationId') || '';
      sendOk(response, requestId, {
        context: getConversationContext(conversationId),
      });
      return;
    }

    if (request.method === 'DELETE' && url.pathname === '/api/context') {
      const conversationId = url.searchParams.get('conversationId') || '';
      sendOk(response, requestId, {
        context: clearConversationContext(conversationId),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/tools/call') {
      const body = await readJsonBody(request);
      const result = await callTool(String(body.tool || body.name || ''), body.input || {}, config, {
        host: body.host || body.input?.host,
      });
      sendOk(response, requestId, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/tools/search') {
      const body = await readJsonBody(request);
      const result = await callTool('web_search', body, config, { host: body.host });
      sendOk(response, requestId, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/chat/with-tools') {
      const body = await readJsonBody(request);
      const result = await prepareChatWithTools(body, config);
      sendOk(response, requestId, result);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/llm/profiles') {
      sendOk(response, requestId, getPublicLlmProfiles(config));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/llm/profiles') {
      const body = await readJsonBody(request);
      sendOk(response, requestId, saveLlmProfiles(body, config));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/llm/chat') {
      const body = await readJsonBody(request);
      if (body.stream) {
        await streamLlmChat(body, response, config);
      } else {
        const result = await completeLlmChat(body, config);
        sendOk(response, requestId, result);
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/llm/test') {
      const body = await readJsonBody(request);
      const result = await testLlm(body, config);
      sendOk(response, requestId, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/document/chunk') {
      const body = await readJsonBody(request);
      if (!String(body.text || '').trim()) {
        throw createInputError('缺少 text。');
      }
      const context = buildDocumentContext(body.text, { chunkMaxChars: Number(body.chunkMaxChars) || undefined });
      sendOk(response, requestId, {
        fingerprint: context.fingerprint,
        charCount: context.charCount,
        chunkCount: context.chunks.length,
        chunks: context.chunks.map(chunk => ({
          index: chunk.index,
          heading: chunk.heading,
          text: chunk.text,
          charCount: chunk.charCount,
        })),
        status: getDocumentContextStatus(context),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/document/search') {
      const body = await readJsonBody(request);
      if (!String(body.text || '').trim()) {
        throw createInputError('缺少 text。');
      }
      if (typeof body.query !== 'string') {
        throw createInputError('缺少 query。');
      }
      // 默认尝试向量召回，向量不可用时自动降级到关键词检索。
      const useHybrid = body.mode !== 'keyword';
      if (useHybrid) {
        const result = await searchDocumentHybrid({
          text: body.text,
          query: body.query,
          limit: Number(body.limit) || undefined,
          modelSelection: resolveModelConfig(body, config),
          config,
        });
        sendOk(response, requestId, {
          mode: result.mode,
          fallbackReason: result.fallbackReason || '',
          terms: result.terms,
          matches: result.matches.map(match => ({
            index: match.index,
            heading: match.heading,
            text: match.text,
            matchReason: match.matchReason || '',
            matchedTerms: match.matchedTerms || [],
            score: typeof match.score === 'number' ? match.score : undefined,
          })),
          evidenceText: formatDocumentMatchesForPrompt(result.matches),
          status: result.status,
        });
        return;
      }
      const context = buildDocumentContext(body.text, { chunkMaxChars: Number(body.chunkMaxChars) || undefined });
      const { terms, matches } = searchDocumentContext(context, body.query, { limit: Number(body.limit) || undefined });
      sendOk(response, requestId, {
        mode: 'keyword',
        terms,
        matches: matches.map(match => ({
          index: match.index,
          heading: match.heading,
          text: match.text,
          matchReason: match.matchReason || '',
          matchedTerms: match.matchedTerms || [],
        })),
        evidenceText: formatDocumentMatchesForPrompt(matches),
        status: getDocumentContextStatus(context),
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/embeddings') {
      const body = await readJsonBody(request);
      const result = await createEmbeddings({
        input: body.input,
        profileId: body.profileId,
        model: body.model,
      }, config);
      sendOk(response, requestId, {
        embeddings: result.embeddings,
        model: result.model,
        dimensions: result.embeddings[0]?.length || 0,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/embeddings/status') {
      sendOk(response, requestId, {
        configured: isEmbeddingsConfigured(config),
        model: config.embeddingsModel || '',
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/document/summarize') {
      const body = await readJsonBody(request);
      if (!String(body.text || '').trim()) {
        throw createInputError('缺少 text。');
      }
      const mode = body.mode === 'review' ? 'review' : 'summary';
      const result = await summarizeWordDocument({
        text: body.text,
        instruction: String(body.instruction || '').trim() || (mode === 'review' ? '审阅整篇文档' : '总结整篇文档'),
        mode,
        modelSelection: resolveModelConfig(body, config),
        config,
      });
      sendOk(response, requestId, { content: result, mode });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/search') {
      const body = await readJsonBody(request);
      const result = await callTool('web_search', body, config, { host: body.host });
      sendOk(response, requestId, {
        query: body.query || '',
        provider: result.output.provider,
        answer: result.output.answer,
        results: result.output.results,
        meta: result.output.meta,
      });
      return;
    }

    const notFound = new Error('接口不存在。');
    notFound.code = 'ROUTE_NOT_FOUND';
    notFound.statusCode = 404;
    sendError(response, requestId, notFound);
  } catch (error) {
    sendError(response, requestId, normalizeError(error));
  } finally {
    response.on('close', () => {
      logRequest({
        requestId,
        method: request.method,
        pathname: url?.pathname || request.url,
        status: response.statusCode || 0,
        durationMs: Date.now() - startedAt,
      });
    });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Office Agent Server 已启动：http://${config.host}:${config.port}`);
});

function normalizeError(error) {
  if (error instanceof SyntaxError) {
    error.code = 'INVALID_JSON';
    error.statusCode = 400;
    error.message = '请求体不是有效 JSON。';
  }
  return error;
}

function createInputError(message) {
  const error = new Error(message);
  error.code = 'INVALID_DOCUMENT_INPUT';
  error.statusCode = 400;
  return error;
}

// 从请求体还原前端传入的模型配置（profileId + model + reasoning）。
// 后端 llm.js 的 resolveRequestConfig 会据此选择 baseUrl/apiKey。
function resolveModelConfig(body, config) {
  return {
    profileId: String(body.profileId || body.profile?.id || config.llmSelectedProfileId || '').trim() || undefined,
    model: String(body.model || '').trim() || undefined,
    reasoningEnabled: Boolean(body.reasoningEnabled),
    reasoningEffort: body.reasoningEffort || 'medium',
    llmTimeoutMs: Number(body.timeoutMs) || config.llmTimeoutMs,
  };
}
