export function isAbortError(error) {
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return name === 'aborterror'
    || message === '已停止生成。'
    || message.includes('operation was aborted')
    || message.includes('signal is aborted')
    || message.includes('abort');
}

export function createAbortError(message = '已停止生成。') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}
