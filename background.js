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
   * 调用LLM API进行翻译（非流式，仅用于向后兼容）
   * 注意：推荐使用 Port 连接进行流式翻译，提供更好的用户体验
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
   * 处理流式响应
   * @param {Response} response - Fetch响应对象
   * @param {Function} onChunk - 数据块回调函数
   * @param {string} model - 模型名称
   * @returns {Promise<Object>} 完整的翻译结果
   */
  async handleStreamResponse(response, onChunk, model) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let usage = null; // 存储token使用信息

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        // 解码数据块
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          // SSE格式: "data: {...}"
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // 移除 "data: " 前缀
            
            // 流结束标记
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                fullText += content;
                // 调用回调函数，实时传递数据块
                onChunk(content, fullText);
              }
              
              // 提取usage信息（通常在最后一个chunk中）
              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch (e) {
              console.error('解析流数据失败:', e, 'data:', data);
            }
          }
        }
      }

      return {
        success: true,
        translatedText: fullText,
        model: model,
        usage: usage // 返回token使用信息
      };

    } catch (error) {
      console.error('流式处理错误:', error);
      return {
        success: false,
        errorMessage: '流式处理失败: ' + error.message,
        errorCode: 'STREAM_ERROR'
      };
    }
  },

  /**
   * 调用LLM API
   * @param {Object} apiConfig - API配置
   * @param {string} systemPrompt - 系统提示
   * @param {string} userPrompt - 用户提示
   * @param {Function} onChunk - 流式数据回调函数（可选）
   * @returns {Promise<Object>} API响应
   */
  async callLLMAPI(apiConfig, systemPrompt, userPrompt, onChunk = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    try {
      // 使用配置中的模型，如果没有配置则使用默认值
      const model = apiConfig.model;
      const useStream = !!onChunk; // 如果提供了回调函数，则启用流式
      
      const requestBody = {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 10000,
        stream: useStream // 启用流式输出
      };
      
      // 流式输出时添加 stream_options 以包含 usage 统计信息
      if (useStream) {
        requestBody.stream_options = { include_usage: true };
      }
      
      const response = await fetch(apiConfig.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify(requestBody),
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

      // 流式处理
      if (useStream) {
        return await this.handleStreamResponse(response, onChunk, apiConfig.model);
      }
      
      // 非流式处理（兼容原有逻辑）
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
        model: apiConfig.model,
        usage: data.usage // 返回token使用信息
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
 * 流式翻译连接监听器（默认启用，推荐使用）
 * 使用 Port 长连接支持流式数据传输，提供实时的翻译反馈
 * 优势：
 * - 渐进式显示翻译结果，用户体验更好
 * - 更快的首字响应时间
 * - 支持长文本翻译时的实时反馈
 */
chrome.runtime.onConnect.addListener((port) => {
  // 词典查询流式连接
  if (port.name === 'dictionary-stream') {
    port.onMessage.addListener(async (msg) => {
      if (msg.action === 'dictionary-lookup') {
        const { word } = msg;
        
        try {
          // 检查缓存
          const cacheKey = `dict_${word.toLowerCase()}`;
          const cached = await StorageUtils.getTranslationCache(cacheKey, 'dictionary');
          if (cached) {
            port.postMessage({
              type: 'complete',
              result: {
                success: true,
                definition: cached,
                cached: true
              }
            });
            return;
          }

          // 获取API配置
          const apiConfig = await StorageUtils.getActiveApiConfig();
          if (!apiConfig) {
            port.postMessage({
              type: 'complete',
              result: {
                success: false,
                errorMessage: '未配置API，请先在设置页面添加API配置',
                errorCode: 'NO_API_CONFIG'
              }
            });
            return;
          }

          // 构建词典查询提示词
          const systemPrompt = `你是一个专业的英文词典助手。请为用户提供的英文单词给出详细的词典释义。

请按以下格式返回：
1. 音标（使用国际音标，格式如 /ˈwɜːd/）
2. 词性和释义（包含中文解释，如 n. 名词，每个词性分开列出）
3. 常用例句（1-2个，并提供中文翻译）

要求：
- 简洁明了，不要赘述
- 释义使用中文
- 例句附带中文翻译
- 如果是不常见的词，可以适当扩展说明`;

          const userPrompt = `请查询单词：${word}`;

          // 流式回调函数
          const onChunk = (chunk, fullText) => {
            port.postMessage({
              type: 'chunk',
              chunk: chunk,
              fullText: fullText
            });
          };

          // 执行查询
          const result = await TranslationService.callLLMAPI(
            apiConfig,
            systemPrompt,
            userPrompt,
            onChunk
          );

          // 如果查询成功，缓存结果并更新token统计
          if (result.success) {
            await StorageUtils.saveTranslationCache(cacheKey, 'dictionary', result.translatedText);
            
            // 更新token统计
            if (result.usage) {
              await StorageUtils.updateTokenUsage(result.usage);
            }
          }

          // 发送完成消息
          port.postMessage({
            type: 'complete',
            result: {
              success: result.success,
              definition: result.translatedText,
              model: apiConfig.model,
              usage: result.usage,
              errorMessage: result.errorMessage,
              errorCode: result.errorCode
            }
          });

        } catch (error) {
          console.error('Dictionary lookup error:', error);
          port.postMessage({
            type: 'complete',
            result: {
              success: false,
              errorMessage: error.message || '查询失败，请稍后重试',
              errorCode: 'DICTIONARY_ERROR'
            }
          });
        }
      }
    });
  }
  
  // 翻译流式连接
  if (port.name === 'translation-stream') {
    port.onMessage.addListener(async (msg) => {
      if (msg.action === 'translate-stream') {
        const { text, targetLanguage, sourceLanguage } = msg;
        
        try {
          // 检测源语言
          const detectedLanguage = sourceLanguage || LanguageDetector.detect(text);
          
          // 如果源语言和目标语言相同，直接返回
          if (detectedLanguage === targetLanguage) {
            port.postMessage({
              type: 'complete',
              result: {
                success: true,
                translatedText: text,
                detectedLanguage: detectedLanguage,
                message: '源语言和目标语言相同'
              }
            });
            return;
          }

          // 检查缓存
          const cached = await StorageUtils.getTranslationCache(text, targetLanguage);
          if (cached) {
            port.postMessage({
              type: 'complete',
              result: {
                success: true,
                translatedText: cached,
                detectedLanguage: detectedLanguage,
                cached: true
              }
            });
            return;
          }

          // 获取API配置
          const apiConfig = await StorageUtils.getActiveApiConfig();
          if (!apiConfig) {
            port.postMessage({
              type: 'complete',
              result: {
                success: false,
                errorMessage: '未配置API，请先在设置页面添加API配置',
                errorCode: 'NO_API_CONFIG'
              }
            });
            return;
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

          // 流式回调函数 - 通过port发送数据块
          const onChunk = (chunk, fullText) => {
            port.postMessage({
              type: 'chunk',
              chunk: chunk,
              fullText: fullText
            });
          };

          // 执行翻译
          const result = await TranslationService.callLLMAPI(
            apiConfig,
            systemPrompt,
            userPrompt,
            onChunk // 传入流式回调
          );

          // 如果翻译成功，缓存结果并更新token统计
          if (result.success) {
            await StorageUtils.saveTranslationCache(text, targetLanguage, result.translatedText);
            
            // 更新token统计
            if (result.usage) {
              await StorageUtils.updateTokenUsage(result.usage);
            }
          }

          // 发送完成消息
          port.postMessage({
            type: 'complete',
            result: {
              ...result,
              detectedLanguage: detectedLanguage,
              model: apiConfig.model,
              apiConfigName: apiConfig.name
            }
          });

        } catch (error) {
          console.error('Stream translation error:', error);
          port.postMessage({
            type: 'complete',
            result: {
              success: false,
              errorMessage: error.message || '翻译失败，请稍后重试',
              errorCode: 'TRANSLATION_ERROR'
            }
          });
        }
      }
    });
  }
});

/**
 * 消息监听器
 * 处理来自content script和options页面的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 旧的非流式翻译接口已废弃，统一使用流式接口 (Port 连接)
  // 如果收到旧的翻译请求，引导使用流式接口
  if (request.action === 'translate') {
    console.warn('检测到旧的非流式翻译请求，建议使用 Port 连接进行流式翻译');
    // 为了向后兼容，仍然支持，但不推荐
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
