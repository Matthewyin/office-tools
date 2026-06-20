import { createAbortError } from './abort-utils.js';

export async function runLimitedConcurrency(items, limit, worker, onProgress = () => {}, options = {}) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;
  const workerCount = Math.min(Math.max(Number(limit) || 1, 1), items.length);

  async function runWorker() {
    while (nextIndex < items.length) {
      throwIfAborted(options.signal);
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
      completed += 1;
      onProgress(completed, items.length);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}
