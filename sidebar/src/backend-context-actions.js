export function createBackendContextActions(deps) {
  async function checkBackendHealth() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const response = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      deps.toolContextUi.setBackendStatus({
        checked: true,
        ok: Boolean(data.ok),
        text: data.ok ? `后端：正常 ${data.port || 30031}` : '后端：异常',
      });
    } catch {
      deps.toolContextUi.setBackendStatus({
        checked: true,
        ok: false,
        text: '后端：未连接',
      });
    }
    deps.renderContextStatus();
  }

  async function restoreBackendConversationContext() {
    const conversationId = deps.getActiveConversationId();
    if (!conversationId) return;
    try {
      const response = await fetch(`/api/context?conversationId=${encodeURIComponent(conversationId)}`);
      const data = await response.json();
      if (!response.ok || data.ok === false) return;
      deps.toolContextUi.setBackendConversationContext(data.context || null);
      deps.toolContextUi.setWebEvidence(
        deps.toolContextUi.normalizeWebEvidenceForStatus(deps.toolContextUi.getBackendConversationContext()?.webEvidence || []),
      );
      deps.renderContextStatus();
    } catch {
      // 后端上下文只是增强能力，失败时不影响主流程。
    }
  }

  async function clearBackendConversationContext() {
    const conversationId = deps.getActiveConversationId();
    if (!conversationId) return;
    try {
      const response = await fetch(`/api/context?conversationId=${encodeURIComponent(conversationId)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      deps.toolContextUi.setBackendConversationContext(data.context || null);
      deps.renderContextStatus();
    } catch {
      // 清理失败不阻塞本地上下文清空。
    }
  }

  return {
    checkBackendHealth,
    clearBackendConversationContext,
    restoreBackendConversationContext,
  };
}
