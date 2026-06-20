export function createOperationController(deps) {
  let isBusy = false;
  let activeAbortController = null;
  let activeModelConfigSnapshot = null;

  function beginOperation(options = {}) {
    if (isBusy) {
      deps.showToast('当前任务仍在处理中');
      return false;
    }

    isBusy = true;
    activeAbortController = options.abortable ? new AbortController() : null;
    activeModelConfigSnapshot = deps.getActiveModelConfig();
    updateSendButtonState();
    return true;
  }

  function endOperation() {
    isBusy = false;
    activeAbortController = null;
    activeModelConfigSnapshot = null;
    updateSendButtonState();
  }

  function stopActiveOperation() {
    if (!activeAbortController || activeAbortController.signal.aborted) return;
    activeAbortController.abort();
    deps.showToast('正在停止生成');
  }

  function updateSendButtonState() {
    const sendBtn = document.getElementById('btn-send');
    if (!sendBtn) return;

    if (isBusy && activeAbortController) {
      sendBtn.disabled = false;
      sendBtn.title = '停止生成';
      sendBtn.setAttribute('aria-label', '停止生成');
      sendBtn.classList.add('is-stopping');
      sendBtn.innerHTML = '<span class="stop-square" aria-hidden="true"></span>';
      return;
    }

    sendBtn.disabled = isBusy;
    sendBtn.title = isBusy ? '处理中' : '发送';
    sendBtn.setAttribute('aria-label', isBusy ? '处理中' : '发送');
    sendBtn.classList.remove('is-stopping');
    sendBtn.innerHTML = '<svg class="icon"><use href="#icon-send"></use></svg>';
  }

  return {
    beginOperation,
    endOperation,
    getAbortSignal: () => activeAbortController?.signal,
    getActiveModelConfigSnapshot: () => activeModelConfigSnapshot,
    isBusy: () => isBusy,
    stopActiveOperation,
  };
}
