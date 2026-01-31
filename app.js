/**
 * OpenClaw 配置管理器
 * 用于可视化管理 OpenClaw 配置文件
 */

// ===== 默认配置模板 =====
const DEFAULT_CONFIG = {
    meta: {
        lastTouchedVersion: "2026.1.29",
        lastTouchedAt: new Date().toISOString()
    },
    wizard: {
        lastRunAt: new Date().toISOString(),
        lastRunVersion: "2026.1.29",
        lastRunCommand: "onboard",
        lastRunMode: "local"
    },
    auth: {
        profiles: {}
    },
    models: {
        providers: {}
    },
    agents: {
        defaults: {
            model: {
                primary: "",
                fallbacks: []
            },
            models: {},
            workspace: "",
            maxConcurrent: 4,
            subagents: {
                maxConcurrent: 8
            }
        }
    },
    messages: {
        ackReactionScope: "group-mentions"
    },
    commands: {
        native: "auto",
        nativeSkills: "auto",
        restart: true
    },
    hooks: {
        internal: {
            enabled: true,
            entries: {
                "boot-md": { enabled: true },
                "session-memory": { enabled: true }
            }
        }
    },
    channels: {},
    gateway: {
        port: 18789,
        mode: "local",
        bind: "loopback",
        auth: {
            mode: "token",
            token: ""
        },
        tailscale: {
            mode: "off",
            resetOnExit: false
        }
    },
    skills: {
        install: {
            nodeManager: "npm"
        }
    },
    plugins: {
        entries: {}
    }
};

// ===== 应用状态 =====
let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let editingProvider = null;
let editingModel = null;
let editingChannel = null;

// 缓存状态
let cachedConfig = null; // 上传时的原始配置
let isModified = false;  // 配置是否已修改

// ===== DOM 元素引用 =====
const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    sections: document.querySelectorAll('.section'),

    // Buttons
    importBtn: document.getElementById('importBtn'),
    exportBtn: document.getElementById('exportBtn'),
    addProviderBtn: document.getElementById('addProviderBtn'),
    addChannelBtn: document.getElementById('addChannelBtn'),
    addFallbackBtn: document.getElementById('addFallbackBtn'),
    formatJsonBtn: document.getElementById('formatJsonBtn'),
    toggleTokenBtn: document.getElementById('toggleTokenBtn'),
    generateTokenBtn: document.getElementById('generateTokenBtn'),

    // Containers
    providersList: document.getElementById('providersList'),
    channelsList: document.getElementById('channelsList'),
    fallbackModels: document.getElementById('fallbackModels'),

    // Form fields
    primaryModel: document.getElementById('primaryModel'),
    workspace: document.getElementById('workspace'),
    maxConcurrent: document.getElementById('maxConcurrent'),
    gatewayPort: document.getElementById('gatewayPort'),
    gatewayBind: document.getElementById('gatewayBind'),
    gatewayToken: document.getElementById('gatewayToken'),
    rawJson: document.getElementById('rawJson'),

    // File input
    fileInput: document.getElementById('fileInput'),

    // Toast
    toast: document.getElementById('toast'),

    // Provider Modal
    providerModal: document.getElementById('providerModal'),
    providerModalTitle: document.getElementById('providerModalTitle'),
    providerName: document.getElementById('providerName'),
    providerBaseUrl: document.getElementById('providerBaseUrl'),
    providerApiKey: document.getElementById('providerApiKey'),
    providerApiMode: document.getElementById('providerApiMode'),
    closeProviderModal: document.getElementById('closeProviderModal'),
    cancelProviderBtn: document.getElementById('cancelProviderBtn'),
    saveProviderBtn: document.getElementById('saveProviderBtn'),

    // Model Modal
    modelModal: document.getElementById('modelModal'),
    modelModalTitle: document.getElementById('modelModalTitle'),
    modelProviderName: document.getElementById('modelProviderName'),
    modelId: document.getElementById('modelId'),
    modelName: document.getElementById('modelName'),
    modelContextWindow: document.getElementById('modelContextWindow'),
    modelMaxTokens: document.getElementById('modelMaxTokens'),
    modelReasoning: document.getElementById('modelReasoning'),
    modelVision: document.getElementById('modelVision'),
    closeModelModal: document.getElementById('closeModelModal'),
    cancelModelBtn: document.getElementById('cancelModelBtn'),
    saveModelBtn: document.getElementById('saveModelBtn'),

    // Channel Modal
    channelModal: document.getElementById('channelModal'),
    channelModalTitle: document.getElementById('channelModalTitle'),
    channelType: document.getElementById('channelType'),
    channelEnabled: document.getElementById('channelEnabled'),
    channelBotToken: document.getElementById('channelBotToken'),
    channelAllowFrom: document.getElementById('channelAllowFrom'),
    channelProxy: document.getElementById('channelProxy'),
    closeChannelModal: document.getElementById('closeChannelModal'),
    cancelChannelBtn: document.getElementById('cancelChannelBtn'),
    saveChannelBtn: document.getElementById('saveChannelBtn'),

    // Cache buttons
    revertConfigBtn: document.getElementById('revertConfigBtn'),
    saveCacheBtn: document.getElementById('saveCacheBtn'),
    cacheStatus: document.getElementById('cacheStatus'),

    // Commands
    cmdUsername: document.getElementById('cmdUsername'),
    cmdPath: document.getElementById('cmdPath'),
    commandsList: document.getElementById('commandsList'),

    // Agent extended settings
    subagentMaxConcurrent: document.getElementById('subagentMaxConcurrent'),
    sandboxMode: document.getElementById('sandboxMode')
};

