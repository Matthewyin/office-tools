export function createMessageRenderScheduler({
  getMessages,
  renderAll,
  renderContent,
  escapeSelector,
}) {
  let pendingFrame = null;
  const pendingIds = new Set();

  function schedule(message) {
    pendingIds.add(message.id);
    if (pendingFrame) return;

    const scheduleFrame = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : ((callback) => window.setTimeout(callback, 16));
    pendingFrame = scheduleFrame(() => {
      pendingFrame = null;
      const ids = Array.from(pendingIds);
      pendingIds.clear();
      ids.forEach(updateNode);
    });
  }

  function updateNode(messageId) {
    const message = getMessages().find(item => item.id === messageId);
    const node = document.querySelector(`[data-message-id="${escapeSelector(messageId)}"] .message-content`);
    if (!message || !node) {
      renderAll();
      return;
    }

    const cursor = message.pending ? '<span class="cursor-blink">▋</span>' : '';
    node.innerHTML = `${renderContent(message)}${cursor}`;
    const chatWindow = document.getElementById('chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  return { schedule };
}
