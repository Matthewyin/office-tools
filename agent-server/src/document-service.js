import { completeLlmChat } from './llm.js';
import { runLimitedConcurrency } from './async-utils.js';
import { vectorSearch } from './vector-store.js';

const DEFAULT_CHUNK_MAX_CHARS = 5000;
const CONTEXT_SNIPPET_MAX_CHARS = 2200;
const DOCUMENT_COMBINE_MAX_CHARS = 18000;
const DOCUMENT_CHUNK_CONCURRENCY = 3;
const COMPACT_RESULT_MAX_CHARS = 250;

// ==================== 文档切块与检索（纯算法，复用前端实现）====================

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
  const limit = options.limit || 5;
  const terms = extractSearchTerms(query);
  if (!context?.chunks?.length) return { terms, matches: [] };
  if (!terms.length) return { terms, matches: context.chunks.slice(0, Math.min(limit, context.chunks.length)) };

  const scored = context.chunks.map(chunk => ({
    chunk,
    score: scoreChunk(chunk, terms),
    headingHit: hasHeadingHit(chunk, terms),
    matchedTerms: getMatchedTerms(chunk, terms),
  }));

  const matches = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.headingHit) - Number(a.headingHit) || a.chunk.index - b.chunk.index)
    .slice(0, limit)
    .map(item => enrichMatchedChunk(item));

  if (matches.length) return { terms, matches: expandNeighborChunks(context.chunks, matches, limit) };
  return { terms, matches: context.chunks.slice(0, Math.min(limit, context.chunks.length)) };
}

export function formatDocumentMatchesForPrompt(matches) {
  return matches.map(chunk => [
    `[分段 ${chunk.index + 1}${chunk.heading ? ` | 标题：${chunk.heading}` : ''}${chunk.matchReason ? ` | 命中：${chunk.matchReason}` : ''}]`,
    clipText(chunk.text, CONTEXT_SNIPPET_MAX_CHARS),
  ].join('\n')).join('\n\n');
}

// 优先向量召回；向量不可用（未配置/供应商不支持）时自动降级到关键词检索。
export async function searchDocumentHybrid({ text, query, limit, modelSelection, config }) {
  const context = buildDocumentContext(text);
  const normalizedLimit = Math.max(1, Number(limit) || 5);

  try {
    const vectorResult = await vectorSearch({ context, query, limit: normalizedLimit, modelSelection, config });
    return {
      mode: 'vector',
      model: vectorResult.model,
      terms: [],
      matches: vectorResult.matches,
      status: getDocumentContextStatus(context),
    };
  } catch (err) {
    const fallback = searchDocumentContext(context, query, { limit: normalizedLimit });
    return {
      mode: 'keyword',
      fallbackReason: err?.code === 'EMBEDDINGS_NOT_CONFIGURED' ? '未配置向量模型' : (err?.message || '向量检索不可用'),
      terms: fallback.terms,
      matches: fallback.matches,
      status: getDocumentContextStatus(context),
    };
  }
}

// ==================== LLM 文档处理（分段并发 + 合并）====================

export async function summarizeWordDocument({ text, instruction, mode, modelSelection, config, onProgress }) {
  const documentContext = buildDocumentContext(text);
  const chunks = getDocumentChunks(documentContext);
  if (!chunks.length) {
    throw createDocumentError('文档没有可处理的正文内容。');
  }

  const chunkResults = await runLimitedConcurrency(
    chunks,
    DOCUMENT_CHUNK_CONCURRENCY,
    (chunkText, index) => analyzeDocumentChunk({ mode, instruction, chunkText, chunkIndex: index + 1, chunkTotal: chunks.length, modelSelection, config }),
    onProgress,
  );

  return await combineWordDocumentResults({ mode, instruction, chunkResults, documentContext, modelSelection, config });
}

export function getDocumentContextStatus(context) {
  if (!context) {
    return { ready: false, charCount: 0, chunkCount: 0, fingerprint: '' };
  }
  return {
    ready: true,
    charCount: context.charCount,
    chunkCount: context.chunks.length,
    fingerprint: context.fingerprint,
  };
}

async function analyzeDocumentChunk({ mode, instruction, chunkText, chunkIndex, chunkTotal, modelSelection, config }) {
  const isReview = mode === 'review';
  const systemPrompt = isReview
    ? [
      '你是专业的 Word 文档审稿助手。',
      '你正在处理长文档的一个分段，只基于当前分段输出审稿结果。',
      '重点找结构、逻辑、表达、错别字、病句和明显不一致之处。',
      '如果没有明显问题，请简短说明“本段未发现明显问题”。',
      '输出要简洁，不要改写全文。',
    ].join('\n')
    : [
      '你是专业的 Word 文档总结助手。',
      '你正在处理长文档的一个分段，只基于当前分段提炼信息。',
      '保留关键事实、观点、论据和小标题线索。',
      '输出控制在 500 字以内。',
    ].join('\n');

  return await completeLlmChat(buildLlmInput(modelSelection, [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        `用户任务：${instruction}`,
        `当前分段：${chunkIndex} / ${chunkTotal}`,
        '',
        chunkText,
      ].join('\n'),
    },
  ]), config).then(result => result.content);
}

