import { completeChat, streamChat, testLLMConfig } from './llm.js';
import {
  getSelectedText,
  insertText,
  getWordBodyText,
  getWordBodyOoxmlSnapshot,
  previewWordMatches,
  replaceWordMatches,
  replaceWordSelection,
  restoreWordBodyOoxmlSnapshot,
  createExcelAnalysisSheet,
} from './office-actions.js';

let currentHost = null;
let pendingAction = null;
let chatMessages = [];
let modelProfiles = [];
let selectedModelId = '';
let expandedModelIds = new Set();
let lastRollback = null;
const DOCUMENT_CHUNK_MAX_CHARS = 5000;
const DOCUMENT_COMBINE_MAX_CHARS = 18000;

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
    if (event.key !== 'Enter' || event.isComposing) return;
    if (event.altKey) return;
    event.preventDefault();
    handleSend();
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
  expandedModelIds.add(profile.id);
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
    const expanded = expandedModelIds.has(profile.id) || !isModelConfigured(profile);
    const item = document.createElement('section');
    item.className = `model-config${expanded ? ' expanded' : ''}`;
    item.dataset.id = profile.id;
    item.innerHTML = `
      <div class="model-config-header">
        <div class="model-config-heading">
          <span class="model-config-title">${escapeHtml(profile.name || `模型 ${index + 1}`)}</span>
          <span class="model-config-summary">${escapeHtml(modelSummary(profile))}</span>
        </div>
        <div class="model-config-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-toggle-model="${escapeHtml(profile.id)}">${expanded ? '收起' : '编辑'}</button>
          <button class="btn btn-secondary btn-sm" type="button" data-test-model="${escapeHtml(profile.id)}">测试</button>
          <button class="btn btn-danger btn-sm" type="button" data-remove-model="${escapeHtml(profile.id)}">删除</button>
        </div>
      </div>
      <div class="model-config-fields">
        <input class="input" data-field="name" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="显示名称，例如 GLM-5.2" value="${escapeHtml(profile.name || '')}" />
        <input class="input" data-field="baseUrl" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="API Base URL" value="${escapeHtml(profile.baseUrl || '')}" />
        <input class="input" data-field="apiKey" type="password" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="API Key" value="${escapeHtml(profile.apiKey || '')}" />
        <input class="input" data-field="model" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Model Name" value="${escapeHtml(profile.model || '')}" />
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
      </div>
      <p class="model-test-status" data-test-status></p>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-toggle-model]').forEach(button => {
    button.addEventListener('click', () => toggleModelEditor(button.dataset.toggleModel));
  });

  list.querySelectorAll('[data-test-model]').forEach(button => {
    button.addEventListener('click', () => testModelProfile(button.dataset.testModel));
  });

  list.querySelectorAll('[data-remove-model]').forEach(button => {
    button.addEventListener('click', () => removeModelProfile(button.dataset.removeModel));
  });
}

function toggleModelEditor(id) {
  modelProfiles = readProfilesFromForm();
  if (expandedModelIds.has(id)) {
    expandedModelIds.delete(id);
  } else {
    expandedModelIds.add(id);
  }
  renderModelConfigList();
  renderModelSelect();
}

function isModelConfigured(profile) {
  return Boolean(profile.name && profile.baseUrl && profile.model);
}

function modelSummary(profile) {
  const model = profile.model || '未填写模型';
  const reasoning = profile.reasoningEnabled ? `思考${effortLabel(profile.reasoningEffort)}` : '思考关';
  return `${model} · ${reasoning}`;
}

function effortLabel(value) {
  const map = { low: '低', medium: '中', high: '高' };
  return map[value] || '中';
}

async function testModelProfile(id) {
  modelProfiles = readProfilesFromForm();
  const profile = modelProfiles.find(item => item.id === id);
  if (!profile) return;

  const item = document.querySelector(`.model-config[data-id="${cssEscape(id)}"]`);
  const status = item?.querySelector('[data-test-status]');
  const button = item?.querySelector('[data-test-model]');
  if (!status || !button) return;

  status.textContent = '测试中...';
  status.className = 'model-test-status';
  button.disabled = true;

  try {
    const reply = await testLLMConfig(profile);
    status.textContent = `连接成功：${reply.slice(0, 40)}`;
    status.className = 'model-test-status success';
  } catch (err) {
    status.textContent = `连接失败：${err.message}`;
    status.className = 'model-test-status error';
  } finally {
    button.disabled = false;
  }
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

  if (await handleRollbackCommand(userPrompt)) return;

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

  const plannedAction = await planDocumentAction(commandText);
  if (plannedAction) {
    return await executePlannedAction(plannedAction, commandText, fromChat);
  }

  // 本地解析只做 LLM 计划失败时的兜底，不作为主要能力边界。
  if (currentHost === 'Word') {
    const parsed = parseReplaceCommand(commandText);
    if (parsed) {
      await previewWordReplace(parsed, fromChat);
      return true;
    }

    if (isWordInsertCommand(commandText)) {
      await generateAndInsertWordContent(commandText);
      return true;
    }

    if (isWordDocumentSummaryCommand(commandText)) {
      await processWholeWordDocument('summary', commandText);
      return true;
    }

    if (isWordDocumentReviewCommand(commandText)) {
      await processWholeWordDocument('review', commandText);
      return true;
    }
  }

  if (currentHost === 'Excel' && isExcelAnalysisSheetCommand(commandText)) {
    await previewExcelAnalysisToSheet(commandText, fromChat);
    return true;
  }

  return false;
}

async function planDocumentAction(commandText) {
  try {
    const selectionContext = await getPlannerSelectionContext();
    const responseText = await completeChat([
      {
        role: 'system',
        content: [
          '你是 Office 加载项的操作规划器，只输出 JSON，不要输出解释。',
          '根据用户输入判断是否要直接操作当前 Office 文档。',
          '可用 action：',
          'chat：普通聊天或无法确定操作。',
          'word_replace：替换 Word 正文中的文本，必须给出 searchText 和 replacementText。',
          'word_rewrite_selection：改写 Word 当前选区，适用于润色、缩短、扩写、改正式、翻译等，必须给出 instruction。',
          'word_insert：在 Word 当前光标或选区写入新内容，必须给出 instruction。',
          'word_summarize_document：总结或介绍 Word 整篇文档，适用于总结全文、总结这篇文章、介绍这首词、分析当前文档、提炼大纲，必须给出 instruction。',
          'word_review_document：审稿 Word 整篇文档，适用于检查全文问题、错别字、逻辑问题、结构反馈，必须给出 instruction。',
          'excel_analysis_sheet：读取 Excel 当前选区并创建分析工作表，必须给出 instruction。',
          '输出格式：{"action":"chat"}、{"action":"word_replace","searchText":"A","replacementText":"B"} 或 {"action":"word_rewrite_selection","instruction":"润色当前选区"}。',
          '不要把“文档中的”“正文里的”等位置描述放入 searchText。',
          '用户要求润色、缩短、扩写、改正式、翻译当前内容，且 hasSelection 为 true 时，优先使用 word_rewrite_selection。',
          '用户明确要求总结、概括、提炼大纲、审稿、检查全文或反馈整篇文档时，使用对应的整篇文档 action，不要使用 chat。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify({
          host: currentHost,
          input: commandText,
          ...selectionContext,
        }),
      },
    ], getSelectedModelConfig());
    const action = parsePlannerJson(responseText);
    const validation = validatePlannedAction(action);
    if (!validation.valid) {
      console.warn('操作计划无效:', validation.reason, action);
      return null;
    }
    return action;
  } catch (err) {
    console.warn('操作规划失败:', err);
    return null;
  }
}

async function getPlannerSelectionContext() {
  if (currentHost !== 'Word') return {};

  try {
    const selectionText = await getSelectedText(currentHost);
    const trimmed = selectionText.trim();
    return {
      hasSelection: Boolean(trimmed),
      selectionSample: trimmed.slice(0, 200),
    };
  } catch {
    return { hasSelection: false };
  }
}

async function executePlannedAction(action, commandText, fromChat) {
  if (action.action === 'chat') return false;

  if (currentHost === 'Word' && action.action === 'word_replace') {
    await previewWordReplace({
      searchText: action.searchText,
      replacementText: action.replacementText,
    }, fromChat);
    return true;
  }

  if (currentHost === 'Word' && action.action === 'word_rewrite_selection') {
    await previewWordSelectionRewrite(action.instruction || commandText, fromChat);
    return true;
  }

  if (currentHost === 'Word' && action.action === 'word_insert') {
    await generateAndInsertWordContent(action.instruction || commandText);
    return true;
  }

  if (currentHost === 'Word' && action.action === 'word_summarize_document') {
    await processWholeWordDocument('summary', action.instruction || commandText);
    return true;
  }

  if (currentHost === 'Word' && action.action === 'word_review_document') {
    await processWholeWordDocument('review', action.instruction || commandText);
    return true;
  }

  if (currentHost === 'Excel' && action.action === 'excel_analysis_sheet') {
    await previewExcelAnalysisToSheet(action.instruction || commandText, fromChat);
    return true;
  }

  return false;
}

function parsePlannerJson(text) {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validatePlannedAction(action) {
  if (!action || typeof action !== 'object') {
    return { valid: false, reason: '计划不是对象' };
  }
  if (typeof action.action !== 'string') {
    return { valid: false, reason: '缺少 action' };
  }
  if (action.action === 'chat') {
    return { valid: true };
  }
  if (action.action === 'word_replace') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.searchText !== 'string' || !action.searchText.trim()) {
      return { valid: false, reason: '缺少 searchText' };
    }
    if (typeof action.replacementText !== 'string') {
      return { valid: false, reason: '缺少 replacementText' };
    }
    action.searchText = action.searchText.trim();
    action.replacementText = action.replacementText.trim();
    return { valid: true };
  }
  if (action.action === 'word_rewrite_selection') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  if (action.action === 'word_insert') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  if (action.action === 'word_summarize_document' || action.action === 'word_review_document') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  if (action.action === 'excel_analysis_sheet') {
    if (currentHost !== 'Excel') return { valid: false, reason: '当前不是 Excel' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  return { valid: false, reason: `未知 action: ${action.action}` };
}

async function generateAndInsertWordContent(commandText) {
  const assistantMessage = addMessage('assistant', '', { pending: true });
  const systemPrompt = [
    '你是专业的 Word 文档写作助手。',
    '用户要求你写入文档时，只输出可直接插入文档的正文。',
    '不要输出“好的”“以下是”“我可以”等解释性话术。',
  ].join('\n');
  const userPrompt = `请根据以下指令生成正文内容：\n\n${commandText}`;

  try {
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

    const beforeOoxml = await getWordBodyOoxmlSnapshot();
    await insertText(currentHost, assistantMessage.content);
    lastRollback = {
      type: 'word-body-ooxml',
      label: '撤销写入文档',
      snapshot: beforeOoxml,
    };
    addMessage('assistant', '已写入 Word 文档。');
    showToast('已写入文档');
  } catch (err) {
    assistantMessage.content = `写入失败: ${err.message}`;
    assistantMessage.pending = false;
    assistantMessage.error = true;
    renderChatMessages();
    showToast(`写入失败: ${err.message}`);
  }
}

async function processWholeWordDocument(mode, instruction) {
  const sendBtn = document.getElementById('btn-send');
  sendBtn.disabled = true;
  const assistantMessage = addMessage('assistant', '正在读取 Word 正文...', { pending: true });

  try {
    const bodyText = (await getWordBodyText()).trim();
    if (!bodyText) {
      throw new Error('当前 Word 文档没有可读取的正文内容。');
    }

    const chunks = splitDocumentText(bodyText);
    const chunkResults = [];
    assistantMessage.content = `已读取正文，约 ${bodyText.length} 字，拆分为 ${chunks.length} 段处理。`;
    renderChatMessages();

    for (let index = 0; index < chunks.length; index += 1) {
      assistantMessage.content = `正在处理第 ${index + 1} / ${chunks.length} 段...`;
      renderChatMessages();
      const result = await analyzeDocumentChunk(mode, instruction, chunks[index], index + 1, chunks.length);
      chunkResults.push(result);
    }

    assistantMessage.content = '正在合并分段结果...';
    renderChatMessages();

    const finalText = await combineDocumentResults(mode, instruction, chunkResults);
    assistantMessage.content = finalText;
    assistantMessage.pending = false;
    renderChatMessages();
  } catch (err) {
    assistantMessage.content = `整篇文档处理失败: ${err.message}`;
    assistantMessage.pending = false;
    assistantMessage.error = true;
    renderChatMessages();
  } finally {
    sendBtn.disabled = false;
  }
}

async function analyzeDocumentChunk(mode, instruction, chunkText, chunkIndex, chunkTotal) {
  const isReview = mode === 'review';
  const systemPrompt = isReview
    ? [
      '你是专业的 Word 文档审稿助手。',
      '你正在处理长文档的一个分段，只基于当前分段输出审稿结果。',
      '重点找结构、逻辑、表达、错别字、病句和明显不一致之处。',
      '如果没有明显问题，请简短说明“本段未发现明显问题”。',
      '输出要简洁，不要改写全文。',
    ].join('\n')
    : [
      '你是专业的 Word 文档总结助手。',
      '你正在处理长文档的一个分段，只基于当前分段提炼信息。',
      '保留关键事实、观点、论据和小标题线索。',
      '输出控制在 500 字以内。',
    ].join('\n');

  return await completeChat([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        `用户任务：${instruction}`,
        `当前分段：${chunkIndex} / ${chunkTotal}`,
        '',
        chunkText,
      ].join('\n'),
    },
  ], getSelectedModelConfig());
}

async function combineDocumentResults(mode, instruction, chunkResults) {
  const isReview = mode === 'review';
  const compactResults = await compactDocumentResultsIfNeeded(chunkResults);
  const systemPrompt = isReview
    ? [
      '你是专业的 Word 文档审稿助手。',
      '现在需要基于各分段审稿结果，合并成整篇文档反馈。',
      '输出结构：总体评价、主要问题、逐项修改建议、优先处理项。',
      '不要编造原文中没有的信息。',
      '只给反馈，不要直接生成改写后的全文。',
    ].join('\n')
    : [
      '你是专业的 Word 文档总结助手。',
      '现在需要基于各分段摘要，合并成整篇文档总结。',
      '输出结构：一句话摘要、核心要点、文章大纲、值得关注的问题或亮点。',
      '不要编造原文中没有的信息。',
    ].join('\n');

  return await completeChat([
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        `用户任务：${instruction}`,
        '',
        compactResults.map((result, index) => `## 分段 ${index + 1}\n${result}`).join('\n\n'),
      ].join('\n'),
    },
  ], getSelectedModelConfig());
}