// ===== 工具函数 =====

function showToast(message, type = 'success') {
    const icons = {
        success: '✓',
        error: '✗',
        warning: '!'
    };

    elements.toast.className = `toast ${type}`;
    elements.toast.querySelector('.toast-icon').textContent = icons[type] || icons.success;
    elements.toast.querySelector('.toast-message').textContent = message;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

function generateToken(length = 48) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getProviderIcon(name) {
    const icons = {
        'anthropic': '🤖',
        'openai': '🧠',
        'qwen': '🔮',
        'demo-api': '🧪',
        'default': '🏢'
    };
    return icons[name.toLowerCase()] || icons.default;
}

function getChannelIcon(type) {
    const icons = {
        'telegram': '✈️',
        'discord': '🎮',
        'whatsapp': '💬',
        'default': '📱'
    };
    return icons[type.toLowerCase()] || icons.default;
}

function getAllModels() {
    const models = [];
    const providers = config.models?.providers || {};

    for (const [providerName, provider] of Object.entries(providers)) {
        const providerModels = provider.models || [];
        for (const model of providerModels) {
            models.push({
                id: `${providerName}/${model.id}`,
                name: model.name || model.id,
                provider: providerName
            });
        }
    }

    return models;
}

// ===== 导航 =====

function initNavigation() {
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(sectionId) {
    // Update navigation
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // Update sections
    elements.sections.forEach(section => {
        section.classList.toggle('hidden', section.id !== `section-${sectionId}`);
    });

    // Refresh section content
    if (sectionId === 'raw') {
        elements.rawJson.value = JSON.stringify(config, null, 2);
    } else if (sectionId === 'agent') {
        renderAgentSettings();
    }
}

// ===== Provider 管理 =====

function renderProviders() {
    const providers = config.models?.providers || {};

    if (Object.keys(providers).length === 0) {
        elements.providersList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏢</div>
                <div class="empty-state-text">暂无模型提供商</div>
                <button class="btn btn-primary" onclick="openProviderModal()">
                    <span class="icon">+</span> 添加第一个提供商
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    for (const [name, provider] of Object.entries(providers)) {
        const models = provider.models || [];
        html += `
            <div class="provider-card" data-provider="${name}">
                <div class="provider-header" onclick="toggleProvider('${name}')">
                    <div class="provider-info">
                        <div class="provider-icon">${getProviderIcon(name)}</div>
                        <div>
                            <div class="provider-name">${name}</div>
                            <div class="provider-url">${provider.baseUrl || ''}</div>
                        </div>
                    </div>
                    <div class="provider-actions">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openProviderModal('${name}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteProvider('${name}')">删除</button>
                    </div>
                </div>
                <div class="provider-body" id="provider-body-${name}">
                    <div class="model-list">
                        ${models.map((model, index) => `
                            <div class="model-item">
                                <div class="model-info">
                                    <div class="model-id">${model.id}</div>
                                    <div class="model-meta">
                                        <span>${model.name || ''}</span>
                                        ${model.reasoning ? '<span class="model-badge">🧠 推理</span>' : ''}
                                        ${model.input?.includes('image') ? '<span class="model-badge">👁️ 视觉</span>' : ''}
                                    </div>
                                </div>
                                <div class="model-actions">
                                    <button class="btn btn-icon" onclick="openModelModal('${name}', ${index})">✏️</button>
                                    <button class="btn btn-icon" onclick="deleteModel('${name}', ${index})">🗑️</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <button class="add-model-btn" onclick="openModelModal('${name}')">
                        + 添加模型
                    </button>
                </div>
            </div>
        `;
    }

    elements.providersList.innerHTML = html;
}

function toggleProvider(name) {
    const body = document.getElementById(`provider-body-${name}`);
    if (body) {
        body.classList.toggle('collapsed');
    }
}

function openProviderModal(name = null) {
    editingProvider = name;

    if (name) {
        // 编辑模式
        elements.providerModalTitle.textContent = '编辑提供商';
        const provider = config.models.providers[name];
        elements.providerName.value = name;
        elements.providerName.disabled = false; // 允许修改名称
        elements.providerBaseUrl.value = provider.baseUrl || '';
        elements.providerApiKey.value = provider.apiKey || '';
        elements.providerApiMode.value = provider.api || 'openai-completions';
    } else {
        // 添加模式
        elements.providerModalTitle.textContent = '添加提供商';
        elements.providerName.value = '';
        elements.providerName.disabled = false;
        elements.providerBaseUrl.value = '';
        elements.providerApiKey.value = '';
        elements.providerApiMode.value = 'openai-completions';
    }

    elements.providerModal.classList.remove('hidden');
}

function closeProviderModalHandler() {
    elements.providerModal.classList.add('hidden');
    editingProvider = null;
}

function saveProvider() {
    const name = elements.providerName.value.trim();
    const baseUrl = elements.providerBaseUrl.value.trim();
    const apiKey = elements.providerApiKey.value.trim();
    const apiMode = elements.providerApiMode.value;

    if (!name) {
        showToast('请输入提供商名称', 'error');
        return;
    }

    if (!baseUrl) {
        showToast('请输入 API Base URL', 'error');
        return;
    }

    if (!apiKey) {
        showToast('请输入 API Key', 'error');
        return;
    }

    if (!config.models) {
        config.models = { providers: {} };
    }
    if (!config.models.providers) {
        config.models.providers = {};
    }

    // 检查是否重命名了提供商
    const isRenaming = editingProvider && editingProvider !== name;

    // 如果重命名，检查新名称是否已存在
    if (isRenaming && config.models.providers[name]) {
        showToast(`提供商 "${name}" 已存在，请使用其他名称`, 'error');
        return;
    }

    // 获取现有模型
    const existingModels = editingProvider ? (config.models.providers[editingProvider]?.models || []) : [];

    // 如果是重命名，删除旧的提供商
    if (isRenaming) {
        delete config.models.providers[editingProvider];

        // 更新 Agent 设置中的模型引用
        updateModelReferences(editingProvider, name);
    }

    config.models.providers[name] = {
        baseUrl: baseUrl,
        apiKey: apiKey,
        api: apiMode,
        models: existingModels
    };

    closeProviderModalHandler();
    renderProviders();
    updateModelSelectors();
    showToast(editingProvider ? (isRenaming ? '提供商已重命名' : '提供商已更新') : '提供商已添加');
}

function deleteProvider(name) {
    if (!confirm(`确定要删除提供商 "${name}" 吗？这将同时删除所有相关模型。`)) {
        return;
    }

    delete config.models.providers[name];
    renderProviders();
    updateModelSelectors();
    showToast('提供商已删除');
}

// 更新模型引用（当提供商重命名时）
function updateModelReferences(oldProviderName, newProviderName) {
    // 更新主模型
    if (config.agents?.defaults?.model?.primary) {
        const primary = config.agents.defaults.model.primary;
        if (primary.startsWith(oldProviderName + '/')) {
            config.agents.defaults.model.primary = primary.replace(oldProviderName + '/', newProviderName + '/');
        }
    }

    // 更新备用模型
    if (config.agents?.defaults?.model?.fallbacks) {
        config.agents.defaults.model.fallbacks = config.agents.defaults.model.fallbacks.map(fallback => {
            if (fallback.startsWith(oldProviderName + '/')) {
                return fallback.replace(oldProviderName + '/', newProviderName + '/');
            }
            return fallback;
        });
    }

    // 更新模型别名
    if (config.agents?.defaults?.models) {
        const newModels = {};
        for (const [key, value] of Object.entries(config.agents.defaults.models)) {
            if (key.startsWith(oldProviderName + '/')) {
                const newKey = key.replace(oldProviderName + '/', newProviderName + '/');
                newModels[newKey] = value;
            } else {
                newModels[key] = value;
            }
        }
        config.agents.defaults.models = newModels;
    }
}

// ===== Model 管理 =====

function openModelModal(providerName, modelIndex = null) {
    elements.modelProviderName.value = providerName;
    editingModel = modelIndex;

    if (modelIndex !== null) {
        // 编辑模式
        elements.modelModalTitle.textContent = '编辑模型';
        const model = config.models.providers[providerName].models[modelIndex];
        elements.modelId.value = model.id || '';
        elements.modelName.value = model.name || '';
        elements.modelContextWindow.value = model.contextWindow || 200000;
        elements.modelMaxTokens.value = model.maxTokens || 32000;
        elements.modelReasoning.checked = model.reasoning !== false;
        elements.modelVision.checked = model.input?.includes('image') !== false;
    } else {
        // 添加模式
        elements.modelModalTitle.textContent = '添加模型';
        elements.modelId.value = '';
        elements.modelName.value = '';
        elements.modelContextWindow.value = 200000;
        elements.modelMaxTokens.value = 32000;
        elements.modelReasoning.checked = true;
        elements.modelVision.checked = true;
    }

    elements.modelModal.classList.remove('hidden');
}

function closeModelModalHandler() {
    elements.modelModal.classList.add('hidden');
    editingModel = null;
}

function saveModel() {
    const providerName = elements.modelProviderName.value;
    const modelId = elements.modelId.value.trim();
    const modelName = elements.modelName.value.trim();
    const contextWindow = parseInt(elements.modelContextWindow.value) || 200000;
    const maxTokens = parseInt(elements.modelMaxTokens.value) || 32000;
    const reasoning = elements.modelReasoning.checked;
    const vision = elements.modelVision.checked;

    if (!modelId) {
        showToast('请输入模型 ID', 'error');
        return;
    }

    const model = {
        id: modelId,
        name: modelName || modelId,
        reasoning: reasoning,
        input: vision ? ['text', 'image'] : ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: contextWindow,
        maxTokens: maxTokens
    };

    const provider = config.models.providers[providerName];
    if (!provider.models) {
        provider.models = [];
    }

    if (editingModel !== null) {
        provider.models[editingModel] = model;
    } else {
        provider.models.push(model);
    }

    closeModelModalHandler();
    renderProviders();
    updateModelSelectors();
    showToast(editingModel !== null ? '模型已更新' : '模型已添加');
}

function deleteModel(providerName, modelIndex) {
    const model = config.models.providers[providerName].models[modelIndex];
    if (!confirm(`确定要删除模型 "${model.id}" 吗？`)) {
        return;
    }

    config.models.providers[providerName].models.splice(modelIndex, 1);
    renderProviders();
    updateModelSelectors();
    showToast('模型已删除');
}

// ===== Agent 设置 =====

function renderAgentSettings() {
    updateModelSelectors();

    const defaults = config.agents?.defaults || {};
    elements.workspace.value = defaults.workspace || '';
    elements.maxConcurrent.value = defaults.maxConcurrent || 4;

    // 子 Agent 并发数
    if (elements.subagentMaxConcurrent) {
        elements.subagentMaxConcurrent.value = defaults.subagents?.maxConcurrent || 8;
    }

    // 沙箱模式
    if (elements.sandboxMode) {
        elements.sandboxMode.value = defaults.sandbox?.mode || '';
    }

    // Render fallback models
    renderFallbackModels();
}

function updateModelSelectors() {
    const models = getAllModels();
    const primary = config.agents?.defaults?.model?.primary || '';

    let optionsHtml = '<option value="">选择模型...</option>';
    models.forEach(model => {
        const selected = model.id === primary ? 'selected' : '';
        optionsHtml += `<option value="${model.id}" ${selected}>${model.id} (${model.name})</option>`;
    });

    elements.primaryModel.innerHTML = optionsHtml;
}

function renderFallbackModels() {
    const fallbacks = config.agents?.defaults?.model?.fallbacks || [];
    const allModels = getAllModels();

    let html = '';
    fallbacks.forEach((fallback, index) => {
        let optionsHtml = '<option value="">选择模型...</option>';
        allModels.forEach(model => {
            const selected = model.id === fallback ? 'selected' : '';
            optionsHtml += `<option value="${model.id}" ${selected}>${model.id}</option>`;
        });

        html += `
            <div class="fallback-item">
                <select class="select fallback-select" data-index="${index}" onchange="updateFallback(${index}, this.value)">
                    ${optionsHtml}
                </select>
                <button class="btn btn-icon" onclick="removeFallback(${index})">🗑️</button>
            </div>
        `;
    });

    elements.fallbackModels.innerHTML = html;
}

function addFallback() {
    if (!config.agents) config.agents = { defaults: { model: { fallbacks: [] } } };
    if (!config.agents.defaults) config.agents.defaults = { model: { fallbacks: [] } };
    if (!config.agents.defaults.model) config.agents.defaults.model = { fallbacks: [] };
    if (!config.agents.defaults.model.fallbacks) config.agents.defaults.model.fallbacks = [];

    config.agents.defaults.model.fallbacks.push('');
    renderFallbackModels();
}

function updateFallback(index, value) {
    config.agents.defaults.model.fallbacks[index] = value;
}

function removeFallback(index) {
    config.agents.defaults.model.fallbacks.splice(index, 1);
    renderFallbackModels();
}

// ===== Channel 管理 =====

function renderChannels() {
    const channels = config.channels || {};

    if (Object.keys(channels).length === 0) {
        elements.channelsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📱</div>
                <div class="empty-state-text">暂无渠道配置</div>
                <button class="btn btn-primary" onclick="openChannelModal()">
                    <span class="icon">+</span> 添加渠道
                </button>
            </div>
        `;
        return;
    }

    let html = '';
    for (const [type, channel] of Object.entries(channels)) {
        html += `
            <div class="channel-card" data-channel="${type}">
                <div class="channel-header">
                    <div class="channel-info">
                        <span class="channel-icon">${getChannelIcon(type)}</span>
                        <span class="channel-name">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </div>
                    <div>
                        <span class="channel-status ${channel.enabled ? 'enabled' : 'disabled'}">
                            ${channel.enabled ? '已启用' : '已禁用'}
                        </span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Bot Token</label>
                    <input type="password" class="input" value="${channel.botToken || ''}" readonly>
                </div>
                ${channel.allowFrom ? `
                    <div class="form-group">
                        <label>允许的用户</label>
                        <div class="model-meta">${channel.allowFrom.join(', ')}</div>
                    </div>
                ` : ''}
                ${channel.proxy ? `
                    <div class="form-group">
                        <label>代理</label>
                        <div class="model-meta">${channel.proxy}</div>
                    </div>
                ` : ''}
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    <button class="btn btn-secondary btn-sm" onclick="openChannelModal('${type}')">编辑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteChannel('${type}')">删除</button>
                </div>
            </div>
        `;
    }

    elements.channelsList.innerHTML = html;
}

function openChannelModal(type = null) {
    editingChannel = type;

    if (type) {
        elements.channelModalTitle.textContent = '编辑渠道';
        const channel = config.channels[type];
        elements.channelType.value = type;
        elements.channelType.disabled = true;
        elements.channelEnabled.checked = channel.enabled !== false;
        elements.channelBotToken.value = channel.botToken || '';
        elements.channelAllowFrom.value = (channel.allowFrom || []).join(', ');
        elements.channelProxy.value = channel.proxy || '';
    } else {
        elements.channelModalTitle.textContent = '添加渠道';
        elements.channelType.value = 'telegram';
        elements.channelType.disabled = false;
        elements.channelEnabled.checked = true;
        elements.channelBotToken.value = '';
        elements.channelAllowFrom.value = '';
        elements.channelProxy.value = '';
    }

    elements.channelModal.classList.remove('hidden');
}

function closeChannelModalHandler() {
    elements.channelModal.classList.add('hidden');
    editingChannel = null;
}

function saveChannel() {
    const type = elements.channelType.value;
    const enabled = elements.channelEnabled.checked;
    const botToken = elements.channelBotToken.value.trim();
    const allowFromStr = elements.channelAllowFrom.value.trim();
    const proxy = elements.channelProxy.value.trim();

    if (!botToken) {
        showToast('请输入 Bot Token', 'error');
        return;
    }

    const allowFrom = allowFromStr
        ? allowFromStr.split(',').map(s => {
            const num = parseInt(s.trim());
            return isNaN(num) ? s.trim() : num;
        })
        : [];

    if (!config.channels) config.channels = {};

    config.channels[type] = {
        enabled: enabled,
        dmPolicy: 'pairing',
        botToken: botToken,
        allowFrom: allowFrom,
        groupPolicy: 'allowlist',
        streamMode: 'partial',
        ...(proxy ? { proxy: proxy } : {})
    };

    // Update plugins
    if (!config.plugins) config.plugins = { entries: {} };
    if (!config.plugins.entries) config.plugins.entries = {};
    config.plugins.entries[type] = { enabled: enabled };

    closeChannelModalHandler();
    renderChannels();
    showToast(editingChannel ? '渠道已更新' : '渠道已添加');
}

function deleteChannel(type) {
    if (!confirm(`确定要删除渠道 "${type}" 吗？`)) {
        return;
    }

    delete config.channels[type];
    if (config.plugins?.entries) {
        delete config.plugins.entries[type];
    }

    renderChannels();
    showToast('渠道已删除');
}

// ===== Gateway 设置 =====

function renderGateway() {
    const gateway = config.gateway || {};
    elements.gatewayPort.value = gateway.port || 18789;
    elements.gatewayBind.value = gateway.bind || 'loopback';
    elements.gatewayToken.value = gateway.auth?.token || '';
}

function saveGatewaySettings() {
    if (!config.gateway) config.gateway = {};

    config.gateway.port = parseInt(elements.gatewayPort.value) || 18789;
    config.gateway.bind = elements.gatewayBind.value;

    if (!config.gateway.auth) config.gateway.auth = { mode: 'token' };
    config.gateway.auth.token = elements.gatewayToken.value;
}

// ===== Raw JSON =====

function updateRawJson() {
    try {
        config = JSON.parse(elements.rawJson.value);
        renderAll();
        showToast('配置已更新');
    } catch (e) {
        showToast('JSON 格式错误: ' + e.message, 'error');
    }
}

function formatJson() {
    try {
        const parsed = JSON.parse(elements.rawJson.value);
        elements.rawJson.value = JSON.stringify(parsed, null, 2);
        showToast('JSON 已格式化');
    } catch (e) {
        showToast('JSON 格式错误: ' + e.message, 'error');
    }
}

// ===== 导入/导出 =====

function importConfig() {
    elements.fileInput.click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            config = JSON.parse(e.target.result);
            renderAll();
            showToast(`配置文件 "${file.name}" 已导入`);
        } catch (err) {
            showToast('无法解析配置文件: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

function exportConfig() {
    // Update config from form fields
    saveAllSettings();

    // Update meta
    config.meta = config.meta || {};
    config.meta.lastTouchedAt = new Date().toISOString();

    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'openclaw.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('配置已导出为 openclaw.json');
}

function saveAllSettings() {
    // Agent settings
    if (!config.agents) config.agents = { defaults: {} };
    if (!config.agents.defaults) config.agents.defaults = {};
    if (!config.agents.defaults.model) config.agents.defaults.model = {};

    config.agents.defaults.model.primary = elements.primaryModel.value;
    config.agents.defaults.workspace = elements.workspace.value;
    config.agents.defaults.maxConcurrent = parseInt(elements.maxConcurrent.value) || 4;

    // Gateway settings
    saveGatewaySettings();
}

// ===== 初始化 =====

function renderAll() {
    renderProviders();
    renderAgentSettings();
    renderChannels();
    renderGateway();
}

function initEventListeners() {
    // Navigation
    initNavigation();

    // Import/Export
    elements.importBtn.addEventListener('click', importConfig);
    elements.exportBtn.addEventListener('click', exportConfig);
    elements.fileInput.addEventListener('change', handleFileImport);

    // Provider Modal
    elements.addProviderBtn.addEventListener('click', () => openProviderModal());
    elements.closeProviderModal.addEventListener('click', closeProviderModalHandler);
    elements.cancelProviderBtn.addEventListener('click', closeProviderModalHandler);
    elements.saveProviderBtn.addEventListener('click', saveProvider);

    // Model Modal
    elements.closeModelModal.addEventListener('click', closeModelModalHandler);
    elements.cancelModelBtn.addEventListener('click', closeModelModalHandler);
    elements.saveModelBtn.addEventListener('click', saveModel);

    // Channel Modal
    elements.addChannelBtn.addEventListener('click', () => openChannelModal());
    elements.closeChannelModal.addEventListener('click', closeChannelModalHandler);
    elements.cancelChannelBtn.addEventListener('click', closeChannelModalHandler);
    elements.saveChannelBtn.addEventListener('click', saveChannel);

    // Agent settings
    elements.addFallbackBtn.addEventListener('click', addFallback);
    elements.primaryModel.addEventListener('change', (e) => {
        if (!config.agents) config.agents = { defaults: { model: {} } };
        if (!config.agents.defaults) config.agents.defaults = { model: {} };
        if (!config.agents.defaults.model) config.agents.defaults.model = {};
        config.agents.defaults.model.primary = e.target.value;
    });

    // Gateway settings
    elements.toggleTokenBtn.addEventListener('click', () => {
        const type = elements.gatewayToken.type;
        elements.gatewayToken.type = type === 'password' ? 'text' : 'password';
    });
    elements.generateTokenBtn.addEventListener('click', () => {
        elements.gatewayToken.value = generateToken();
        showToast('已生成新的认证 Token');
    });

    // Raw JSON
    elements.formatJsonBtn.addEventListener('click', formatJson);
    elements.rawJson.addEventListener('blur', updateRawJson);

    // Close modals on overlay click
    [elements.providerModal, elements.modelModal, elements.channelModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.providerModal.classList.add('hidden');
            elements.modelModal.classList.add('hidden');
            elements.channelModal.classList.add('hidden');
        }
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initEventListeners();
    initAgentSettingsListeners();

    // 自动加载示例数据
    await loadExampleConfig();

    renderAll();
    showToast('欢迎使用 OpenClaw 配置管理器 🦞', 'success');
});

// 自动加载示例配置
async function loadExampleConfig() {
    try {
        const response = await fetch('openclaw-example.json');
        if (response.ok) {
            const exampleConfig = await response.json();
            config = exampleConfig;
            cachedConfig = JSON.parse(JSON.stringify(config));
            isModified = false;
        }
    } catch (e) {
        console.log('No example config found, using default');
    }
}

// Agent 设置事件监听
function initAgentSettingsListeners() {
    // 工作区路径
    if (elements.workspace) {
        elements.workspace.addEventListener('change', () => {
            if (!config.agents) config.agents = { defaults: {} };
            if (!config.agents.defaults) config.agents.defaults = {};
            config.agents.defaults.workspace = elements.workspace.value;
            onConfigChanged();
        });
    }

    // 最大并发数
    if (elements.maxConcurrent) {
        elements.maxConcurrent.addEventListener('change', () => {
            if (!config.agents) config.agents = { defaults: {} };
            if (!config.agents.defaults) config.agents.defaults = {};
            config.agents.defaults.maxConcurrent = parseInt(elements.maxConcurrent.value) || 4;
            onConfigChanged();
        });
    }

    // 子 Agent 并发数
    if (elements.subagentMaxConcurrent) {
        elements.subagentMaxConcurrent.addEventListener('change', () => {
            if (!config.agents) config.agents = { defaults: {} };
            if (!config.agents.defaults) config.agents.defaults = {};
            if (!config.agents.defaults.subagents) config.agents.defaults.subagents = {};
            config.agents.defaults.subagents.maxConcurrent = parseInt(elements.subagentMaxConcurrent.value) || 8;
            onConfigChanged();
        });
    }

    // 沙盒模式
    if (elements.sandboxMode) {
        elements.sandboxMode.addEventListener('change', () => {
            if (!config.agents) config.agents = { defaults: {} };
            if (!config.agents.defaults) config.agents.defaults = {};
            if (elements.sandboxMode.value) {
                if (!config.agents.defaults.sandbox) config.agents.defaults.sandbox = {};
                config.agents.defaults.sandbox.mode = elements.sandboxMode.value;
            } else {
                delete config.agents.defaults.sandbox;
            }
            onConfigChanged();
        });
    }
}

// ===== 主题切换 =====

function initTheme() {
    const savedTheme = localStorage.getItem('openclaw-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('openclaw-theme', newTheme);
    updateThemeIcon(newTheme);

    showToast(`已切换到${newTheme === 'dark' ? '深色' : '明亮'}主题`);
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
        themeToggle.title = theme === 'dark' ? '切换到明亮主题' : '切换到深色主题';
    }
}

// Add theme toggle event listener
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});

// Expose functions to global scope for inline handlers
window.openProviderModal = openProviderModal;
window.toggleProvider = toggleProvider;
window.deleteProvider = deleteProvider;
window.openModelModal = openModelModal;
window.deleteModel = deleteModel;
window.openChannelModal = openChannelModal;
window.deleteChannel = deleteChannel;
window.updateFallback = updateFallback;
window.removeFallback = removeFallback;
window.toggleTheme = toggleTheme;
window.copyCommand = copyCommand;

// ===== 实时同步 =====

// 每次配置变化时调用此函数
function onConfigChanged() {
    isModified = true;
    updateCacheStatus();
    updateRawJsonDisplay();

    // 如果当前在命令页面，重新渲染命令（确保写入配置命令包含最新配置）
    const commandsSection = document.getElementById('section-commands');
    if (commandsSection && !commandsSection.classList.contains('hidden')) {
        renderCommands();
    }
}

// 更新原始 JSON 显示
function updateRawJsonDisplay() {
    if (elements.rawJson) {
        elements.rawJson.value = JSON.stringify(config, null, 2);
    }
}

// 监听原始 JSON 的实时输入
function initRawJsonSync() {
    if (elements.rawJson) {
        elements.rawJson.addEventListener('input', () => {
            try {
                const parsed = JSON.parse(elements.rawJson.value);
                config = parsed;
                isModified = true;
                updateCacheStatus();
            } catch (e) {
                // JSON 格式不正确时不更新
            }
        });
    }
}

// ===== 缓存控制 =====

function updateCacheStatus() {
    if (!elements.cacheStatus) return;

    const statusText = elements.cacheStatus.querySelector('.status-text');

    if (!cachedConfig) {
        elements.cacheStatus.className = 'cache-status';
        statusText.textContent = '未导入配置';
    } else if (isModified) {
        elements.cacheStatus.className = 'cache-status modified';
        statusText.textContent = '已修改（未保存）';
    } else {
        elements.cacheStatus.className = 'cache-status saved';
        statusText.textContent = '已保存';
    }
}

function saveToCache() {
    cachedConfig = JSON.parse(JSON.stringify(config));
    isModified = false;
    updateCacheStatus();

    // 保存到 localStorage
    localStorage.setItem('openclaw-cache', JSON.stringify(config));
    localStorage.setItem('openclaw-cache-time', new Date().toISOString());

    showToast('配置已保存到缓存 💾');
}

function revertToCache() {
    if (!cachedConfig) {
        showToast('没有可恢复的缓存版本', 'warning');
        return;
    }

    if (!confirm('确定要恢复到上传时的版本吗？当前修改将丢失。')) {
        return;
    }

    config = JSON.parse(JSON.stringify(cachedConfig));
    isModified = false;
    renderAll();
    updateCacheStatus();
    showToast('已恢复到缓存版本 ↩️');
}

function loadFromLocalStorage() {
    const cached = localStorage.getItem('openclaw-cache');
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            const cacheTime = localStorage.getItem('openclaw-cache-time');
            if (confirm(`发现本地缓存（${cacheTime ? new Date(cacheTime).toLocaleString() : '未知时间'}），是否加载？`)) {
                config = parsed;
                cachedConfig = JSON.parse(JSON.stringify(parsed));
                isModified = false;
                renderAll();
                updateCacheStatus();
                showToast('已从本地缓存加载配置');
                return true;
            }
        } catch (e) {
            console.error('Failed to load cache:', e);
        }
    }
    return false;
}

