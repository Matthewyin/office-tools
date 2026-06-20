const PPT_ACTIONS = new Set([
  'chat',
  'web_search',
]);

export const pptAdapter = {
  mode: 'ppt',
  capabilities: {
    name: 'NSSA_PPT',
    wordActions: false,
    excelActions: false,
    previewActions: false,
    previewTitle: 'PPT 操作工具尚未接入',
    previewHint: 'PPT 当前只开放聊天和读取选区',
    placeholder: '输入问题，或先选中幻灯片内容后读取到输入框...',
    readSelectionTitle: '读取当前 PPT 选中内容到输入框',
    emptyState: '选择模型后开始处理演示内容。当前可聊天和读取选中内容，PPT 专属工具稍后接入。',
    contextIdle: '幻灯片：未读取',
    evidenceIdle: '内容：未使用',
  },
  hasDocumentPlanner: false,
  planner: {
    actionDescriptions: [],
    rules: [],
    examples: [
      '{"action":"chat"}',
      '{"action":"web_search","query":"查询词"}',
    ],
  },
  supportsAction(action) {
    return PPT_ACTIONS.has(action);
  },
  async dispatchAction(action, ctx) {
    if (!this.supportsAction(action.action)) return false;
    if (action.action === 'chat') return false;

    if (action.action === 'web_search') {
      if (!ctx.isWebSearchEnabled()) return false;
      await ctx.answerWithWebSearch(action.query || ctx.commandText);
      return true;
    }

    return false;
  },
};