async function compactDocumentResultsIfNeeded(results) {
  const joined = results.join('\n\n');
  if (joined.length <= DOCUMENT_COMBINE_MAX_CHARS) return results;

  const compacted = [];
  for (const result of results) {
    compacted.push(await completeChat([
      {
        role: 'system',
        content: '请把这段中间结果压缩到 250 字以内，保留关键事实、问题和结论，不要新增信息。',
      },
      { role: 'user', content: result },
    ], getSelectedModelConfig()));
  }
  return compacted;
}

function splitDocumentText(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs.length ? paragraphs : [normalized]) {
    if (paragraph.length > DOCUMENT_CHUNK_MAX_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let start = 0; start < paragraph.length; start += DOCUMENT_CHUNK_MAX_CHARS) {
        chunks.push(paragraph.slice(start, start + DOCUMENT_CHUNK_MAX_CHARS));
      }
      continue;
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > DOCUMENT_CHUNK_MAX_CHARS && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function handleRollbackCommand(input) {
  if (!/(撤销|回滚|恢复)(上次|刚才|最近)?(操作|修改|写入|替换)?/.test(input)) {
    return false;
  }
  if (!lastRollback) {
    addMessage('assistant', '没有可撤销的上一次文档操作。', { error: true });
    return true;
  }
  if (lastRollback.type !== 'word-body-ooxml') {
    addMessage('assistant', '当前上一次操作暂不支持撤销。', { error: true });
    return true;
  }

  try {
    await restoreWordBodyOoxmlSnapshot(lastRollback.snapshot);
    addMessage('assistant', `已执行：${lastRollback.label}`);
    lastRollback = null;
    showToast('已撤销上次操作');
  } catch (err) {
    addMessage('assistant', `撤销失败: ${err.message}`, { error: true });
  }
  return true;
}

async function previewWordReplace(parsed, fromChat) {
  const previewBtn = document.getElementById('btn-preview-action');
  previewBtn.disabled = true;
  try {
    const preview = await previewWordMatches(parsed.searchText, parsed.replacementText);
    pendingAction = {
      type: 'word-replace',
      searchText: parsed.searchText,
      replacementText: parsed.replacementText,
      count: preview.count,
      preview,
    };

    const confirmBtn = document.getElementById('btn-confirm-action');
    confirmBtn.disabled = preview.count === 0;
    showActionPreview([
      'Word 查找替换',
      `查找内容：${parsed.searchText}`,
      `替换为：${parsed.replacementText || '（空文本）'}`,
      `作用范围：${preview.scope}`,
      `预计影响：${preview.count} 处匹配`,
      '',
      ...formatDiffExamples(preview.examples),
    ].join('\n'));

    if (fromChat) {
      addMessage('assistant', preview.count > 0
        ? `已识别为 Word 查找替换操作，作用范围：${preview.scope}，预计影响 ${preview.count} 处。请确认后执行。`
        : `已识别为 Word 查找替换操作，但${preview.scope}中没有匹配内容。`);
    }
  } catch (err) {
    addMessage('assistant', `预览失败: ${err.message}`, { error: true });
  } finally {
    previewBtn.disabled = false;
  }
}

async function previewWordSelectionRewrite(instruction, fromChat) {
  const previewBtn = document.getElementById('btn-preview-action');
  previewBtn.disabled = true;
  const assistantMessage = fromChat
    ? addMessage('assistant', '正在生成 Word 选区改写预览...', { pending: true })
    : null;

  try {
    const selectionText = await getSelectedText(currentHost);
    if (!selectionText.trim()) {
      if (assistantMessage) {
        assistantMessage.content = '请先在 Word 中选中要改写的文本。';
        assistantMessage.pending = false;
        assistantMessage.error = true;
        renderChatMessages();
      } else {
        addMessage('assistant', '请先在 Word 中选中要改写的文本。', { error: true });
      }
      return;
    }

    const rewrittenText = await completeChat([
      {
        role: 'system',
        content: [
          '你是专业的 Word 文档改写助手。',
          '只输出改写后的正文，不要输出解释、标题、引号或寒暄。',
          '保持原文事实和核心含义，不要虚构信息。',
          '除非用户明确要求，否则保持原文语言不变。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `改写要求：${instruction}`,
          '',
          '当前选区：',
          selectionText,
        ].join('\n'),
      },
    ], getSelectedModelConfig());

    if (!rewrittenText.trim()) {
      throw new Error('模型没有返回可写入的文本。');
    }

    pendingAction = {
      type: 'word-selection-rewrite',
      instruction,
      originalText: selectionText,
      replacementText: rewrittenText.trim(),
    };

    document.getElementById('btn-confirm-action').disabled = false;
    showActionPreview([
      'Word 选区改写',
      `改写要求：${instruction}`,
      '作用范围：当前选区',
      '',
      ...formatRewritePreview(selectionText, rewrittenText.trim()),
    ].join('\n'));

    if (assistantMessage) {
      assistantMessage.content = '已生成 Word 选区改写预览，请确认后执行。';
      assistantMessage.pending = false;
      renderChatMessages();
    }
  } catch (err) {
    if (assistantMessage) {
      assistantMessage.content = `预览失败: ${err.message}`;
      assistantMessage.pending = false;
      assistantMessage.error = true;
      renderChatMessages();
    } else {
      addMessage('assistant', `预览失败: ${err.message}`, { error: true });
    }
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
      const beforeOoxml = await getWordBodyOoxmlSnapshot();
      const replaced = await replaceWordMatches(action.searchText, action.replacementText);
      lastRollback = {
        type: 'word-body-ooxml',
        label: `撤销替换：${action.searchText} → ${action.replacementText}`,
        snapshot: beforeOoxml,
      };
      addMessage('assistant', [
        '已完成 Word 查找替换。',
        '',
        `查找内容：${action.searchText}`,
        `替换为：${action.replacementText || '（空文本）'}`,
        `作用范围：${replaced.scope}`,
        `实际替换：${replaced.count} 处`,
        '',
        '如需恢复，可输入“撤销上次操作”。',
      ].join('\n'));
      showToast('替换完成');
    }

    if (action.type === 'word-selection-rewrite') {
      const beforeOoxml = await getWordBodyOoxmlSnapshot();
      const result = await replaceWordSelection(action.replacementText);
      lastRollback = {
        type: 'word-body-ooxml',
        label: '撤销选区改写',
        snapshot: beforeOoxml,
      };
      addMessage('assistant', [
        '已完成 Word 选区改写。',
        '',
        `改写要求：${action.instruction}`,
        `作用范围：${result.scope}`,
        '',
        '如需恢复，可输入“撤销上次操作”。',
      ].join('\n'));
      showToast('改写完成');
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

function isWordInsertCommand(input) {
  return /(在|往|向)?文档(中|里)?/.test(input) && /(写|写入|插入|生成|创建|起草|撰写)/.test(input);
}

function isWordDocumentSummaryCommand(input) {
  return /(总结|概括|提炼|梳理|大纲|摘要|介绍|解释|分析)/.test(input) && /(全文|整篇|整份|文档|文章|这篇|当前内容|这首|诗|词)/.test(input);
}

function isWordDocumentReviewCommand(input) {
  return /(审稿|检查|校对|反馈|问题|错别字|病句|逻辑|结构)/.test(input) && /(全文|整篇|整份|文档|文章|这篇|当前内容)/.test(input);
}

function parseReplaceCommand(input) {
  const text = input.trim();
  const patterns = [
    /^(?:请)?(?:找到|查找)(?:文档中|文档里|正文中|正文里)?(?:的)?\s*(?:“([^”]+)”|"([^"]+)"|'([^']+)'|(.+?))(?:内容)?\s*[，,；; ]*(?:并)?(?:全部)?(?:替换为|替换成|改成|更改为|修改为)\s*(?:“([^”]*)”|"([^"]*)"|'([^']*)'|(.+?))\s*[。.!！]?$/,
    /^(?:请)?(?:把|将)(?:文档中|文档里|正文中|正文里)?(?:的)?\s*(?:“([^”]+)”|"([^"]+)"|'([^']+)'|(.+?))\s*(?:全部)?(?:替换为|替换成|改成|更改为|修改为)\s*(?:“([^”]*)”|"([^"]*)"|'([^']*)'|(.+?))\s*[。.!！]?$/,
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

function clipPreviewText(text) {
  const normalized = String(text || '').trim();
  if (normalized.length <= 500) return normalized;
  return `${normalized.slice(0, 500)}...`;
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

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
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
