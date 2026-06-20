export const STORAGE_MAX_CONVERSATIONS_ON_FALLBACK = 8;
export const STORAGE_MAX_MESSAGES_PER_CONVERSATION_ON_FALLBACK = 20;
export const STORAGE_MAX_MESSAGE_CHARS_ON_FALLBACK = 4000;

export function saveConversationsToStorage(storage, key, activeId, conversations) {
  try {
    storage.setItem(key, JSON.stringify({
      activeId,
      items: conversations,
    }));
    return { saved: true, trimmed: false, items: conversations };
  } catch (error) {
    const trimmedItems = trimConversationsForStorage(conversations, activeId);
    try {
      storage.setItem(key, JSON.stringify({
        activeId,
        items: trimmedItems,
      }));
      return { saved: true, trimmed: true, items: trimmedItems, error };
    } catch (retryError) {
      return { saved: false, trimmed: true, items: conversations, error: retryError };
    }
  }
}

export function trimConversationsForStorage(items, activeId) {
  const trimmed = items.map(conversation => ({
    ...conversation,
    messages: (conversation.messages || [])
      .slice(-STORAGE_MAX_MESSAGES_PER_CONVERSATION_ON_FALLBACK)
      .map(message => ({
        ...message,
        content: clipStorageMessage(message.content),
      })),
  }));

  while (trimmed.length > STORAGE_MAX_CONVERSATIONS_ON_FALLBACK) {
    const removableIndex = findOldestRemovableConversationIndex(trimmed, activeId);
    if (removableIndex < 0) break;
    trimmed.splice(removableIndex, 1);
  }

  return trimmed;
}

function findOldestRemovableConversationIndex(items, activeId) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].id !== activeId && !items[index].pinned) return index;
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].id !== activeId) return index;
  }
  return -1;
}

function clipStorageMessage(content) {
  const text = String(content || '');
  if (text.length <= STORAGE_MAX_MESSAGE_CHARS_ON_FALLBACK) return text;
  return `${text.slice(0, STORAGE_MAX_MESSAGE_CHARS_ON_FALLBACK)}\n...[因本地存储空间不足已截断]`;
}
