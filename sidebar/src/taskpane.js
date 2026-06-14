import { streamChat } from './llm.js';
import {
  getSelectedText,
  countWordMatches,
  replaceWordMatches,
  createExcelAnalysisSheet,
} from './office-actions.js';

let currentHost = null;
let pendingAction = null;
let chatMessages = [];
let modelProfiles = [];
let selectedModelId = '';

// eslint-disable-next-line no-undef
Office.onReady((info) => {
  currentHost = info.host;
  initUI();
  loadSettings();
  renderChatMessages();
});

function initUI() {
  document.getElementById('btn-settings-toggle').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('hidden');
  });

  document.getElementById('btn-add-model').addEventListener('click', addModelProfile);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
  document.getElementById('select-model').addEventListener('change', handleModelSelect);
  document.getElementById('select-thinking').addEventListener('change', handleReasoningSelect);

  document.getElementById('btn-read-selection').addEventListener('click', readSelectionToPrompt);
  document.getElementById('btn-preview-action').addEventListener('click', previewDocumentAction);
  document.getElementById('btn-confirm-action').addEventListener('click', confirmPendingAction);
  document.getElementById('btn-cancel-action').addEventListener('click', clearPendingAction);

  document.getElementById('btn-send').addEventListener('click', handleSend);
  document.getElementById('input-user-prompt').addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSend();
    }
  });
}

// ==================== 设置 ====================

function loadSettings() {
  document.getElementById('input-system-prompt').value =
    localStorage.getItem('llm_system_prompt') || '';

  modelProfiles = loadModelProfiles();
  selectedModelId = localStorage.getItem('llm_selected_profile') || modelProfiles[0]?.id || '';
  renderModelConfigList();
  renderModelSelect();
}

function loadModelProfiles() {
  const saved = readJson('llm_profiles_v1');
  if (Array.isArray(saved) && saved.length > 0) return saved;

  return [{
    id: createId(),
    name: localStorage.getItem('llm_model') || '默认模型',
    baseUrl: localStorage.getItem('llm_base_url') || '',
    apiKey: localStorage.getItem('llm_api_key') || '',
    model: localStorage.getItem('llm_model') || '',
    reasoningEnabled: false,
    reasoningEffort: 'medium',
  }];
}

function saveSettings() {
  const profiles = readProfilesFromForm()
    .filter(profile => profile.name || profile.baseUrl || profile.apiKey || profile.model);

  if (profiles.length === 0) {
    showSettingsStatus('请至少保留一个模型配置。', 'error');
    return;
  }

  const invalid = profiles.find(profile => !profile.name || !profile.baseUrl || !profile.model);
  if (invalid) {
    showSettingsStatus('模型名称、Base URL 和 Model Name 必须填写。', 'error');
    return;
  }

  modelProfiles = profiles;
  if (!modelProfiles.some(profile => profile.id === selectedModelId)) {
    selectedModelId = modelProfiles[0].id;
  }

  localStorage.setItem('llm_system_prompt', document.getElementById('input-system-prompt').value.trim());
  localStorage.setItem('llm_profiles_v1', JSON.stringify(modelProfiles));
  localStorage.setItem('llm_selected_profile', selectedModelId);
  syncLegacyConfig();

  renderModelConfigList();
  renderModelSelect();
  showSettingsStatus('已保存', 'success');

  setTimeout(() => {
    document.getElementById('settings-panel').classList.add('hidden');
    document.getElementById('settings-status').textContent = '';
  }, 900);
}

function syncLegacyConfig() {
  const profile = getSelectedModelConfig();
  if (!profile) return;
  localStorage.setItem('llm_base_url', profile.baseUrl);
  localStorage.setItem('llm_api_key', profile.apiKey || '');
  localStorage.setItem('llm_model', profile.model);
}

function addModelProfile() {
  modelProfiles = readProfilesFromForm();
  const profile = {
    id: createId(),
    name: '新模型',
    baseUrl: '',
    apiKey: '',
    model: '',
    reasoningEnabled: false,
    reasoningEffort: 'medium',
  };
  modelProfiles.push(profile);
  selectedModelId = profile.id;
  renderModelConfigList();
  renderModelSelect();
}

function removeModelProfile(id) {
  modelProfiles = readProfilesFromForm().filter(profile => profile.id !== id);
  if (modelProfiles.length === 0) {
    modelProfiles.push({
      id: createId(),
      name: '默认模型',
      baseUrl: '',
      apiKey: '',
      model: '',
      reasoningEnabled: false,
      reasoningEffort: 'medium',
    });
  }
  if (!modelProfiles.some(profile => profile.id === selectedModelId)) {
    selectedModelId = modelProfiles[0].id;
  }
  renderModelConfigList();
  renderModelSelect();
}

