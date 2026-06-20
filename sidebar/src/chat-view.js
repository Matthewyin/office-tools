import { createChatMessage } from './conversation-context.js';
import { renderMessageContent, renderMessageHtml } from '../../packages/frontend-shared/src/chat-renderer.js';
import { createMessageRenderScheduler } from '../../packages/frontend-shared/src/message-render-scheduler.js';

export function createChatView(deps) {
  let chatMessages = [];
  let onMessagesChanged = () => {};

  const messageRenderScheduler = createMessageRenderScheduler({
    getMessages: () => chatMessages,
    renderAll: () => renderChatMessages(),
    renderContent: renderMessageContent,
    escapeSelector: cssEscape,
  });

  function getMessages() {
    return chatMessages;
  }

  function setMessages(messages) {
    chatMessages = Array.isArray(messages) ? messages : [];
  }

  function setOnMessagesChanged(callback) {
    onMessagesChanged = typeof callback === 'function' ? callback : () => {};
  }

  function addMessage(role, content, options = {}) {
    const message = createChatMessage(role, content, options);
    chatMessages.push(message);
    renderChatMessages();
    onMessagesChanged();
    return message;
  }

  function renderChatMessages() {
    const list = document.getElementById('chat-messages');
    if (chatMessages.length === 0) {
      list.innerHTML = `<div class="empty-state">${escapeHtml(deps.appCapabilities.emptyState)}</div>`;
      deps.renderContextStatus();
      return;
    }

    list.innerHTML = chatMessages.map(renderMessageHtml).join('');

    const chatWindow = document.getElementById('chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
    deps.renderContextStatus();
  }

  function scheduleMessageContentRender(message) {
    messageRenderScheduler.schedule(message);
  }

  async function handleMessageAction(event) {
    const copyButton = event.target.closest('[data-copy-message]');
    if (!copyButton) return;
    const message = chatMessages.find(item => item.id === copyButton.dataset.copyMessage);
    if (!message?.content) return;
    await copyTextToClipboard(message.content);
  }

  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      deps.showToast('已复制');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      deps.showToast('已复制');
    }
  }

  return {
    addMessage,
    getMessages,
    handleMessageAction,
    renderChatMessages,
    scheduleMessageContentRender,
    setMessages,
    setOnMessagesChanged,
  };
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}