// ===== 常用命令生成 =====

function getCommands() {
    const username = elements.cmdUsername?.value || 'root';
    const basePath = elements.cmdPath?.value || `/Users/${username}/.openclaw/`;
    const configPath = basePath + 'openclaw.json';
    const jsonContent = JSON.stringify(config, null, 2).replace(/'/g, "'\\''");

    return [
        {
            id: 'stop-gateway',
            icon: '🛑',
            title: '停止网关',
            command: 'openclaw gateway stop',
            description: '停止 OpenClaw 网关服务'
        },
        {
            id: 'start-gateway',
            icon: '🚀',
            title: '启动网关',
            command: 'openclaw gateway start',
            description: '启动 OpenClaw 网关服务'
        },
        {
            id: 'restart-gateway',
            icon: '🔄',
            title: '重启网关',
            command: 'openclaw gateway restart',
            description: '重启 OpenClaw 网关服务'
        },
        {
            id: 'delete-config',
            icon: '🗑️',
            title: '删除配置文件',
            command: `rm -f ${configPath} && rm -f ${basePath}.openclaw.json.swp`,
            description: '删除配置文件及 vim 交换文件'
        },
        {
            id: 'view-config',
            icon: '👁️',
            title: '查看配置文件',
            command: `cat ${configPath}`,
            description: '显示当前配置文件内容'
        },
        {
            id: 'backup-config',
            icon: '💾',
            title: '备份配置文件',
            command: `cp ${configPath} ${configPath}.backup.$(date +%Y%m%d_%H%M%S)`,
            description: '创建带时间戳的配置文件备份'
        },
        {
            id: 'write-config',
            icon: '✏️',
            title: '写入配置文件',
            command: `cat > ${configPath} << 'EOFCONFIG'\n${JSON.stringify(config, null, 2)}\nEOFCONFIG`,
            description: '将当前配置写入服务器（heredoc 方式）'
        }
    ];
}

function renderCommands() {
    if (!elements.commandsList) return;

    const commands = getCommands();

    let html = commands.map(cmd => `
        <div class="command-card">
            <div class="command-header">
                <div class="command-title">
                    <span class="icon">${cmd.icon}</span>
                    <span>${cmd.title}</span>
                </div>
                <button class="copy-btn" onclick="copyCommand('${cmd.id}')">
                    <span class="icon">📋</span> 复制
                </button>
            </div>
            <div class="command-body">
                <div class="command-code" id="cmd-${cmd.id}">${escapeHtml(cmd.command)}</div>
                <div class="command-description">${cmd.description}</div>
            </div>
        </div>
    `).join('');

    elements.commandsList.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyCommand(cmdId) {
    const commands = getCommands();
    const cmd = commands.find(c => c.id === cmdId);
    if (!cmd) return;

    navigator.clipboard.writeText(cmd.command).then(() => {
        const btn = document.querySelector(`[onclick="copyCommand('${cmdId}')"]`);
        if (btn) {
            btn.classList.add('copied');
            btn.innerHTML = '<span class="icon">✓</span> 已复制';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = '<span class="icon">📋</span> 复制';
            }, 2000);
        }
        showToast('命令已复制到剪贴板 📋');
    }).catch(err => {
        showToast('复制失败: ' + err.message, 'error');
    });
}

