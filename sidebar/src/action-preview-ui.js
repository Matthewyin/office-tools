export function createActionPreviewUi(deps) {
  function showActionPreview(text) {
    const panel = document.getElementById('action-preview');
    document.getElementById('action-preview-text').textContent = text;
    panel.classList.remove('hidden');
  }

  function clearPendingAction() {
    deps.setPendingAction(null);
    document.getElementById('action-preview').classList.add('hidden');
    document.getElementById('action-preview-text').textContent = '';
    document.getElementById('btn-confirm-action').disabled = false;
  }

  function formatDiffExamples(examples) {
    if (!examples.length) return ['预览：未找到匹配文本'];
    return [
      '预览：',
      ...examples.flatMap((example, index) => [
        `${index + 1}. 原文：${example.before}`,
        `   新文：${example.after || '（空文本）'}`,
      ]),
    ];
  }

  function formatRewritePreview(originalText, rewrittenText) {
    return [
      '预览：',
      `原文：${clipPreviewText(originalText)}`,
      `新文：${clipPreviewText(rewrittenText)}`,
    ];
  }

  return {
    clearPendingAction,
    formatDiffExamples,
    formatRewritePreview,
    showActionPreview,
  };
}

function clipPreviewText(text) {
  const normalized = String(text || '').trim();
  if (normalized.length <= 500) return normalized;
  return `${normalized.slice(0, 500)}...`;
}
