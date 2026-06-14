import { streamLLM } from './llm.js';
import {
  getSelectedText,
  insertText,
  countWordMatches,
  replaceWordMatches,
  createExcelAnalysisSheet,
} from './office-actions.js';

// 当前宿主类型（Word / Excel / PowerPoint）
let currentHost = null;
// 最近一次 AI 回复的完整文本（供"插入文档"使用）
let lastReplyText = '';
// 等待用户确认的文档操作
let pendingAction = null;

// ==================== 初始化 ====================

// eslint-disable-next-line no-undef
Office.onReady((info) => {
  currentHost = info.host; // e.g. 'Word' / 'Excel' / 'PowerPoint'
  initUI();
  loadSettings();
  filterQuickActions(currentHost);
});

function initUI() {
  // 设置面板开关
  document.getElementById('btn-settings-toggle').addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('hidden');
  });

  // 保存配置
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

  // 快捷操作
  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => handleQuickAction(btn.dataset.action));
  });

  // 读取选中内容
  document.getElementById('btn-read-selection').addEventListener('click', readSelectionToPrompt);
  document.getElementById('btn-preview-action').addEventListener('click', previewDocumentAction);
  document.getElementById('btn-confirm-action').addEventListener('click', confirmPendingAction);
  document.getElementById('btn-cancel-action').addEventListener('click', clearPendingAction);

  // 发送
  document.getElementById('btn-send').addEventListener('click', handleSend);
  document.getElementById('input-user-prompt').addEventListener('keydown', (e) => {
    // Ctrl+Enter 或 Cmd+Enter 发送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  });

  // 插入文档
  document.getElementById('btn-insert').addEventListener('click', handleInsert);

  // 复制
  document.getElementById('btn-copy').addEventListener('click', handleCopy);

  // 清空
  document.getElementById('btn-clear').addEventListener('click', clearOutput);
}

// ==================== 设置 ====================

function loadSettings() {
  document.getElementById('input-base-url').value =
    localStorage.getItem('llm_base_url') || '';
  document.getElementById('input-api-key').value =
    localStorage.getItem('llm_api_key') || '';
  document.getElementById('input-model').value =
    localStorage.getItem('llm_model') || '';
}

function saveSettings() {
  const baseUrl = document.getElementById('input-base-url').value.trim();
  const apiKey = document.getElementById('input-api-key').value.trim();
  const model = document.getElementById('input-model').value.trim();

  if (!apiKey) {
    showSettingsStatus('请填写 API Key。', 'error');
    return;
  }

  localStorage.setItem('llm_base_url', baseUrl || 'https://api.openai.com/v1');
  localStorage.setItem('llm_api_key', apiKey);
  localStorage.setItem('llm_model', model || 'gpt-4o-mini');

  showSettingsStatus('已保存', 'success');

  // 1.5 秒后自动折叠设置面板
  setTimeout(() => {
    document.getElementById('settings-panel').classList.add('hidden');
    document.getElementById('settings-status').textContent = '';
  }, 1500);
}

function showSettingsStatus(msg, type) {
  const el = document.getElementById('settings-status');
  el.textContent = msg;
  el.className = `status-text ${type}`;
}

// ==================== 快捷操作 ====================

// 根据当前宿主隐藏不相关的快捷按钮
function filterQuickActions(host) {
  const classMap = {
    Word: 'host-word',
    Excel: 'host-excel',
    PowerPoint: 'host-ppt',
  };
  const activeClass = classMap[host];
  document.querySelectorAll('.pill').forEach(btn => {
    // 只显示当前宿主对应的按钮
    btn.style.display = (!activeClass || btn.classList.contains(activeClass)) ? '' : 'none';
  });
}

// 快捷操作预设 Prompt
const QUICK_ACTION_PROMPTS = {
  'polish': {
    system: '你是专业的中文文档润色助手。请保留原文含义，提升语言的流畅性、专业性和可读性，直接输出润色后的文本，不要添加解释。',
    user: (text) => `请润色以下文本：\n\n${text}`,
  },
  'translate-en': {
    system: '你是专业的翻译助手。请将中文翻译为自然流畅的英文，直接输出翻译结果，不要添加解释。',
    user: (text) => `请将以下中文翻译成英文：\n\n${text}`,
  },
  'summarize': {
    system: '你是文档摘要助手。请提炼核心要点，用简洁的中文输出摘要。',
    user: (text) => `请总结以下内容的核心要点：\n\n${text}`,
  },
  'analyze-data': {
    system: '你是数据分析助手。请分析表格数据的特征、规律和潜在问题，输出简洁的分析报告。',
    user: (text) => `请分析以下表格数据：\n\n${text}`,
  },
  'gen-formula': {
    system: '你是 Excel 公式专家。只输出 Excel 公式，不要解释，如有多个方案只给出最优的一个。',
    user: (text) => `根据以下数据和需求，生成对应的 Excel 公式：\n\n${text}\n\n请直接输出公式（以 = 开头）。`,
  },
  'explain-formula': {
    system: '你是 Excel 专家。请用简洁的中文解释公式的含义和作用。',
    user: (text) => `请解释以下 Excel 公式的含义：\n\n${text}`,
  },
  'gen-outline': {
    system: '你是演示文稿设计专家。请生成结构清晰、层次分明的幻灯片大纲，每张幻灯片包含标题和 3-5 个要点。',
    user: (text) => `根据以下主题或内容，生成幻灯片大纲：\n\n${text || '（请先在幻灯片中输入主题）'}`,
  },
  'expand-content': {
    system: '你是演示文稿撰写专家。请将简短的要点扩写为完整、有说服力的幻灯片内容，语言简洁有力。',
    user: (text) => `请将以下内容扩写为完整的幻灯片文案：\n\n${text}`,
  },
};

async function handleQuickAction(action) {
  if (action === 'analyze-to-sheet') {
    await previewExcelAnalysisToSheet();
    return;
  }

  const config = QUICK_ACTION_PROMPTS[action];
  if (!config) return;

  let selectionText = '';
  try {
    selectionText = await getSelectedText(currentHost);
  } catch (err) {
    console.warn('读取选区失败:', err);
  }

  const userPrompt = config.user(selectionText);
  document.getElementById('input-user-prompt').value = userPrompt;
  await sendToLLM(config.system, userPrompt);
}

// ==================== 发送 ====================

async function readSelectionToPrompt() {
  const btn = document.getElementById('btn-read-selection');
  btn.disabled = true;
  setButtonLabel(btn, '读取中...');
  try {
    const text = await getSelectedText(currentHost);
    const textarea = document.getElementById('input-user-prompt');
    textarea.value = text
      ? `${textarea.value ? textarea.value + '\n\n' : ''}${text}`
      : textarea.value;
    if (!text) showToast('未检测到选中内容');
  } catch (err) {
    showToast(`读取失败: ${err.message}`);
  } finally {
    btn.disabled = false;
    setButtonLabel(btn, '读取选中');
  }
}

async function handleSend() {
  const systemPrompt = document.getElementById('input-system-prompt').value.trim();
  const userPrompt = document.getElementById('input-user-prompt').value.trim();
  if (!userPrompt) {
    showToast('请输入问题内容');
    return;
  }
  await sendToLLM(systemPrompt, userPrompt);
}

async function previewDocumentAction() {
  if (currentHost !== 'Word') {
    showToast('当前仅支持 Word 查找替换预览');
    return;
  }

  const commandText = document.getElementById('input-user-prompt').value.trim();
  const parsed = parseReplaceCommand(commandText);
  if (!parsed) {
    showToast('请输入类似：找到文档中的“XX”，替换为“YY”');
    return;
  }

  const btn = document.getElementById('btn-preview-action');
  btn.disabled = true;
  setButtonLabel(btn, '预览中...');
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
  } catch (err) {
    showToast(`预览失败: ${err.message}`);
  } finally {
    btn.disabled = false;
    setButtonLabel(btn, '预览操作');
  }
}

