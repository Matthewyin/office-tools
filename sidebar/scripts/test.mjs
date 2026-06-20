import assert from 'assert/strict';
import {
  isWordDocumentQuestionCommand,
  isWordDocumentSummaryCommand,
  isWordInsertCommand,
  parsePlannerJson,
  parseReplaceCommand,
  shouldUsePlannerForPrompt,
  validatePlannedAction,
} from '../src/command-parser.js';
import {
  buildDocumentContext,
  formatDocumentMatchesForPrompt,
  searchDocumentContext,
} from '../src/document-context.js';
import { renderMarkdown } from '../../packages/frontend-shared/src/chat-renderer.js';
import { isAbortError } from '../../packages/frontend-shared/src/abort-utils.js';
import {
  conversationMeta,
  createConversationRecord,
  inferConversationTitle,
  normalizeConversation,
} from '../../packages/frontend-shared/src/conversation-records.js';
import {
  saveConversationsToStorage,
  STORAGE_MAX_CONVERSATIONS_ON_FALLBACK,
  STORAGE_MAX_MESSAGE_CHARS_ON_FALLBACK,
  STORAGE_MAX_MESSAGES_PER_CONVERSATION_ON_FALLBACK,
} from '../../packages/frontend-shared/src/conversation-storage.js';
import { runLimitedConcurrency } from '../../packages/frontend-shared/src/async-utils.js';
import {
  createModelOptionValue,
  getSelectedModelNameFromProfile,
  getSelectedProfileFromProfiles,
  getSelectedProfileId,
  modelSummary,
  normalizeModelNames,
  normalizeModelProfile,
  resolveSelectedModelId,
  validateSingleModelProfile,
} from '../../packages/frontend-shared/src/model-profiles.js';
import {
  excelAdapter,
  officeAdapter,
  pptAdapter,
  wordAdapter,
} from '../src/host-adapters/index.js';

const pendingTests = [];

test('解析 planner JSON 可处理代码块和前后说明', () => {
  const action = parsePlannerJson('说明\n```json\n{"action":"word_replace","searchText":"A","replacementText":"B"}\n```');
  assert.deepEqual(action, {
    action: 'word_replace',
    searchText: 'A',
    replacementText: 'B',
  });
});

test('校验 Word 替换计划会修剪字段', () => {
  const action = {
    action: 'word_replace',
    searchText: '  旧词  ',
    replacementText: '  新词  ',
  };
  const result = validatePlannedAction(action, { currentHost: 'Word' });
  assert.equal(result.valid, true);
  assert.equal(action.searchText, '旧词');
  assert.equal(action.replacementText, '新词');
});

test('网页搜索关闭时拒绝 web_search 计划', () => {
  const result = validatePlannedAction({
    action: 'web_search',
    query: 'OpenAI 最新消息',
  }, { webSearchEnabled: false });
  assert.equal(result.valid, false);
  assert.equal(result.reason, '网页搜索已关闭');
});

test('中文替换命令解析稳定', () => {
  assert.deepEqual(parseReplaceCommand('把文档中的“旧词”替换为“新词”。'), {
    searchText: '旧词',
    replacementText: '新词',
  });
});

test('写作、总结、问答命令边界稳定', () => {
  assert.equal(isWordInsertCommand('写一篇自创的水调歌头'), true);
  assert.equal(isWordInsertCommand('总结这篇文章'), false);
  assert.equal(isWordDocumentSummaryCommand('总结这篇文章'), true);
  assert.equal(isWordDocumentQuestionCommand('文中作者的观点是什么'), true);
});

test('文档上下文可分段并按关键词召回', () => {
  const context = buildDocumentContext([
    '第一章 背景',
    '这里介绍项目背景和约束。',
    '',
    '第二章 搜索能力',
    '网页搜索能力需要通过后端工具调用。',
  ].join('\n'), { chunkMaxChars: 28 });

  assert.ok(context.chunks.length >= 2);
  const result = searchDocumentContext(context, '网页搜索后端工具', { limit: 2 });
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.some(chunk => chunk.text.includes('网页搜索')));
});

test('文档问答检索优先标题命中', () => {
  const context = buildDocumentContext([
    '第一章 普通背景',
    '合同、流程、预算都有说明。',
    '',
    '第二章 风险控制',
    '这里没有重复标题关键词，但说明了审批、阈值和异常处理。',
    '',
    '第三章 附录',
    '风险控制只是附带提及。',
  ].join('\n'), { chunkMaxChars: 60 });

  const result = searchDocumentContext(context, '风险控制', { limit: 2 });
  assert.equal(result.matches[0].heading, '第二章 风险控制');
});

test('文档问答检索会补充相邻段落', () => {
  const context = buildDocumentContext([
    '第一章 背景',
    '项目背景介绍。',
    '',
    '第二章 检索',
    '网页搜索能力需要通过后端工具调用。',
    '',
    '第三章 影响',
    '该能力会影响资料查询和引用来源。',
  ].join('\n'), { chunkMaxChars: 28 });

  const result = searchDocumentContext(context, '网页搜索', { limit: 3 });
  assert.ok(result.matches.some(chunk => chunk.heading === '第二章 检索'));
  assert.ok(result.matches.some(chunk => chunk.heading === '第一章 背景' || chunk.heading === '第三章 影响'));
});

