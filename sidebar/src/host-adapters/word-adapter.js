const WORD_ACTIONS = new Set([
  'chat',
  'web_search',
  'word_replace',
  'word_rewrite_selection',
  'word_insert',
  'word_summarize_document',
  'word_review_document',
  'word_document_qa',
]);

export const wordAdapter = {
  mode: 'word',
  capabilities: {
    name: 'NSSA_Word',
    wordActions: true,
    excelActions: false,
    previewActions: true,
    previewTitle: '预览会修改 Word 文档的操作，不会立即执行',
    previewHint: '请输入可预览的 Word 替换、改写、总结或审稿指令',
    placeholder: '输入问题，或输入“总结这篇文章”“找到文档中的XX，替换为YY”...',
    readSelectionTitle: '读取当前 Word 选中内容到输入框',
    emptyState: '选择模型后开始处理 Word 文档。可读取选区，也可以输入总结、审稿、替换或写入指令。',
    contextIdle: '文档：未索引',
    evidenceIdle: '段落：未使用',
  },
  hasDocumentPlanner: true,
  planner: {
    actionDescriptions: [
      'word_replace：替换 Word 正文中的文本，必须给出 searchText 和 replacementText。',
      'word_rewrite_selection：改写 Word 当前选区，适用于润色、缩短、扩写、改正式、翻译等，必须给出 instruction。',
      'word_insert：在 Word 当前光标或选区写入新内容，必须给出 instruction。',
      'word_summarize_document：总结或介绍 Word 整篇文档，适用于总结全文、总结这篇文章、介绍这首词、分析当前文档、提炼大纲，必须给出 instruction。',
      'word_review_document：审稿 Word 整篇文档，适用于检查全文问题、错别字、逻辑问题、结构反馈，必须给出 instruction。',
      'word_document_qa：基于 Word 文档回答具体问题，适用于询问文中某处、某个概念、背景、原因、人物、观点，必须给出 question。',
    ],
    rules: [
      '不要把“文档中的”“正文里的”等位置描述放入 searchText。',
      '用户要求润色、缩短、扩写、改正式、翻译当前内容，且 hasSelection 为 true 时，优先使用 word_rewrite_selection。',
      '当前是 Word 时，用户要求写一篇、写一段、生成、创作、起草、撰写正文内容，即使没有明确说“插入文档”，也使用 word_insert。',
      '用户明确要求总结、概括、提炼大纲、审稿、检查全文或反馈整篇文档时，使用对应的整篇文档 action，不要使用 chat。',
      '用户基于当前文档追问具体信息时，使用 word_document_qa，不要使用普通 chat。',
    ],
    examples: [
      '{"action":"chat"}',
      '{"action":"word_replace","searchText":"A","replacementText":"B"}',
      '{"action":"word_rewrite_selection","instruction":"润色当前选区"}',
      '{"action":"word_insert","instruction":"写一段会议纪要"}',
      '{"action":"web_search","query":"查询词"}',
    ],
  },
  supportsAction(action) {
    return WORD_ACTIONS.has(action);
  },
  async dispatchAction(action, ctx) {
    if (!this.supportsAction(action.action)) return false;
    if (action.action === 'chat') return false;

    if (action.action === 'web_search') {
      if (!ctx.isWebSearchEnabled()) return false;
      await ctx.answerWithWebSearch(action.query || ctx.commandText);
      return true;
    }

    if (ctx.getCurrentHost() !== 'Word') return false;

    if (action.action === 'word_replace') {
      await ctx.wordActions.previewWordReplace({
        searchText: action.searchText,
        replacementText: action.replacementText,
      }, ctx.fromChat);
      return true;
    }

    if (action.action === 'word_rewrite_selection') {
      await ctx.wordActions.previewWordSelectionRewrite(action.instruction || ctx.commandText, ctx.fromChat);
      return true;
    }

    if (action.action === 'word_insert') {
      await ctx.wordActions.generateAndInsertWordContent(action.instruction || ctx.commandText);
      return true;
    }

    if (action.action === 'word_summarize_document') {
      await ctx.wordActions.processWholeWordDocument('summary', action.instruction || ctx.commandText);
      return true;
    }

    if (action.action === 'word_review_document') {
      await ctx.wordActions.processWholeWordDocument('review', action.instruction || ctx.commandText);
      return true;
    }

    if (action.action === 'word_document_qa') {
      await ctx.wordActions.answerWordDocumentQuestion(action.question || ctx.commandText);
      return true;
    }

    return false;
  },
};
