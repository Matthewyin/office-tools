// 从 localStorage 读取用户配置，调用方也可以传入当前选择的模型配置。
function getConfig(config = {}) {
  return {
    baseUrl: config.baseUrl || localStorage.getItem('llm_base_url') || 'https://api.openai.com/v1',
    apiKey: config.apiKey || localStorage.getItem('llm_api_key') || '',
    model: config.model || localStorage.getItem('llm_model') || 'gpt-4o-mini',
  };
}

/**
 * 流式调用 LLM（SSE 格式）
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {(chunk: string) => void} onChunk - 每收到一个 token 调用一次
 * @returns {Promise<string>} 完整的回复文本
 */
export async function streamLLM(systemPrompt, userPrompt, onChunk, config) {
  return streamChat([
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: userPrompt },
  ], onChunk, config);
}

export async function streamChat(messages, onChunk, config) {
  const { baseUrl, apiKey, model } = getConfig(config);

  if (!apiKey) {
    throw new Error('请先在设置中填写 API Key。');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 按行切割，解析 SSE 数据
    const lines = buffer.split('\n');
    buffer = lines.pop(); // 保留最后一个可能不完整的行

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6)); // 去掉 "data: "
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      } catch {
        // 忽略解析失败的行（某些供应商会发送非 JSON 行）
      }
    }
  }

  return fullText;
}
