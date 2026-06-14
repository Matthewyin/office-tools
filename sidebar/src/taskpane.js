import { streamLLM } from './llm.js';
import { getSelectedText, insertText } from './office-actions.js';

// 当前宿主类型（Word / Excel / PowerPoint）
let currentHost = null;
// 最近一次 AI 回复的完整文本（供"插入文档"使用）
let lastReplyText = '';

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
