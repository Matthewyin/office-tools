import fs from 'fs';
import path from 'path';
import process from 'process';

export function loadConfig() {
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvFile(path.resolve(process.cwd(), 'agent-server', '.env.local'));

  const llmProfiles = loadLlmProfilesFromEnv(process.env);
  const llmSelectedProfileId = process.env.LLM_SELECTED_PROFILE_ID || llmProfiles[0]?.id || '';
  const activeLlmProfile = selectLlmProfile(llmProfiles, llmSelectedProfileId);
  const searchProvider = process.env.SEARCH_PROVIDER
    || (process.env.TAVILY_API_KEY ? 'tavily' : 'mock');

  return {
    envFilePath: resolveAgentEnvPath(),
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 30031),
    searchProvider,
    tavilyApiKey: process.env.TAVILY_API_KEY || '',
    braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY || '',
    toolTimeoutMs: Number(process.env.TOOL_TIMEOUT_MS || 30000),
    searchMaxResults: Number(process.env.SEARCH_MAX_RESULTS || 5),
    llmProfiles,
    llmSelectedProfileId,
    llmApiBaseUrl: activeLlmProfile?.baseUrl || normalizeBaseUrl(process.env.LLM_API_BASE_URL || ''),
    llmApiKey: activeLlmProfile?.apiKey || process.env.LLM_API_KEY || '',
    llmModel: activeLlmProfile?.model || process.env.LLM_MODEL || '',
    llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 180000),
    embeddingsModel: process.env.EMBEDDINGS_MODEL || '',
  };
}

export function getPublicLlmProfiles(config) {
  return {
    selectedProfileId: config.llmSelectedProfileId || config.llmProfiles[0]?.id || '',
    profiles: config.llmProfiles.map(toPublicLlmProfile),
  };
}

export function saveLlmProfiles(input, config) {
  const existingById = new Map(config.llmProfiles.map(profile => [profile.id, profile]));
  const profiles = normalizeSavedProfiles(input.profiles, existingById);
  const selectedProfileId = profiles.some(profile => profile.id === input.selectedProfileId)
    ? input.selectedProfileId
    : profiles[0].id;
  const selectedProfile = selectLlmProfile(profiles, selectedProfileId);

  writeEnvValues(config.envFilePath, {
    LLM_PROFILES_JSON: JSON.stringify(profiles),
    LLM_SELECTED_PROFILE_ID: selectedProfileId,
    LLM_API_BASE_URL: selectedProfile.baseUrl,
    LLM_API_KEY: selectedProfile.apiKey,
    LLM_MODEL: selectedProfile.model,
  });

  process.env.LLM_PROFILES_JSON = JSON.stringify(profiles);
  process.env.LLM_SELECTED_PROFILE_ID = selectedProfileId;
  process.env.LLM_API_BASE_URL = selectedProfile.baseUrl;
  process.env.LLM_API_KEY = selectedProfile.apiKey;
  process.env.LLM_MODEL = selectedProfile.model;

  config.llmProfiles = profiles;
  config.llmSelectedProfileId = selectedProfileId;
  config.llmApiBaseUrl = selectedProfile.baseUrl;
  config.llmApiKey = selectedProfile.apiKey;
  config.llmModel = selectedProfile.model;

  return getPublicLlmProfiles(config);
}

export function selectLlmProfile(profiles, profileId) {
  return profiles.find(profile => profile.id === profileId) || profiles[0] || null;
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveAgentEnvPath() {
  if (path.basename(process.cwd()) === 'agent-server') {
    return path.resolve(process.cwd(), '.env.local');
  }
  return path.resolve(process.cwd(), 'agent-server', '.env.local');
}

function loadLlmProfilesFromEnv(env) {
  const parsed = parseProfilesJson(env.LLM_PROFILES_JSON);
  if (parsed.length) return parsed;

  if (env.LLM_API_BASE_URL || env.LLM_API_KEY || env.LLM_MODEL) {
    return [normalizeLlmProfile({
      id: 'default',
      name: env.LLM_MODEL || '默认模型',
      baseUrl: env.LLM_API_BASE_URL || '',
      apiKey: env.LLM_API_KEY || '',
      model: env.LLM_MODEL || '',
      models: env.LLM_MODEL ? [env.LLM_MODEL] : [],
    }, 0)];
  }

  return [];
}

function parseProfilesJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLlmProfile).filter(profile => profile.baseUrl || profile.apiKey || profile.models.length);
  } catch {
    return [];
  }
}

function normalizeSavedProfiles(items, existingById) {
  if (!Array.isArray(items) || !items.length) {
    throwConfigInputError('至少需要一个模型配置。');
  }

  const profiles = items.map((item, index) => {
    const id = normalizeId(item.id || `profile-${index + 1}`);
    const existing = existingById.get(id);
    const profile = normalizeLlmProfile({
      ...item,
      id,
      apiKey: item.apiKey ? item.apiKey : existing?.apiKey || '',
    }, index);

    if (!profile.name) throwConfigInputError('模型显示名称不能为空。');
    if (!profile.baseUrl) throwConfigInputError(`模型 ${profile.name} 缺少 API Base URL。`);
    if (!profile.apiKey) throwConfigInputError(`模型 ${profile.name} 缺少 API Key。`);
    if (!profile.models.length) throwConfigInputError(`模型 ${profile.name} 至少需要一个 Model Name。`);
    return profile;
  });

  const ids = new Set();
  for (const profile of profiles) {
    if (ids.has(profile.id)) throwConfigInputError(`模型 ID 重复：${profile.id}`);
    ids.add(profile.id);
  }
  return profiles;
}

function normalizeLlmProfile(profile, index = 0) {
  const models = normalizeModelNames(profile.models || profile.model);
  const model = String(profile.model || models[0] || '').trim();
  return {
    id: normalizeId(profile.id || `profile-${index + 1}`),
    name: String(profile.name || model || `模型 ${index + 1}`).trim(),
    baseUrl: normalizeBaseUrl(profile.baseUrl || profile.apiBaseUrl || ''),
    apiKey: String(profile.apiKey || ''),
    model: models.includes(model) ? model : models[0] || model,
    models,
  };
}

function toPublicLlmProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    model: profile.model,
    models: profile.models,
    hasApiKey: Boolean(profile.apiKey),
  };
}

function normalizeModelNames(value) {
  const rawItems = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const models = [];

  for (const item of rawItems) {
    const model = String(item || '').trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }

  return models;
}

function normalizeId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || `profile-${Date.now()}`;
}

function throwConfigInputError(message) {
  const error = new Error(message);
  error.code = 'INVALID_LLM_PROFILE';
  error.statusCode = 400;
  throw error;
}

function writeEnvValues(filePath, updates) {
  const current = readEnvValues(filePath);
  const next = {
    ...current,
    ...updates,
  };
  const lines = Object.entries(next)
    .filter(([key]) => key)
    .map(([key, value]) => `${key}=${String(value ?? '')}`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, { mode: 0o600 });
}

function readEnvValues(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key) values[key] = value;
  }
  return values;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
