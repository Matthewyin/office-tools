export function createTaskpaneUi(deps) {
  function initUI() {
    applyAppModeUi();
    document.getElementById('btn-settings-toggle').addEventListener('click', (event) => {
      event.stopPropagation();
      deps.conversationsUi.closeHistoryOverlay();
      deps.settingsUi.ensureSettingsRendered();
      document.getElementById('settings-panel').classList.toggle('hidden');
    });
    document.getElementById('btn-new-chat').addEventListener('click', (event) => {
      event.stopPropagation();
      deps.conversationsUi.startNewConversation();
    });
    document.getElementById('btn-history-toggle').addEventListener('click', (event) => {
      event.stopPropagation();
      deps.conversationsUi.closeConversationMenu();
      document.getElementById('history-panel').classList.toggle('hidden');
      document.getElementById('settings-panel').classList.add('hidden');
      deps.conversationsUi.renderConversationList();
    });
    document.getElementById('history-panel').addEventListener('click', (event) => {
      event.stopPropagation();
    });
    document.addEventListener('click', deps.conversationsUi.closeHistoryOverlay);

    document.getElementById('btn-add-model').addEventListener('click', deps.settingsUi.addModelProfile);
    document.getElementById('btn-save-settings').addEventListener('click', deps.settingsUi.saveSettings);
    document.getElementById('input-web-search-enabled').addEventListener('change', (event) => {
      localStorage.setItem(deps.webSearchEnabledKey, String(event.target.checked));
      deps.showToast(event.target.checked ? '已开启网页搜索' : '已关闭网页搜索');
    });
    document.getElementById('select-model').addEventListener('change', deps.settingsUi.handleModelSelect);
    document.getElementById('select-thinking').addEventListener('change', deps.settingsUi.handleReasoningSelect);

    document.getElementById('btn-read-selection').addEventListener('click', deps.chatActions.readSelectionToPrompt);
    document.getElementById('btn-preview-action').addEventListener('click', deps.previewDocumentAction);
    document.getElementById('btn-confirm-action').addEventListener('click', deps.confirmPendingAction);
    document.getElementById('btn-cancel-action').addEventListener('click', deps.clearPendingAction);

    document.getElementById('btn-send').addEventListener('click', handleSendButton);
    document.getElementById('input-user-prompt').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      if (event.altKey) return;
      event.preventDefault();
      if (deps.operationController.isBusy()) return;
      deps.chatActions.handleSend();
    });
    document.getElementById('chat-messages').addEventListener('click', deps.chatView.handleMessageAction);
    document.getElementById('context-status-tools').addEventListener('click', deps.toolContextUi.toggleToolContextPanel);
    document.getElementById('btn-tool-context-close').addEventListener('click', deps.toolContextUi.closeToolContextPanel);
  }

  function applyAppModeUi() {
    document.body.dataset.officeApp = deps.officeAppMode;
    document.title = deps.appCapabilities.name;
    const title = document.querySelector('.header-title span');
    if (title) title.textContent = deps.appCapabilities.name;

    const prompt = document.getElementById('input-user-prompt');
    if (prompt) prompt.placeholder = deps.appCapabilities.placeholder;

    const previewButton = document.getElementById('btn-preview-action');
    if (previewButton) {
      previewButton.hidden = !deps.appCapabilities.previewActions;
      previewButton.title = deps.appCapabilities.previewTitle;
      previewButton.setAttribute('aria-label', deps.appCapabilities.previewTitle);
    }

    const readButton = document.getElementById('btn-read-selection');
    if (readButton) {
      readButton.title = deps.appCapabilities.readSelectionTitle;
      readButton.setAttribute('aria-label', deps.appCapabilities.readSelectionTitle);
    }
  }

  function handleSendButton() {
    if (deps.operationController.isBusy()) {
      deps.operationController.stopActiveOperation();
      return;
    }
    deps.chatActions.handleSend();
  }

  return {
    initUI,
  };
}
