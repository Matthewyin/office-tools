export function createToolContextUi(deps) {
  let lastDocumentEvidence = [];
  let lastWebEvidence = [];
  let backendConversationContext = null;
  let backendStatus = {
    checked: false,
    ok: false,
    text: '后端：检测中',
  };

  function setBackendStatus(status) {
    backendStatus = status;
  }

  function setDocumentEvidence(evidence) {
    lastDocumentEvidence = Array.isArray(evidence) ? evidence : [];
  }

  function setWebEvidence(evidence) {
    lastWebEvidence = Array.isArray(evidence) ? evidence : [];
  }

  function setBackendConversationContext(context) {
    backendConversationContext = context || null;
  }

  function getBackendConversationContext() {
    return backendConversationContext;
  }

  function resetToolContext() {
    lastDocumentEvidence = [];
    lastWebEvidence = [];
    backendConversationContext = null;
  }

  function renderContextStatus(chatMessages) {
    const backendEl = document.getElementById('context-status-backend');
    const chatEl = document.getElementById('context-status-chat');
    const docEl = document.getElementById('context-status-doc');
    const evidenceEl = document.getElementById('context-status-evidence');
    const toolsEl = document.getElementById('context-status-tools');
    if (!backendEl || !chatEl || !docEl || !evidenceEl || !toolsEl) return;

    backendEl.textContent = backendStatus.text;
    backendEl.classList.toggle('context-chip-muted', backendStatus.checked && !backendStatus.ok);

    const chatStatus = deps.getConversationContextStatus(chatMessages);
    chatEl.textContent = chatStatus.compressed
      ? `对话：已压缩，保留最近 ${chatStatus.recentCount} 条`
      : `对话：短历史 ${chatStatus.recentCount} 条`;

    const docStatus = deps.getDocumentContextStatus();
    docEl.textContent = docStatus.ready && deps.appCapabilities.wordActions
      ? `文档：${docStatus.chunkCount} 段 / 约 ${docStatus.charCount} 字`
      : deps.appCapabilities.contextIdle;

    evidenceEl.textContent = lastDocumentEvidence.length
      ? `段落：${lastDocumentEvidence.map(item => item.index + 1).join('、')}`
      : lastWebEvidence.length
        ? `网页：${lastWebEvidence.length} 个来源`
        : deps.appCapabilities.evidenceIdle;
    evidenceEl.title = lastDocumentEvidence.length
      ? lastDocumentEvidence.map(item => `分段 ${item.index + 1}${item.heading ? `：${item.heading}` : ''}`).join('\n')
      : lastWebEvidence.length
        ? lastWebEvidence.map((item, index) => `${index + 1}. ${item.title}\n${item.url}`).join('\n')
        : '';

    const toolCallCount = backendConversationContext?.toolCalls?.length || 0;
    const webEvidenceCount = backendConversationContext?.webEvidence?.length || 0;
    toolsEl.textContent = toolCallCount || webEvidenceCount
      ? `工具：${toolCallCount} 次 / 网页 ${webEvidenceCount}`
      : '工具：未使用';
    toolsEl.classList.toggle('context-chip-muted', !toolCallCount && !webEvidenceCount);
    renderToolContextPanel();
  }

  function toggleToolContextPanel() {
    const panel = document.getElementById('tool-context-panel');
    panel?.classList.toggle('hidden');
    renderToolContextPanel();
  }

  function closeToolContextPanel() {
    document.getElementById('tool-context-panel')?.classList.add('hidden');
  }

  function renderToolContextPanel() {
    const body = document.getElementById('tool-context-body');
    if (!body) return;

    const toolCalls = backendConversationContext?.toolCalls || [];
    const webEvidence = backendConversationContext?.webEvidence || [];

    if (!toolCalls.length && !webEvidence.length) {
      body.innerHTML = '<div class="tool-context-empty">当前会话还没有使用后端工具。</div>';
      return;
    }

    const groups = [];
    if (toolCalls.length) {
      groups.push(`
        <div class="tool-context-group">
          <div class="tool-context-title">最近工具调用</div>
          ${toolCalls.slice(0, 5).map(call => `
            <div class="tool-context-item">
              <strong>${escapeHtml(toolLabel(call.type))}</strong>
              <span>${escapeHtml(call.query || '无查询内容')}</span>
              <span>${escapeHtml(call.provider || '本地工具')} · ${call.sourceCount || 0} 个来源${typeof call.elapsedMs === 'number' ? ` · ${call.elapsedMs} ms` : ''}</span>
            </div>
          `).join('')}
        </div>
      `);
    }

    if (webEvidence.length) {
      groups.push(`
        <div class="tool-context-group">
          <div class="tool-context-title">网页来源</div>
          ${webEvidence.slice(0, 8).map((item, index) => `
            <div class="tool-context-item">
              <strong>${index + 1}. ${escapeHtml(item.title || '未命名来源')}</strong>
              ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.url)}</a>` : '<span>无链接</span>'}
            </div>
          `).join('')}
        </div>
      `);
    }

    body.innerHTML = groups.join('');
  }

  function normalizeWebEvidenceForStatus(items) {
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
      title: item.title || item.url || '未命名来源',
      url: item.url || '',
    }));
  }

  return {
    closeToolContextPanel,
    getBackendConversationContext,
    normalizeWebEvidenceForStatus,
    renderContextStatus,
    resetToolContext,
    setBackendConversationContext,
    setBackendStatus,
    setDocumentEvidence,
    setWebEvidence,
    toggleToolContextPanel,
  };
}

function toolLabel(type) {
  if (type === 'web_search') return '网页搜索';
  return type || '工具调用';
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
