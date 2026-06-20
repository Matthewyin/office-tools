export function normalizeModelNames(value) {
  const rawItems = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const models = [];

  rawItems.forEach(item => {
    const model = String(item || '').trim();
    if (!model || seen.has(model)) return;
    seen.add(model);
    models.push(model);
  });

  return models;
}

export function normalizeModelProfile(profile = {}, createId = defaultCreateId) {
  const models = normalizeModelNames(profile.models || profile.model);
  const model = String(profile.model || models[0] || '');
  const makeId = typeof createId === 'function' ? createId : defaultCreateId;
  return {
    id: profile.id || makeId(),
    name: String(profile.name || model || '默认模型'),
    baseUrl: String(profile.baseUrl || ''),
    apiKey: '',
    hasApiKey: Boolean(profile.hasApiKey),
    model,
    models,
    reasoningEnabled: Boolean(profile.reasoningEnabled),
    reasoningEffort: profile.reasoningEffort || 'medium',
  };
}

export function createModelOptionValue(profileId, model) {
  return `${encodeURIComponent(profileId || '')}::${encodeURIComponent(model || '')}`;
}

export function parseModelOptionValue(value) {
  const text = String(value || '');
  if (!text.includes('::')) {
    return { profileId: text, model: '' };
  }
  const [profileId, model] = text.split('::');
  return {
    profileId: safeDecodeURIComponent(profileId || ''),
    model: safeDecodeURIComponent(model || ''),
  };
}

export function resolveSelectedModelId(value, profiles) {
  const normalizedProfiles = Array.isArray(profiles) ? profiles : [];
  if (!normalizedProfiles.length) return '';

  const selection = parseModelOptionValue(value);
  const profile = normalizedProfiles.find(item => item.id === selection.profileId) || normalizedProfiles[0];
  const models = profile.models.length ? profile.models : [profile.model].filter(Boolean);
  const model = models.includes(selection.model) ? selection.model : profile.model || models[0] || '';
  return createModelOptionValue(profile.id, model);
}

export function getSelectedProfileId(selectedModelId) {
  return parseModelOptionValue(selectedModelId).profileId;
}

export function getSelectedProfileFromProfiles(profiles, selectedModelId) {
  const profileId = getSelectedProfileId(selectedModelId);
  return profiles.find(profile => profile.id === profileId) || null;
}

export function getSelectedModelNameFromModels(models, selectedModelId) {
  const selection = parseModelOptionValue(selectedModelId);
  return models.includes(selection.model) ? selection.model : models[0] || '';
}

export function getSelectedModelNameFromProfile(profile, selectedModelId) {
  const models = profile.models.length ? profile.models : [profile.model].filter(Boolean);
  return getSelectedModelNameFromModels(models, selectedModelId) || profile.model || models[0] || '';
}

export function isMeaningfulModelProfile(profile) {
  if (profile.baseUrl || profile.apiKey || profile.models.length) return true;
  return Boolean(profile.name && !['新模型', '默认模型'].includes(profile.name));
}

export function validateSingleModelProfile(profile) {
  if (!profile.name || !profile.baseUrl || !profile.models.length || (!profile.hasApiKey && !profile.apiKey)) {
    throw new Error('模型名称、Base URL、API Key 和至少一个 Model Name 必须填写。');
  }
}

export function modelSummary(profile) {
  const model = profile.models.length ? profile.models.join(' / ') : '未填写模型';
  const reasoning = profile.reasoningEnabled ? `思考${effortLabel(profile.reasoningEffort)}` : '思考关';
  return `${model} · ${reasoning}`;
}

export function effortLabel(value) {
  const map = { low: '低', medium: '中', high: '高' };
  return map[value] || '中';
}

function defaultCreateId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value || '');
  }
}
