import { streamChat, stripReasoningText } from '../llm.js';
import {
  createExcelAnalysisSheet,
  getSelectedText,
} from '../office-actions.js';

export function createExcelActions(deps) {
  async function previewExcelAnalysisToSheet(commandText, fromChat) {
    let selectionText = '';
    try {
      selectionText = await getSelectedText(deps.getCurrentHost());
    } catch (err) {
      deps.addMessage('assistant', `读取选区失败: ${err.message}`, { error: true });
      return;
    }

    if (!selectionText.trim()) {
      deps.addMessage('assistant', '请先选中要分析的单元格区域。', { error: true });
      return;
    }

    deps.setPendingAction({
      type: 'excel-analysis-to-sheet',
      instruction: commandText,
      selectionText,
    });
    document.getElementById('btn-confirm-action').disabled = false;
    deps.showActionPreview([
      'Excel 新建分析工作表',
      '将读取当前选区，生成分析报告。',
      '确认后会创建新的工作表“AI 分析”，原工作表不会被修改。',
    ].join('\n'));

    if (fromChat) {
      deps.addMessage('assistant', '已准备创建 Excel 分析工作表，请确认后执行。');
    }
  }

  async function confirmExcelPendingAction(action) {
    if (action.type !== 'excel-analysis-to-sheet') return false;

    const analysisText = await generateExcelAnalysis(action);
    const sheetName = await createExcelAnalysisSheet(analysisText);
    deps.addMessage('assistant', `已写入工作表：${sheetName}`);
    deps.showToast(`已创建工作表：${sheetName}`);
    return true;
  }

  async function generateExcelAnalysis(action) {
    const assistantMessage = deps.addMessage('assistant', '', { pending: true });
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
      deps.scheduleMessageContentRender(assistantMessage);
    }, deps.getActiveModelConfig());

    assistantMessage.content = stripReasoningText(fullText || assistantMessage.content);
    assistantMessage.pending = false;
    deps.renderChatMessages();
    deps.saveChatState();
    return assistantMessage.content;
  }

  return {
    confirmExcelPendingAction,
    previewExcelAnalysisToSheet,
  };
}
