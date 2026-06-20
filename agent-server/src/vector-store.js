import { createEmbeddings, isEmbeddingsConfigured } from './embeddings.js';

const MAX_DOCUMENTS = 8; // 内存向量库最多缓存的文档数
const documents = new Map(); // fingerprint -> { chunks: [{index, heading, text, vector}], model, updatedAt }

// 为整篇文档生成分段向量并缓存。失败时抛错，调用方负责降级到关键词检索。
export async function indexDocument({ context, modelSelection, config }) {
  if (!isEmbeddingsConfigured(config)) {
    throw createVectorError('未配置 EMBEDDINGS_MODEL，无法建立向量索引。', 'EMBEDDINGS_NOT_CONFIGURED');
  }
  if (!context?.chunks?.length) {
    throw createVectorError('文档没有可索引的分段。', 'EMPTY_DOCUMENT');
  }

  const fingerprint = context.fingerprint;
  const cached = documents.get(fingerprint);
  if (cached && cached.model === config.embeddingsModel) {
    touchDocument(fingerprint);
    return cached;
  }

  // 把标题拼进待向量化的文本，提升标题命中权重。
  const texts = context.chunks.map(chunk => (chunk.heading ? `${chunk.heading}\n${chunk.text}` : chunk.text));
  const { embeddings, model } = await createEmbeddings({
    input: texts,
    profileId: modelSelection?.profileId,
    model: config.embeddingsModel,
  }, config);

  if (embeddings.length !== context.chunks.length) {
    throw createVectorError(
      `向量数量与分段数量不一致（${embeddings.length} vs ${context.chunks.length}）。`,
      'EMBEDDINGS_MISMATCH',
    );
  }

  const indexed = {
    fingerprint,
    model,
    updatedAt: new Date().toISOString(),
    chunks: context.chunks.map((chunk, index) => ({
      index: chunk.index,
      heading: chunk.heading,
      text: chunk.text,
      vector: embeddings[index],
    })),
  };

  documents.set(fingerprint, indexed);
  evictIfNeeded();
  return indexed;
}

// 基于向量相似度检索最相关分段。返回按相似度降序的前 limit 个。
export async function vectorSearch({ context, query, limit, modelSelection, config }) {
  const indexed = await indexDocument({ context, modelSelection, config });
  const { embeddings: [queryVector] } = await createEmbeddings({
    input: [query],
    profileId: modelSelection?.profileId,
    model: config.embeddingsModel,
  }, config);

  if (!queryVector || !queryVector.length) {
    throw createVectorError('查询向量为空。', 'EMPTY_QUERY_VECTOR');
  }

  const scored = indexed.chunks
    .map(chunk => ({ chunk, score: cosineSimilarity(queryVector, chunk.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(limit) || 5));

  return {
    matches: scored.map(item => ({
      index: item.chunk.index,
      heading: item.chunk.heading,
      text: item.chunk.text,
      matchReason: `向量相似度 ${item.score.toFixed(3)}`,
      matchedTerms: [],
      score: item.score,
    })),
    model: indexed.model,
  };
}

function cosineSimilarity(a, b) {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom ? dot / denom : 0;
}

function touchDocument(fingerprint) {
  const doc = documents.get(fingerprint);
  if (doc) doc.updatedAt = new Date().toISOString();
}

function evictIfNeeded() {
  if (documents.size <= MAX_DOCUMENTS) return;
  const oldest = Array.from(documents.entries())
    .sort((a, b) => new Date(a[1].updatedAt) - new Date(b[1].updatedAt));
  while (documents.size > MAX_DOCUMENTS && oldest.length) {
    const [fingerprint] = oldest.shift();
    documents.delete(fingerprint);
  }
}

function createVectorError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}
