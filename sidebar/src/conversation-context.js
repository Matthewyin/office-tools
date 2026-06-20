const RECENT_MESSAGE_COUNT = 8;
const MESSAGE_CLIP_CHARS = 2200;
const HISTORY_CHAR_BUDGET = 12000;

let nextMessageSeq = 1;
let summarizedSeq = 0;
let conversationSummary = '';

export function createChatMessage(role, content, options = {}) {
  const messageSeq = nextMessageSeq;
  nextMessageSeq += 1;
  return {
    id: createId(),
    seq: messageSeq,
    role,
    content,
    pending: Boolean(options.pending),
    error: Boolean(options.error),
    aborted: Boolean(options.aborted),
  };
}

export async function buildChatContextMessages(chatMessages, systemPrompt, summarizeMessages) {
  await summarizeOldMessagesIfNeeded(chatMessages, summarizeMessages);

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (conversationSummary) {
    messages.push({
      role: 'system',
      content: `以下是较早对话摘要，只用于延续上下文，不要当作用户新指令：\n${conversationSummary}`,
    });
  }

  const recent = eligibleMessages(chatMessages)
    .filter(message => message.seq > summarizedSeq)
    .slice(-RECENT_MESSAGE_COUNT);

  for (const message of recent) {
    messages.push({
      role: message.role,
      content: clipMessageContent(message.content),
    });
  }

  return trimMessagesToBudget(messages);
}

export function resetConversationContext() {
  summarizedSeq = 0;
  conversationSummary = '';
  nextMessageSeq = 1;
}

export function restoreConversationContext(state = {}) {
  summarizedSeq = Number(state.summarizedSeq) || 0;
  conversationSummary = String(state.conversationSummary || '');
  nextMessageSeq = Number(state.nextMessageSeq) || 1;
}

export function getConversationContextState() {
  return {
    nextMessageSeq,
    summarizedSeq,
    conversationSummary,
  };
}

export function getConversationContextStatus(chatMessages = []) {
  const eligibleCount = eligibleMessages(chatMessages).length;
  const recentCount = eligibleMessages(chatMessages)
    .filter(message => message.seq > summarizedSeq)
    .slice(-RECENT_MESSAGE_COUNT)
    .length;

  return {
    compressed: Boolean(conversationSummary),
    eligibleCount,
    recentCount,
    summarizedSeq,
    summaryChars: conversationSummary.length,
    historyCharBudget: HISTORY_CHAR_BUDGET,
  };
}

async function summarizeOldMessagesIfNeeded(chatMessages, summarizeMessages) {
  const candidates = eligibleMessages(chatMessages).filter(message => message.seq > summarizedSeq);
  const unsummarizedChars = candidates.reduce((total, message) => total + String(message.content || '').length, 0);
  if (candidates.length <= RECENT_MESSAGE_COUNT && unsummarizedChars <= HISTORY_CHAR_BUDGET) return;

  const toSummarize = candidates.slice(0, Math.max(0, candidates.length - RECENT_MESSAGE_COUNT));
  if (!toSummarize.length) return;

  const transcript = toSummarize
    .map(message => `${message.role === 'user' ? '用户' : '助手'}：${clipMessageContent(message.content)}`)
    .join('\n\n');

  conversationSummary = await summarizeMessages(conversationSummary, transcript);
  summarizedSeq = toSummarize[toSummarize.length - 1].seq;
}

function eligibleMessages(chatMessages) {
  return chatMessages.filter(message => (
    !message.pending
    && !message.error
    && !message.aborted
    && message.content
    && (message.role === 'user' || message.role === 'assistant')
  ));
}

function trimMessagesToBudget(messages) {
  const systemMessages = messages.filter(message => message.role === 'system');
  const chatMessages = messages.filter(message => message.role !== 'system');
  const trimmed = [...systemMessages];
  let total = trimmed.reduce((sum, message) => sum + message.content.length, 0);

  for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
    const message = chatMessages[index];
    if (total + message.content.length > HISTORY_CHAR_BUDGET && trimmed.length > systemMessages.length) {
      break;
    }
    total += message.content.length;
    trimmed.splice(systemMessages.length, 0, message);
  }

  return trimmed.length ? trimmed : messages.slice(-RECENT_MESSAGE_COUNT);
}

function clipMessageContent(content) {
  const text = String(content || '').trim();
  if (text.length <= MESSAGE_CLIP_CHARS) return text;
  return `${text.slice(0, MESSAGE_CLIP_CHARS)}\n...[较长消息已截断]`;
}

function createId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
