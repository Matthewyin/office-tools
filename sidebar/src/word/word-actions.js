import { clearDocumentContext } from '../document-context.js';
import { completeChat, streamChat, stripReasoningText } from '../llm.js';
import {
  getSelectedText,
  getWordBodyOoxmlSnapshot,
  getWordBodyText,
  insertText,
  previewWordMatches,
  replaceWordMatches,
  replaceWordSelection,
  restoreWordBodyOoxmlSnapshot,
} from '../office-actions.js';
import { isAbortError } from '../../../packages/frontend-shared/src/abort-utils.js';

export function createWordActions(deps) {
  function resetDocumentUsage() {
    clearDocumentContext();
    deps.setLastDocumentEvidence([]);
    deps.renderContextStatus();
  }

  async function generateAndInsertWordContent(commandText) {
    const assistantMessage = deps.addMessage('assistant', '正在生成可写入的正文...', { pending: true });
    const waitingTimer = setTimeout(() => {
      if (assistantMessage.pending && assistantMessage.content === '正在生成可写入的正文...') {
        assistantMessage.content = '已连接模型，正在等待正文返回...';
        deps.renderChatMessages();
      }
    }, 8000);

    try {
      let hasVisibleChunk = false;
      const writableText = await generateWritableWordText(commandText, (chunk) => {
        if (!hasVisibleChunk) {
          assistantMessage.content = '';
          hasVisibleChunk = true;
        }
        assistantMessage.content += chunk;
        deps.scheduleMessageContentRender(assistantMessage);
      });
      assistantMessage.content = writableText;
      assistantMessage.pending = false;
      deps.renderChatMessages();

      await captureWordRollbackSnapshot('撤销写入文档', '写入前备份失败，未写入 Word 文档，避免无法撤销。');
      await insertText(deps.getCurrentHost(), writableText);
      resetDocumentUsage();
      deps.addMessage('assistant', '已写入 Word 文档。\n\n如需恢复，可输入“撤销上次操作”。');
      deps.showToast('已写入文档');
    } catch (err) {
      assistantMessage.content = isAbortError(err)
        ? `${assistantMessage.content || '已停止生成。'}\n\n已停止，未写入 Word 文档。`
        : formatWordWriteFailure(err);
      assistantMessage.pending = false;
      assistantMessage.error = !isAbortError(err);
      deps.renderChatMessages();
      deps.saveChatState();
      deps.showToast(isAbortError(err) ? '已停止，未写入 Word 文档' : `写入失败: ${err.message}`);
    } finally {
      clearTimeout(waitingTimer);
    }
  }

  async function generateWritableWordText(commandText, onChunk) {
    const systemPrompt = [
      '你是专业的 Word 文档写作助手。',
      '只输出要写入 Word 的最终正文。',
      '不要输出思考过程、解释、代码块、JSON、Markdown 标记、寒暄或确认语。',
      '如果用户要求创作诗词，直接输出标题和正文。',
    ].join('\n');
    const firstText = await streamChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请根据以下指令生成可直接插入 Word 的正文：\n\n${commandText}` },
    ], onChunk, deps.getWritingModelConfig());
    const cleanedFirstText = stripReasoningText(firstText).trim();
    if (cleanedFirstText) return cleanedFirstText;

    const retryText = await completeChat([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          '上一次没有得到可写入正文。请重新生成。',
          '只返回正文内容，不要返回任何过程、说明或标签。',
          '',
          `用户指令：${commandText}`,
        ].join('\n'),
      },
    ], deps.getWritingModelConfig());
    const cleanedRetryText = stripReasoningText(retryText).trim();
    if (cleanedRetryText) return cleanedRetryText;

    throw new Error('模型没有返回可写入的正文。');
  }

  async function captureWordRollbackSnapshot(label, failureMessage) {
    try {
      const snapshot = await getWordBodyOoxmlSnapshot();
      deps.setLastRollback({
        type: 'word-body-ooxml',
        label,
        snapshot,
      });
      return snapshot;
    } catch {
      deps.setLastRollback(null);
      throw new Error(failureMessage);
    }
  }

  function formatWordFailure(prefix, err) {
    const base = `${prefix}: ${err.message}`;
    if (!deps.getLastRollback()) return base;
    return `${base}\n\n已保留修改前快照。如果 Word 文档已经发生变化，可输入“撤销上次操作”尝试恢复。`;
  }

  function formatWordWriteFailure(err) {
    return formatWordFailure('写入失败', err);
  }

  async function processWholeWordDocument(mode, instruction) {
    const assistantMessage = deps.addMessage('assistant', '正在读取 Word 正文...', { pending: true });

    try {
      const bodyText = await getWordBodyText();
      if (!String(bodyText || '').trim()) {
        throw new Error('当前 Word 文档没有可读取的正文内容。');
      }

      resetDocumentUsage();
      assistantMessage.content = '已交给后端并发处理整篇文档，请稍候...';
      deps.renderChatMessages();

      const data = await fetch('/api/document/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: deps.getAbortSignal(),
        body: JSON.stringify({
          text: bodyText,
          instruction,
          mode,
          ...deps.getActiveModelSelectionForBackend(),
        }),
      }).then(res => res.json());

      if (!data.ok || typeof data.content !== 'string') {
        throw new Error(data.error?.message || `整篇文档处理失败 (${data.error?.code || '未知错误'})`);
      }

      assistantMessage.content = data.content;
      assistantMessage.pending = false;
      deps.renderChatMessages();
      deps.saveChatState();
    } catch (err) {
      assistantMessage.content = isAbortError(err)
        ? '已停止处理整篇文档。'
        : `整篇文档处理失败: ${err.message}`;
      assistantMessage.pending = false;
      assistantMessage.error = !isAbortError(err);
      assistantMessage.aborted = isAbortError(err);
      deps.renderChatMessages();
      deps.saveChatState();
    }
  }

  async function answerWordDocumentQuestion(question) {
    const assistantMessage = deps.addMessage('assistant', '正在检索 Word 文档上下文...', { pending: true });

    try {
      const bodyText = await getWordBodyText();
      if (!String(bodyText || '').trim()) {
        throw new Error('当前 Word 文档没有可读取的正文内容。');
      }

      const searchResponse = await fetch('/api/document/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: deps.getAbortSignal(),
        body: JSON.stringify({
          text: bodyText,
          query: question,
          limit: 5,
          ...deps.getActiveModelSelectionForBackend(),
        }),
      }).then(res => res.json());

      if (!searchResponse.ok) {
        throw new Error(searchResponse.error?.message || '文档检索失败。');
      }

      const matches = Array.isArray(searchResponse.matches) ? searchResponse.matches : [];
      const relatedText = searchResponse.evidenceText || '';
      const charCount = searchResponse.status?.charCount || bodyText.length;
      const chunkCount = searchResponse.status?.chunkCount || 0;
      deps.setLastDocumentEvidence(matches.map(match => ({ index: match.index, heading: match.heading })));
      deps.renderContextStatus();

      assistantMessage.content = `已检索到 ${matches.length} 个相关段落，正在回答...`;
      deps.renderChatMessages();

      const fullText = await streamChat([
        {
          role: 'system',
          content: [
            '你是 Word 文档问答助手。',
            '请只基于给定的相关段落回答，不要编造文档中没有的信息。',
            '如果相关段落证据不足，请明确说明“不足以从当前相关段落判断”。',
            '回答要简洁，并在必要时指出依据来自哪些分段。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `用户问题：${question}`,
            `文档规模：约 ${charCount} 字，${chunkCount} 个分段`,
            '',
            '相关段落：',
            relatedText,
          ].join('\n'),
        },
      ], (chunk) => {
        assistantMessage.content += chunk;
        deps.scheduleMessageContentRender(assistantMessage);
      }, deps.getActiveModelConfig());

      assistantMessage.content = [
        `已基于 ${matches.length} 个相关段落回答。`,
        '',
        stripReasoningText(fullText || assistantMessage.content.replace(/^已检索到.*?正在回答\.\.\./, '').trim()),
      ].join('\n');
      assistantMessage.pending = false;
      deps.renderChatMessages();
      deps.saveChatState();
    } catch (err) {
      assistantMessage.content = isAbortError(err)
        ? (assistantMessage.content || '已停止文档问答。')
        : `文档问答失败: ${err.message}`;
      assistantMessage.pending = false;
      assistantMessage.error = !isAbortError(err);
      assistantMessage.aborted = isAbortError(err);
      deps.renderChatMessages();
      deps.saveChatState();
    }
  }

  async function handleRollbackCommand(input) {
    if (!/(撤销|回滚|恢复)(上次|刚才|最近)?(操作|修改|写入|替换)?/.test(input)) {
      return false;
    }
    const lastRollback = deps.getLastRollback();
    if (!lastRollback) {
      deps.addMessage('assistant', '没有可撤销的上一次文档操作。', { error: true });
      return true;
    }
    if (lastRollback.type !== 'word-body-ooxml') {
      deps.addMessage('assistant', '当前上一次操作暂不支持撤销。', { error: true });
      return true;
    }

    try {
      await restoreWordBodyOoxmlSnapshot(lastRollback.snapshot);
      resetDocumentUsage();
      deps.addMessage('assistant', `已执行：${lastRollback.label}`);
      deps.setLastRollback(null);
      deps.showToast('已撤销上次操作');
    } catch (err) {
      deps.addMessage('assistant', `撤销失败: ${err.message}`, { error: true });
    }
    return true;
  }

  async function previewWordReplace(parsed, fromChat) {
    const previewBtn = document.getElementById('btn-preview-action');
    previewBtn.disabled = true;
    try {
      const preview = await previewWordMatches(parsed.searchText, parsed.replacementText);
      deps.setPendingAction({
        type: 'word-replace',
        searchText: parsed.searchText,
        replacementText: parsed.replacementText,
        count: preview.count,
        preview,
      });

      const confirmBtn = document.getElementById('btn-confirm-action');
      confirmBtn.disabled = preview.count === 0;
      deps.showActionPreview([
        'Word 查找替换',
        `查找内容：${parsed.searchText}`,
        `替换为：${parsed.replacementText || '（空文本）'}`,
        `作用范围：${preview.scope}`,
        `预计影响：${preview.count} 处匹配`,
        '',
        ...deps.formatDiffExamples(preview.examples),
      ].join('\n'));

      if (fromChat) {
        deps.addMessage('assistant', preview.count > 0
          ? `已识别为 Word 查找替换操作，作用范围：${preview.scope}，预计影响 ${preview.count} 处。请确认后执行。`
          : `已识别为 Word 查找替换操作，但${preview.scope}中没有匹配内容。`);
      }
    } catch (err) {
      deps.addMessage('assistant', `预览失败: ${err.message}`, { error: true });
    } finally {
      previewBtn.disabled = false;
    }
  }

  async function previewWordSelectionRewrite(instruction, fromChat) {
    const previewBtn = document.getElementById('btn-preview-action');
    previewBtn.disabled = true;
    const assistantMessage = fromChat
      ? deps.addMessage('assistant', '正在生成 Word 选区改写预览...', { pending: true })
      : null;

    try {
      const selectionText = await getSelectedText(deps.getCurrentHost());
      if (!selectionText.trim()) {
        if (assistantMessage) {
          assistantMessage.content = '请先在 Word 中选中要改写的文本。';
          assistantMessage.pending = false;
          assistantMessage.error = true;
          deps.renderChatMessages();
          deps.saveChatState();
        } else {
          deps.addMessage('assistant', '请先在 Word 中选中要改写的文本。', { error: true });
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
      ], deps.getActiveModelConfig());

      if (!rewrittenText.trim()) {
        throw new Error('模型没有返回可写入的文本。');
      }

      deps.setPendingAction({
        type: 'word-selection-rewrite',
        instruction,
        originalText: selectionText,
        replacementText: rewrittenText.trim(),
      });

      document.getElementById('btn-confirm-action').disabled = false;
      deps.showActionPreview([
        'Word 选区改写',
        `改写要求：${instruction}`,
        '作用范围：当前选区',
        '',
        ...deps.formatRewritePreview(selectionText, rewrittenText.trim()),
      ].join('\n'));

      if (assistantMessage) {
        assistantMessage.content = '已生成 Word 选区改写预览，请确认后执行。';
        assistantMessage.pending = false;
        deps.renderChatMessages();
        deps.saveChatState();
      }
    } catch (err) {
      if (assistantMessage) {
        assistantMessage.content = isAbortError(err) ? '已停止生成 Word 选区改写预览。' : `预览失败: ${err.message}`;
        assistantMessage.pending = false;
        assistantMessage.error = !isAbortError(err);
        deps.renderChatMessages();
        deps.saveChatState();
      } else {
        deps.addMessage('assistant', isAbortError(err) ? '已停止生成 Word 选区改写预览。' : `预览失败: ${err.message}`, { error: !isAbortError(err) });
      }
    } finally {
      previewBtn.disabled = false;
    }
  }

  async function confirmWordPendingAction(action) {
    if (action.type === 'word-replace') {
      await captureWordRollbackSnapshot(
        `撤销替换：${action.searchText} → ${action.replacementText}`,
        '替换前备份失败，未修改 Word 文档，避免无法撤销。'
      );
      const replaced = await replaceWordMatches(action.searchText, action.replacementText);
      resetDocumentUsage();
      deps.addMessage('assistant', [
        '已完成 Word 查找替换。',
        '',
        `查找内容：${action.searchText}`,
        `替换为：${action.replacementText || '（空文本）'}`,
        `作用范围：${replaced.scope}`,
        `实际替换：${replaced.count} 处`,
        '',
        '如需恢复，可输入“撤销上次操作”。',
      ].join('\n'));
      deps.showToast('替换完成');
      return true;
    }

    if (action.type === 'word-selection-rewrite') {
      await captureWordRollbackSnapshot('撤销选区改写', '改写前备份失败，未修改 Word 文档，避免无法撤销。');
      const result = await replaceWordSelection(action.replacementText);
      resetDocumentUsage();
      deps.addMessage('assistant', [
        '已完成 Word 选区改写。',
        '',
        `改写要求：${action.instruction}`,
        `作用范围：${result.scope}`,
        '',
        '如需恢复，可输入“撤销上次操作”。',
      ].join('\n'));
      deps.showToast('改写完成');
      return true;
    }

    return false;
  }

  return {
    answerWordDocumentQuestion,
    confirmWordPendingAction,
    formatWordFailure,
    generateAndInsertWordContent,
    handleRollbackCommand,
    previewWordReplace,
    previewWordSelectionRewrite,
    processWholeWordDocument,
  };
}
