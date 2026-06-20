import process from 'process';
import http from 'http';
import https from 'https';

const baseUrl = normalizeBaseUrl(process.env.OFFICE_AGENT_BASE_URL || 'https://localhost:30030');
const timeoutMs = Number(process.env.OFFICE_AGENT_VERIFY_TIMEOUT_MS || 45000);
const conversationId = `verify-${Date.now()}`;
const state = {
  health: null,
};

await run('健康检查返回工具和搜索 Provider', async () => {
  const response = await request('/api/health');
  assert(response.status === 200, `期望 200，实际 ${response.status}`);
  assert(response.data.ok === true, '健康检查 ok 不是 true');
  assert(Array.isArray(response.data.tools), '健康检查没有返回 tools');
  assert(response.data.tools.includes('web_search'), '未注册 web_search 工具');
  assert(typeof response.data.llmConfigured === 'boolean', '健康检查没有返回 llmConfigured');
  state.health = response.data;
});

await run('工具列表包含 web_search', async () => {
  const response = await request('/api/tools');
  assert(response.status === 200, `期望 200，实际 ${response.status}`);
  const names = response.data.tools.map(tool => tool.name);
  assert(names.includes('web_search'), '工具列表缺少 web_search');
});

await run('LLM 配置接口不返回明文 Key', async () => {
  const response = await request('/api/llm/profiles');
  assert(response.status === 200, `期望 200，实际 ${response.status}`);
  assert(response.data.ok === true, 'LLM 配置接口 ok 不是 true');
  assert(Array.isArray(response.data.profiles), 'LLM 配置接口没有返回 profiles');
  for (const profile of response.data.profiles) {
    assert(!Object.hasOwn(profile, 'apiKey'), 'LLM 配置接口返回了 apiKey');
    assert(typeof profile.hasApiKey === 'boolean', 'LLM 配置接口缺少 hasApiKey');
  }
});

await run('不存在的接口返回统一错误', async () => {
  const response = await request('/api/not-found');
  assert(response.status === 404, `期望 404，实际 ${response.status}`);
  assert(response.data.ok === false, '错误响应 ok 不是 false');
  assert(response.data.error?.code === 'ROUTE_NOT_FOUND', '错误码不是 ROUTE_NOT_FOUND');
  assert(Boolean(response.data.requestId), '错误响应缺少 requestId');
});

await run('工具参数错误返回统一错误', async () => {
  const response = await request('/api/tools/call', {
    method: 'POST',
    body: {
      tool: 'web_search',
      input: {},
    },
  });
  assert(response.status === 400, `期望 400，实际 ${response.status}`);
  assert(response.data.error?.code === 'INVALID_TOOL_INPUT', '错误码不是 INVALID_TOOL_INPUT');
});

await run('普通聊天不触发搜索工具', async () => {
  const response = await request('/api/chat/with-tools', {
    method: 'POST',
    body: {
      conversationId,
      input: '你好',
      options: {
        webSearchEnabled: true,
      },
    },
  });
  assert(response.status === 200, `期望 200，实际 ${response.status}`);
  assert(response.data.mode === 'chat', `期望 chat，实际 ${response.data.mode}`);
  assert(response.data.toolEvidence.length === 0, '普通聊天不应返回工具证据');
});

await run('搜索意图触发工具并写入上下文', async () => {
  const response = await request('/api/chat/with-tools', {
    method: 'POST',
    body: {
      conversationId,
      input: '搜索 OpenAI 官方最新消息',
      options: {
        webSearchEnabled: true,
        maxResults: 1,
        includeAnswer: false,
      },
    },
  });
  assert(response.status === 200, `期望 200，实际 ${response.status}`);
  assert(response.data.mode === 'with_tools', `期望 with_tools，实际 ${response.data.mode}`);
  assert(response.data.toolEvidence.length === 1, '搜索没有返回工具证据');
  assert(response.data.toolEvidence[0].sources.length >= 1, '搜索证据没有来源');
  assert(response.data.context.toolCallCount >= 1, '上下文没有记录工具调用');
});

await run('上下文可读取并可清空', async () => {
  const contextResponse = await request(`/api/context?conversationId=${encodeURIComponent(conversationId)}`);
  assert(contextResponse.status === 200, `读取上下文期望 200，实际 ${contextResponse.status}`);
  assert(contextResponse.data.context.toolCalls.length >= 1, '读取到的工具调用为空');
  assert(contextResponse.data.context.webEvidence.length >= 1, '读取到的网页证据为空');

  const clearResponse = await request(`/api/context?conversationId=${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  });
  assert(clearResponse.status === 200, `清空上下文期望 200，实际 ${clearResponse.status}`);
  assert(clearResponse.data.context.toolCalls.length === 0, '清空后工具调用仍存在');
  assert(clearResponse.data.context.webEvidence.length === 0, '清空后网页证据仍存在');
});

if (state.health?.llmConfigured) {
  await run('LLM 后端代理可测试', async () => {
    const response = await request('/api/llm/test', {
      method: 'POST',
      body: {
        model: state.health.llmModel || 'gpt-4o-mini',
      },
    });
    assert(response.status === 200, `期望 200，实际 ${response.status}`);
    assert(response.data.ok === true, 'LLM 测试 ok 不是 true');
    assert(typeof response.data.content === 'string' && response.data.content.length > 0, 'LLM 测试没有返回内容');
  });
} else {
  console.log('跳过：LLM 后端代理未配置');
}

console.log(`\n验证完成：${baseUrl}`);
console.log(`搜索 Provider：${state.health?.searchProvider || '未知'}`);
console.log(`LLM 代理：${state.health?.llmConfigured ? '已配置' : '未配置'}`);

async function run(name, task) {
  try {
    await task();
    console.log(`通过：${name}`);
  } catch (error) {
    console.error(`失败：${name}`);
    console.error(error.message);
    process.exitCode = 1;
    throw error;
  }
}

async function request(pathname, options = {}) {
  const url = new URL(pathname, baseUrl);
  const transport = url.protocol === 'https:' ? https : http;
  const body = options.body ? JSON.stringify(options.body) : '';

  return await new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: options.method || 'GET',
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      } : {},
      rejectUnauthorized: shouldVerifyCertificate(url),
      timeout: timeoutMs,
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: response.statusCode || 0,
            data: text ? JSON.parse(text) : {},
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`请求超时：${pathname}`));
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function shouldVerifyCertificate(url) {
  if (url.protocol !== 'https:') return undefined;
  return !(url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}
