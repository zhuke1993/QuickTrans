/**
 * 设置页面逻辑
 * 管理API配置的增删改查和用户偏好设置
 */

(function() {
  'use strict';

  // DOM元素
  const elements = {
    emptyState: document.getElementById('empty-state'),
    configList: document.getElementById('config-list'),
    addConfigBtn: document.getElementById('add-config-btn'),
    configModal: document.getElementById('config-modal'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalClose: document.getElementById('modal-close'),
    modalTitle: document.getElementById('modal-title'),
    configForm: document.getElementById('config-form'),
    configId: document.getElementById('config-id'),
    configName: document.getElementById('config-name'),
    configEndpoint: document.getElementById('config-endpoint'),
    configApiKey: document.getElementById('config-apikey'),
    configModel: document.getElementById('config-model'),
    configTemperature: document.getElementById('config-temperature'),
    toggleApiKey: document.getElementById('toggle-apikey'),
    testBtn: document.getElementById('test-btn'),
    saveBtn: document.getElementById('save-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    // TTS配置元素
    ttsEmptyState: document.getElementById('tts-empty-state'),
    ttsConfigList: document.getElementById('tts-config-list'),
    addTtsConfigBtn: document.getElementById('add-tts-config-btn'),
    ttsConfigModal: document.getElementById('tts-config-modal'),
    ttsModalOverlay: document.getElementById('tts-modal-overlay'),
    ttsModalClose: document.getElementById('tts-modal-close'),
    ttsModalTitle: document.getElementById('tts-modal-title'),
    ttsConfigForm: document.getElementById('tts-config-form'),
    ttsConfigId: document.getElementById('tts-config-id'),
    ttsConfigName: document.getElementById('tts-config-name'),
    ttsConfigProvider: document.getElementById('tts-config-provider'),
    ttsConfigEndpoint: document.getElementById('tts-config-endpoint'),
    ttsConfigApiKey: document.getElementById('tts-config-apikey'),
    // Qwen特有字段
    ttsConfigModel: document.getElementById('tts-config-model'),
    ttsConfigVoice: document.getElementById('tts-config-voice'),
    ttsQwenModelGroup: document.getElementById('tts-qwen-model-group'),
    ttsQwenVoiceGroup: document.getElementById('tts-qwen-voice-group'),
    // OpenAI特有字段
    ttsOpenaiModel: document.getElementById('tts-openai-model'),
    ttsOpenaiVoice: document.getElementById('tts-openai-voice'),
    ttsOpenaiFormat: document.getElementById('tts-openai-format'),
    ttsOpenaiModelGroup: document.getElementById('tts-openai-model-group'),
    ttsOpenaiVoiceGroup: document.getElementById('tts-openai-voice-group'),
    ttsOpenaiFormatGroup: document.getElementById('tts-openai-format-group'),
    toggleTtsApiKey: document.getElementById('toggle-tts-apikey'),
    ttsSaveBtn: document.getElementById('tts-save-btn'),
    ttsCancelBtn: document.getElementById('tts-cancel-btn'),
    // 用户偏好元素
    defaultTargetLang: document.getElementById('default-target-lang'),
    autoShowPopup: document.getElementById('auto-show-popup'),
    maxTextLength: document.getElementById('max-text-length'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    // 缓存管理元素
    cacheCount: document.getElementById('cache-count'),
    cacheSize: document.getElementById('cache-size'),
    refreshCacheBtn: document.getElementById('refresh-cache-btn'),
    clearAllCacheBtn: document.getElementById('clear-all-cache-btn'),
    // Token统计元素
    totalTokens: document.getElementById('total-tokens'),
    promptTokens: document.getElementById('prompt-tokens'),
    completionTokens: document.getElementById('completion-tokens'),
    requestCount: document.getElementById('request-count'),
    tokenLastUpdated: document.getElementById('token-last-updated'),
    refreshTokenBtn: document.getElementById('refresh-token-btn'),
    resetTokenBtn: document.getElementById('reset-token-btn')
  };

  // 当前编辑的配置ID
  let editingConfigId = null;
  let editingTtsConfigId = null;

  /**
   * 初始化
   */
  async function init() {
    // 加载翻译API配置列表
    await loadConfigs();

    // 加载TTS API配置列表
    await loadTtsConfigs();

    // 加载用户偏好设置
    await loadPreferences();

    // 加载语言选项
    loadLanguageOptions();

    // 加载缓存统计
    await loadCacheStats();

    // 加载token统计
    await loadTokenStats();

    // 绑定事件
    bindEvents();

    console.log('设置页面已加载');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    // 翻译API配置按钮
    elements.addConfigBtn.addEventListener('click', () => {
      editingConfigId = null;
      openModal('添加翻译API配置');
    });

    // TTS API配置按钮
    elements.addTtsConfigBtn.addEventListener('click', () => {
      editingTtsConfigId = null;
      openTtsModal('添加TTS API配置');
    });

    // 翻译API模态框关闭
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);

    // TTS API模态框关闭
    elements.ttsModalClose.addEventListener('click', closeTtsModal);
    elements.ttsModalOverlay.addEventListener('click', closeTtsModal);
    elements.ttsCancelBtn.addEventListener('click', closeTtsModal);

    // 切换密钥可见性
    elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
    elements.toggleTtsApiKey.addEventListener('click', toggleTtsApiKeyVisibility);

    // 表单提交
    elements.configForm.addEventListener('submit', handleFormSubmit);
    elements.ttsConfigForm.addEventListener('submit', handleTtsFormSubmit);

    // 测试连接
    elements.testBtn.addEventListener('click', handleTestConnection);

    // TTS服务商选择变更
    elements.ttsConfigProvider.addEventListener('change', handleTtsProviderChange);

    // 偏好设置变更
    elements.defaultTargetLang.addEventListener('change', handlePreferenceChange);
    elements.autoShowPopup.addEventListener('change', handlePreferenceChange);
    elements.maxTextLength.addEventListener('change', handlePreferenceChange);
    elements.maxTextLength.addEventListener('blur', handlePreferenceChange);

    // 缓存管理按钮
    elements.refreshCacheBtn.addEventListener('click', handleRefreshCache);
    elements.clearAllCacheBtn.addEventListener('click', handleClearAllCache);

    // Token统计按钮
    elements.refreshTokenBtn.addEventListener('click', handleRefreshToken);
    elements.resetTokenBtn.addEventListener('click', handleResetToken);

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (elements.configModal.classList.contains('show')) {
          closeModal();
        }
        if (elements.ttsConfigModal.classList.contains('show')) {
          closeTtsModal();
        }
      }
    });
  }

  /**
   * 加载翻译API配置列表
   */
  async function loadConfigs() {
    const configs = await StorageUtils.getApiConfigs();

    if (configs.length === 0) {
      elements.emptyState.style.display = 'block';
      elements.configList.style.display = 'none';
      return;
    }

    elements.emptyState.style.display = 'none';
    elements.configList.style.display = 'grid';

    // 渲染配置卡片
    elements.configList.innerHTML = configs.map(config => createConfigCard(config)).join('');

    // 绑定卡片按钮事件
    bindConfigCardEvents();
  }

  /**
   * 创建翻译API配置卡片HTML
   */
  function createConfigCard(config) {
    const createdDate = new Date(config.createdAt).toLocaleDateString('zh-CN');
    const maskedApiKey = maskApiKey(config.apiKey);
    const modelName = config.model;
    const temperature = config.temperature !== undefined ? config.temperature : 0.3;

    return `
      <div class="config-card ${config.isActive ? 'active' : ''}" data-id="${config.id}">
        <div class="config-card-header">
          <div class="config-card-title">
            ${escapeHtml(config.name)}
            ${config.isActive ? '<span class="config-card-badge">当前使用</span>' : ''}
          </div>
          <div class="config-card-actions">
            ${!config.isActive ? `<button class="btn btn-secondary config-card-btn activate-btn" data-id="${config.id}">激活</button>` : ''}
            <button class="btn btn-secondary config-card-btn edit-btn" data-id="${config.id}">编辑</button>
            <button class="btn btn-danger config-card-btn delete-btn" data-id="${config.id}">删除</button>
          </div>
        </div>
        <div class="config-card-info">
          <div class="config-card-endpoint">
            <strong>端点：</strong>${escapeHtml(config.apiEndpoint)}
          </div>
          <div class="config-card-endpoint">
            <strong>密钥：</strong>${maskedApiKey}
          </div>
          <div class="config-card-endpoint">
            <strong>模型：</strong>${escapeHtml(modelName)}
          </div>
          <div class="config-card-endpoint">
            <strong>Temperature：</strong>${temperature}
          </div>
        </div>
        <div class="config-card-footer">
          <div class="config-card-meta">
            <span>创建于：${createdDate}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 绑定翻译API配置卡片事件
   */
  function bindConfigCardEvents() {
    // 激活按钮
    document.querySelectorAll('.activate-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        await StorageUtils.setActiveApiConfig(id);
        await loadConfigs();
        showToast('已切换翻译API配置', 'success');
      });
    });

    // 编辑按钮
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const configs = await StorageUtils.getApiConfigs();
        const config = configs.find(c => c.id === id);
        if (config) {
          editingConfigId = id;
          openModal('编辑翻译API配置');
          fillFormWithConfig(config);
        }
      });
    });

    // 删除按钮
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('确定要删除这个翻译API配置吗？')) {
          await StorageUtils.deleteApiConfig(id);
          await loadConfigs();
          showToast('配置已删除', 'success');
        }
      });
    });
  }

  /**
   * 打开翻译API模态框
   */
  function openModal(title) {
    elements.modalTitle.textContent = title;
    elements.configModal.classList.add('show');
    // 只有在添加新配置时才重置表单
    if (!editingConfigId) {
      elements.configForm.reset();
    }
    elements.configId.value = editingConfigId || '';
  }

  /**
   * 关闭翻译API模态框
   */
  function closeModal() {
    elements.configModal.classList.remove('show');
    elements.configForm.reset();
    editingConfigId = null;
  }

  /**
   * 填充翻译API表单（编辑时）
   */
  function fillFormWithConfig(config) {
    elements.configId.value = config.id;
    elements.configName.value = config.name;
    elements.configEndpoint.value = config.apiEndpoint;
    elements.configApiKey.value = config.apiKey;
    elements.configModel.value = config.model;
    elements.configTemperature.value = config.temperature !== undefined ? config.temperature : 0.3;
  }

  /**
   * 切换TTS API密钥可见性
   */
  function toggleTtsApiKeyVisibility() {
    const input = elements.ttsConfigApiKey;
    if (input.type === 'password') {
      input.type = 'text';
    } else {
      input.type = 'password';
    }
  }

  /**
   * 切换翻译API密钥可见性
   */
  function toggleApiKeyVisibility() {
    const input = elements.configApiKey;
    if (input.type === 'password') {
      input.type = 'text';
    } else {
      input.type = 'password';
    }
  }

  /**
   * 处理翻译API表单提交
   */
  async function handleFormSubmit(e) {
    e.preventDefault();

    const configData = {
      name: elements.configName.value.trim(),
      apiEndpoint: elements.configEndpoint.value.trim(),
      apiKey: elements.configApiKey.value.trim(),
      model: elements.configModel.value.trim(),
      temperature: parseFloat(elements.configTemperature.value)
    };

    // 验证
    if (!configData.name || !configData.apiEndpoint || !configData.apiKey || !configData.model) {
      showToast('请填写所有必填字段', 'error');
      return;
    }

    // 验证temperature范围
    if (isNaN(configData.temperature) || configData.temperature < 0 || configData.temperature > 2) {
      showToast('Temperature必须在 0-2 之间', 'error');
      return;
    }

    // 验证URL格式
    try {
      new URL(configData.apiEndpoint);
    } catch {
      showToast('请输入有效的API端点地址', 'error');
      return;
    }

    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = '保存中...';

    try {
      if (editingConfigId) {
        // 更新配置
        await StorageUtils.updateApiConfig(editingConfigId, configData);
        showToast('翻译API配置已更新', 'success');
      } else {
        // 添加新配置
        await StorageUtils.addApiConfig(configData);
        showToast('翻译API配置已添加', 'success');
      }

      closeModal();
      await loadConfigs();
    } catch (error) {
      console.error('Save config error:', error);
      showToast('保存失败，请重试', 'error');
    } finally {
      elements.saveBtn.disabled = false;
      elements.saveBtn.textContent = '保存配置';
    }
  }

  /**
   * 测试翻译API连接
   */
  async function handleTestConnection() {
    const configData = {
      name: elements.configName.value.trim(),
      apiEndpoint: elements.configEndpoint.value.trim(),
      apiKey: elements.configApiKey.value.trim(),
      model: elements.configModel.value.trim(),
      temperature: parseFloat(elements.configTemperature.value)
    };

    if (!configData.apiEndpoint || !configData.apiKey || !configData.model) {
      showToast('请先填写API端点、密钥和模型名称', 'warning');
      return;
    }

    // 验证temperature范围
    if (isNaN(configData.temperature) || configData.temperature < 0 || configData.temperature > 2) {
      showToast('Temperature必须在 0-2 之间', 'error');
      return;
    }

    elements.testBtn.disabled = true;
    elements.testBtn.textContent = '测试中...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'testApiConfig',
        config: configData
      });

      if (response.success) {
        showToast('翻译API连接测试成功！', 'success');
      } else {
        showToast(`测试失败：${response.message}`, 'error');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      showToast('测试失败，请检查配置', 'error');
    } finally {
      elements.testBtn.disabled = false;
      elements.testBtn.textContent = '测试连接';
    }
  }

  /**
   * 加载TTS API配置列表
   */
  async function loadTtsConfigs() {
    const configs = await StorageUtils.getTtsConfigs();

    if (configs.length === 0) {
      elements.ttsEmptyState.style.display = 'block';
      elements.ttsConfigList.style.display = 'none';
      return;
    }

    elements.ttsEmptyState.style.display = 'none';
    elements.ttsConfigList.style.display = 'grid';

    // 渲染配置卡片
    elements.ttsConfigList.innerHTML = configs.map(config => createTtsConfigCard(config)).join('');

    // 绑定卡片按钮事件
    bindTtsConfigCardEvents();
  }

  /**
   * 创建TTS API配置卡片HTML
   */
  function createTtsConfigCard(config) {
    const createdDate = new Date(config.createdAt).toLocaleDateString('zh-CN');
    const maskedApiKey = maskApiKey(config.apiKey);
    const provider = config.provider || 'qwen';
    const providerName = provider === 'qwen' ? '通义千问' : provider === 'openai' ? 'OpenAI' : provider;
    
    // 根据provider显示不同字段
    let extraInfo = '';
    if (provider === 'qwen') {
      const model = config.model || 'qwen3-tts-flash';
      const voice = config.voice || 'Cherry';
      extraInfo = `
        <div class="config-card-endpoint">
          <strong>模型：</strong>${escapeHtml(model)}
        </div>
        <div class="config-card-endpoint">
          <strong>音色：</strong>${escapeHtml(voice)}
        </div>
      `;
    } else if (provider === 'openai') {
      const model = config.openai_model || 'tts-1';
      const voice = config.openai_voice || 'alloy';
      const format = config.openai_format || 'mp3';
      extraInfo = `
        <div class="config-card-endpoint">
          <strong>模型：</strong>${escapeHtml(model)}
        </div>
        <div class="config-card-endpoint">
          <strong>音色：</strong>${escapeHtml(voice)}
        </div>
        <div class="config-card-endpoint">
          <strong>格式：</strong>${escapeHtml(format)}
        </div>
      `;
    }

    return `
      <div class="config-card ${config.isActive ? 'active' : ''}" data-id="${config.id}">
        <div class="config-card-header">
          <div class="config-card-title">
            ${escapeHtml(config.name)}
            ${config.isActive ? '<span class="config-card-badge">当前使用</span>' : ''}
          </div>
          <div class="config-card-actions">
            ${!config.isActive ? `<button class="btn btn-secondary config-card-btn activate-tts-btn" data-id="${config.id}">激活</button>` : ''}
            <button class="btn btn-secondary config-card-btn edit-tts-btn" data-id="${config.id}">编辑</button>
            <button class="btn btn-danger config-card-btn delete-tts-btn" data-id="${config.id}">删除</button>
          </div>
        </div>
        <div class="config-card-info">
          <div class="config-card-endpoint">
            <strong>服务商：</strong>${escapeHtml(providerName)}
          </div>
          <div class="config-card-endpoint">
            <strong>端点：</strong>${escapeHtml(config.apiEndpoint)}
          </div>
          <div class="config-card-endpoint">
            <strong>密钥：</strong>${maskedApiKey}
          </div>
          ${extraInfo}
        </div>
        <div class="config-card-footer">
          <div class="config-card-meta">
            <span>创建于：${createdDate}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 绑定TTS API配置卡片事件
   */
  function bindTtsConfigCardEvents() {
    // 激活按钮
    document.querySelectorAll('.activate-tts-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        await StorageUtils.setActiveTtsConfig(id);
        await loadTtsConfigs();
        showToast('已切换TTS API配置', 'success');
      });
    });

    // 编辑按钮
    document.querySelectorAll('.edit-tts-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const configs = await StorageUtils.getTtsConfigs();
        const config = configs.find(c => c.id === id);
        if (config) {
          editingTtsConfigId = id;
          openTtsModal('编辑TTS API配置');
          fillTtsFormWithConfig(config);
        }
      });
    });

    // 删除按钮
    document.querySelectorAll('.delete-tts-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('确定要删除这个TTS API配置吗？')) {
          await StorageUtils.deleteTtsConfig(id);
          await loadTtsConfigs();
          showToast('TTS配置已删除', 'success');
        }
      });
    });
  }

  /**
   * 打开TTS API模态框
   */
  function openTtsModal(title) {
    elements.ttsModalTitle.textContent = title;
    elements.ttsConfigModal.classList.add('show');
    // 只有在添加新配置时才重置表单
    if (!editingTtsConfigId) {
      elements.ttsConfigForm.reset();
      // 隐藏所有provider特定字段
      hideAllTtsProviderFields();
    }
    elements.ttsConfigId.value = editingTtsConfigId || '';
  }

  /**
   * 关闭TTS API模态框
   */
  function closeTtsModal() {
    elements.ttsConfigModal.classList.remove('show');
    elements.ttsConfigForm.reset();
    editingTtsConfigId = null;
  }

  /**
   * 填充TTS API表单(编辑时)
   */
  function fillTtsFormWithConfig(config) {
    elements.ttsConfigId.value = config.id;
    elements.ttsConfigName.value = config.name;
    elements.ttsConfigProvider.value = config.provider || 'qwen';
    elements.ttsConfigEndpoint.value = config.apiEndpoint;
    elements.ttsConfigApiKey.value = config.apiKey;
      
    // 根据provider显示对应字段
    handleTtsProviderChange();
      
    // 填充provider特定字段
    if (config.provider === 'openai') {
      elements.ttsOpenaiModel.value = config.openai_model || 'tts-1';
      elements.ttsOpenaiVoice.value = config.openai_voice || 'alloy';
      elements.ttsOpenaiFormat.value = config.openai_format || 'mp3';
    } else {
      // 默认为qwen
      elements.ttsConfigModel.value = config.model || 'qwen3-tts-flash';
      elements.ttsConfigVoice.value = config.voice || 'Cherry';
    }
  }

  /**
   * 处理TTS服务商选择变更
   */
  function handleTtsProviderChange() {
    const provider = elements.ttsConfigProvider.value;
    
    // 隐藏所有provider特定字段
    hideAllTtsProviderFields();
    
    // 根据选择的provider显示对应字段
    if (provider === 'qwen') {
      elements.ttsQwenModelGroup.style.display = 'block';
      elements.ttsQwenVoiceGroup.style.display = 'block';
      // 更新提示文本
      document.getElementById('tts-endpoint-hint').textContent = '通义千问API端点，如: https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
    } else if (provider === 'openai') {
      elements.ttsOpenaiModelGroup.style.display = 'block';
      elements.ttsOpenaiVoiceGroup.style.display = 'block';
      elements.ttsOpenaiFormatGroup.style.display = 'block';
      // 更新提示文本
      document.getElementById('tts-endpoint-hint').textContent = 'OpenAI兼容的TTS端点，如: https://api.openai.com/v1/audio/speech';
    }
  }

  /**
   * 隐藏所有TTS provider特定字段
   */
  function hideAllTtsProviderFields() {
    elements.ttsQwenModelGroup.style.display = 'none';
    elements.ttsQwenVoiceGroup.style.display = 'none';
    elements.ttsOpenaiModelGroup.style.display = 'none';
    elements.ttsOpenaiVoiceGroup.style.display = 'none';
    elements.ttsOpenaiFormatGroup.style.display = 'none';
  }

  /**
   * 处理TTS API表单提交
   */
  async function handleTtsFormSubmit(e) {
    e.preventDefault();

    const provider = elements.ttsConfigProvider.value.trim();
    
    const configData = {
      name: elements.ttsConfigName.value.trim(),
      provider: provider,
      apiEndpoint: elements.ttsConfigEndpoint.value.trim(),
      apiKey: elements.ttsConfigApiKey.value.trim()
    };
    
    // 根据provider添加特定字段
    if (provider === 'qwen') {
      configData.model = elements.ttsConfigModel.value.trim() || 'qwen3-tts-flash';
      configData.voice = elements.ttsConfigVoice.value.trim() || 'Cherry';
    } else if (provider === 'openai') {
      configData.openai_model = elements.ttsOpenaiModel.value.trim() || 'tts-1';
      configData.openai_voice = elements.ttsOpenaiVoice.value.trim() || 'alloy';
      configData.openai_format = elements.ttsOpenaiFormat.value.trim() || 'mp3';
    }

    // 验证
    if (!configData.name || !configData.provider || !configData.apiEndpoint || !configData.apiKey) {
      showToast('请填写所有必填字段', 'error');
      return;
    }

    // 验证URL格式
    try {
      new URL(configData.apiEndpoint);
    } catch {
      showToast('请输入有效的API端点地址', 'error');
      return;
    }

    elements.ttsSaveBtn.disabled = true;
    elements.ttsSaveBtn.textContent = '保存中...';

    try {
      if (editingTtsConfigId) {
        // 更新配置
        await StorageUtils.updateTtsConfig(editingTtsConfigId, configData);
        showToast('TTS API配置已更新', 'success');
      } else {
        // 添加新配置
        await StorageUtils.addTtsConfig(configData);
        showToast('TTS API配置已添加', 'success');
      }

      closeTtsModal();
      await loadTtsConfigs();
    } catch (error) {
      console.error('Save TTS config error:', error);
      showToast('保存失败，请重试', 'error');
    } finally {
      elements.ttsSaveBtn.disabled = false;
      elements.ttsSaveBtn.textContent = '保存配置';
    }
  }

  /**
   * 加载用户偏好设置
   */
  async function loadPreferences() {
    const prefs = await StorageUtils.getUserPreferences();
    elements.defaultTargetLang.value = prefs.lastTargetLanguage;
    elements.autoShowPopup.checked = prefs.autoShowPopup;
    elements.maxTextLength.value = prefs.maxTextLength || 5000;
  }

  /**
   * 加载语言选项
   */
  function loadLanguageOptions() {
    const languages = LanguageDetector.getAllLanguages();
    elements.defaultTargetLang.innerHTML = languages.map(lang => `
      <option value="${lang.code}">${lang.name} (${lang.nativeName})</option>
    `).join('');
  }

  /**
   * 处理偏好设置变更
   */
  async function handlePreferenceChange() {
    // 验证文字长度限制的合法性
    let maxTextLength = parseInt(elements.maxTextLength.value);
    if (isNaN(maxTextLength) || maxTextLength < 100) {
      maxTextLength = 100;
      elements.maxTextLength.value = 100;
    } else if (maxTextLength > 50000) {
      maxTextLength = 50000;
      elements.maxTextLength.value = 50000;
    }

    const prefs = {
      lastTargetLanguage: elements.defaultTargetLang.value,
      autoShowPopup: elements.autoShowPopup.checked,
      maxTextLength: maxTextLength
    };

    await StorageUtils.updateUserPreferences(prefs);
    showToast('偏好设置已保存', 'success');
  }

  /**
   * 显示提示消息
   */
  function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast show ${type}`;

    // 设置图标
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠'
    };
    const toastIcon = elements.toast.querySelector('.toast-icon');
    if (toastIcon) {
      toastIcon.textContent = icons[type] || '•';
    }

    // 3秒后自动隐藏
    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 3000);
  }

  /**
   * 掩码API密钥
   */
  function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) {
      return '••••••••';
    }
    return apiKey.substring(0, 4) + '••••••••' + apiKey.substring(apiKey.length - 4);
  }

  /**
   * HTML转义
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 加载缓存统计信息
   */
  async function loadCacheStats() {
    try {
      const stats = await StorageUtils.getCacheStats();
      elements.cacheCount.textContent = stats.totalCount;
      elements.cacheSize.textContent = `${stats.totalSizeMB}MB`;
      
      // 更新存储类型说明
      const storageNote = document.getElementById('cache-storage-note');
      if (storageNote) {
        storageNote.textContent = stats.note || '浏览器关闭后自动清空';
      }
    } catch (error) {
      console.error('加载缓存统计失败:', error);
      elements.cacheCount.textContent = '错误';
      elements.cacheSize.textContent = '错误';
    }
  }

  /**
   * 处理刷新缓存统计
   */
  async function handleRefreshCache() {
    elements.refreshCacheBtn.disabled = true;
    elements.refreshCacheBtn.textContent = '刷新中...';
    
    await loadCacheStats();
    
    elements.refreshCacheBtn.disabled = false;
    elements.refreshCacheBtn.textContent = '刷新统计';
    showToast('缓存统计已刷新', 'success');
  }

  /**
   * 处理清空所有缓存
   */
  async function handleClearAllCache() {
    if (!confirm('确定要清空所有翻译缓存吗？')) {
      return;
    }
    
    elements.clearAllCacheBtn.disabled = true;
    elements.clearAllCacheBtn.textContent = '清空中...';
    
    try {
      const clearedCount = await StorageUtils.clearAllCache();
      await loadCacheStats();
      
      elements.clearAllCacheBtn.disabled = false;
      elements.clearAllCacheBtn.textContent = '清空所有缓存';
      
      showToast(`已清空 ${clearedCount} 个缓存`, 'success');
    } catch (error) {
      console.error('清空缓存失败:', error);
      elements.clearAllCacheBtn.disabled = false;
      elements.clearAllCacheBtn.textContent = '清空所有缓存';
      showToast('清空失败，请重试', 'error');
    }
  }

  /**
   * 加载Token使用统计信息
   */
  async function loadTokenStats() {
    try {
      const stats = await StorageUtils.getTokenUsage();
      
      // 格式化数字，添加千位分隔符
      elements.totalTokens.textContent = stats.totalTokens.toLocaleString();
      elements.promptTokens.textContent = stats.totalPromptTokens.toLocaleString();
      elements.completionTokens.textContent = stats.totalCompletionTokens.toLocaleString();
      elements.requestCount.textContent = stats.requestCount.toLocaleString();
      
      // 更新最后更新时间
      if (stats.lastUpdated) {
        const date = new Date(stats.lastUpdated);
        const dateStr = date.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        elements.tokenLastUpdated.textContent = `• 最后更新：${dateStr}`;
      } else {
        elements.tokenLastUpdated.textContent = '• 未有统计数据';
      }
    } catch (error) {
      console.error('加载Token统计失败:', error);
      elements.totalTokens.textContent = '错误';
      elements.promptTokens.textContent = '错误';
      elements.completionTokens.textContent = '错误';
      elements.requestCount.textContent = '错误';
    }
  }

  /**
   * 处理刷新Token统计
   */
  async function handleRefreshToken() {
    elements.refreshTokenBtn.disabled = true;
    elements.refreshTokenBtn.textContent = '刷新中...';
    
    await loadTokenStats();
    
    elements.refreshTokenBtn.disabled = false;
    elements.refreshTokenBtn.textContent = '刷新统计';
    showToast('Token统计已刷新', 'success');
  }

  /**
   * 处理重置Token统计
   */
  async function handleResetToken() {
    if (!confirm('确定要重置Token使用统计吗？此操作不可恢复！')) {
      return;
    }
    
    elements.resetTokenBtn.disabled = true;
    elements.resetTokenBtn.textContent = '重置中...';
    
    try {
      await StorageUtils.resetTokenUsage();
      await loadTokenStats();
      
      elements.resetTokenBtn.disabled = false;
      elements.resetTokenBtn.textContent = '重置统计';
      
      showToast('Token统计已重置', 'success');
    } catch (error) {
      console.error('重置Token统计失败:', error);
      elements.resetTokenBtn.disabled = false;
      elements.resetTokenBtn.textContent = '重置统计';
      showToast('重置失败，请重试', 'error');
    }
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