async function previewExcelAnalysisToSheet() {
  if (currentHost !== 'Excel') {
    showToast('当前仅支持 Excel 新表分析');
    return;
  }

  let selectionText = '';
  try {
    selectionText = await getSelectedText(currentHost);
  } catch (err) {
    showToast(`读取选区失败: ${err.message}`);
    return;
  }

  if (!selectionText.trim()) {
    showToast('请先选中要分析的单元格区域');
    return;
  }

  pendingAction = {
    type: 'excel-analysis-to-sheet',
    selectionText,
  };
  document.getElementById('btn-confirm-action').disabled = false;
  showActionPreview([
    'Excel 新建分析工作表',
    '将读取当前选区，生成简洁分析报告。',
    '确认后会创建新的工作表“AI 分析”，原工作表不会被修改。',
  ].join('\n'));
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
  setButtonLabel(confirmBtn, action.type === 'excel-analysis-to-sheet' ? '生成中...' : '执行中...');

  try {
    if (action.type === 'word-replace') {
      const replacedCount = await replaceWordMatches(action.searchText, action.replacementText);
      setOutputText([
        '已完成 Word 查找替换。',
        '',
        `查找内容：${action.searchText}`,
        `替换为：${action.replacementText || '（空文本）'}`,
        `实际替换：${replacedCount} 处`,
      ].join('\n'), { allowInsert: false, allowCopy: true });
      showToast('替换完成');
      clearPendingAction();
      return;
    }

    if (action.type === 'excel-analysis-to-sheet') {
      const analysisText = await generateExcelAnalysis(action.selectionText);
      const sheetName = await createExcelAnalysisSheet(analysisText);
      setOutputText(`${analysisText}\n\n已写入工作表：${sheetName}`, {
        allowInsert: false,
        allowCopy: true,
      });
      showToast(`已创建工作表：${sheetName}`);
      clearPendingAction();
    }
  } catch (err) {
    setOutputText(`错误: ${err.message}`, { allowInsert: false, allowCopy: true });
    showToast(`执行失败: ${err.message}`);
  } finally {
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    setButtonLabel(confirmBtn, '确认执行');
  }
}

