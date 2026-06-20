import {
  isExcelAnalysisSheetCommand,
  isLikelyDocumentActionCommand,
  isWebSearchCommand,
  isWordDocumentQuestionCommand,
  isWordDocumentReviewCommand,
  isWordDocumentSummaryCommand,
  isWordInsertCommand,
  parsePlannerJson,
  parseReplaceCommand,
  shouldUsePlannerForPrompt,
  validatePlannedAction,
} from './command-parser.js';
import { completeChat } from './llm.js';
import { getSelectedText } from './office-actions.js';

export function createHostActionRouter(deps) {
  let lastPlannerIssue = '';

  async function previewActionFromPrompt(commandText, fromChat) {
    if (!commandText) return false;

    if (deps.appCapabilities.wordActions && isWordInsertCommand(commandText)) {
      if (deps.getCurrentHost() !== 'Word') {
        deps.addMessage('assistant', '当前不是 Word，无法写入文档。', { error: true });
        return true;
      }
      await deps.wordActions.generateAndInsertWordContent(commandText);
      return true;
    }

    if (shouldPlanAction(commandText)) {
      const plannedAction = await planDocumentAction(commandText);
      if (plannedAction) {
        const handled = await executePlannedAction(plannedAction, commandText, fromChat);
        if (handled) return true;
      }
    }

    if (deps.isWebSearchEnabled() && isWebSearchCommand(commandText)) {
      await deps.answerWithWebSearch(commandText);
      return true;
    }

    // 本地解析只做 LLM 计划失败时的兜底，不作为主要能力边界。
    if (deps.appCapabilities.wordActions && deps.getCurrentHost() === 'Word') {
      const parsed = parseReplaceCommand(commandText);
      if (parsed) {
        await deps.wordActions.previewWordReplace(parsed, fromChat);
        return true;
      }

      if (isWordDocumentSummaryCommand(commandText)) {
        await deps.wordActions.processWholeWordDocument('summary', commandText);
        return true;
      }

      if (isWordDocumentReviewCommand(commandText)) {
        await deps.wordActions.processWholeWordDocument('review', commandText);
        return true;
      }

      if (isWordDocumentQuestionCommand(commandText)) {
        await deps.wordActions.answerWordDocumentQuestion(commandText);
        return true;
      }
    }

    if (deps.appCapabilities.excelActions && deps.getCurrentHost() === 'Excel' && isExcelAnalysisSheetCommand(commandText)) {
      await deps.excelActions.previewExcelAnalysisToSheet(commandText, fromChat);
      return true;
    }

    if (lastPlannerIssue && isLikelyDocumentActionCommand(commandText)) {
      deps.showToast(`操作规划失败：${lastPlannerIssue}，已转为普通聊天`);
    }

    return false;
  }

  function shouldPlanAction(commandText) {
    if (deps.hostAdapter.hasDocumentPlanner) {
      return shouldUsePlannerForPrompt(commandText, { webSearchEnabled: deps.isWebSearchEnabled() });
    }
    return deps.isWebSearchEnabled() && isWebSearchCommand(commandText);
  }

  async function planDocumentAction(commandText) {
    lastPlannerIssue = '';
    try {
      const selectionContext = await getPlannerSelectionContext();
      const webSearchEnabled = deps.isWebSearchEnabled();
      const responseText = await completeChat([
        {
          role: 'system',
          content: [
            '你是 Office 加载项的操作规划器，只输出 JSON，不要输出解释。',
            '根据用户输入判断是否要直接操作当前 Office 文档。',
            '可用 action：',
            'chat：普通聊天或无法确定操作。',
            ...deps.hostAdapter.planner.actionDescriptions,
            webSearchEnabled
              ? 'web_search：使用后端搜索工具查询网页资料，适用于最新资料、外部事实、新闻、政策、价格、联网查询，必须给出 query。'
              : '网页搜索当前关闭；即使用户要求联网查询，也输出 {"action":"chat"}。',
            `输出格式示例：${deps.hostAdapter.planner.examples.join('、')}。`,
            ...deps.hostAdapter.planner.rules,
            webSearchEnabled ? '用户明确要求搜索网页、联网查询、查最新或查外部资料时，使用 web_search，不要使用普通 chat。' : '',
          ].filter(Boolean).join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            host: deps.getCurrentHost(),
            input: commandText,
            ...selectionContext,
          }),
        },
      ], deps.getActiveModelConfig());
      const action = parsePlannerJson(responseText);
      const validation = validatePlannedAction(action, {
        currentHost: deps.getCurrentHost(),
        webSearchEnabled: deps.isWebSearchEnabled(),
      });
      if (!validation.valid) {
        console.warn('操作计划无效:', validation.reason, action);
        lastPlannerIssue = validation.reason;
        return null;
      }
      return action;
    } catch (err) {
      console.warn('操作规划失败:', err);
      lastPlannerIssue = err.message || '模型未返回有效计划';
      return null;
    }
  }

  async function getPlannerSelectionContext() {
    if (deps.getCurrentHost() !== 'Word') return {};

    try {
      const selectionText = await getSelectedText(deps.getCurrentHost());
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
    return await deps.hostAdapter.dispatchAction(action, {
      answerWithWebSearch: deps.answerWithWebSearch,
      commandText,
      excelActions: deps.excelActions,
      fromChat,
      getCurrentHost: deps.getCurrentHost,
      isWebSearchEnabled: deps.isWebSearchEnabled,
      wordActions: deps.wordActions,
    });
  }

  return {
    previewActionFromPrompt,
  };
}
