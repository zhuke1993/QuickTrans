/**
 * 后台服务脚本（Background Service Worker）
 * 处理翻译请求、API配置管理
 */

// 导入工具模块（注意：Service Worker使用importScripts）
importScripts('storage-utils.js', 'language-detector.js');

/**
 * 翻译服务
 */
const TranslationService = {
  /**
   * 调用LLM API进行翻译
   * @param {string} text - 待翻译文本
   * @param {string} targetLanguage - 目标语言代码
   * @param {string} sourceLanguage - 源语言代码（可选）
   * @returns {Promise<Object>} 翻译结果
   */
  async translate(text, targetLanguage, sourceLanguage = null) {
    try {
      // 检测源语言（如果未提供）
      const detectedLanguage = sourceLanguage || LanguageDetector.detect(text);
      
      // 如果源语言和目标语言相同，直接返回原文
      if (detectedLanguage === targetLanguage) {
        return {
          success: true,
          translatedText: text,
          detectedLanguage: detectedLanguage,
          message: '源语言和目标语言相同'
        };
      }

      // 检查缓存
      const cached = await StorageUtils.getTranslationCache(text, targetLanguage);
      if (cached) {
        return {
          success: true,
          translatedText: cached,
          detectedLanguage: detectedLanguage,
          cached: true
        };
      }

      // 获取当前激活的API配置
      const apiConfig = await StorageUtils.getActiveApiConfig();
      if (!apiConfig) {
        return {
          success: false,
          errorMessage: '未配置API，请先在设置页面添加API配置',
          errorCode: 'NO_API_CONFIG'
        };
      }

      // 构建翻译提示词
      const targetLangName = LanguageDetector.getLanguageName(targetLanguage);
      const sourceLangName = LanguageDetector.getLanguageName(detectedLanguage);

      const systemPrompt = `你是一个专业的翻译助手。请将用户提供的文本翻译成${targetLangName}。
要求：
1. 只返回翻译结果，不要添加任何解释或说明
2. 保持原文的语气和风格
3. 对于专业术语，提供准确的翻译
4. 保持原文的格式（如换行、段落等）`;

      const userPrompt = `请将以下${sourceLangName}文本翻译成${targetLangName}：\n\n${text}`;

      // 调用OpenAI兼容API
      const response = await this.callLLMAPI(apiConfig, systemPrompt, userPrompt);

      if (response.success) {
        // 缓存翻译结果
        await StorageUtils.saveTranslationCache(text, targetLanguage, response.translatedText);
      }

      return {
        ...response,
        detectedLanguage: detectedLanguage,
        model: apiConfig.model,
        apiConfigName: apiConfig.name
      };

    } catch (error) {
      console.error('Translation error:', error);
      return {
        success: false,
        errorMessage: error.message || '翻译失败，请稍后重试',
        errorCode: 'TRANSLATION_ERROR'
      };
    }
  },

  /**
   * 调用LLM API
   * @param {Object} apiConfig - API配置
   * @param {string} systemPrompt - 系统提示
   * @param {string} userPrompt - 用户提示
   * @returns {Promise<Object>} API响应
   */
  async callLLMAPI(apiConfig, systemPrompt, userPrompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      // 使用配置中的模型，如果没有配置则使用默认值
      const model = apiConfig.model;
      
      const response = await fetch(apiConfig.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // 处理不同的错误状态码
        if (response.status === 401) {
          return {
            success: false,
            errorMessage: 'API密钥无效，请检查配置',
            errorCode: 'INVALID_API_KEY'
          };
        } else if (response.status === 429) {
          return {
            success: false,
            errorMessage: 'API调用频率超限，请稍后重试或切换其他API',
            errorCode: 'RATE_LIMIT'
          };
        } else if (response.status === 500 || response.status === 503) {
          return {
            success: false,
            errorMessage: 'API服务暂时不可用，请稍后重试',
            errorCode: 'SERVICE_UNAVAILABLE'
          };
        }

        return {
          success: false,
          errorMessage: errorData.error?.message || `API错误 (${response.status})`,
          errorCode: 'API_ERROR'
        };
      }

      const data = await response.json();
      
      // 提取翻译结果
      const translatedText = data.choices?.[0]?.message?.content?.trim();
      
      if (!translatedText) {
        return {
          success: false,
          errorMessage: 'API返回数据格式错误',
          errorCode: 'INVALID_RESPONSE'
        };
      }

      return {
        success: true,
        translatedText: translatedText,
        model: apiConfig.model
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          errorMessage: '请求超时，请检查网络连接或稍后重试',
          errorCode: 'TIMEOUT'
        };
      }

      return {
        success: false,
        errorMessage: error.message || '网络错误，请检查连接',
        errorCode: 'NETWORK_ERROR'
      };
    }
  },

  /**
   * 测试API配置是否有效
   * @param {Object} apiConfig - API配置
   * @returns {Promise<Object>} 测试结果
   */
  async testApiConfig(apiConfig) {
    const testPrompt = 'Hello';
    const result = await this.callLLMAPI(
      apiConfig,
      '你是一个翻译助手。',
      '请将以下文本翻译成中文：Hello'
    );

    if (result.success) {
      return {
        success: true,
        message: 'API配置测试成功'
      };
    } else {
      return {
        success: false,
        message: result.errorMessage,
        errorCode: result.errorCode
      };
    }
  }
};

/**
 * 消息监听器
 * 处理来自content script和options页面的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 翻译请求
  if (request.action === 'translate') {
    TranslationService.translate(
      request.text,
      request.targetLanguage,
      request.sourceLanguage
    ).then(sendResponse);
    return true; // 保持消息通道开放以进行异步响应
  }

  // 检测语言
  if (request.action === 'detectLanguage') {
    const detectedLanguage = LanguageDetector.detect(request.text);
    sendResponse({ language: detectedLanguage });
    return false;
  }

  // 测试API配置
  if (request.action === 'testApiConfig') {
    TranslationService.testApiConfig(request.config).then(sendResponse);
    return true;
  }

  // 获取所有支持的语言
  if (request.action === 'getAllLanguages') {
    const languages = LanguageDetector.getAllLanguages();
    sendResponse({ languages });
    return false;
  }
});

/**
 * 插件安装或更新时的初始化
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('AI翻译助手已安装');
    
    // 初始化默认偏好设置
    await StorageUtils.saveUserPreferences({
      lastTargetLanguage: 'zh',
      autoShowPopup: true,
      popupPosition: 'near'
    });

    // 打开设置页面引导用户配置API
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('AI翻译助手已更新到版本', chrome.runtime.getManifest().version);
  }
});

/**
 * Service Worker启动时初始化
 */
(async function init() {
  console.log('AI翻译助手后台服务已启动');
  
  // 输出缓存统计信息
  const stats = await StorageUtils.getCacheStats();
  console.log('缓存统计:', {
    总数: stats.totalCount,
    总大小: `${stats.totalSizeMB}MB`,
    存储类型: stats.storageType,
    说明: stats.note
  });
})();
