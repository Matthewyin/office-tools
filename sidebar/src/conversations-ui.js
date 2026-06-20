import { getConversationContextState, restoreConversationContext } from './conversation-context.js';
import { saveConversationsToStorage } from '../../packages/frontend-shared/src/conversation-storage.js';
import {
  conversationMeta,
  createConversationRecord as createConversationRecordData,
  inferConversationTitle,
  normalizeConversation as normalizeConversationRecord,
  normalizeMessages as normalizeConversationMessages,
} from '../../packages/frontend-shared/src/conversation-records.js';

export function createConversationsUi(deps) {
  let conversations = [];
  let activeConversationId = '';
  let openConversationMenuId = '';
  let conversationMenuPosition = { top: 0, left: 0 };

  function loadChatState() {
    const saved = deps.readJson(deps.conversationsKey) || readLegacyWordConversations();
    if (saved && Array.isArray(saved.items) && saved.items.length) {
      conversations = saved.items.map(item => normalizeConversationRecord(item, createId)).filter(Boolean);
      activeConversationId = conversations.some(item => item.id === saved.activeId)
        ? saved.activeId
        : conversations[0].id;
    } else {
      const legacy = deps.readJson(deps.chatStateKey) || readLegacyWordChatState();
      const legacyMessages = Array.isArray(legacy?.messages) ? legacy.messages : [];
      const migrated = createConversationRecord(legacyMessages.length ? inferConversationTitle(legacyMessages) : '新对话');
      migrated.messages = normalizeConversationMessages(legacyMessages, createId);
      migrated.context = legacy?.context || {};
      conversations = [migrated];
      activeConversationId = migrated.id;
    }

    loadActiveConversation();
    scheduleIdle(saveConversations);
  }

  function readLegacyWordConversations() {
    if (deps.officeAppMode !== 'word') return null;
    return deps.readJson(deps.legacyConversationsKey);
  }

  function readLegacyWordChatState() {
    if (deps.officeAppMode !== 'word') return null;
    return deps.readJson(deps.legacyChatStateKey);
  }

  function loadActiveConversation() {
    const active = getActiveConversation() || conversations[0] || createAndStoreConversation();
    activeConversationId = active.id;
    const chatMessages = normalizeConversationMessages(active.messages, createId);
    deps.setChatMessages(chatMessages);
    deps.setLastWebEvidence([]);
    deps.setBackendConversationContext(null);

    deps.resetConversationContext();
    const maxSeq = chatMessages.reduce((max, message) => Math.max(max, message.seq || 0), 0);
    restoreConversationContext({
      ...active.context,
      nextMessageSeq: Math.max(Number(active.context?.nextMessageSeq) || 1, maxSeq + 1),
    });
  }

  function saveChatState() {
    const active = getActiveConversation() || createAndStoreConversation();
    const stableMessages = deps.getChatMessages()
      .filter(message => !message.pending && !message.error && message.content)
      .map(message => ({
        id: message.id,
        seq: message.seq,
        role: message.role,
        content: message.content,
      }));

    active.messages = stableMessages;
    active.context = getConversationContextState();
    active.updatedAt = new Date().toISOString();
    if (active.title === '新对话') {
      active.title = inferConversationTitle(stableMessages);
    }
    saveConversations();
    renderConversationList();
  }

  function clearSavedChatState() {
    const active = getActiveConversation();
    if (!active) return;
    active.messages = [];
    active.context = getConversationContextState();
    active.updatedAt = new Date().toISOString();
    saveConversations();
    renderConversationList();
  }

  function getActiveConversation() {
    return conversations.find(item => item.id === activeConversationId) || null;
  }

  function createConversationRecord(title = '新对话') {
    return createConversationRecordData(createId, title);
  }

  function createAndStoreConversation(title = '新对话') {
    const conversation = createConversationRecord(title);
    conversations.unshift(conversation);
    activeConversationId = conversation.id;
    return conversation;
  }

  function saveConversations() {
    const result = saveConversationsToStorage(localStorage, deps.conversationsKey, activeConversationId, conversations);
    if (result.saved && result.trimmed) {
      conversations = result.items;
      deps.showToast('本地存储空间不足，已裁剪较早对话');
    } else if (!result.saved) {
      console.warn('保存对话失败:', result.error);
      deps.showToast('本地存储空间不足，对话未能保存');
    }
  }

  function startNewConversation() {
    if (deps.isBusy()) deps.stopActiveOperation();
    closeConversationMenu();
    saveChatState();
    createAndStoreConversation();
    deps.setChatMessages([]);
    deps.setPendingAction(null);
    deps.setLastDocumentEvidence([]);
    deps.setLastWebEvidence([]);
    deps.setBackendConversationContext(null);
    deps.resetConversationContext();
    deps.closeToolContextPanel();
    deps.clearPendingAction();
    saveConversations();
    deps.renderChatMessages();
    renderConversationList();
    document.getElementById('input-user-prompt').focus();
  }

  function switchConversation(id) {
    if (deps.isBusy()) deps.stopActiveOperation();
    const menuWasOpen = Boolean(openConversationMenuId);
    openConversationMenuId = '';
    closeHistoryPanel();
    if (id === activeConversationId) {
      if (menuWasOpen) renderConversationList();
      return;
    }
    saveChatState();
    activeConversationId = id;
    deps.setPendingAction(null);
    deps.setLastDocumentEvidence([]);
    deps.clearPendingAction();
    loadActiveConversation();
    saveConversations();
    deps.renderChatMessages();
    renderConversationList();
    deps.restoreBackendConversationContext();
  }

  function renameConversation(id) {
    const conversation = conversations.find(item => item.id === id);
    if (!conversation) return;
    const title = window.prompt('重命名对话', conversation.title);
    if (!title) return;
    conversation.title = title.trim().slice(0, 40) || conversation.title;
    conversation.updatedAt = new Date().toISOString();
    openConversationMenuId = '';
    saveConversations();
    renderConversationList();
  }

  function closeConversationMenu() {
    document.querySelector('.conversation-menu')?.remove();
    if (!openConversationMenuId) return;
    openConversationMenuId = '';
    renderConversationList();
  }

  function closeHistoryPanel() {
    document.getElementById('history-panel')?.classList.add('hidden');
  }

  function closeHistoryOverlay() {
    closeConversationMenu();
    closeHistoryPanel();
  }

  function deleteConversation(id) {
    const conversation = conversations.find(item => item.id === id);
    if (!conversation) return;

    conversations = conversations.filter(item => item.id !== id);
    openConversationMenuId = '';
    if (!conversations.length) {
      createAndStoreConversation();
    } else if (activeConversationId === id) {
      activeConversationId = conversations[0].id;
    }
    loadActiveConversation();
    saveConversations();
    deps.renderChatMessages();
    renderConversationList();
    deps.showToast('已删除对话');
  }

  function togglePinConversation(id) {
    const conversation = conversations.find(item => item.id === id);
    if (!conversation) return;
    conversation.pinned = !conversation.pinned;
    conversation.updatedAt = new Date().toISOString();
    openConversationMenuId = '';
    saveConversations();
    renderConversationList();
  }

  function renderConversationList() {
    const list = document.getElementById('conversation-list');
    if (!list) return;

    const items = [...conversations].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    list.innerHTML = items.map(item => `
      <div class="conversation-item${item.id === activeConversationId ? ' active' : ''}" data-conversation-id="${escapeHtml(item.id)}">
        <button class="conversation-switch" type="button" data-switch-conversation="${escapeHtml(item.id)}">
          <span class="conversation-title">${escapeHtml(item.title)}</span>
          <span class="conversation-meta">${conversationMeta(item)}</span>
        </button>
        <div class="conversation-actions">
          <button class="icon-btn" type="button" title="更多" aria-label="管理对话" data-menu-conversation="${escapeHtml(item.id)}">
            <svg class="icon"><use href="#icon-more"></use></svg>
          </button>
        </div>
      </div>
    `).join('');
    renderConversationMenu();

    list.querySelectorAll('[data-conversation-id]').forEach(item => {
      item.addEventListener('click', (event) => {
        if (event.target.closest('[data-menu-conversation]')) return;
        switchConversation(item.dataset.conversationId);
      });
    });
    list.querySelectorAll('[data-menu-conversation]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const nextId = openConversationMenuId === button.dataset.menuConversation
          ? ''
          : button.dataset.menuConversation;
        openConversationMenuId = nextId;
        if (nextId) {
          conversationMenuPosition = getConversationMenuPosition(button.getBoundingClientRect());
        }
        renderConversationList();
      });
    });
    document.querySelectorAll('[data-pin-conversation]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        togglePinConversation(button.dataset.pinConversation);
      });
    });
    document.querySelectorAll('[data-rename-conversation]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        renameConversation(button.dataset.renameConversation);
      });
    });
    document.querySelectorAll('[data-delete-conversation]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteConversation(button.dataset.deleteConversation);
      });
    });
  }

  function renderConversationMenu() {
    document.querySelector('.conversation-menu')?.remove();

    const conversation = conversations.find(item => item.id === openConversationMenuId);
    if (!conversation) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="conversation-menu" style="top:${conversationMenuPosition.top}px;left:${conversationMenuPosition.left}px">
        <button type="button" data-pin-conversation="${escapeHtml(conversation.id)}">${conversation.pinned ? '取消置顶' : '置顶'}</button>
        <button type="button" data-rename-conversation="${escapeHtml(conversation.id)}">重命名</button>
        <button class="danger" type="button" data-delete-conversation="${escapeHtml(conversation.id)}">删除</button>
      </div>
    `);
  }

  function getConversationMenuPosition(rect) {
    const width = 118;
    const height = 104;
    const gap = 6;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const shouldOpenUp = rect.bottom + gap + height > window.innerHeight;
    const top = shouldOpenUp
      ? Math.max(8, rect.top - height - gap)
      : rect.bottom + gap;
    return { top: Math.round(top), left: Math.round(left) };
  }

  function getActiveConversationId() {
    return activeConversationId;
  }

  return {
    clearSavedChatState,
    closeConversationMenu,
    closeHistoryOverlay,
    getActiveConversationId,
    loadChatState,
    renderConversationList,
    saveChatState,
    startNewConversation,
  };
}

function createId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scheduleIdle(task) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: 1500 });
    return;
  }
  setTimeout(task, 0);
}
