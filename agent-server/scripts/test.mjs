import assert from 'assert/strict';
import {
  buildDocumentContext,
  formatDocumentMatchesForPrompt,
  getDocumentContextStatus,
  searchDocumentContext,
} from '../src/document-service.js';
import { runLimitedConcurrency } from '../src/async-utils.js';
import { createMcpServer } from '../src/mcp-server.js';
import { listTools } from '../src/tools.js';
import { extractReadableText } from '../src/fetch-url.js';

const pendingTests = [];

test('工具注册表包含 web_search、fetch_url、document_search', () => {
  const names = listTools().map(tool => tool.name);
  assert.ok(names.includes('web_search'), '缺少 web_search');
  assert.ok(names.includes('fetch_url'), '缺少 fetch_url');
  assert.ok(names.includes('document_search'), '缺少 document_search');
});

test('document_search 工具仅对 Word 宿主可见', () => {
  const excelTools = listTools({ host: 'excel' }).map(tool => tool.name);
  const wordTools = listTools({ host: 'word' }).map(tool => tool.name);
  assert.ok(!excelTools.includes('document_search'), 'document_search 不应在 Excel 暴露');
  assert.ok(wordTools.includes('document_search'), 'document_search 应在 Word 暴露');
});

test('MCP Server 注册现有工具', () => {
  const server = createMcpServer({});
  const names = Object.keys(server._registeredTools || {});
  assert.ok(names.includes('web_search'), 'MCP 缺少 web_search');
  assert.ok(names.includes('fetch_url'), 'MCP 缺少 fetch_url');
  assert.ok(names.includes('document_search'), 'MCP 缺少 document_search');
});

test('网页正文抽取剥离脚本样式并保留段落', () => {
  const html = [
    '<html><head><title>测试标题</title>',
    '<script>var x = 1;</script>',
    '<style>body { color: red; }</style></head>',
    '<body>',
    '<nav>导航栏</nav>',
    '<p>第一段正文。</p>',
    '<p>第二段正文。</p>',
    '<footer>页脚</footer>',
    '</body></html>',
  ].join('');
  const { title, text } = extractReadableText(html);
  assert.equal(title, '测试标题');
  assert.ok(text.includes('第一段正文'));
  assert.ok(text.includes('第二段正文'));
  assert.ok(!text.includes('var x'), '脚本内容应被剥离');
  assert.ok(!text.includes('color: red'), '样式内容应被剥离');
  assert.ok(!text.includes('页脚'), '页脚应被剥离');
});

test('网页正文抽取解码常见 HTML 实体', () => {
  const { text } = extractReadableText('<p>a&nbsp;&amp;&lt;&gt;b</p>');
  assert.ok(text.includes('a &<>b'));
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

test('文档状态在无上下文时返回 ready=false', () => {
  assert.deepEqual(getDocumentContextStatus(null), {
    ready: false,
    charCount: 0,
    chunkCount: 0,
    fingerprint: '',
  });
});

test('文档指纹对相同内容稳定，对改动敏感', () => {
  const a = buildDocumentContext('完全相同的内容');
  const b = buildDocumentContext('完全相同的内容');
  const c = buildDocumentContext('完全相同的内容2');
  assert.equal(a.fingerprint, b.fingerprint);
  assert.notEqual(a.fingerprint, c.fingerprint);
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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
