import { completeChat, streamChat, stripReasoningText } from './llm.js';
import { buildChatContextMessages } from './conversation-context.js';
import { getSelectedText } from './office-actions.js';
import { isAbortError } from '../../packages/frontend-shared/src/abort-utils.js';

export function createChatActions(deps) {
  async function readSelectionToPrompt() {
    if (deps.operationController.isBusy()) {
      deps.showToast('当前任务仍在处理中');
      return;
    }

    const btn = document.getElementById('btn-read-selection');
    btn.disabled = true;
    try {
      const text = await getSelectedText(deps.getCurrentHost());
      const textarea = document.getElementById('input-user-prompt');
      textarea.value = text
        ? `${textarea.value ? textarea.value + '\n\n' : ''}${text}`
        : textarea.value;
      if (!text) deps.showToast('未检测到选中内容');
      textarea.focus();
    } catch (err) {
      deps.showToast(`读取失败: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  async function handleSend() {
    if (!deps.operationController.beginOperation({ abortable: true })) return;

    const textarea = document.getElementById('input-user-prompt');
    const userPrompt = textarea.value.trim();
    if (!userPrompt) {
      deps.showToast('请输入问题内容');
      deps.operationController.endOperation();
      return;
    }

    try {
      deps.addMessage('user', userPrompt);
      textarea.value = '';

      if (handleClearContextCommand(userPrompt)) return;
      if (await deps.wordActions.handleRollbackCommand(userPrompt)) return;

      const handledByAction = await deps.hostActionRouter.previewActionFromPrompt(userPrompt, true);
      if (handledByAction) return;

      await sendChatPrompt();
    } finally {
      deps.operationController.endOperation();
    }
  }

  async function sendChatPrompt() {
    const assistantMessage = deps.addMessage('assistant', '', { pending: true });

    try {
      const fullText = await streamChat(await buildRequestMessages(), (chunk) => {
        assistantMessage.content += chunk;
        deps.scheduleMessageContentRender(assistantMessage);
      }, deps.settingsUi.getActiveModelConfig());

      assistantMessage.content = stripReasoningText(fullText || assistantMessage.content);
      assistantMessage.pending = false;
      deps.renderChatMessages();
      deps.saveChatState();
    } catch (err) {
      assistantMessage.content = isAbortError(err)
        ? (assistantMessage.content || '已停止生成。')
        : `错误: ${err.message}`;
      assistantMessage.pending = false;
      assistantMessage.error = !isAbortError(err);
      assistantMessage.aborted = isAbortError(err);
      deps.renderChatMessages();
      deps.saveChatState();
    }
  }

  async function buildRequestMessages() {
    const systemPrompt = deps.settingsUi.getSystemPrompt();
    const messages = await buildChatContextMessages(deps.getChatMessages(), systemPrompt, summarizeConversationMessages);
    deps.saveChatState();
    deps.renderContextStatus();
    return messages;
  }

  async function summarizeConversationMessages(previousSummary, transcript) {
    return await completeChat([
      {
        role: 'system',
        content: [
          '你是对话上下文压缩器。',
          '请把较早对话压缩成简洁中文摘要，只保留用户目标、关键约束、已确认结论和待办。',
          '不要加入新信息，不要保留大段文档正文或模型长回答。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          previousSummary ? `已有摘要：\n${previousSummary}\n` : '',
          '需要压缩的新对话：',
          transcript,
        ].join('\n'),
      },
    ], deps.settingsUi.getActiveModelConfig());
  }

  function handleClearContextCommand(input) {
    if (!/(清空|清除|重置)(上下文|聊天记录|对话|文档缓存)/.test(input)) {
      return false;
    }

    deps.setChatMessages([]);
    deps.setPendingAction(null);
    deps.setLastRollback(null);
    deps.resetConversationContext();
    deps.clearDocumentContext();
    deps.toolContextUi.resetToolContext();
    deps.clearBackendConversationContext();
    deps.clearSavedChatState();
    deps.clearPendingAction();
    deps.renderChatMessages();
    deps.showToast('已清空上下文');
    return true;
  }

  return {
    handleSend,
    readSelectionToPrompt,
  };
}
