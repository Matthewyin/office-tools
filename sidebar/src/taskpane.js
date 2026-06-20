import {
  getConversationContextStatus,
  resetConversationContext,
} from './conversation-context.js';
import {
  clearDocumentContext,
  getDocumentContextStatus,
} from './document-context.js';
import { scopedStorageKey } from './app-capabilities.js';
import { createActionPreviewUi } from './action-preview-ui.js';
import { createBackendContextActions } from './backend-context-actions.js';
import { createChatActions } from './chat-actions.js';
import { createChatView } from './chat-view.js';
import { createConversationsUi } from './conversations-ui.js';
import { createExcelActions } from './excel/excel-actions.js';
import { createHostActionRouter } from './host-action-router.js';
import { getHostAdapter } from './host-adapters/index.js';
import { createOperationController } from './operation-controller.js';
import { createPendingActionController } from './pending-action-controller.js';
import { createSettingsUi } from './settings-ui.js';
import { createTaskpaneUi } from './taskpane-ui.js';
import { createToolContextUi } from './tool-context-ui.js';
import { createWebSearchActions } from './web-search-actions.js';
import { createWordActions } from './word/word-actions.js';

let currentHost = null;
let pendingAction = null;
let lastRollback = null;
const OFFICE_APP_MODE = document.documentElement.dataset.officeApp || 'office';
const LEGACY_CHAT_STATE_KEY = 'taskpane_chat_state_v1';
const LEGACY_CONVERSATIONS_KEY = 'taskpane_conversations_v1';
const CHAT_STATE_KEY = scopedStorageKey(OFFICE_APP_MODE, LEGACY_CHAT_STATE_KEY);
const CONVERSATIONS_KEY = scopedStorageKey(OFFICE_APP_MODE, LEGACY_CONVERSATIONS_KEY);
const WEB_SEARCH_ENABLED_KEY = 'office_assistant_web_search_enabled';
const HOST_ADAPTER = getHostAdapter(OFFICE_APP_MODE);
const APP_CAPABILITIES = HOST_ADAPTER.capabilities;
const operationController = createOperationController({
  getActiveModelConfig: () => settingsUi.getActiveModelConfig(),
  showToast,
});
const settingsUi = createSettingsUi({
  getAbortSignal: operationController.getAbortSignal,
  getActiveModelConfigSnapshot: operationController.getActiveModelConfigSnapshot,
  webSearchEnabledKey: WEB_SEARCH_ENABLED_KEY,
});
const toolContextUi = createToolContextUi({
  appCapabilities: APP_CAPABILITIES,
  getConversationContextStatus,
  getDocumentContextStatus,
});
const chatView = createChatView({
  appCapabilities: APP_CAPABILITIES,
  renderContextStatus,
  showToast,
});
const actionPreviewUi = createActionPreviewUi({
  setPendingAction: (action) => {
    pendingAction = action;
  },
});
let backendContextActions;
const conversationsUi = createConversationsUi({
  chatStateKey: CHAT_STATE_KEY,
  clearPendingAction: actionPreviewUi.clearPendingAction,
  closeToolContextPanel: toolContextUi.closeToolContextPanel,
  conversationsKey: CONVERSATIONS_KEY,
  getChatMessages: chatView.getMessages,
  isBusy: operationController.isBusy,
  legacyChatStateKey: LEGACY_CHAT_STATE_KEY,
  legacyConversationsKey: LEGACY_CONVERSATIONS_KEY,
  officeAppMode: OFFICE_APP_MODE,
  readJson,
  renderChatMessages: chatView.renderChatMessages,
  resetConversationContext,
  restoreBackendConversationContext: () => backendContextActions.restoreBackendConversationContext(),
  setBackendConversationContext: toolContextUi.setBackendConversationContext,
  setChatMessages: chatView.setMessages,
  setLastDocumentEvidence: toolContextUi.setDocumentEvidence,
  setLastWebEvidence: toolContextUi.setWebEvidence,
  setPendingAction: (action) => {
    pendingAction = action;
  },
  showToast,
  stopActiveOperation: operationController.stopActiveOperation,
});
backendContextActions = createBackendContextActions({
  getActiveConversationId: conversationsUi.getActiveConversationId,
  renderContextStatus,
  toolContextUi,
});
chatView.setOnMessagesChanged(conversationsUi.saveChatState);
const excelActions = createExcelActions({
  addMessage: chatView.addMessage,
  getActiveModelConfig: settingsUi.getActiveModelConfig,
  getCurrentHost: () => currentHost,
  renderChatMessages: chatView.renderChatMessages,
  saveChatState: conversationsUi.saveChatState,
  scheduleMessageContentRender: chatView.scheduleMessageContentRender,
  setPendingAction: (action) => {
    pendingAction = action;
  },
  showActionPreview: actionPreviewUi.showActionPreview,
  showToast,
});
const wordActions = createWordActions({
  addMessage: chatView.addMessage,
  formatDiffExamples: actionPreviewUi.formatDiffExamples,
  formatRewritePreview: actionPreviewUi.formatRewritePreview,
  getAbortSignal: operationController.getAbortSignal,
  getActiveModelConfig: settingsUi.getActiveModelConfig,
  getActiveModelSelectionForBackend: settingsUi.getActiveModelSelectionForBackend,
  getCurrentHost: () => currentHost,
  getLastRollback: () => lastRollback,
  getWritingModelConfig: settingsUi.getWritingModelConfig,
  renderChatMessages: chatView.renderChatMessages,
  renderContextStatus,
  saveChatState: conversationsUi.saveChatState,
  scheduleMessageContentRender: chatView.scheduleMessageContentRender,
  setLastDocumentEvidence: toolContextUi.setDocumentEvidence,
  setLastRollback: (rollback) => {
    lastRollback = rollback;
  },
  setPendingAction: (action) => {
    pendingAction = action;
  },
  showActionPreview: actionPreviewUi.showActionPreview,
  showToast,
});
const webSearchActions = createWebSearchActions({
  addMessage: chatView.addMessage,
  getAbortSignal: operationController.getAbortSignal,
  getActiveConversationId: conversationsUi.getActiveConversationId,
  getActiveModelConfig: settingsUi.getActiveModelConfig,
  officeAppMode: OFFICE_APP_MODE,
  renderChatMessages: chatView.renderChatMessages,
  renderContextStatus,
  saveChatState: conversationsUi.saveChatState,
  scheduleMessageContentRender: chatView.scheduleMessageContentRender,
  toolContextUi,
});
const hostActionRouter = createHostActionRouter({
  addMessage: chatView.addMessage,
  answerWithWebSearch: webSearchActions.answerWithWebSearch,
  appCapabilities: APP_CAPABILITIES,
  excelActions,
  getActiveModelConfig: settingsUi.getActiveModelConfig,
  getCurrentHost: () => currentHost,
  hostAdapter: HOST_ADAPTER,
  isWebSearchEnabled: settingsUi.isWebSearchEnabled,
  showToast,
  wordActions,
});
const chatActions = createChatActions({
  addMessage: chatView.addMessage,
  clearBackendConversationContext: backendContextActions.clearBackendConversationContext,
  clearDocumentContext,
  clearPendingAction: actionPreviewUi.clearPendingAction,
  clearSavedChatState: conversationsUi.clearSavedChatState,
  getChatMessages: chatView.getMessages,
  getCurrentHost: () => currentHost,
  hostActionRouter,
  operationController,
  renderChatMessages: chatView.renderChatMessages,
  renderContextStatus,
  resetConversationContext,
  saveChatState: conversationsUi.saveChatState,
  scheduleMessageContentRender: chatView.scheduleMessageContentRender,
  setChatMessages: chatView.setMessages,
  setLastRollback: (rollback) => {
    lastRollback = rollback;
  },
  setPendingAction: (action) => {
    pendingAction = action;
  },
  settingsUi,
  showToast,
  toolContextUi,
  wordActions,
});
const pendingActionController = createPendingActionController({
  addMessage: chatView.addMessage,
  clearPendingAction: actionPreviewUi.clearPendingAction,
  excelActions,
  getPendingAction: () => pendingAction,
  operationController,
  showToast,
  wordActions,
});
const taskpaneUi = createTaskpaneUi({
  appCapabilities: APP_CAPABILITIES,
  chatActions,
  chatView,
  clearPendingAction: actionPreviewUi.clearPendingAction,
  confirmPendingAction: pendingActionController.confirmPendingAction,
  conversationsUi,
  officeAppMode: OFFICE_APP_MODE,
  operationController,
  previewDocumentAction,
  settingsUi,
  showToast,
  toolContextUi,
  webSearchEnabledKey: WEB_SEARCH_ENABLED_KEY,
});

// eslint-disable-next-line no-undef
Office.onReady((info) => {
  currentHost = info.host;
  taskpaneUi.initUI();
  settingsUi.loadSettings();
  conversationsUi.loadChatState();
  chatView.renderChatMessages();
  renderContextStatus();
  backendContextActions.restoreBackendConversationContext();
  backendContextActions.checkBackendHealth();
});

function renderContextStatus() {
  toolContextUi.renderContextStatus(chatView.getMessages());
}

// ==================== 文档操作预览 ====================

async function previewDocumentAction() {
  if (!APP_CAPABILITIES.previewActions) {
    showToast(`${APP_CAPABILITIES.name} 当前只开放聊天和读取选区`);
    return;
  }

  if (!operationController.beginOperation({ abortable: true })) return;

  const commandText = document.getElementById('input-user-prompt').value.trim();
  try {
    const handled = await hostActionRouter.previewActionFromPrompt(commandText, false);
    if (!handled) {
      showToast(APP_CAPABILITIES.previewHint);
    }
  } finally {
    operationController.endOperation();
  }
}

// ==================== 工具函数 ====================

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
