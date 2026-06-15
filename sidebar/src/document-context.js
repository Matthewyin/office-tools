const DEFAULT_CHUNK_MAX_CHARS = 5000;
const DEFAULT_SEARCH_LIMIT = 5;
const CONTEXT_SNIPPET_MAX_CHARS = 2200;

let cachedContext = null;

export async function getOrCreateDocumentContext(readBodyText, options = {}) {
  const text = String(await readBodyText() || '').trim();
  if (!text) {
    throw new Error('当前 Word 文档没有可读取的正文内容。');
  }

  const fingerprint = createDocumentFingerprint(text);
  if (cachedContext?.fingerprint === fingerprint) {
    return cachedContext;
  }

  cachedContext = buildDocumentContext(text, options);
  return cachedContext;
}

export function clearDocumentContext() {
  cachedContext = null;
}

export function getDocumentContextStatus() {
  if (!cachedContext) {
    return {
      ready: false,
      charCount: 0,
      chunkCount: 0,
      fingerprint: '',
    };
  }

  return {
    ready: true,
    charCount: cachedContext.charCount,
    chunkCount: cachedContext.chunks.length,
    fingerprint: cachedContext.fingerprint,
  };
}

export function buildDocumentContext(text, options = {}) {
  const normalized = normalizeText(text);
  const chunkMaxChars = options.chunkMaxChars || DEFAULT_CHUNK_MAX_CHARS;
  const chunks = splitDocumentChunks(normalized, chunkMaxChars);

  return {
    fingerprint: createDocumentFingerprint(normalized),
    text: normalized,
    charCount: normalized.length,
    chunks,
    summary: buildDocumentPreview(chunks),
  };
}

export function getDocumentChunks(context) {
  return context?.chunks?.map(chunk => chunk.text) || [];
}

export function searchDocumentContext(context, query, options = {}) {
  const limit = options.limit || DEFAULT_SEARCH_LIMIT;
  const terms = extractSearchTerms(query);
  if (!context?.chunks?.length) return { terms, matches: [] };

  const scored = context.chunks.map(chunk => ({
    chunk,
    score: scoreChunk(chunk, terms),
  }));

  const matches = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index)
    .slice(0, limit)
    .map(item => item.chunk);

  if (matches.length) return { terms, matches: expandNeighborChunks(context.chunks, matches, limit) };
  return { terms, matches: context.chunks.slice(0, Math.min(limit, context.chunks.length)) };
}

export function formatDocumentMatchesForPrompt(matches) {
  return matches.map(chunk => [
    `[分段 ${chunk.index + 1}${chunk.heading ? ` | 标题：${chunk.heading}` : ''}]`,
    clipText(chunk.text, CONTEXT_SNIPPET_MAX_CHARS),
  ].join('\n')).join('\n\n');
}

function splitDocumentChunks(text, chunkMaxChars) {
  const paragraphs = splitParagraphs(text);
  const chunks = [];
  let current = [];
  let currentLength = 0;
  let currentHeading = '';

  const flush = () => {
    if (!current.length) return;
    const content = current.join('\n\n').trim();
    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      index: chunks.length,
      text: content,
      heading: currentHeading,
      keywords: extractSearchTerms(`${currentHeading}\n${content}`).slice(0, 24),
      charCount: content.length,
    });
    current = [];
    currentLength = 0;
  };

  for (const paragraph of paragraphs) {
    if (isLikelyHeading(paragraph)) {
      if (current.length) flush();
      currentHeading = paragraph;
    }

    if (paragraph.length > chunkMaxChars) {
      flush();
      for (let start = 0; start < paragraph.length; start += chunkMaxChars) {
        const part = paragraph.slice(start, start + chunkMaxChars);
        chunks.push({
          id: `chunk-${chunks.length + 1}`,
          index: chunks.length,
          text: part,
          heading: currentHeading,
          keywords: extractSearchTerms(`${currentHeading}\n${part}`).slice(0, 24),
          charCount: part.length,
        });
      }
      continue;
    }

    const nextLength = currentLength + paragraph.length + (current.length ? 2 : 0);
    if (nextLength > chunkMaxChars && current.length) {
      flush();
    }

    current.push(paragraph);
    currentLength += paragraph.length + (current.length > 1 ? 2 : 0);
  }

  flush();
  return chunks;
}

function splitParagraphs(text) {
  const paragraphs = text
    .split(/\n+/)
    .map(item => item.trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs : [text.trim()].filter(Boolean);
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLikelyHeading(paragraph) {
  const text = paragraph.trim();
  if (text.length > 80) return false;
  return /^(第[一二三四五六七八九十百\d]+[章节部分篇]|[一二三四五六七八九十]+[、.．]|[0-9]+[.．、]|#{1,6}\s+)/.test(text)
    || /^[^\n。！？!?]{2,40}$/.test(text);
}

function scoreChunk(chunk, terms) {
  if (!terms.length) return 0;
  const haystack = `${chunk.heading}\n${chunk.text}\n${chunk.keywords.join(' ')}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized) continue;
    const count = countOccurrences(haystack, normalized);
    if (!count) continue;
    score += count * Math.min(normalized.length, 8);
    if (chunk.heading?.toLowerCase().includes(normalized)) score += 12;
  }

  return score;
}

function expandNeighborChunks(chunks, matches, limit) {
  const selected = new Map();
  for (const match of matches) {
    for (const index of [match.index - 1, match.index, match.index + 1]) {
      if (index >= 0 && index < chunks.length && selected.size < limit) {
        selected.set(index, chunks[index]);
      }
    }
    if (selected.size >= limit) break;
  }
  return Array.from(selected.entries()).sort((a, b) => a[0] - b[0]).map(([, chunk]) => chunk);
}

function extractSearchTerms(input) {
  const normalized = String(input || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim();
  if (!normalized) return [];

  const rawTerms = normalized.split(/\s+/).filter(Boolean);
  const terms = [];
  for (const term of rawTerms) {
    if (isStopword(term)) continue;
    if (/^[\u4e00-\u9fff]{5,}$/.test(term)) {
      terms.push(term);
      for (let size = 2; size <= 4; size += 1) {
        for (let index = 0; index <= term.length - size; index += 1) {
          terms.push(term.slice(index, index + size));
        }
      }
      continue;
    }
    if (term.length >= 2) terms.push(term);
  }

  return Array.from(new Set(terms)).slice(0, 40);
}

function isStopword(term) {
  return new Set([
    '请', '帮我', '一下', '这个', '那个', '当前', '文档', '文章', '全文', '整篇',
    '什么', '为什么', '怎么', '如何', '介绍', '分析', '总结', '概括', 'the', 'and',
  ]).has(term);
}

function countOccurrences(text, term) {
  let count = 0;
  let index = text.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(term, index + term.length);
  }
  return count;
}

function buildDocumentPreview(chunks) {
  return chunks
    .slice(0, 6)
    .map(chunk => `分段 ${chunk.index + 1}${chunk.heading ? `：${chunk.heading}` : ''}`)
    .join('\n');
}

function createDocumentFingerprint(text) {
  const normalized = normalizeText(text);
  const seed = `${normalized.length}:${normalized.slice(0, 1200)}:${normalized.slice(-1200)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `${normalized.length}-${hash.toString(16)}`;
}

function clipText(text, maxChars) {
  const value = String(text || '').trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[已截断]`;
}
