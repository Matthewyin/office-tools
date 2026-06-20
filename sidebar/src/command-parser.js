export function parsePlannerJson(text) {
  const cleaned = String(text || '')
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function validatePlannedAction(action, options = {}) {
  const currentHost = options.currentHost || '';
  const webSearchEnabled = Boolean(options.webSearchEnabled);

  if (!action || typeof action !== 'object') {
    return { valid: false, reason: '计划不是对象' };
  }
  if (typeof action.action !== 'string') {
    return { valid: false, reason: '缺少 action' };
  }
  if (action.action === 'chat') {
    return { valid: true };
  }
  if (action.action === 'web_search') {
    if (!webSearchEnabled) return { valid: false, reason: '网页搜索已关闭' };
    if (typeof action.query !== 'string' || !action.query.trim()) {
      return { valid: false, reason: '缺少 query' };
    }
    action.query = action.query.trim();
    return { valid: true };
  }
  if (action.action === 'word_replace') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.searchText !== 'string' || !action.searchText.trim()) {
      return { valid: false, reason: '缺少 searchText' };
    }
    if (typeof action.replacementText !== 'string') {
      return { valid: false, reason: '缺少 replacementText' };
    }
    action.searchText = action.searchText.trim();
    action.replacementText = action.replacementText.trim();
    return { valid: true };
  }
  if (action.action === 'word_rewrite_selection') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  if (action.action === 'word_insert') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  if (action.action === 'word_summarize_document' || action.action === 'word_review_document') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  if (action.action === 'word_document_qa') {
    if (currentHost !== 'Word') return { valid: false, reason: '当前不是 Word' };
    if (typeof action.question !== 'string' || !action.question.trim()) {
      return { valid: false, reason: '缺少 question' };
    }
    action.question = action.question.trim();
    return { valid: true };
  }
  if (action.action === 'excel_analysis_sheet') {
    if (currentHost !== 'Excel') return { valid: false, reason: '当前不是 Excel' };
    if (typeof action.instruction !== 'string' || !action.instruction.trim()) {
      return { valid: false, reason: '缺少 instruction' };
    }
    action.instruction = action.instruction.trim();
    return { valid: true };
  }
  return { valid: false, reason: `未知 action: ${action.action}` };
}

export function isExcelAnalysisSheetCommand(input) {
  return /分析/.test(input) && /(新建|创建|生成|写入).*(sheet|工作表|表页|表)/i.test(input);
}

export function isLikelyDocumentActionCommand(input) {
  return /(替换|改成|修改|润色|缩短|扩写|翻译|写入|插入|生成|总结|概括|审稿|检查|校对|分析|新建|创建)/.test(input);
}

export function isWebSearchCommand(input) {
  return /(搜索|联网|网页|查一下|查找资料|查资料|最新|新闻|资料来源|外部资料|网上|政策|价格|官网)/.test(input);
}

export function shouldUsePlannerForPrompt(input, options = {}) {
  if (isLikelyDocumentActionCommand(input)) return true;
  return Boolean(options.webSearchEnabled) && isWebSearchCommand(input);
}

export function isWordInsertCommand(input) {
  if (/(总结|概括|提炼|梳理|审稿|检查|校对|分析|介绍|解释|反馈)/.test(input)) return false;
  return (
    /(在|往|向)?文档(中|里)?/.test(input) && /(写|写入|插入|生成|创建|起草|撰写|创作)/.test(input)
  ) || /(?:写|生成|创作|起草|撰写)(?:一篇|一段|一份|一首|两首|几句|正文|文章|诗|词|报告|邮件|通知|总结|标题|大纲)/.test(input);
}

export function isWordDocumentSummaryCommand(input) {
  return /(总结|概括|提炼|梳理|大纲|摘要|介绍|解释|分析)/.test(input) && /(全文|整篇|整份|文档|文章|这篇|当前内容|这首|诗|词)/.test(input);
}

export function isWordDocumentReviewCommand(input) {
  return /(审稿|检查|校对|反馈|问题|错别字|病句|逻辑|结构)/.test(input) && /(全文|整篇|整份|文档|文章|这篇|当前内容)/.test(input);
}

export function isWordDocumentQuestionCommand(input) {
  if (!/(文中|文档|文章|这篇|这首|上文|前文|里面|其中|作者|背景|观点|原因|依据|哪里|哪一段)/.test(input)) {
    return false;
  }
  return /(什么|为什么|为何|怎么|如何|是否|有没有|哪里|哪一段|介绍|解释|说明|含义|意思|背景|观点|原因|依据)/.test(input);
}

export function parseReplaceCommand(input) {
  const text = input.trim();
  const patterns = [
    /^(?:请)?(?:找到|查找)(?:文档中|文档里|正文中|正文里)?(?:的)?\s*(?:“([^”]+)”|"([^"]+)"|'([^']+)'|(.+?))(?:内容)?\s*[，,；; ]*(?:并)?(?:全部)?(?:替换为|替换成|改成|更改为|修改为)\s*(?:“([^”]*)”|"([^"]*)"|'([^']*)'|(.+?))\s*[。.!！]?$/,
    /^(?:请)?(?:把|将)(?:文档中|文档里|正文中|正文里)?(?:的)?\s*(?:“([^”]+)”|"([^"]+)"|'([^']+)'|(.+?))\s*(?:全部)?(?:替换为|替换成|改成|更改为|修改为)\s*(?:“([^”]*)”|"([^"]*)"|'([^']*)'|(.+?))\s*[。.!！]?$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const searchText = normalizeCommandPart(match.slice(1, 5).find(value => value !== undefined));
    const replacementText = normalizeCommandPart(match.slice(5, 9).find(value => value !== undefined) || '');
    if (!searchText) return null;
    return { searchText, replacementText };
  }

  return null;
}

function normalizeCommandPart(value) {
  return String(value || '').trim().replace(/[。.!！]$/, '').trim();
}
