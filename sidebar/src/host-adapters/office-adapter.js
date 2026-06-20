import { wordAdapter } from './word-adapter.js';
import { excelAdapter } from './excel-adapter.js';

const OFFICE_ACTIONS = new Set([
  'chat',
  'web_search',
  'word_replace',
  'word_rewrite_selection',
  'word_insert',
  'word_summarize_document',
  'word_review_document',
  'word_document_qa',
  'excel_analysis_sheet',
]);

export const officeAdapter = {
  mode: 'office',
  capabilities: {
    name: 'NSSA_Office',
    wordActions: true,
    excelActions: true,
    previewActions: true,
    previewTitle: '预览会修改文档的操作，不会立即执行',
    previewHint: '请输入可预览的 Word 替换或 Excel 新表分析指令',
    placeholder: '输入问题，或输入“找到文档中的XX，替换为YY”...',
    readSelectionTitle: '读取当前 Word/Excel/PPT 选中内容到输入框',
    emptyState: '选择模型后开始聊天。可读取文档选区，也可以输入查找替换指令。',
    contextIdle: '文档：未索引',
    evidenceIdle: '段落：未使用',
  },
  hasDocumentPlanner: true,
  planner: {
    actionDescriptions: [
      ...wordAdapter.planner.actionDescriptions,
      ...excelAdapter.planner.actionDescriptions,
    ],
    rules: [
      ...wordAdapter.planner.rules,
    ],
    examples: [
      '{"action":"chat"}',
      '{"action":"word_replace","searchText":"A","replacementText":"B"}',
      '{"action":"word_rewrite_selection","instruction":"润色当前选区"}',
      '{"action":"excel_analysis_sheet","instruction":"分析当前选区"}',
      '{"action":"web_search","query":"查询词"}',
    ],
  },
  supportsAction(action) {
    return OFFICE_ACTIONS.has(action);
  },
  async dispatchAction(action, ctx) {
    if (!this.supportsAction(action.action)) return false;
    if (action.action === 'chat') return false;

    if (action.action === 'web_search') {
      if (!ctx.isWebSearchEnabled()) return false;
      await ctx.answerWithWebSearch(action.query || ctx.commandText);
      return true;
    }

    if (ctx.getCurrentHost() === 'Word') {
      return await wordAdapter.dispatchAction(action, ctx);
    }

    if (ctx.getCurrentHost() === 'Excel') {
      return await excelAdapter.dispatchAction(action, ctx);
    }

    return false;
  },
};
