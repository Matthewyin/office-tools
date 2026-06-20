import { isAbortError } from '../../packages/frontend-shared/src/abort-utils.js';

export function createPendingActionController(deps) {
  async function confirmPendingAction() {
    if (!deps.operationController.beginOperation({ abortable: true })) return;

    const action = deps.getPendingAction();
    if (!action) {
      deps.showToast('没有待执行操作');
      deps.operationController.endOperation();
      return;
    }

    const confirmBtn = document.getElementById('btn-confirm-action');
    const cancelBtn = document.getElementById('btn-cancel-action');
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
      const handledWordAction = await deps.wordActions.confirmWordPendingAction(action);
      const handledExcelAction = handledWordAction
        ? false
        : await deps.excelActions.confirmExcelPendingAction(action);

      if (!handledWordAction && !handledExcelAction) {
        deps.addMessage('assistant', '未知的待执行操作。', { error: true });
      }

      deps.clearPendingAction();
    } catch (err) {
      if (isAbortError(err)) {
        deps.addMessage('assistant', '已停止执行。');
        deps.showToast('已停止执行');
      } else if (action.type?.startsWith('word-')) {
        const message = deps.wordActions.formatWordFailure('执行失败', err);
        deps.addMessage('assistant', message, { error: true });
        deps.showToast(`执行失败: ${err.message}`);
      } else {
        deps.addMessage('assistant', `执行失败: ${err.message}`, { error: true });
        deps.showToast(`执行失败: ${err.message}`);
      }
    } finally {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      deps.operationController.endOperation();
    }
  }

  return {
    confirmPendingAction,
  };
}
