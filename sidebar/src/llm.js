function getConfig(config = {}) {
  return {
    profileId: config.id || config.profileId || getStoredProfileId(),
    baseUrl: config.baseUrl || '',
    apiKey: config.apiKey || '',
    model: config.model || localStorage.getItem('llm_model') || 'gpt-4o-mini',
    reasoningEnabled: Boolean(config.reasoningEnabled),
    reasoningEffort: config.reasoningEffort || 'medium',
    timeoutMs: Number(config.timeoutMs) || 0,
    signal: config.signal || null,
  };
}

function getStoredProfileId() {
  const value = localStorage.getItem('llm_selected_profile') || '';
  if (!value.includes('::')) return value;
  return decodeURIComponent(value.split('::')[0] || '');
}

export function stripReasoningText(text) {
  return String(text || '')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/i, '')
    .replace(/<thinking\b[^>]*>[\s\S]*$/i, '')
    .replace(/<reasoning\b[^>]*>[\s\S]*$/i, '')
    .trim();
}

function readStreamContent(json) {
  const choice = json.choices?.[0] || {};
  const delta = choice.delta || {};
  const message = choice.message || {};
  return [
    delta.content,
    delta.text,
    message.content,
    json.content,
    json.response,
    json.text,
  ].find(value => typeof value === 'string' && value.length) || '';
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
  const { profileId, model, reasoningEnabled, reasoningEffort, timeoutMs, signal: externalSignal } = getConfig(config);
  const body = createBackendRequestBody(messages, profileId, model, reasoningEnabled, reasoningEffort, true);

  const requestSignal = createRequestSignal(externalSignal, timeoutMs);

  try {
    const response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: requestSignal.signal,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let visibleText = '';
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
          const content = readStreamContent(json);
          if (content) {
            fullText += content;
            const cleanedText = stripReasoningText(fullText);
            const visibleDelta = cleanedText.startsWith(visibleText)
              ? cleanedText.slice(visibleText.length)
              : cleanedText;
            visibleText = cleanedText;
            if (visibleDelta) onChunk(visibleDelta);
          }
        } catch {
          // 忽略解析失败的行（某些供应商会发送非 JSON 行）
        }
      }
    }

    return stripReasoningText(fullText);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(requestSignal.timedOut() ? '模型请求超时，请稍后重试或切换模型。' : '已停止生成。');
    }
    throw err;
  } finally {
    requestSignal.cleanup();
  }
}

export async function completeChat(messages, config) {
  const { profileId, model, reasoningEnabled, reasoningEffort, timeoutMs, signal: externalSignal } = getConfig(config);
  const body = createBackendRequestBody(messages, profileId, model, reasoningEnabled, reasoningEffort, false);

  const requestSignal = createRequestSignal(externalSignal, timeoutMs);

  let response;
  try {
    response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: requestSignal.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(requestSignal.timedOut() ? '模型请求超时，请稍后重试或切换模型。' : '已停止生成。');
    }
    throw err;
  } finally {
    requestSignal.cleanup();
  }

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const data = await response.json();
  if (data.ok === false) {
    throw new Error(data.error?.message || '后端 LLM 请求失败。');
  }
  return stripReasoningText(data.content);
}

function createBackendRequestBody(messages, profileId, model, reasoningEnabled, reasoningEffort, stream) {
  if (!model) {
    throw new Error('请先选择模型。');
  }

  const body = {
    profileId,
    model,
    stream,
    messages,
  };

  if (reasoningEnabled) {
    body.reasoningEnabled = true;
    body.reasoningEffort = reasoningEffort;
  }

  return body;
}

function createRequestSignal(externalSignal, timeoutMs) {
  const controller = new AbortController();
  const cleanupHandlers = [];
  let timeoutHit = false;

  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortFromExternal, { once: true });
      cleanupHandlers.push(() => externalSignal.removeEventListener('abort', abortFromExternal));
    }
  }

  let timeoutId = null;
  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timeoutHit = true;
      controller.abort();
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    timedOut: () => timeoutHit,
    cleanup: () => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanupHandlers.forEach(cleanup => cleanup());
    },
  };
}

export async function testLLMConfig(config) {
  const { profileId, baseUrl, apiKey, model, reasoningEnabled, reasoningEffort } = getConfig(config);

  if (!model) {
    throw new Error('请填写 Model Name。');
  }

  const response = await fetch('/api/llm/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      profileId,
      baseUrl,
      apiKey,
      reasoningEnabled,
      reasoningEffort,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const data = await response.json();
  if (data.ok === false) {
    throw new Error(data.error?.message || '后端 LLM 测试失败。');
  }
  return stripReasoningText(data.content) || 'OK';
}

async function readApiError(response) {
  const text = await response.text();
  const message = extractReadableError(text);
  return `API 请求失败 (${response.status}): ${message}`;
}

function extractReadableError(text) {
  const parsed = parseJsonObject(text);
  const message = parsed ? findErrorMessage(parsed) : String(text || '');
  const nested = extractNestedJsonMessage(message);
  const finalMessage = nested || message;
  const unknownModel = finalMessage.match(/unknown model ['"]([^'"]+)['"]/i);
  if (unknownModel) {
    return `模型不存在或当前账号不可用：${unknownModel[1]}`;
  }
  return finalMessage || '未知错误';
}

function extractNestedJsonMessage(message) {
  const jsonStart = String(message || '').indexOf('{');
  if (jsonStart < 0) return '';
  const parsed = parseJsonObject(String(message).slice(jsonStart));
  return parsed ? findErrorMessage(parsed) : '';
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(String(text || ''));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function findErrorMessage(value) {
  if (!value || typeof value !== 'object') return '';
  for (const key of ['message', 'error_msg', 'error_message', 'errmsg', 'msg', 'status_msg', 'detail']) {
    if (typeof value[key] === 'string') return value[key];
  }
  if (value.error) {
    const nested = findErrorMessage(value.error);
    if (nested) return nested;
  }
  return '';
}