function renderModelConfigList() {
  const list = document.getElementById('model-config-list');
  list.innerHTML = '';

  modelProfiles.forEach((profile, index) => {
    const item = document.createElement('section');
    item.className = 'model-config';
    item.dataset.id = profile.id;
    item.innerHTML = `
      <div class="model-config-header">
        <span class="model-config-title">模型 ${index + 1}</span>
        <button class="btn btn-danger btn-sm" type="button" data-remove-model="${escapeHtml(profile.id)}">删除</button>
      </div>
      <input class="input" data-field="name" type="text" placeholder="显示名称，例如 GLM-5.2" value="${escapeHtml(profile.name || '')}" />
      <input class="input" data-field="baseUrl" type="text" placeholder="API Base URL" value="${escapeHtml(profile.baseUrl || '')}" />
      <input class="input" data-field="apiKey" type="password" placeholder="API Key" value="${escapeHtml(profile.apiKey || '')}" />
      <input class="input" data-field="model" type="text" placeholder="Model Name" value="${escapeHtml(profile.model || '')}" />
      <div class="model-option-row">
        <label class="checkbox-row">
          <input data-field="reasoningEnabled" type="checkbox" ${profile.reasoningEnabled ? 'checked' : ''} />
          <span>启用推理/思考</span>
        </label>
        <select class="compact-select" data-field="reasoningEffort" aria-label="默认思考深度">
          <option value="low" ${profile.reasoningEffort === 'low' ? 'selected' : ''}>低</option>
          <option value="medium" ${!profile.reasoningEffort || profile.reasoningEffort === 'medium' ? 'selected' : ''}>中</option>
          <option value="high" ${profile.reasoningEffort === 'high' ? 'selected' : ''}>高</option>
        </select>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-remove-model]').forEach(button => {
    button.addEventListener('click', () => removeModelProfile(button.dataset.removeModel));
  });
}

function renderModelSelect() {
  const select = document.getElementById('select-model');
  select.innerHTML = '';

  modelProfiles.forEach(profile => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name || profile.model || '未命名模型';
    select.appendChild(option);
  });

  select.value = selectedModelId || modelProfiles[0]?.id || '';
  renderReasoningSelect();
}

function readProfilesFromForm() {
  return Array.from(document.querySelectorAll('.model-config')).map(item => ({
    id: item.dataset.id || createId(),
    name: item.querySelector('[data-field="name"]').value.trim(),
    baseUrl: item.querySelector('[data-field="baseUrl"]').value.trim(),
    apiKey: item.querySelector('[data-field="apiKey"]').value.trim(),
    model: item.querySelector('[data-field="model"]').value.trim(),
    reasoningEnabled: item.querySelector('[data-field="reasoningEnabled"]').checked,
    reasoningEffort: item.querySelector('[data-field="reasoningEffort"]').value,
  }));
}

function handleModelSelect(event) {
  modelProfiles = readProfilesFromForm();
  selectedModelId = event.target.value;
  localStorage.setItem('llm_selected_profile', selectedModelId);
  localStorage.setItem('llm_profiles_v1', JSON.stringify(modelProfiles));
  syncLegacyConfig();
  renderReasoningSelect();
}

function handleReasoningSelect(event) {
  modelProfiles = readProfilesFromForm();
  const selectedProfile = modelProfiles.find(profile => profile.id === selectedModelId) || modelProfiles[0];
  if (!selectedProfile) return;

  selectedProfile.reasoningEnabled = event.target.value !== 'off';
  selectedProfile.reasoningEffort = event.target.value === 'off' ? 'medium' : event.target.value;
  localStorage.setItem('llm_profiles_v1', JSON.stringify(modelProfiles));
  renderModelConfigList();
  renderModelSelect();
}

function renderReasoningSelect() {
  const select = document.getElementById('select-thinking');
  const profile = getSelectedModelConfig();
  if (!profile?.reasoningEnabled) {
    select.value = 'off';
    return;
  }
  select.value = profile.reasoningEffort || 'medium';
}

function getSelectedModelConfig() {
  const currentProfiles = readProfilesFromForm();
  return currentProfiles.find(profile => profile.id === selectedModelId) || currentProfiles[0] || null;
}

function getSystemPrompt() {
  return document.getElementById('input-system-prompt').value.trim();
}

function showSettingsStatus(msg, type) {
  const el = document.getElementById('settings-status');
  el.textContent = msg;
  el.className = `status-text ${type}`;
}

// ==================== 聊天 ====================

async function readSelectionToPrompt() {
  const btn = document.getElementById('btn-read-selection');
  btn.disabled = true;
  try {
    const text = await getSelectedText(currentHost);
    const textarea = document.getElementById('input-user-prompt');
    textarea.value = text
      ? `${textarea.value ? textarea.value + '\n\n' : ''}${text}`
      : textarea.value;
    if (!text) showToast('未检测到选中内容');
    textarea.focus();
  } catch (err) {
    showToast(`读取失败: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function handleSend() {
  const textarea = document.getElementById('input-user-prompt');
  const userPrompt = textarea.value.trim();
  if (!userPrompt) {
    showToast('请输入问题内容');
    return;
  }

  addMessage('user', userPrompt);
  textarea.value = '';

  const handledByAction = await previewActionFromPrompt(userPrompt, true);
  if (handledByAction) return;

  await sendChatPrompt();
}

async function sendChatPrompt() {
  const sendBtn = document.getElementById('btn-send');
  sendBtn.disabled = true;
  const assistantMessage = addMessage('assistant', '', { pending: true });

  try {
    const fullText = await streamChat(buildRequestMessages(), (chunk) => {
      assistantMessage.content += chunk;
      renderChatMessages();
    }, getSelectedModelConfig());

    assistantMessage.content = fullText || assistantMessage.content;
    assistantMessage.pending = false;
    renderChatMessages();
  } catch (err) {
    assistantMessage.content = `错误: ${err.message}`;
    assistantMessage.pending = false;
    assistantMessage.error = true;
    renderChatMessages();
  } finally {
    sendBtn.disabled = false;
  }
}

function buildRequestMessages() {
  const systemPrompt = getSystemPrompt();
  return [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...chatMessages
      .filter(message => !message.pending && !message.error && message.content)
      .map(message => ({ role: message.role, content: message.content })),
  ];
}

function addMessage(role, content, options = {}) {
  const message = {
    id: createId(),
    role,
    content,
    pending: Boolean(options.pending),
    error: Boolean(options.error),
  };
  chatMessages.push(message);
  renderChatMessages();
  return message;
}

function renderChatMessages() {
  const list = document.getElementById('chat-messages');
  if (chatMessages.length === 0) {
    list.innerHTML = '<div class="empty-state">选择模型后开始聊天。可读取文档选区，也可以输入查找替换指令。</div>';
    return;
  }

  list.innerHTML = chatMessages.map(message => {
    const cursor = message.pending ? '<span class="cursor-blink">▋</span>' : '';
    const content = message.content
      ? escapeHtml(message.content).replace(/\n/g, '<br>')
      : '';
    const errorClass = message.error ? ' message-error' : '';
    return `
      <div class="message message-${message.role}${errorClass}">
        <div class="message-bubble">${content}${cursor}</div>
      </div>
    `;
  }).join('');

  const chatWindow = document.getElementById('chat-window');
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ==================== 文档操作预览 ====================

async function previewDocumentAction() {
  const commandText = document.getElementById('input-user-prompt').value.trim();
  const handled = await previewActionFromPrompt(commandText, false);
  if (!handled) {
    showToast('请输入可预览的 Word 替换或 Excel 新表分析指令');
  }
}

async function previewActionFromPrompt(commandText, fromChat) {
  if (!commandText) return false;

  if (currentHost === 'Word') {
    const parsed = parseReplaceCommand(commandText);
    if (parsed) {
      await previewWordReplace(parsed, fromChat);
      return true;
    }
  }

  if (currentHost === 'Excel' && isExcelAnalysisSheetCommand(commandText)) {
    await previewExcelAnalysisToSheet(commandText, fromChat);
    return true;
  }

  return false;
}

async function previewWordReplace(parsed, fromChat) {
  const previewBtn = document.getElementById('btn-preview-action');
  previewBtn.disabled = true;
  try {
    const count = await countWordMatches(parsed.searchText);
    pendingAction = {
      type: 'word-replace',
      searchText: parsed.searchText,
      replacementText: parsed.replacementText,
      count,
    };

    const confirmBtn = document.getElementById('btn-confirm-action');
    confirmBtn.disabled = count === 0;
    showActionPreview([
      'Word 查找替换',
      `查找内容：${parsed.searchText}`,
      `替换为：${parsed.replacementText || '（空文本）'}`,
      `预计影响：${count} 处正文匹配`,
    ].join('\n'));

    if (fromChat) {
      addMessage('assistant', count > 0
        ? `已识别为 Word 查找替换操作，预计影响 ${count} 处。请确认后执行。`
        : '已识别为 Word 查找替换操作，但正文中没有匹配内容。');
    }
  } catch (err) {
    addMessage('assistant', `预览失败: ${err.message}`, { error: true });
  } finally {
    previewBtn.disabled = false;
  }
}

async function previewExcelAnalysisToSheet(commandText, fromChat) {
  let selectionText = '';
  try {
    selectionText = await getSelectedText(currentHost);
  } catch (err) {
    addMessage('assistant', `读取选区失败: ${err.message}`, { error: true });
    return;
  }

  if (!selectionText.trim()) {
    addMessage('assistant', '请先选中要分析的单元格区域。', { error: true });
    return;
  }

  pendingAction = {
    type: 'excel-analysis-to-sheet',
    instruction: commandText,
    selectionText,
  };
  document.getElementById('btn-confirm-action').disabled = false;
  showActionPreview([
    'Excel 新建分析工作表',
    '将读取当前选区，生成分析报告。',
    '确认后会创建新的工作表“AI 分析”，原工作表不会被修改。',
  ].join('\n'));

  if (fromChat) {
    addMessage('assistant', '已准备创建 Excel 分析工作表，请确认后执行。');
  }
}

async function confirmPendingAction() {
  if (!pendingAction) {
    showToast('没有待执行操作');
    return;
  }

  const action = pendingAction;
  const confirmBtn = document.getElementById('btn-confirm-action');
  const cancelBtn = document.getElementById('btn-cancel-action');
  confirmBtn.disabled = true;
  cancelBtn.disabled = true;

  try {
    if (action.type === 'word-replace') {
      const replacedCount = await replaceWordMatches(action.searchText, action.replacementText);
      addMessage('assistant', [
        '已完成 Word 查找替换。',
        '',
        `查找内容：${action.searchText}`,
        `替换为：${action.replacementText || '（空文本）'}`,
        `实际替换：${replacedCount} 处`,
      ].join('\n'));
      showToast('替换完成');
    }

    if (action.type === 'excel-analysis-to-sheet') {
      const analysisText = await generateExcelAnalysis(action);
      const sheetName = await createExcelAnalysisSheet(analysisText);
      addMessage('assistant', `已写入工作表：${sheetName}`);
      showToast(`已创建工作表：${sheetName}`);
    }

    clearPendingAction();
  } catch (err) {
    addMessage('assistant', `执行失败: ${err.message}`, { error: true });
    showToast(`执行失败: ${err.message}`);
  } finally {
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
  }
}

async function generateExcelAnalysis(action) {
  const assistantMessage = addMessage('assistant', '', { pending: true });
  const systemPrompt = '你是专业的数据分析助手。请基于用户选中的 Excel 数据输出简洁、可落地的中文分析报告。';
  const userPrompt = [
    action.instruction || '请分析当前 Excel 选区，并生成报告。',
    '',
    '要求：',
    '1. 先给核心结论。',
    '2. 再列出关键发现和异常点。',
    '3. 最后给出下一步建议。',
    '',
    action.selectionText,
  ].join('\n');

  const fullText = await streamChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], (chunk) => {
    assistantMessage.content += chunk;
    renderChatMessages();
  }, getSelectedModelConfig());

  assistantMessage.content = fullText || assistantMessage.content;
  assistantMessage.pending = false;
  renderChatMessages();
  return assistantMessage.content;
}

function showActionPreview(text) {
  const panel = document.getElementById('action-preview');
  document.getElementById('action-preview-text').textContent = text;
  panel.classList.remove('hidden');
}

function clearPendingAction() {
  pendingAction = null;
  document.getElementById('action-preview').classList.add('hidden');
  document.getElementById('action-preview-text').textContent = '';
  document.getElementById('btn-confirm-action').disabled = false;
}

function isExcelAnalysisSheetCommand(input) {
  return /分析/.test(input) && /(新建|创建|生成|写入).*(sheet|工作表|表页|表)/i.test(input);
}

function parseReplaceCommand(input) {
  const text = input.trim();
  const patterns = [
    /^(?:请)?(?:找到|查找)(?:文档中|正文中)?(?:的)?\s*(?:“([^”]+)”|"([^"]+)"|'([^']+)'|(.+?))(?:内容)?\s*[，,；; ]*(?:并)?(?:全部)?(?:替换为|改成|更改为|修改为)\s*(?:“([^”]*)”|"([^"]*)"|'([^']*)'|(.+?))\s*[。.!！]?$/,
    /^(?:请)?(?:把|将)\s*(?:“([^”]+)”|"([^"]+)"|'([^']+)'|(.+?))\s*(?:全部)?(?:替换为|改成|更改为|修改为)\s*(?:“([^”]*)”|"([^"]*)"|'([^']*)'|(.+?))\s*[。.!！]?$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const searchText = normalizeCommandPart(match.slice(1, 5).find(value => value !== undefined));
    const replacementText = normalizeCommandPart(match.slice(5, 9).find(value => value !== undefined) || '');
    if (!searchText) return null;
    return { searchText, replacementText };
  }

  return null;
}

function normalizeCommandPart(value) {
  return String(value || '').trim().replace(/[。.!！]$/, '').trim();
}

// ==================== 工具函数 ====================

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
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
