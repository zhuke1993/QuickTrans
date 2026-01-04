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
    toggleApiKey: document.getElementById('toggle-apikey'),
    testBtn: document.getElementById('test-btn'),
    saveBtn: document.getElementById('save-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    defaultTargetLang: document.getElementById('default-target-lang'),
    autoShowPopup: document.getElementById('auto-show-popup'),
    maxTextLength: document.getElementById('max-text-length'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    // 缓存管理元素
    cacheCount: document.getElementById('cache-count'),
    cacheSize: document.getElementById('cache-size'),
    refreshCacheBtn: document.getElementById('refresh-cache-btn'),
    clearAllCacheBtn: document.getElementById('clear-all-cache-btn')
  };

  // 当前编辑的配置ID
  let editingConfigId = null;

  /**
   * 初始化
   */
  async function init() {
    // 加载API配置列表
    await loadConfigs();

    // 加载用户偏好设置
    await loadPreferences();

    // 加载语言选项
    loadLanguageOptions();

    // 加载缓存统计
    await loadCacheStats();

    // 绑定事件
    bindEvents();

    console.log('设置页面已加载');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    // 添加配置按钮
    elements.addConfigBtn.addEventListener('click', () => {
      editingConfigId = null;
      openModal('添加API配置');
    });

    // 模态框关闭
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);

    // 切换密钥可见性
    elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);

    // 表单提交
    elements.configForm.addEventListener('submit', handleFormSubmit);

    // 测试连接
    elements.testBtn.addEventListener('click', handleTestConnection);

    // 偏好设置变更
    elements.defaultTargetLang.addEventListener('change', handlePreferenceChange);
    elements.autoShowPopup.addEventListener('change', handlePreferenceChange);
    elements.maxTextLength.addEventListener('change', handlePreferenceChange);
    elements.maxTextLength.addEventListener('blur', handlePreferenceChange);

    // 缓存管理按钮
    elements.refreshCacheBtn.addEventListener('click', handleRefreshCache);
    elements.clearAllCacheBtn.addEventListener('click', handleClearAllCache);

    // ESC键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.configModal.classList.contains('show')) {
        closeModal();
      }
    });
  }

  /**
   * 加载API配置列表
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
   * 创建配置卡片HTML
   */
  function createConfigCard(config) {
    const createdDate = new Date(config.createdAt).toLocaleDateString('zh-CN');
    const maskedApiKey = maskApiKey(config.apiKey);
    const modelName = config.model;

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
   * 绑定配置卡片事件
   */
  function bindConfigCardEvents() {
    // 激活按钮
    document.querySelectorAll('.activate-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        await StorageUtils.setActiveApiConfig(id);
        await loadConfigs();
        showToast('已切换API配置', 'success');
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
          openModal('编辑API配置');
          fillFormWithConfig(config);
        }
      });
    });

    // 删除按钮
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('确定要删除这个API配置吗？')) {
          await StorageUtils.deleteApiConfig(id);
          await loadConfigs();
          showToast('配置已删除', 'success');
        }
      });
    });
  }

  /**
   * 打开模态框
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
   * 关闭模态框
   */
  function closeModal() {
    elements.configModal.classList.remove('show');
    elements.configForm.reset();
    editingConfigId = null;
  }

  /**
   * 填充表单（编辑时）
   */
  function fillFormWithConfig(config) {
    elements.configId.value = config.id;
    elements.configName.value = config.name;
    elements.configEndpoint.value = config.apiEndpoint;
    elements.configApiKey.value = config.apiKey;
    elements.configModel.value = config.model;
  }

  /**
   * 切换API密钥可见性
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
   * 处理表单提交
   */
  async function handleFormSubmit(e) {
    e.preventDefault();

    const configData = {
      name: elements.configName.value.trim(),
      apiEndpoint: elements.configEndpoint.value.trim(),
      apiKey: elements.configApiKey.value.trim(),
      model: elements.configModel.value.trim()
    };

    // 验证
    if (!configData.name || !configData.apiEndpoint || !configData.apiKey || !configData.model) {
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

    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = '保存中...';

    try {
      if (editingConfigId) {
        // 更新配置
        await StorageUtils.updateApiConfig(editingConfigId, configData);
        showToast('配置已更新', 'success');
      } else {
        // 添加新配置
        await StorageUtils.addApiConfig(configData);
        showToast('配置已添加', 'success');
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
   * 测试API连接
   */
  async function handleTestConnection() {
    const configData = {
      name: elements.configName.value.trim(),
      apiEndpoint: elements.configEndpoint.value.trim(),
      apiKey: elements.configApiKey.value.trim(),
      model: elements.configModel.value.trim()
    };

    if (!configData.apiEndpoint || !configData.apiKey || !configData.model) {
      showToast('请先填写API端点、密钥和模型名称', 'warning');
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
        showToast('API连接测试成功！', 'success');
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

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
