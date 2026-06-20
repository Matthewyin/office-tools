export function normalizeConversation(item, createId) {
  if (!item?.id) return null;
  return {
    id: String(item.id),
    title: String(item.title || '新对话').trim() || '新对话',
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    pinned: Boolean(item.pinned),
    messages: normalizeMessages(item.messages, createId),
    context: item.context || {},
  };
}

export function normalizeMessages(messages, createId) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(message => message?.role && message?.content)
    .map((message, index) => ({
      id: message.id || createId(),
      seq: Number(message.seq) || index + 1,
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content),
      pending: false,
      error: false,
    }));
}

export function createConversationRecord(createId, title = '新对话') {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    messages: [],
    context: {},
  };
}

export function inferConversationTitle(messages) {
  const firstUserMessage = messages.find(message => message.role === 'user' && message.content);
  if (!firstUserMessage) return '新对话';
  return firstUserMessage.content.replace(/\s+/g, ' ').trim().slice(0, 32) || '新对话';
}

export function conversationMeta(conversation) {
  const count = conversation.messages?.length || 0;
  const updated = conversation.updatedAt
    ? new Date(conversation.updatedAt).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';
  return `${conversation.pinned ? '已置顶 · ' : ''}${count} 条消息${updated ? ` · ${updated}` : ''}`;
}