// 初始化命令输入监听
function initCommandsInput() {
    if (elements.cmdUsername) {
        elements.cmdUsername.addEventListener('input', () => {
            // 自动更新路径中的用户名
            const username = elements.cmdUsername.value;
            if (username && elements.cmdPath) {
                elements.cmdPath.value = `/Users/${username}/.openclaw/`;
            }
            renderCommands();
        });
    }
    if (elements.cmdPath) {
        elements.cmdPath.addEventListener('input', renderCommands);
    }
}

// ===== 初始化扩展功能 =====

function initExtendedFeatures() {
    // 缓存按钮
    if (elements.revertConfigBtn) {
        elements.revertConfigBtn.addEventListener('click', revertToCache);
    }
    if (elements.saveCacheBtn) {
        elements.saveCacheBtn.addEventListener('click', saveToCache);
    }

    // 实时同步
    initRawJsonSync();

    // 命令输入
    initCommandsInput();

    // 初始化缓存状态
    updateCacheStatus();
}

// 修改 DOMContentLoaded 初始化
document.addEventListener('DOMContentLoaded', () => {
    initExtendedFeatures();

    // 尝试从本地缓存加载
    loadFromLocalStorage();

    // 初始渲染命令
    renderCommands();
});

// 修改导入函数，保存原始缓存
const originalHandleFileImport = handleFileImport;
function handleFileImportWithCache(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            config = JSON.parse(e.target.result);
            cachedConfig = JSON.parse(JSON.stringify(config)); // 保存原始版本
            isModified = false;
            renderAll();
            updateCacheStatus();
            renderCommands();
            showToast(`配置文件 "${file.name}" 已导入`);
        } catch (err) {
            showToast('无法解析配置文件: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// 替换原有的文件导入处理
document.addEventListener('DOMContentLoaded', () => {
    if (elements.fileInput) {
        // 移除可能的旧监听器，添加新的
        elements.fileInput.removeEventListener('change', handleFileImport);
        elements.fileInput.addEventListener('change', handleFileImportWithCache);
    }
});

// 修改 switchSection，加入命令渲染
const originalSwitchSection = switchSection;
window.switchSection = function (sectionId) {
    // Update navigation
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    // Update sections
    elements.sections.forEach(section => {
        section.classList.toggle('hidden', section.id !== `section-${sectionId}`);
    });

    // Refresh section content
    if (sectionId === 'raw') {
        updateRawJsonDisplay();
    } else if (sectionId === 'agent') {
        renderAgentSettings();
    } else if (sectionId === 'commands') {
        renderCommands();
    }
};