test('文档问答检索支持中英文混合词', () => {
  const context = buildDocumentContext([
    '第一章 技术方案',
    'RAG 检索能力用于在长文档中找到相关段落。',
    '',
    '第二章 其他',
    '普通聊天不需要使用文档索引。',
  ].join('\n'), { chunkMaxChars: 40 });

  const result = searchDocumentContext(context, 'RAG检索', { limit: 1 });
  assert.equal(result.matches.length, 1);
  assert.ok(result.matches[0].text.includes('RAG 检索'));
  assert.ok(result.matches[0].matchReason.includes('rag'));
});

test('文档问答提示会显示段落命中原因', () => {
  const context = buildDocumentContext([
    '第一章 风险控制',
    '审批阈值和异常处理写在这里。',
  ].join('\n'), { chunkMaxChars: 80 });

  const result = searchDocumentContext(context, '风险控制', { limit: 1 });
  const prompt = formatDocumentMatchesForPrompt(result.matches);
  assert.ok(prompt.includes('命中：标题'));
  assert.ok(prompt.includes('风险'));
});

test('文档问答空查询回退到开头段落', () => {
  const context = buildDocumentContext('第一段\n\n第二段', { chunkMaxChars: 4 });
  const result = searchDocumentContext(context, '', { limit: 1 });
  assert.equal(result.matches.length, 1);
  assert.ok(result.matches[0].text.includes('第一段'));
});

test('Markdown 渲染保留 Word 总结常见结构', () => {
  const html = renderMarkdown([
    '> 核心判断',
    '',
    '| 项目 | 结论 |',
    '| --- | --- |',
    '| 主题 | 明确 |',
    '',
    '[来源](https://example.com)',
  ].join('\n'));

  assert.ok(html.includes('<blockquote>'));
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<a href="https://example.com"'));
});

test('Markdown 不渲染危险链接', () => {
  const html = renderMarkdown('[危险](javascript:alert(1))');
  assert.ok(!html.includes('<a href='));
  assert.ok(html.includes('javascript:alert'));
});

test('Markdown 非法表格按普通段落处理', () => {
  const html = renderMarkdown([
    '| 项目 | 结论 |',
    '| xx | yy |',
  ].join('\n'));
  assert.ok(!html.includes('<table>'));
  assert.ok(html.includes('| 项目 | 结论 |'));
});

test('Markdown code span 不误解析强调', () => {
  const html = renderMarkdown('`a*b` **强**');
  assert.ok(html.includes('<code>a*b</code>'));
  assert.ok(html.includes('<strong>强</strong>'));
});

test('abort 判断覆盖常见浏览器错误', () => {
  assert.equal(isAbortError(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })), true);
  assert.equal(isAbortError(new Error('signal is aborted without reason')), true);
  assert.equal(isAbortError(new Error('普通错误')), false);
});

test('会话记录工具能生成标题和元信息', () => {
  let nextId = 1;
  const createId = () => `id-${nextId++}`;
  const record = createConversationRecord(createId, '新对话');
  assert.equal(record.id, 'id-1');

  const normalized = normalizeConversation({
    id: 'c1',
    title: '',
    pinned: true,
    messages: [{ role: 'assistant', content: '回复' }],
  }, createId);
  assert.equal(normalized.title, '新对话');
  assert.equal(normalized.messages[0].role, 'assistant');
  assert.ok(conversationMeta(normalized).startsWith('已置顶'));
  assert.equal(inferConversationTitle([{ role: 'user', content: '  帮我 总结 这篇文章  ' }]), '帮我 总结 这篇文章');
});

test('planner 预筛避免普通聊天触发规划器', () => {
  assert.equal(shouldUsePlannerForPrompt('你好，介绍一下你自己'), false);
  assert.equal(shouldUsePlannerForPrompt('总结这篇文章'), true);
  assert.equal(shouldUsePlannerForPrompt('查一下最新 AI 新闻', { webSearchEnabled: false }), false);
  assert.equal(shouldUsePlannerForPrompt('查一下最新 AI 新闻', { webSearchEnabled: true }), true);
});

test('对话存储失败时会裁剪历史后重试', () => {
  const storage = createFailingOnceStorage();
  const conversations = Array.from({ length: 10 }, (_, index) => ({
    id: `c${index}`,
    title: `对话 ${index}`,
    pinned: false,
    messages: Array.from({ length: 25 }, (_, messageIndex) => ({
      id: `m${index}-${messageIndex}`,
      role: 'assistant',
      content: 'x'.repeat(STORAGE_MAX_MESSAGE_CHARS_ON_FALLBACK + 20),
    })),
  }));

  const result = saveConversationsToStorage(storage, 'conversations', 'c0', conversations);
  assert.equal(result.saved, true);
  assert.equal(result.trimmed, true);
  assert.ok(result.items.length <= STORAGE_MAX_CONVERSATIONS_ON_FALLBACK);
  assert.ok(result.items.some(item => item.id === 'c0'));
  assert.ok(result.items.every(item => item.messages.length <= STORAGE_MAX_MESSAGES_PER_CONVERSATION_ON_FALLBACK));
  assert.ok(result.items.every(item => item.messages.every(message => message.content.length < STORAGE_MAX_MESSAGE_CHARS_ON_FALLBACK + 80)));
});

