const EXCEL_ACTIONS = new Set([
  'chat',
  'web_search',
  'excel_analysis_sheet',
]);

export const excelAdapter = {
  mode: 'excel',
  capabilities: {
    name: 'NSSA_Excel',
    wordActions: false,
    excelActions: true,
    previewActions: true,
    previewTitle: '预览会写入 Excel 的分析操作，不会立即执行',
    previewHint: '请输入可预览的 Excel 新表分析指令',
    placeholder: '输入问题，或先选中单元格后输入“分析当前选区并新建工作表”...',
    readSelectionTitle: '读取当前 Excel 选中区域到输入框',
    emptyState: '选择模型后开始分析 Excel。可读取选中区域，也可以让助手基于表格内容生成分析。',
    contextIdle: '表格：未读取',
    evidenceIdle: '区域：未使用',
  },
  hasDocumentPlanner: true,
  planner: {
    actionDescriptions: [
      'excel_analysis_sheet：读取 Excel 当前选区并创建分析工作表，必须给出 instruction。',
    ],
    rules: [],
    examples: [
      '{"action":"chat"}',
      '{"action":"excel_analysis_sheet","instruction":"分析当前选区"}',
      '{"action":"web_search","query":"查询词"}',
    ],
  },
  supportsAction(action) {
    return EXCEL_ACTIONS.has(action);
  },
  async dispatchAction(action, ctx) {
    if (!this.supportsAction(action.action)) return false;
    if (action.action === 'chat') return false;

    if (action.action === 'web_search') {
      if (!ctx.isWebSearchEnabled()) return false;
      await ctx.answerWithWebSearch(action.query || ctx.commandText);
      return true;
    }

    if (ctx.getCurrentHost() !== 'Excel') return false;

    if (action.action === 'excel_analysis_sheet') {
      await ctx.excelActions.previewExcelAnalysisToSheet(action.instruction || ctx.commandText, ctx.fromChat);
      return true;
    }

    return false;
  },
};
