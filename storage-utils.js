/**
 * 数据存储工具模块
 * 用于管理API配置和用户偏好设置
 */

const StorageUtils = {
  /**
   * 获取所有翻译API配置
   * @returns {Promise<Array>} 翻译API配置数组
   */
  async getApiConfigs() {
    const result = await chrome.storage.local.get('apiConfigs');
    const configs = result.apiConfigs || [];
    
    // 兼容性处理：为旧配置添加默认 model、temperature 字段
    return configs.map(config => ({
      ...config,
      model: config.model,
      temperature: config.temperature !== undefined ? config.temperature : 0.3
    }));
  },

  /**
   * 保存API配置列表
   * @param {Array} configs - API配置数组
   * @returns {Promise<void>}
   */
  async saveApiConfigs(configs) {
    await chrome.storage.local.set({ apiConfigs: configs });
  },

  /**
   * 添加新的翻译API配置
   * @param {Object} config - 新配置对象
   * @returns {Promise<Object>} 添加后的配置（包含ID）
   */
  async addApiConfig(config) {
    const configs = await this.getApiConfigs();
    
    // 如果是第一个配置，自动设置为激活
    const isFirstConfig = configs.length === 0;
    
    const newConfig = {
      id: this.generateId(),
      name: config.name,
      apiEndpoint: config.apiEndpoint,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature !== undefined ? config.temperature : 0.3,
      isActive: isFirstConfig || config.isActive || false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 如果新配置设为激活，需要将其他配置设为非激活
    if (newConfig.isActive) {
      configs.forEach(c => c.isActive = false);
    }

    configs.push(newConfig);
    await this.saveApiConfigs(configs);
    return newConfig;
  },

  /**
   * 更新翻译API配置
   * @param {string} id - 配置ID
   * @param {Object} updates - 更新的字段
   * @returns {Promise<Object|null>} 更新后的配置
   */
  async updateApiConfig(id, updates) {
    const configs = await this.getApiConfigs();
    const index = configs.findIndex(c => c.id === id);
    
    if (index === -1) {
      return null;
    }

    // 如果设为激活，需要将其他配置设为非激活
    if (updates.isActive) {
      configs.forEach(c => c.isActive = false);
    }

    configs[index] = {
      ...configs[index],
      ...updates,
      updatedAt: Date.now()
    };

    await this.saveApiConfigs(configs);
    return configs[index];
  },

  /**
   * 删除翻译API配置
   * @param {string} id - 配置ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteApiConfig(id) {
    const configs = await this.getApiConfigs();
    const index = configs.findIndex(c => c.id === id);
    
    if (index === -1) {
      return false;
    }

    const wasActive = configs[index].isActive;
    configs.splice(index, 1);

    // 如果删除的是激活配置，且还有其他配置，激活第一个
    if (wasActive && configs.length > 0) {
      configs[0].isActive = true;
    }

    await this.saveApiConfigs(configs);
    return true;
  },

  /**
   * 获取当前激活的翻译API配置
   * @returns {Promise<Object|null>} 激活的配置
   */
  async getActiveApiConfig() {
    const configs = await this.getApiConfigs();
    return configs.find(c => c.isActive) || null;
  },

  /**
   * 设置激活的翻译API配置
   * @param {string} id - 配置ID
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setActiveApiConfig(id) {
    const configs = await this.getApiConfigs();
    const targetConfig = configs.find(c => c.id === id);
    
    if (!targetConfig) {
      return false;
    }

    configs.forEach(c => c.isActive = (c.id === id));
    await this.saveApiConfigs(configs);
    return true;
  },

  /**
   * 获取所有TTS配置
   * @returns {Promise<Array>} TTS配置数组
   */
  async getTtsConfigs() {
    const result = await chrome.storage.local.get('ttsConfigs');
    const configs = result.ttsConfigs || [];
    
    // 兼容性处理：为旧配置添加默认字段
    return configs.map(config => ({
      ...config,
      model: config.model || 'qwen3-tts-flash',
      voice: config.voice || 'Cherry'
    }));
  },

  /**
   * 保存TTS配置列表
   * @param {Array} configs - TTS配置数组
   * @returns {Promise<void>}
   */
  async saveTtsConfigs(configs) {
    await chrome.storage.local.set({ ttsConfigs: configs });
  },

  /**
   * 添加新的TTS配置
   * @param {Object} config - 新配置对象
   * @returns {Promise<Object>} 添加后的配置（包含ID）
   */
  async addTtsConfig(config) {
    const configs = await this.getTtsConfigs();
    
    // 如果是第一个配置，自动设置为激活
    const isFirstConfig = configs.length === 0;
    
    const newConfig = {
      id: this.generateId(),
      name: config.name,
      apiEndpoint: config.apiEndpoint,
      apiKey: config.apiKey,
      model: config.model || 'qwen3-tts-flash',
      voice: config.voice || 'Cherry',
      isActive: isFirstConfig || config.isActive || false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 如果新配置设为激活，需要将其他配置设为非激活
    if (newConfig.isActive) {
      configs.forEach(c => c.isActive = false);
    }

    configs.push(newConfig);
    await this.saveTtsConfigs(configs);
    return newConfig;
  },

  /**
   * 更新TTS配置
   * @param {string} id - 配置ID
   * @param {Object} updates - 更新的字段
   * @returns {Promise<Object|null>} 更新后的配置
   */
  async updateTtsConfig(id, updates) {
    const configs = await this.getTtsConfigs();
    const index = configs.findIndex(c => c.id === id);
    
    if (index === -1) {
      return null;
    }

    // 如果设为激活，需要将其他配置设为非激活
    if (updates.isActive) {
      configs.forEach(c => c.isActive = false);
    }

    configs[index] = {
      ...configs[index],
      ...updates,
      updatedAt: Date.now()
    };

    await this.saveTtsConfigs(configs);
    return configs[index];
  },

  /**
   * 删除TTS配置
   * @param {string} id - 配置ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteTtsConfig(id) {
    const configs = await this.getTtsConfigs();
    const index = configs.findIndex(c => c.id === id);
    
    if (index === -1) {
      return false;
    }

    const wasActive = configs[index].isActive;
    configs.splice(index, 1);

    // 如果删除的是激活配置，且还有其他配置，激活第一个
    if (wasActive && configs.length > 0) {
      configs[0].isActive = true;
    }

    await this.saveTtsConfigs(configs);
    return true;
  },

  /**
   * 获取当前激活的TTS配置
   * @returns {Promise<Object|null>} 激活的配置
   */
  async getActiveTtsConfig() {
    const configs = await this.getTtsConfigs();
    return configs.find(c => c.isActive) || null;
  },

  /**
   * 设置激活的TTS配置
   * @param {string} id - 配置ID
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setActiveTtsConfig(id) {
    const configs = await this.getTtsConfigs();
    const targetConfig = configs.find(c => c.id === id);
    
    if (!targetConfig) {
      return false;
    }

    configs.forEach(c => c.isActive = (c.id === id));
    await this.saveTtsConfigs(configs);
    return true;
  },

  /**
   * 获取用户偏好设置
   * @returns {Promise<Object>} 用户偏好对象
   */
  async getUserPreferences() {
    const result = await chrome.storage.sync.get('userPreferences');
    return result.userPreferences || {
      lastTargetLanguage: 'zh',
      autoShowPopup: true,
      popupPosition: 'near'
    };
  },

  /**
   * 保存用户偏好设置
   * @param {Object} preferences - 偏好设置对象
   * @returns {Promise<void>}
   */
  async saveUserPreferences(preferences) {
    await chrome.storage.sync.set({ userPreferences: preferences });
  },

  /**
   * 更新用户偏好设置
   * @param {Object} updates - 要更新的字段
   * @returns {Promise<Object>} 更新后的偏好设置
   */
  async updateUserPreferences(updates) {
    const preferences = await this.getUserPreferences();
    const updated = { ...preferences, ...updates };
    await this.saveUserPreferences(updated);
    return updated;
  },

  /**
   * 生成唯一ID
   * @returns {string} UUID格式的ID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * 获取翻译缓存
   * 使用 chrome.storage.session 自动管理，浏览器重启后自动清空
   * @param {string} text - 原文
   * @param {string} targetLang - 目标语言
   * @returns {Promise<string|null>} 缓存的翻译结果
   */
  async getTranslationCache(text, targetLang) {
    const key = `cache_${this.hashCode(text)}_${targetLang}`;
    const result = await chrome.storage.session.get(key);
    return result[key] || null;
  },

  /**
   * 保存翻译缓存
   * 使用 chrome.storage.session 自动管理，无需手动管理空间和过期
   * @param {string} text - 原文
   * @param {string} targetLang - 目标语言
   * @param {string} translation - 翻译结果
   * @returns {Promise<void>}
   */
  async saveTranslationCache(text, targetLang, translation) {
    const key = `cache_${this.hashCode(text)}_${targetLang}`;
    try {
      await chrome.storage.session.set({ [key]: translation });
    } catch (error) {
      // storage.session 满了，Chrome 会自动清理，这里捕获错误避免崩溃
      console.warn('缓存保存失败，可能是空间不足:', error);
    }
  },

  /**
   * 获取缓存统计信息
   * @returns {Promise<Object>} 缓存统计数据
   */
  async getCacheStats() {
    try {
      // 获取 session storage 中的所有缓存键
      const allData = await chrome.storage.session.get(null);
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith('cache_'));
      
      // 计算总大小
      let totalSize = 0;
      for (const key of cacheKeys) {
        totalSize += new Blob([allData[key]]).size;
      }
      
      return {
        totalCount: cacheKeys.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        maxSizeMB: '10', // session storage 限制约 10MB
        storageType: 'session',
        note: '浏览器关闭后自动清空'
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return {
        totalCount: 0,
        totalSize: 0,
        totalSizeMB: '0.00',
        maxSizeMB: '10',
        storageType: 'session',
        note: '浏览器关闭后自动清空'
      };
    }
  },

  /**
   * 清空所有翻译缓存
   * @returns {Promise<number>} 清理的缓存数量
   */
  async clearAllCache() {
    try {
      const allData = await chrome.storage.session.get(null);
      const cacheKeys = Object.keys(allData).filter(key => key.startsWith('cache_'));
      
      if (cacheKeys.length > 0) {
        await chrome.storage.session.remove(cacheKeys);
      }
      
      return cacheKeys.length;
    } catch (error) {
      console.error('清空缓存失败:', error);
      return 0;
    }
  },

  /**
   * 计算字符串的哈希值
   * @param {string} str - 输入字符串
   * @returns {number} 哈希值
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  },

  /**
   * 获取token使用统计
   * @returns {Promise<Object>} token使用统计数据
   */
  async getTokenUsage() {
    const result = await chrome.storage.local.get('tokenUsage');
    return result.tokenUsage || {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      requestCount: 0,
      lastUpdated: null
    };
  },

  /**
   * 更新token使用统计
   * @param {Object} usage - API返回的usage对象 {prompt_tokens, completion_tokens, total_tokens}
   * @returns {Promise<Object>} 更新后的统计数据
   */
  async updateTokenUsage(usage) {
    if (!usage) return;
    
    const stats = await this.getTokenUsage();
    
    const updated = {
      totalPromptTokens: stats.totalPromptTokens + (usage.prompt_tokens || 0),
      totalCompletionTokens: stats.totalCompletionTokens + (usage.completion_tokens || 0),
      totalTokens: stats.totalTokens + (usage.total_tokens || 0),
      requestCount: stats.requestCount + 1,
      lastUpdated: Date.now()
    };
    
    await chrome.storage.local.set({ tokenUsage: updated });
    return updated;
  },

  /**
   * 重置token使用统计
   * @returns {Promise<void>}
   */
  async resetTokenUsage() {
    await chrome.storage.local.set({
      tokenUsage: {
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        requestCount: 0,
        lastUpdated: null
      }
    });
  }
};

// 导出模块（用于background和options页面）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageUtils;
}