test('有限并发保持结果顺序', async () => {
  const progress = [];
  const results = await runLimitedConcurrency([1, 2, 3], 2, async (item) => {
    await wait({ 1: 30, 2: 5, 3: 10 }[item]);
    return item * 10;
  }, (done) => {
    progress.push(done);
  });

  assert.deepEqual(results, [10, 20, 30]);
  assert.deepEqual(progress, [1, 2, 3]);
});

test('有限并发在停止后不继续派发新任务', async () => {
  const controller = new AbortController();
  let started = 0;

  await assert.rejects(
    runLimitedConcurrency([1, 2, 3], 1, async (item) => {
      started += 1;
      if (item === 1) controller.abort();
      return item;
    }, () => {}, { signal: controller.signal }),
    /已停止生成/
  );

  assert.equal(started, 1);
});

test('模型配置支持单供应商多模型', () => {
  const profile = normalizeModelProfile({
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    models: ['deepseek-chat', ' deepseek-reasoner ', 'deepseek-chat', ''],
    hasApiKey: true,
    reasoningEnabled: true,
    reasoningEffort: 'high',
  });

  assert.deepEqual(profile.models, ['deepseek-chat', 'deepseek-reasoner']);
  assert.equal(modelSummary(profile), 'deepseek-chat / deepseek-reasoner · 思考高');

  const selected = resolveSelectedModelId(createModelOptionValue('deepseek', 'deepseek-reasoner'), [profile]);
  assert.equal(getSelectedProfileId(selected), 'deepseek');
  assert.equal(getSelectedProfileFromProfiles([profile], selected)?.id, 'deepseek');
  assert.equal(getSelectedModelNameFromProfile(profile, selected), 'deepseek-reasoner');
});

test('模型选择值解析兼容历史异常值', () => {
  const profile = normalizeModelProfile({
    id: 'bad%id',
    name: '异常历史配置',
    baseUrl: 'https://example.com',
    model: 'm1',
    models: ['m1'],
    hasApiKey: true,
  });

  const selected = resolveSelectedModelId('bad%id::m1', [profile]);
  assert.equal(getSelectedProfileId(selected), 'bad%id');
  assert.equal(getSelectedModelNameFromProfile(profile, selected), 'm1');
});

test('模型选择值兼容后端只返回 profile id', () => {
  const profile = normalizeModelProfile({
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    hasApiKey: true,
  });

  const selected = resolveSelectedModelId('deepseek', [profile]);
  assert.equal(getSelectedProfileId(selected), 'deepseek');
  assert.equal(getSelectedModelNameFromProfile(profile, selected), 'deepseek-chat');
});

test('模型配置校验只测试当前配置', () => {
  const models = normalizeModelNames(['glm-4.5', '', 'glm-4.5', 'glm-4.5-air']);
  assert.deepEqual(models, ['glm-4.5', 'glm-4.5-air']);

  assert.doesNotThrow(() => validateSingleModelProfile({
    name: 'GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: '',
    hasApiKey: true,
    models: ['glm-4.5'],
  }));

  assert.throws(() => validateSingleModelProfile({
    name: '空模型',
    baseUrl: 'https://example.com',
    apiKey: '',
    hasApiKey: false,
    models: [],
  }), /Model Name/);
});

test('宿主适配器能力边界稳定', () => {
  assert.equal(wordAdapter.supportsAction('word_replace'), true);
  assert.equal(wordAdapter.supportsAction('excel_analysis_sheet'), false);

  assert.equal(excelAdapter.supportsAction('excel_analysis_sheet'), true);
  assert.equal(excelAdapter.supportsAction('word_replace'), false);

  assert.equal(pptAdapter.supportsAction('web_search'), true);
  assert.equal(pptAdapter.supportsAction('word_insert'), false);
  assert.equal(pptAdapter.supportsAction('excel_analysis_sheet'), false);

  assert.equal(officeAdapter.supportsAction('word_document_qa'), true);
  assert.equal(officeAdapter.supportsAction('excel_analysis_sheet'), true);
});

await Promise.all(pendingTests);

function test(name, fn) {
  pendingTests.push(runTest(name, fn));
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`通过：${name}`);
  } catch (error) {
    console.error(`失败：${name}`);
    throw error;
  }
}

function createFailingOnceStorage() {
  return {
    calls: 0,
    value: '',
    setItem(key, value) {
      this.calls += 1;
      if (this.calls === 1) throw new Error('quota');
      this.value = value;
    },
  };
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