async function generateExcelAnalysis(selectionText) {
  const outputArea = document.getElementById('output-area');
  outputArea.innerHTML = '<span class="cursor-blink">▋</span>';
  lastReplyText = '';
  document.getElementById('btn-insert').disabled = true;
  document.getElementById('btn-copy').disabled = true;

  const systemPrompt = '你是专业的数据分析助手。请基于用户选中的 Excel 数据输出简洁、可落地的中文分析报告。';
  const userPrompt = [
    '请分析以下 Excel 选区数据。',
    '要求：',
    '1. 先给核心结论。',
    '2. 再列出关键发现和异常点。',
    '3. 最后给出下一步建议。',
    '',
    selectionText,
  ].join('\n');

  const fullText = await streamLLM(systemPrompt, userPrompt, (chunk) => {
    lastReplyText += chunk;
    outputArea.innerHTML =
      escapeHtml(lastReplyText).replace(/\n/g, '<br>') +
      '<span class="cursor-blink">▋</span>';
    outputArea.scrollTop = outputArea.scrollHeight;
  });

  const result = fullText || lastReplyText;
  outputArea.innerHTML = escapeHtml(result).replace(/\n/g, '<br>');
  return result;
}

async function sendToLLM(systemPrompt, userPrompt) {
  const sendBtn = document.getElementById('btn-send');
  sendBtn.disabled = true;
  setButtonLabel(sendBtn, '生成中...');

  // 清空输出区，准备流式写入
  const outputArea = document.getElementById('output-area');
  outputArea.innerHTML = '<span class="cursor-blink">▋</span>';
  lastReplyText = '';

  document.getElementById('btn-insert').disabled = true;
  document.getElementById('btn-copy').disabled = true;

  try {
    await streamLLM(systemPrompt, userPrompt, (chunk) => {
      lastReplyText += chunk;
      // 更新输出区域（保留光标动画在末尾）
      outputArea.innerHTML =
        escapeHtml(lastReplyText).replace(/\n/g, '<br>') +
        '<span class="cursor-blink">▋</span>';
      outputArea.scrollTop = outputArea.scrollHeight;
    });

    // 流式完成，移除光标
    outputArea.innerHTML = escapeHtml(lastReplyText).replace(/\n/g, '<br>');
    document.getElementById('btn-insert').disabled = false;
    document.getElementById('btn-copy').disabled = false;
  } catch (err) {
    outputArea.innerHTML = `<span class="error-text">错误: ${escapeHtml(err.message)}</span>`;
  } finally {
    sendBtn.disabled = false;
    setButtonLabel(sendBtn, '发送');
  }
}

// ==================== 输出操作 ====================

async function handleInsert() {
  if (!lastReplyText) return;
  const btn = document.getElementById('btn-insert');
  btn.disabled = true;
  setButtonLabel(btn, '插入中...');
  try {
    await insertText(currentHost, lastReplyText);
    showToast('已插入文档');
  } catch (err) {
    showToast(`插入失败: ${err.message}`);
  } finally {
    btn.disabled = false;
    setButtonLabel(btn, '插入');
  }
}

async function handleCopy() {
  if (!lastReplyText) return;
  try {
    await navigator.clipboard.writeText(lastReplyText);
    const btn = document.getElementById('btn-copy');
    setButtonLabel(btn, '已复制');
    setTimeout(() => { setButtonLabel(btn, '复制'); }, 1500);
  } catch {
    showToast('复制失败，请手动选择文本复制');
  }
}

function clearOutput() {
  document.getElementById('output-area').innerHTML =
    '<p class="output-placeholder">回复将在这里显示...</p>';
  lastReplyText = '';
  document.getElementById('btn-insert').disabled = true;
  document.getElementById('btn-copy').disabled = true;
}

// ==================== 工具函数 ====================

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

function showActionPreview(text) {
  const panel = document.getElementById('action-preview');
  document.getElementById('action-preview-text').textContent = text;
  panel.classList.remove('hidden');
}

function clearPendingAction() {
  pendingAction = null;
  document.getElementById('action-preview').classList.add('hidden');
  document.getElementById('action-preview-text').textContent = '';
  const confirmBtn = document.getElementById('btn-confirm-action');
  confirmBtn.disabled = false;
  setButtonLabel(confirmBtn, '确认执行');
}

function setOutputText(text, options = {}) {
  const { allowInsert = false, allowCopy = false } = options;
  lastReplyText = text;
  document.getElementById('output-area').innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
  document.getElementById('btn-insert').disabled = !allowInsert;
  document.getElementById('btn-copy').disabled = !allowCopy;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setButtonLabel(btn, label) {
  const iconId = btn.dataset.icon;
  if (!iconId) {
    btn.textContent = label;
    return;
  }
  btn.innerHTML = `<svg class="icon"><use href="#${iconId}"></use></svg><span>${escapeHtml(label)}</span>`;
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
