import { testLLMConfig } from './llm.js';
import {
  createModelOptionValue,
  getSelectedModelNameFromModels as getSelectedModelNameFromModelsData,
  getSelectedModelNameFromProfile as getSelectedModelNameFromProfileData,
  getSelectedProfileFromProfiles as getSelectedProfileFromProfilesData,
  getSelectedProfileId as getSelectedProfileIdData,
  isMeaningfulModelProfile,
  modelSummary,
  normalizeModelNames,
  normalizeModelProfile as normalizeModelProfileData,
  resolveSelectedModelId,
  validateSingleModelProfile,
} from '../../packages/frontend-shared/src/model-profiles.js';

export function createSettingsUi(deps = {}) {
  const webSearchEnabledKey = deps.webSearchEnabledKey || 'office_assistant_web_search_enabled';
  let modelProfiles = [];
  let selectedModelId = '';
  let expandedModelIds = new Set();
  let modelConfigRendered = false;

  function loadSettings() {
    document.getElementById('input-system-prompt').value =
      localStorage.getItem('llm_system_prompt') || '';
    document.getElementById('input-web-search-enabled').checked =
      localStorage.getItem(webSearchEnabledKey) === 'true';
    localStorage.removeItem('llm_api_key');

    modelProfiles = loadModelProfiles();
    selectedModelId = resolveSelectedModelId(localStorage.getItem('llm_selected_profile'), modelProfiles);
    if (getSelectedProfileId()) expandedModelIds.add(getSelectedProfileId());
    renderModelSelect();
    loadBackendLlmProfiles();
  }

  function loadModelProfiles() {
    const saved = readJson('llm_profiles_v1');
    if (Array.isArray(saved) && saved.length > 0) return saved.map(normalizeModelProfile);

    return [normalizeModelProfile({
      id: createId(),
      name: localStorage.getItem('llm_model') || '默认模型',
      model: localStorage.getItem('llm_model') || '',
      models: localStorage.getItem('llm_model') ? [localStorage.getItem('llm_model')] : [],
      reasoningEnabled: false,
      reasoningEffort: 'medium',
    })];
  }

  function normalizeModelProfile(profile) {
    return normalizeModelProfileData(profile, createId);
  }

  async function loadBackendLlmProfiles() {
    try {
      const response = await fetch('/api/llm/profiles');
      const data = await response.json();
      if (!response.ok || data.ok === false) return;
      if (Array.isArray(data.profiles) && data.profiles.length) {
        modelProfiles = data.profiles.map(normalizeModelProfile);
        selectedModelId = resolveSelectedModelId(data.selectedProfileId, modelProfiles);
        saveModelProfilesLocal();
        localStorage.setItem('llm_selected_profile', selectedModelId);
        expandedModelIds.add(getSelectedProfileId());
        if (modelConfigRendered) renderModelConfigList();
        renderModelSelect();
      }
    } catch {
      // 后端配置读取失败时，保留本地已有模型名，避免阻塞界面。
    }
  }

  async function saveSettings() {
    const profiles = readProfilesFromForm()
      .filter(isMeaningfulModelProfile);

    if (profiles.length === 0) {
      showSettingsStatus('请至少保留一个模型配置。', 'error');
      return;
    }

    const invalid = profiles.find(profile => !profile.name || !profile.baseUrl || !profile.models.length || (!profile.hasApiKey && !profile.apiKey));
    if (invalid) {
      showSettingsStatus('模型名称、Base URL、API Key 和至少一个 Model Name 必须填写。', 'error');
      return;
    }

    try {
      await saveLlmProfilesToBackend(profiles);
      localStorage.setItem('llm_system_prompt', document.getElementById('input-system-prompt').value.trim());
      localStorage.setItem(webSearchEnabledKey, String(isWebSearchEnabled()));
      syncLegacyConfig();

      renderModelConfigList();
      renderModelSelect();
      showSettingsStatus('已保存到本地后端', 'success');

      setTimeout(() => {
        document.getElementById('settings-panel').classList.add('hidden');
        document.getElementById('settings-status').textContent = '';
      }, 900);
    } catch (err) {
      showSettingsStatus(`保存失败：${err.message}`, 'error');
    }
  }

  async function saveLlmProfilesToBackend(profiles) {
    const selectedProfile = getSelectedProfileFromProfiles(profiles);
    if (!selectedProfile) {
      selectedModelId = createModelOptionValue(profiles[0].id, profiles[0].models[0]);
    } else {
      const selectedModel = getSelectedModelNameFromProfile(selectedProfile);
      selectedProfile.model = selectedModel;
      selectedModelId = createModelOptionValue(selectedProfile.id, selectedModel);
    }

    const response = await fetch('/api/llm/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedProfileId: getSelectedProfileId(),
        profiles,
      }),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) {
      throw new Error(data.error?.message || `后端保存失败 (${response.status})`);
    }

    modelProfiles = data.profiles.map(normalizeModelProfile);
    selectedModelId = resolveSelectedModelId(data.selectedProfileId, modelProfiles);
    saveModelProfilesLocal();
    localStorage.setItem('llm_selected_profile', selectedModelId);
    return data;
  }

  function saveModelProfilesLocal() {
    localStorage.setItem('llm_profiles_v1', JSON.stringify(modelProfiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      baseUrl: profile.baseUrl,
      hasApiKey: Boolean(profile.hasApiKey),
      model: profile.model,
      models: profile.models,
      reasoningEnabled: Boolean(profile.reasoningEnabled),
      reasoningEffort: profile.reasoningEffort || 'medium',
    }))));
  }

  function syncLegacyConfig() {
    const profile = getSelectedModelConfig();
    if (!profile) return;
    localStorage.setItem('llm_model', profile.model);
    localStorage.removeItem('llm_api_key');
  }

  function addModelProfile() {
    modelProfiles = readProfilesFromForm();
    const profile = {
      id: createId(),
      name: '新模型',
      baseUrl: '',
      apiKey: '',
      hasApiKey: false,
      model: '',
      models: [''],
      reasoningEnabled: false,
      reasoningEffort: 'medium',
    };
    modelProfiles.push(profile);
    selectedModelId = createModelOptionValue(profile.id, '');
    expandedModelIds.add(profile.id);
    renderModelConfigList();
    renderModelSelect();
  }

  function removeModelProfile(id) {
    modelProfiles = readProfilesFromForm().filter(profile => profile.id !== id);
    if (modelProfiles.length === 0) {
      modelProfiles.push({
        id: createId(),
        name: '默认模型',
        baseUrl: '',
        apiKey: '',
        hasApiKey: false,
        model: '',
        models: [''],
        reasoningEnabled: false,
        reasoningEffort: 'medium',
      });
    }
    if (!getSelectedProfileFromProfiles(modelProfiles)) {
      selectedModelId = createModelOptionValue(modelProfiles[0].id, modelProfiles[0].models[0] || '');
    }
    renderModelConfigList();
    renderModelSelect();
  }

  function renderModelConfigList() {
    const list = document.getElementById('model-config-list');
    modelConfigRendered = true;
    list.innerHTML = '';

    modelProfiles.forEach((profile, index) => {
      const expanded = expandedModelIds.has(profile.id) || !isModelConfigured(profile);
      const item = document.createElement('section');
      const selected = profile.id === getSelectedProfileId();
      item.className = `model-config${expanded ? ' expanded' : ''}${selected ? ' selected' : ''}`;
      item.dataset.id = profile.id;
      item.innerHTML = `
        <div class="model-config-header">
          <div class="model-config-heading">
            <span class="model-config-title">${escapeHtml(profile.name || `模型 ${index + 1}`)}${selected ? '<em>当前</em>' : ''}</span>
            <span class="model-config-summary">${escapeHtml(modelSummary(profile))}</span>
          </div>
          <div class="model-config-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-toggle-model="${escapeHtml(profile.id)}">${expanded ? '收起' : '编辑'}</button>
            <button class="btn btn-secondary btn-sm" type="button" data-test-model="${escapeHtml(profile.id)}">测试</button>
            <button class="btn btn-danger btn-sm" type="button" data-remove-model="${escapeHtml(profile.id)}">删除</button>
          </div>
        </div>
        <div class="model-config-fields">
          <label class="config-field">
            <span>显示名称</span>
            <input class="input" data-field="name" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="例如 GLM-5.2" value="${escapeHtml(profile.name || '')}" />
          </label>
          <label class="config-field">
            <span>API Base URL</span>
            <input class="input" data-field="baseUrl" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="https://api.openai.com/v1" value="${escapeHtml(profile.baseUrl || '')}" />
          </label>
          <label class="config-field">
            <span>API Key</span>
            <input class="input" data-field="apiKey" type="password" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="${profile.hasApiKey ? '留空则沿用已保存 Key' : '保存到本地后端 .env.local'}" value="${profile.hasApiKey ? '' : escapeHtml(profile.apiKey || '')}" />
          </label>
          <label class="config-field">
            <span>Model Names</span>
            <div class="model-name-list">
              ${renderModelNameInputs(profile)}
            </div>
            <button class="btn btn-secondary btn-sm model-add-btn" type="button" data-add-profile-model="${escapeHtml(profile.id)}">添加 Model</button>
          </label>
          <div class="model-option-row">
            <label class="checkbox-row">
              <input data-field="reasoningEnabled" type="checkbox" ${profile.reasoningEnabled ? 'checked' : ''} />
              <span>启用推理/思考</span>
            </label>
            <select class="compact-select" data-field="reasoningEffort" aria-label="默认思考深度">
              <option value="low" ${profile.reasoningEffort === 'low' ? 'selected' : ''}>低</option>
              <option value="medium" ${!profile.reasoningEffort || profile.reasoningEffort === 'medium' ? 'selected' : ''}>中</option>
              <option value="high" ${profile.reasoningEffort === 'high' ? 'selected' : ''}>高</option>
            </select>
          </div>
        </div>
        <p class="model-test-status" data-test-status></p>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('[data-toggle-model]').forEach(button => {
      button.addEventListener('click', () => toggleModelEditor(button.dataset.toggleModel));
    });

    list.querySelectorAll('[data-test-model]').forEach(button => {
      button.addEventListener('click', () => testModelProfile(button.dataset.testModel));
    });

    list.querySelectorAll('[data-remove-model]').forEach(button => {
      button.addEventListener('click', () => removeModelProfile(button.dataset.removeModel));
    });

    list.querySelectorAll('[data-add-profile-model]').forEach(button => {
      button.addEventListener('click', () => addProfileModelName(button.dataset.addProfileModel));
    });

    list.querySelectorAll('[data-remove-profile-model]').forEach(button => {
      button.addEventListener('click', () => removeProfileModelName(button.dataset.profileId, Number(button.dataset.modelIndex)));
    });
  }

  function renderModelNameInputs(profile) {
    const models = profile.models.length ? profile.models : [''];
    return models.map((model, index) => `
      <div class="model-name-row">
        <input class="input" data-field="model" data-model-index="${index}" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="例如 deepseek-chat" value="${escapeHtml(model)}" />
        <button class="icon-btn model-name-remove" type="button" title="删除 Model" aria-label="删除 Model" data-remove-profile-model data-profile-id="${escapeHtml(profile.id)}" data-model-index="${index}" ${models.length <= 1 ? 'disabled' : ''}>
          <svg class="icon"><use href="#icon-trash"></use></svg>
        </button>
      </div>
    `).join('');
  }

  function addProfileModelName(profileId) {
    modelProfiles = readProfilesFromForm();
    const profile = modelProfiles.find(item => item.id === profileId);
    if (!profile) return;
    profile.models.push('');
    expandedModelIds.add(profileId);
    renderModelConfigList();
    renderModelSelect();
  }

  function removeProfileModelName(profileId, modelIndex) {
    modelProfiles = readProfilesFromForm();
    const profile = modelProfiles.find(item => item.id === profileId);
    if (!profile || profile.models.length <= 1) return;
    profile.models.splice(modelIndex, 1);
    profile.models = profile.models.length ? profile.models : [''];
    profile.model = profile.models[0] || '';
    if (getSelectedProfileId() === profileId && !profile.models.includes(getSelectedModelNameFromProfile(profile))) {
      selectedModelId = createModelOptionValue(profile.id, profile.models[0] || '');
    }
    expandedModelIds.add(profileId);
    renderModelConfigList();
    renderModelSelect();
  }

  function toggleModelEditor(id) {
    modelProfiles = readProfilesFromForm();
    if (expandedModelIds.has(id)) {
      expandedModelIds.delete(id);
    } else {
      expandedModelIds.add(id);
    }
    renderModelConfigList();
    renderModelSelect();
  }

  function isModelConfigured(profile) {
    return Boolean(profile.name && profile.baseUrl && profile.models.length && profile.hasApiKey);
  }

  async function testModelProfile(id) {
    modelProfiles = readProfilesFromForm();
    const profile = modelProfiles.find(item => item.id === id);
    if (!profile) return;

    const item = document.querySelector(`.model-config[data-id="${cssEscape(id)}"]`);
    const status = item?.querySelector('[data-test-status]');
    const button = item?.querySelector('[data-test-model]');
    if (!status || !button) return;

    status.textContent = '测试中...';
    status.className = 'model-test-status';
    button.disabled = true;

    try {
      validateSingleModelProfile(profile);
      const model = getSelectedProfileId() === profile.id
        ? getSelectedModelNameFromProfile(profile)
        : profile.models[0];
      const reply = await testLLMConfig({ ...profile, model });
      status.textContent = `连接成功：${model}：${reply.slice(0, 40)}`;
      status.className = 'model-test-status success';
    } catch (err) {
      status.textContent = `连接失败：${err.message}`;
      status.className = 'model-test-status error';
    } finally {
      button.disabled = false;
    }
  }

  function renderModelSelect() {
    const select = document.getElementById('select-model');
    select.innerHTML = '';

    modelProfiles.forEach(profile => {
      const models = profile.models.length ? profile.models : [profile.model].filter(Boolean);
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = createModelOptionValue(profile.id, model);
        option.textContent = `${profile.name || '未命名配置'} / ${model || '未命名模型'}`;
        select.appendChild(option);
      });
    });

    selectedModelId = resolveSelectedModelId(selectedModelId, modelProfiles);
    select.value = selectedModelId;
    renderReasoningSelect();
  }

  function readProfilesFromForm() {
    const items = Array.from(document.querySelectorAll('.model-config'));
    if (!items.length) return modelProfiles.map(normalizeModelProfile);

    return items.map(item => {
      const models = normalizeModelNames(Array.from(item.querySelectorAll('[data-field="model"]')).map(input => input.value));
      const profileId = item.dataset.id || createId();
      const selectedModel = getSelectedProfileId() === profileId
        ? getSelectedModelNameFromModels(models)
        : models[0] || '';
      return {
        id: profileId,
        name: item.querySelector('[data-field="name"]').value.trim(),
        baseUrl: item.querySelector('[data-field="baseUrl"]').value.trim(),
        apiKey: item.querySelector('[data-field="apiKey"]').value.trim(),
        hasApiKey: item.querySelector('[data-field="apiKey"]').placeholder.includes('沿用已保存'),
        model: selectedModel,
        models,
        reasoningEnabled: item.querySelector('[data-field="reasoningEnabled"]').checked,
        reasoningEffort: item.querySelector('[data-field="reasoningEffort"]').value,
      };
    });
  }

  function handleModelSelect(event) {
    modelProfiles = readProfilesFromForm();
    selectedModelId = event.target.value;
    localStorage.setItem('llm_selected_profile', selectedModelId);
    saveModelProfilesLocal();
    syncLegacyConfig();
    renderReasoningSelect();
  }

  function handleReasoningSelect(event) {
    modelProfiles = readProfilesFromForm();
    const selectedProfile = getSelectedProfileFromProfiles(modelProfiles) || modelProfiles[0];
    if (!selectedProfile) return;

    selectedProfile.reasoningEnabled = event.target.value !== 'off';
    selectedProfile.reasoningEffort = event.target.value === 'off' ? 'medium' : event.target.value;
    saveModelProfilesLocal();
    renderModelConfigList();
    renderModelSelect();
  }

  function renderReasoningSelect() {
    const select = document.getElementById('select-thinking');
    const profile = getSelectedModelConfig();
    if (!profile?.reasoningEnabled) {
      select.value = 'off';
      return;
    }
    select.value = profile.reasoningEffort || 'medium';
  }

  function getSelectedModelConfig() {
    const currentProfiles = readProfilesFromForm();
    const profile = getSelectedProfileFromProfiles(currentProfiles) || currentProfiles[0] || null;
    if (!profile) return null;
    return {
      ...profile,
      model: getSelectedModelNameFromProfile(profile),
    };
  }

  function getActiveModelConfig() {
    const config = deps.getActiveModelConfigSnapshot?.() || getSelectedModelConfig();
    if (!config) return null;
    return {
      ...config,
      signal: deps.getAbortSignal?.(),
    };
  }

  function getWritingModelConfig() {
    const config = deps.getActiveModelConfigSnapshot?.() || getSelectedModelConfig();
    if (!config) return null;
    return {
      ...config,
      reasoningEnabled: false,
      reasoningEffort: 'medium',
      timeoutMs: 180000,
      signal: deps.getAbortSignal?.(),
    };
  }

  // 传给后端文档服务的模型选择信息（不含密钥，后端按 profileId 自行取用）。
  function getActiveModelSelectionForBackend() {
    const config = deps.getActiveModelConfigSnapshot?.() || getSelectedModelConfig();
    if (!config) return {};
    return {
      profileId: config.id || config.profileId || getSelectedProfileId(),
      model: config.model || getSelectedModelNameFromProfile(config),
      reasoningEnabled: Boolean(config.reasoningEnabled),
      reasoningEffort: config.reasoningEffort || 'medium',
    };
  }

  function getSystemPrompt() {
    return document.getElementById('input-system-prompt').value.trim();
  }

  function isWebSearchEnabled() {
    return Boolean(document.getElementById('input-web-search-enabled')?.checked);
  }

  function ensureSettingsRendered() {
    if (modelConfigRendered) return;
    renderModelConfigList();
  }

  function showSettingsStatus(msg, type) {
    const el = document.getElementById('settings-status');
    el.textContent = msg;
    el.className = `status-text ${type}`;
  }

  function getSelectedProfileId() {
    return getSelectedProfileIdData(selectedModelId);
  }

  function getSelectedProfileFromProfiles(profiles) {
    return getSelectedProfileFromProfilesData(profiles, selectedModelId);
  }

  function getSelectedModelNameFromModels(models) {
    return getSelectedModelNameFromModelsData(models, selectedModelId);
  }

  function getSelectedModelNameFromProfile(profile) {
    return getSelectedModelNameFromProfileData(profile, selectedModelId);
  }

  return {
    addModelProfile,
    getActiveModelConfig,
    getActiveModelSelectionForBackend,
    getSystemPrompt,
    getWritingModelConfig,
    handleModelSelect,
    handleReasoningSelect,
    ensureSettingsRendered,
    isWebSearchEnabled,
    loadSettings,
    saveSettings,
  };
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function createId() {
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}
