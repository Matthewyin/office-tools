import { streamChat, stripReasoningText } from './llm.js';
import { isAbortError } from '../../packages/frontend-shared/src/abort-utils.js';

export function createWebSearchActions(deps) {
  async function answerWithWebSearch(query) {
    const assistantMessage = deps.addMessage('assistant', '正在搜索网页...', { pending: true });

    try {
      const response = await fetch('/api/chat/with-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: deps.getAbortSignal(),
        body: JSON.stringify({
          conversationId: deps.getActiveConversationId(),
          host: deps.officeAppMode,
          input: query,
          options: {
            host: deps.officeAppMode,
            webSearchEnabled: true,
            forceWebSearch: true,
            maxResults: 5,
            includeAnswer: 'basic',
          },
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error?.message || `搜索请求失败 (${response.status})`);
      }

      const evidence = Array.isArray(data.toolEvidence) ? data.toolEvidence[0] : null;
      const sources = Array.isArray(evidence?.sources) ? evidence.sources : [];
      const evidenceText = data.answerInput?.evidenceText || formatWebSearchResults(sources);
      deps.toolContextUi.setDocumentEvidence([]);
      deps.toolContextUi.setBackendConversationContext(data.context || deps.toolContextUi.getBackendConversationContext());
      deps.toolContextUi.setWebEvidence(deps.toolContextUi.normalizeWebEvidenceForStatus(data.context?.webEvidence || sources));
      deps.renderContextStatus();

      assistantMessage.content = `已检索到 ${sources.length} 个网页来源，正在整理回答...`;
      deps.renderChatMessages();

      const fullText = await streamChat([
        {
          role: 'system',
          content: [
            '你是 Office 助手的网页搜索回答模块。',
            '请基于给定搜索结果回答用户问题，不要编造搜索结果中没有的信息。',
            '回答要简洁，必要时列出来源链接。',
            '如果搜索证据不足，请明确说明。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `用户问题：${query}`,
            '',
            evidenceText,
          ].join('\n'),
        },
      ], (chunk) => {
        assistantMessage.content += chunk;
        deps.scheduleMessageContentRender(assistantMessage);
      }, deps.getActiveModelConfig());

      assistantMessage.content = stripReasoningText(fullText || assistantMessage.content.replace(/^已检索到.*?正在整理回答\.\.\./, '').trim());
      assistantMessage.pending = false;
      deps.renderChatMessages();
      deps.saveChatState();
    } catch (err) {
      assistantMessage.content = isAbortError(err)
        ? (assistantMessage.content || '已停止网页搜索回答。')
        : `网页搜索失败: ${err.message}`;
      assistantMessage.pending = false;
      assistantMessage.error = !isAbortError(err);
      assistantMessage.aborted = isAbortError(err);
      deps.renderChatMessages();
      deps.saveChatState();
    }
  }

  return {
    answerWithWebSearch,
  };
}

function formatWebSearchResults(results) {
  if (!results.length) return '无搜索结果。';
  return results.map((item, index) => [
    `## 来源 ${index + 1}`,
    `标题：${item.title || '未命名'}`,
    `链接：${item.url || '无'}`,
    item.publishedDate ? `发布时间：${item.publishedDate}` : '',
    `摘要：${item.snippet || '无'}`,
  ].filter(Boolean).join('\n')).join('\n\n');
}