async function combineWordDocumentResults({ mode, instruction, chunkResults, documentContext, modelSelection, config }) {
  const isReview = mode === 'review';
  const compactResults = await compactDocumentResultsIfNeeded({ results: chunkResults, modelSelection, config });
  const systemPrompt = isReview
    ? [
      '你是专业的 Word 文档审稿助手。',
      '现在需要基于各分段审稿结果，合并成整篇文档反馈。',
      '输出结构：总体评价、主要问题、逐项修改建议、优先处理项。',
      '不要编造原文中没有的信息。',
      '只给反馈，不要直接生成改写后的全文。',
    ].join('\n')
    : [
      '你是专业的 Word 文档总结助手。',
      '现在需要基于各分段摘要，合并成整篇文档总结。',
      '输出结构：一句话摘要、核心要点、文章大纲、值得关注的问题或亮点。',
      '不要编造原文中没有的信息。',
    ].join('\n');

  return await completeLlmChat(buildLlmInput(modelSelection, [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        `用户任务：${instruction}`,
        `文档规模：约 ${documentContext.charCount} 字，${documentContext.chunks.length} 个分段`,
        '',
        compactResults.map((result, index) => `## 分段 ${index + 1}\n${result}`).join('\n\n'),
      ].join('\n'),
    },
  ]), config).then(result => result.content);
}

async function compactDocumentResultsIfNeeded({ results, modelSelection, config }) {
  const joined = results.join('\n\n');
  if (joined.length <= DOCUMENT_COMBINE_MAX_CHARS) return results;

  const compacted = [];
  for (const result of results) {
    const compactedResult = await completeLlmChat(buildLlmInput(modelSelection, [
      { role: 'system', content: `请把这段中间结果压缩到 ${COMPACT_RESULT_MAX_CHARS} 字以内，保留关键事实、问题和结论，不要新增信息。` },
      { role: 'user', content: result },
    ]), config).then(item => item.content);
    compacted.push(compactedResult);
  }
  return compacted;
}

function buildLlmInput(modelSelection, messages) {
  return {
    model: modelSelection?.model,
    profileId: modelSelection?.profileId,
    reasoningEnabled: modelSelection?.reasoningEnabled,
    reasoningEffort: modelSelection?.reasoningEffort,
    messages,
  };
}

// ==================== 纯函数：切块/检索算法（与前端一致）====================

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
  const heading = String(chunk.heading || '').toLowerCase();
  const text = String(chunk.text || '').toLowerCase();
  const keywords = String(chunk.keywords?.join(' ') || '').toLowerCase();
  let score = 0;

  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized) continue;
    const headingCount = countOccurrences(heading, normalized);
    const textCount = countOccurrences(text, normalized);
    const keywordCount = countOccurrences(keywords, normalized);
    if (!headingCount && !textCount && !keywordCount) continue;

    const weight = Math.min(normalized.length, 8);
    score += headingCount * weight * 5;
    score += textCount * weight;
    score += keywordCount * Math.max(2, weight);
    if (heading === normalized) score += 30;
  }

  return score;
}

function expandNeighborChunks(chunks, matches, limit) {
  const selected = new Map();
  for (const match of matches) selected.set(match.index, match);

  for (const match of matches) {
    for (const index of [match.index - 1, match.index + 1]) {
      if (selected.size >= limit) break;
      if (index >= 0 && index < chunks.length) selected.set(index, {
        ...chunks[index],
        matchedTerms: [],
        matchReason: '相邻段落补充',
      });
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
    const parts = splitMixedTerm(term);
    const candidates = parts.length > 1 ? [term, ...parts] : [term];
    candidates.forEach(candidate => addSearchTerm(candidate, terms));
  }

  return Array.from(new Set(terms)).slice(0, 40);
}

function addSearchTerm(term, terms) {
  if (isStopword(term)) return;
  if (/^[\u4e00-\u9fff]{5,}$/.test(term)) {
    terms.push(term);
    for (let size = 2; size <= 4; size += 1) {
      for (let index = 0; index <= term.length - size; index += 1) {
        terms.push(term.slice(index, index + size));
      }
    }
    return;
  }
  if (term.length >= 2) terms.push(term);
}

function splitMixedTerm(term) {
  return String(term || '').match(/[\u4e00-\u9fff]+|[a-z0-9_]+/gi) || [];
}

function enrichMatchedChunk(item) {
  return {
    ...item.chunk,
    score: item.score,
    matchedTerms: item.matchedTerms,
    matchReason: formatMatchReason(item),
  };
}

function formatMatchReason(item) {
  const terms = item.matchedTerms.slice(0, 6).join('、');
  if (!terms) return '';
  return `${item.headingHit ? '标题' : '正文'}：${terms}`;
}

function hasHeadingHit(chunk, terms) {
  const heading = String(chunk.heading || '').toLowerCase();
  return terms.some(term => countOccurrences(heading, term.toLowerCase()) > 0);
}

function getMatchedTerms(chunk, terms) {
  const text = `${chunk.heading || ''}\n${chunk.text || ''}\n${chunk.keywords?.join(' ') || ''}`.toLowerCase();
  return terms.filter(term => countOccurrences(text, term.toLowerCase()) > 0).slice(0, 12);
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

function createDocumentError(message) {
  const error = new Error(message);
  error.code = 'INVALID_DOCUMENT';
  error.statusCode = 400;
  return error;
}
