/**
 * 内容脚本（Content Script）
 * 负责划词监听、显示翻译图标和翻译弹窗
 */

(function() {
  'use strict';

  // 全局状态
  let currentIcon = null;
  let currentPopup = null;
  let currentSelectedText = '';
  let currentContext = '';  // 当前单词所在的上下文句子
  let debounceTimer = null;
  let userPreferences = null;
  let isDictionaryMode = false;  // 是否为词典模式
  
  // 音频播放状态
  let currentAudio = null;  // 当前正在播放的音频实例
  let isSynthesizing = false;  // 是否正在合成语音
  let isPlaying = false;  // 是否正在播放

  /**
   * 初始化
   */
  async function init() {
    // 加载用户偏好设置
    const result = await chrome.storage.sync.get('userPreferences');
    userPreferences = result.userPreferences || {
      lastTargetLanguage: 'zh',
      autoShowPopup: true,
      popupPosition: 'near',
      maxTextLength: 5000
    };

    // 为旧配置添加默认值兼容处理
    if (userPreferences.maxTextLength === undefined) {
      userPreferences.maxTextLength = 5000;
    }

    // 监听文本选择事件
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keyup', handleTextSelection);

    // 监听ESC键关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePopup();
      }
    });

    // 点击其他区域关闭弹窗
    document.addEventListener('mousedown', (e) => {
      if (currentPopup && !currentPopup.contains(e.target) && 
          (!currentIcon || !currentIcon.contains(e.target))) {
        closePopup();
      }
    });

    console.log('AI翻译助手已加载');
  }

  /**
   * 处理文本选择事件
   */
  function handleTextSelection(e) {
    // 防抖处理
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const selectedText = window.getSelection().toString().trim();
      
      // 移除之前的图标
      if (currentIcon) {
        currentIcon.remove();
        currentIcon = null;
      }

      // 如果没有选中文本或文本太短，不显示图标
      if (!selectedText || selectedText.length < 2) {
        return;
      }

      // 如果选中的文本超过用户设置的长度限制，不处理
      const maxLength = userPreferences.maxTextLength || 5000;
      if (selectedText.length > maxLength) {
        return;
      }

      currentSelectedText = selectedText;
      // 判断是否为单词（词典模式）
      isDictionaryMode = isSingleWord(selectedText);
      
      // 如果是词典模式，获取上下文
      if (isDictionaryMode) {
        currentContext = getWordContext();
      } else {
        currentContext = '';
      }
      
      showTranslateIcon(e);
    }, 200);
  }

  /**
   * 显示翻译图标
   */
  function showTranslateIcon(event) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // 创建图标
    const icon = document.createElement('div');
    icon.className = 'ai-translate-icon';
    
    // 计算图标位置（选中文本的右上角）
    const iconX = rect.right + window.scrollX + 5;
    const iconY = rect.top + window.scrollY - 5;
    
    icon.style.left = `${iconX}px`;
    icon.style.top = `${iconY}px`;

    // 点击图标时显示翻译弹窗
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      showTranslatePopup(iconX, iconY);
    });

    document.body.appendChild(icon);
    currentIcon = icon;

    // 如果设置了自动显示弹窗
    if (userPreferences.autoShowPopup) {
      setTimeout(() => {
        if (currentIcon === icon) {
          showTranslatePopup(iconX, iconY);
        }
      }, 500);
    }
  }

  /**
   * 显示翻译弹窗
   */
  async function showTranslatePopup(x, y) {
    // 关闭已存在的弹窗
    closePopup();

    // 创建弹窗容器
    const popup = document.createElement('div');
    popup.className = 'ai-translate-popup';

    // 先设置初始位置（在视口外），以便获取实际尺寸
    popup.style.left = '-9999px';
    popup.style.top = '-9999px';
    popup.style.visibility = 'hidden';

    // 获取所有支持的语言
    const languagesResponse = await chrome.runtime.sendMessage({ action: 'getAllLanguages' });
    const languages = languagesResponse.languages;

    // 检测源语言
    const detectionResponse = await chrome.runtime.sendMessage({
      action: 'detectLanguage',
      text: currentSelectedText
    });
    const detectedLanguage = detectionResponse.language;

    // 构建弹窗HTML - 根据是否为词典模式显示不同内容
    if (isDictionaryMode) {
      // 词典模式
      popup.innerHTML = `
        <div class="ai-translate-popup-header ai-translate-dict-header">
          <div class="ai-translate-popup-language">
            <span class="ai-translate-popup-dict-title">📖 词典</span>
          </div>
          <button class="ai-translate-popup-close" id="ai-translate-close">×</button>
        </div>
        <div class="ai-translate-popup-content">
          <div class="ai-translate-dict-word">
            <div class="ai-translate-dict-word-row">
              <div class="ai-translate-dict-word-info">
                <span class="ai-translate-dict-word-text">${escapeHtml(currentSelectedText)}</span>
                <span class="ai-translate-dict-phonetic" id="ai-translate-phonetic"></span>
              </div>
              <button class="ai-translate-tts-btn" id="ai-translate-word-tts" title="播放单词发音">
                <svg class="ai-translate-tts-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                </svg>
              </button>
            </div>
          </div>
          ${currentContext ? `
          <div class="ai-translate-dict-context">
            <div class="ai-translate-dict-context-header">
              <div class="ai-translate-dict-context-label">📝 上下文</div>
              <button class="ai-translate-tts-btn ai-translate-tts-btn-small" id="ai-translate-sentence-tts" title="播放句子发音">
                <svg class="ai-translate-tts-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                </svg>
              </button>
            </div>
            <div class="ai-translate-dict-context-text" id="ai-translate-context">${escapeHtml(currentContext).replace(new RegExp(`(${escapeHtml(currentSelectedText)})`, 'gi'), '<mark class="ai-translate-highlight">$1</mark>')}</div>
            <div class="ai-translate-dict-context-trans" id="ai-translate-context-trans"></div>
          </div>
          ` : ''}
          <div class="ai-translate-popup-result ai-translate-dict-result" id="ai-translate-result">
            <div class="ai-translate-popup-loading">
              <div class="ai-translate-popup-spinner"></div>
              <span>正在查询...</span>
            </div>
          </div>
        </div>
        <div class="ai-translate-popup-footer">
          <button class="ai-translate-popup-copy-btn" id="ai-translate-copy" disabled>复制释义</button>
          <div class="ai-translate-popup-info">AI词典助手</div>
        </div>
      `;
    } else {
      // 普通翻译模式
      popup.innerHTML = `
        <div class="ai-translate-popup-header">
          <div class="ai-translate-popup-language">
            <span class="ai-translate-popup-source-lang">${getLanguageName(detectedLanguage, languages)}</span>
            <span class="ai-translate-popup-arrow">→</span>
            <select class="ai-translate-popup-target-select" id="ai-translate-target-lang">
              ${languages.map(lang => `
                <option value="${lang.code}" ${lang.code === userPreferences.lastTargetLanguage ? 'selected' : ''}>
                  ${lang.name}
                </option>
              `).join('')}
            </select>
          </div>
          <button class="ai-translate-popup-close" id="ai-translate-close">×</button>
        </div>
        <div class="ai-translate-popup-content">
          <div class="ai-translate-popup-original">
            <div class="ai-translate-popup-original-label">原文</div>
            <div>${escapeHtml(currentSelectedText)}</div>
          </div>
          <div class="ai-translate-popup-result" id="ai-translate-result">
            <div class="ai-translate-popup-loading">
              <div class="ai-translate-popup-spinner"></div>
              <span>正在翻译...</span>
            </div>
          </div>
        </div>
        <div class="ai-translate-popup-footer">
          <button class="ai-translate-popup-copy-btn" id="ai-translate-copy" disabled>复制译文</button>
          <div class="ai-translate-popup-info">AI翻译助手</div>
        </div>
      `;
    }

    document.body.appendChild(popup);
    currentPopup = popup;

    // 等待DOM更新后获取实际尺寸并调整位置
    requestAnimationFrame(() => {
      adjustPopupPosition(popup, x, y);
      popup.style.visibility = 'visible';
    });

    // 绑定事件
    const closeBtn = popup.querySelector('#ai-translate-close');
    closeBtn.addEventListener('click', closePopup);

    const copyBtn = popup.querySelector('#ai-translate-copy');
    copyBtn.addEventListener('click', handleCopyTranslation);

    // 词典模式和翻译模式的不同处理
    if (isDictionaryMode) {
      // 词典模式：绑定TTS按钮事件并执行词典查询
      const wordTtsBtn = popup.querySelector('#ai-translate-word-tts');
      if (wordTtsBtn) {
        wordTtsBtn.addEventListener('click', () => handleTTS(currentSelectedText, 'word'));
      }
      
      const sentenceTtsBtn = popup.querySelector('#ai-translate-sentence-tts');
      if (sentenceTtsBtn) {
        sentenceTtsBtn.addEventListener('click', () => handleTTS(currentContext, 'sentence'));
      }
      
      performDictionaryLookup();
    } else {
      // 翻译模式：绑定语言切换事件并执行翻译
      const targetSelect = popup.querySelector('#ai-translate-target-lang');
      targetSelect.addEventListener('change', handleTargetLanguageChange);
      performTranslation(detectedLanguage, userPreferences.lastTargetLanguage);
    }
  }

  /**
   * 调整弹窗位置，确保不超出视口
   */
  function adjustPopupPosition(popup, x, y) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 20; // 距离视口边缘的最小间距

    // 获取弹窗的实际尺寸
    const rect = popup.getBoundingClientRect();
    const popupWidth = rect.width || 400;  // 如果无法获取，使用默认值
    const popupHeight = rect.height || 300;

    // 将绝对定位转换为相对视口的定位（因为弹窗使用 position: fixed）
    let popupX = x - window.scrollX + 10;
    let popupY = y - window.scrollY + 40;

    // 调整水平位置，确保不超出视口右边界
    if (popupX + popupWidth > viewportWidth - margin) {
      popupX = viewportWidth - popupWidth - margin;
    }
    // 确保不超出视口左边界
    if (popupX < margin) {
      popupX = margin;
    }

    // 调整垂直位置，确保不超出视口底部
    if (popupY + popupHeight > viewportHeight - margin) {
      // 尝试显示在选中文本上方
      popupY = y - window.scrollY - popupHeight - 10;
      // 如果上方空间也不够，则显示在视口顶部留出边距
      if (popupY < margin) {
        popupY = margin;
      }
    }
    // 确保不超出视口顶部
    if (popupY < margin) {
      popupY = margin;
    }

    // 应用最终位置
    popup.style.left = `${popupX}px`;
    popup.style.top = `${popupY}px`;

    // 动态计算并设置弹窗的最大高度，确保底部按钮区域始终可见
    const availableHeight = viewportHeight - popupY - margin;
    popup.style.maxHeight = `${availableHeight}px`;
  }

  /**
   * 执行词典查询 - 用于单词查询模式
   */
  async function performDictionaryLookup() {
    const resultDiv = document.getElementById('ai-translate-result');
    const phoneticSpan = document.getElementById('ai-translate-phonetic');
    const copyBtn = document.getElementById('ai-translate-copy');

    if (!resultDiv) return;

    // 显示加载状态
    resultDiv.innerHTML = `
      <div class="ai-translate-popup-loading">
        <div class="ai-translate-popup-spinner"></div>
        <span>正在查询...</span>
      </div>
    `;
    copyBtn.disabled = true;

    try {
      // 建立流式连接
      const port = chrome.runtime.connect({ name: 'dictionary-stream' });
      
      let fullResult = '';
      let isStreamStarted = false;

      // 监听流式数据
      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          // 第一次收到数据时，清除加载动画
          if (!isStreamStarted) {
            isStreamStarted = true;
            resultDiv.innerHTML = '';
          }
          
          // 实时更新结果
          fullResult = msg.fullText;
          resultDiv.innerHTML = formatDictionaryResult(fullResult);
          
          // 尝试提取音标
          extractAndShowPhonetic(fullResult, phoneticSpan);
          
          // 每次更新后重新调整弹窗位置
          if (currentPopup && currentIcon) {
            const iconRect = currentIcon.getBoundingClientRect();
            const iconX = iconRect.left + window.scrollX;
            const iconY = iconRect.top + window.scrollY;
            requestAnimationFrame(() => {
              adjustPopupPosition(currentPopup, iconX, iconY);
            });
          }
          
        } else if (msg.type === 'complete') {
          const response = msg.result;
          
          if (response.success) {
            // 如果是缓存结果，直接显示
            if (response.cached) {
              resultDiv.innerHTML = formatDictionaryResult(response.definition);
              extractAndShowPhonetic(response.definition, phoneticSpan);
            }
            
            // 显示上下文翻译
            const contextTransDiv = document.getElementById('ai-translate-context-trans');
            if (contextTransDiv && response.contextTranslation) {
              contextTransDiv.innerHTML = `<span class="ai-translate-dict-context-trans-label">译文：</span>${escapeHtml(response.contextTranslation)}`;
              contextTransDiv.style.display = 'block';
            }
            
            // 启用复制按钮
            copyBtn.disabled = false;
            copyBtn.dataset.translation = response.definition || fullResult;

            // 更新底部信息栏显示模型信息和token消耗
            const infoDiv = document.querySelector('.ai-translate-popup-info');
            if (infoDiv && response.model) {
              let infoHtml = `AI词典助手<span style="margin: 0 4px; color: #ddd;">|</span><span style="color: #667eea;">${escapeHtml(response.model)}</span>`;
              
              // 添加token消耗信息
              if (response.usage) {
                infoHtml += `<span style="margin: 0 4px; color: #ddd;">|</span><span style="color: #48bb78;" title="输入Token/输出Token/总Token">${response.usage.prompt_tokens || 0}/${response.usage.completion_tokens || 0}/${response.usage.total_tokens || 0} tokens</span>`;
              }
              
              infoDiv.innerHTML = infoHtml;
            }

            // 显示缓存提示
            if (response.cached) {
              resultDiv.innerHTML += '<div style="margin-top: 8px; font-size: 11px; color: #999;">(缓存结果)</div>';
            }

            // 查询完成后重新调整弹窗位置
            if (currentPopup && currentIcon) {
              const iconRect = currentIcon.getBoundingClientRect();
              const iconX = iconRect.left + window.scrollX;
              const iconY = iconRect.top + window.scrollY;
              
              requestAnimationFrame(() => {
                adjustPopupPosition(currentPopup, iconX, iconY);
              });
            }
            
          } else {
            // 显示错误信息
            showError(response.errorMessage, response.errorCode);
          }
          
          // 断开连接
          port.disconnect();
        }
      });

      // 发送词典查询请求（包含上下文）
      port.postMessage({
        action: 'dictionary-lookup',
        word: currentSelectedText,
        context: currentContext
      });

    } catch (error) {
      console.error('Dictionary lookup error:', error);
      showError('查询失败，请稍后重试', 'UNKNOWN_ERROR');
    }
  }

  /**
   * 格式化词典结果为HTML（支持Markdown渲染）
   */
  function formatDictionaryResult(text) {
    if (!text) return '';
    
    // 先转义HTML特殊字符
    let html = escapeHtml(text);
    
    // 处理Markdown格式
    // 1. 处理标题 ## -> h4, ### -> h5
    html = html.replace(/^### (.+)$/gm, '<h5 class="ai-translate-dict-h5">$1</h5>');
    html = html.replace(/^## (.+)$/gm, '<h4 class="ai-translate-dict-h4">$1</h4>');
    
    // 2. 处理加粗 **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 3. 处理斜体 *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // 4. 处理行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code class="ai-translate-dict-code">$1</code>');
    
    // 5. 处理换行
    html = html.replace(/\n/g, '<br>');
    
    // 6. 突出显示词性标记（如 n. v. adj. 等）
    html = html.replace(/\b(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|vt\.|vi\.|aux\.)/g, '<span class="ai-translate-dict-pos">$1</span>');
    
    // 7. 突出显示序号（如 1. 2. 3. 或 ① ② ③）
    html = html.replace(/(^|<br>)(\d+\.\s*)/g, '$1<span class="ai-translate-dict-num">$2</span>');
    html = html.replace(/([\u2460-\u2473])/g, '<span class="ai-translate-dict-num">$1</span>');
    
    // 8. 处理无序列表项 - item
    html = html.replace(/(^|<br>)- /g, '$1<span class="ai-translate-dict-bullet">•</span> ');
    
    return html;
  }

  /**
   * 提取并显示音标
   */
  function extractAndShowPhonetic(text, phoneticSpan) {
    if (!phoneticSpan || !text) return;
    
    // 尝试匹配音标格式：/.../ 或 [...] 或 UK: ... US: ...
    const phoneticPatterns = [
      /\/([ɐ-˿\w\s]+)\//,  // /fəˈnetɪk/
      /\[([ɐ-˿\w\s]+)\]/,  // [fəˈnetɪk]
      /UK:\s*\/([ɐ-˿\w\s]+)\/\s*US:\s*\/([ɐ-˿\w\s]+)\//,  // UK: /.../ US: /.../
      /［([ɐ-˿\w\s]+)］/  // 全角方括号
    ];
    
    for (const pattern of phoneticPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
          // UK/US 双音标
          phoneticSpan.textContent = `UK /${match[1]}/ US /${match[2]}/`;
        } else {
          phoneticSpan.textContent = `/${match[1]}/`;
        }
        phoneticSpan.style.display = 'inline';
        return;
      }
    }
  }

  /**
   * 执行翻译 - 默认启用流式输出
   * 使用 Port 长连接实现流式翻译，结果逐字显示，提供更好的用户体验
   */
  async function performTranslation(sourceLanguage, targetLanguage) {
    const resultDiv = document.getElementById('ai-translate-result');
    const copyBtn = document.getElementById('ai-translate-copy');

    if (!resultDiv) return;

    // 显示加载状态
    resultDiv.innerHTML = `
      <div class="ai-translate-popup-loading">
        <div class="ai-translate-popup-spinner"></div>
        <span>正在翻译...</span>
      </div>
    `;
    copyBtn.disabled = true;

    try {
      // 建立流式连接（默认启用）
      const port = chrome.runtime.connect({ name: 'translation-stream' });
      
      let fullTranslation = '';
      let isStreamStarted = false;

      // 监听流式数据
      port.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          // 第一次收到数据时，清除加载动画
          if (!isStreamStarted) {
            isStreamStarted = true;
            resultDiv.innerHTML = '';
          }
          
          // 实时更新翻译结果
          fullTranslation = msg.fullText;
          resultDiv.innerHTML = escapeHtml(fullTranslation).replace(/\n/g, '<br>');
          
          // 每次更新后重新调整弹窗位置（防止内容增长导致超出视窗）
          if (currentPopup && currentIcon) {
            const iconRect = currentIcon.getBoundingClientRect();
            const iconX = iconRect.left + window.scrollX;
            const iconY = iconRect.top + window.scrollY;
            requestAnimationFrame(() => {
              adjustPopupPosition(currentPopup, iconX, iconY);
            });
          }
          
        } else if (msg.type === 'complete') {
          // 翻译完成
          const response = msg.result;
          
          if (response.success) {
            // 如果是缓存结果或源目标语言相同，直接显示
            if (response.cached || response.message) {
              resultDiv.innerHTML = escapeHtml(response.translatedText).replace(/\n/g, '<br>');
            }
            
            // 启用复制按钮
            copyBtn.disabled = false;
            copyBtn.dataset.translation = response.translatedText;

            // 更新底部信息栏显示模型信息和token消耗
            const infoDiv = document.querySelector('.ai-translate-popup-info');
            if (infoDiv && response.model) {
              let infoHtml = `AI翻译助手<span style="margin: 0 4px; color: #ddd;">|</span><span style="color: #667eea;">${escapeHtml(response.model)}</span>`;
              
              // 添加token消耗信息
              if (response.usage) {
                infoHtml += `<span style="margin: 0 4px; color: #ddd;">|</span><span style="color: #48bb78;" title="输入Token/输出Token/总Token">${response.usage.prompt_tokens || 0}/${response.usage.completion_tokens || 0}/${response.usage.total_tokens || 0} tokens</span>`;
              }
              
              infoDiv.innerHTML = infoHtml;
            }

            // 显示缓存提示
            if (response.cached) {
              resultDiv.innerHTML += '<div style="margin-top: 8px; font-size: 11px; color: #999;">(缓存结果)</div>';
            }

            // 翻译完成后重新调整弹窗位置
            if (currentPopup && currentIcon) {
              const iconRect = currentIcon.getBoundingClientRect();
              const iconX = iconRect.left + window.scrollX;
              const iconY = iconRect.top + window.scrollY;
              
              requestAnimationFrame(() => {
                adjustPopupPosition(currentPopup, iconX, iconY);
              });
            }
            
          } else {
            // 显示错误信息
            showError(response.errorMessage, response.errorCode);
          }
          
          // 断开连接
          port.disconnect();
        }
      });

      // 发送翻译请求
      port.postMessage({
        action: 'translate-stream',
        text: currentSelectedText,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      });

    } catch (error) {
      console.error('Translation error:', error);
      showError('翻译失败，请稍后重试', 'UNKNOWN_ERROR');
    }
  }

  /**
   * 显示错误信息
   */
  function showError(message, errorCode) {
    const resultDiv = document.getElementById('ai-translate-result');
    if (!resultDiv) return;

    let actionButtons = '';
    
    if (errorCode === 'NO_API_CONFIG') {
      actionButtons = `
        <div class="ai-translate-popup-error-actions">
          <button class="ai-translate-popup-error-btn" onclick="chrome.runtime.openOptionsPage()">
            前往设置
          </button>
        </div>
      `;
    } else if (errorCode === 'RATE_LIMIT' || errorCode === 'API_ERROR') {
      actionButtons = `
        <div class="ai-translate-popup-error-actions">
          <button class="ai-translate-popup-error-btn secondary" id="ai-translate-retry">
            重试
          </button>
          <button class="ai-translate-popup-error-btn" onclick="chrome.runtime.openOptionsPage()">
            切换API
          </button>
        </div>
      `;
    }

    resultDiv.innerHTML = `
      <div class="ai-translate-popup-error">
        <div class="ai-translate-popup-error-title">翻译失败</div>
        <div>${escapeHtml(message)}</div>
        ${actionButtons}
      </div>
    `;

    // 绑定重试按钮
    const retryBtn = resultDiv.querySelector('#ai-translate-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        const targetSelect = document.getElementById('ai-translate-target-lang');
        const targetLang = targetSelect.value;
        performTranslation(null, targetLang);
      });
    }
  }

  /**
   * 处理目标语言变更
   */
  async function handleTargetLanguageChange(e) {
    const newTargetLang = e.target.value;
    
    // 更新用户偏好
    userPreferences.lastTargetLanguage = newTargetLang;
    await chrome.storage.sync.set({ userPreferences });

    // 重新翻译
    performTranslation(null, newTargetLang);
  }

  /**
   * 处理复制翻译结果
   */
  async function handleCopyTranslation(e) {
    const btn = e.target;
    const translation = btn.dataset.translation;

    if (!translation) return;

    try {
      await navigator.clipboard.writeText(translation);
      
      // 显示复制成功状态
      btn.classList.add('copied');
      btn.textContent = '已复制';
      
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = '复制译文';
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      // 降级方案：使用旧的复制方法
      const textarea = document.createElement('textarea');
      textarea.value = translation;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      btn.classList.add('copied');
      btn.textContent = '已复制';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.textContent = '复制译文';
      }, 2000);
    }
  }

  /**
   * 处理TTS请求（文本转语音）
   * @param {string} text - 待合成的文本
   * @param {string} type - 类型：'word' 或 'sentence'
   */
  async function handleTTS(text, type) {
    if (!text || isSynthesizing) return;
    
    // 获取对应的按钮
    const btnId = type === 'word' ? 'ai-translate-word-tts' : 'ai-translate-sentence-tts';
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    // 如果正在播放，停止播放
    if (isPlaying && currentAudio) {
      stopAudio();
      updateTTSButtonState(btn, 'default');
      return;
    }
    
    try {
      // 更新按钮状态为加载中
      isSynthesizing = true;
      updateTTSButtonState(btn, 'loading');
      
      // 请求TTS服务
      const response = await chrome.runtime.sendMessage({
        action: 'text-to-speech',
        text: text,
        type: type
      });
      
      if (response.success) {
        // 创建音频对象并播放
        currentAudio = new Audio();
        
        // 监听播放事件
        currentAudio.onloadeddata = () => {
          isSynthesizing = false;
          isPlaying = true;
          updateTTSButtonState(btn, 'playing');
          currentAudio.play().catch(err => {
            console.error('Audio play error:', err);
            showTTSError(btn, '播放失败');
          });
        };
        
        currentAudio.onended = () => {
          isPlaying = false;
          updateTTSButtonState(btn, 'default');
          currentAudio = null;
        };
        
        currentAudio.onerror = (err) => {
          console.error('Audio load error:', err);
          console.error('Audio error details:', {
            error: currentAudio.error,
            networkState: currentAudio.networkState,
            readyState: currentAudio.readyState,
            src: currentAudio.src.substring(0, 100)
          });
          isSynthesizing = false;
          isPlaying = false;
          showTTSError(btn, '加载失败');
        };
        
        // 加载音频数据
        if (response.audioUrl) {
          currentAudio.src = response.audioUrl;
        } else if (response.audioData) {
          // 如果是Base64数据
          console.log('TTS返回音频数据，Base64长度:', response.audioData.length);
          
          // 检查Base64数据的前几个字符
          const base64Preview = response.audioData.substring(0, 50);
          console.log('Base64数据预览:', base64Preview);
          
          // 尝试检测实际的音频格式
          const detectedFormat = detectAudioFormat(response.audioData);
          console.log('检测到的音频格式:', detectedFormat);
          
          // 使用检测到的格式，默认为mp3
          const actualFormat = detectedFormat || 'mp3';
          
          try {
            const audioBlob = base64ToBlob(response.audioData, actualFormat);
            console.log('音频Blob创建成功，大小:', audioBlob.size, 'bytes, 类型:', audioBlob.type);
            
            // 验证Blob是否有效
            if (audioBlob.size === 0) {
              throw new Error('生成的Blob大小为0');
            }
            
            // 检查浏览器是否支持该音频格式
            const canPlay = currentAudio.canPlayType(audioBlob.type);
            console.log('浏览器支持该格式:', canPlay, '("probably" or "maybe" 表示支持)');
            
            const blobUrl = URL.createObjectURL(audioBlob);
            console.log('Blob URL创建成功:', blobUrl);
            
            // 添加更多调试事件
            currentAudio.addEventListener('loadstart', () => {
              console.log('音频开始加载...');
            }, { once: true });
            
            currentAudio.addEventListener('loadedmetadata', () => {
              console.log('音频元数据已加载，时长:', currentAudio.duration);
            }, { once: true });
            
            currentAudio.addEventListener('loadeddata', () => {
              console.log('音频数据已加载');
            }, { once: true });
            
            currentAudio.addEventListener('canplay', () => {
              console.log('音频可以播放');
            }, { once: true });
            
            // 设置音频源
            currentAudio.src = blobUrl;
            
            // 尝试预加载
            currentAudio.load();
            console.log('开始预加载音频数据...');
            
            // 清理旧的Blob URL
            currentAudio.addEventListener('ended', () => {
              URL.revokeObjectURL(blobUrl);
            }, { once: true });
            
            // 也在错误时清理
            currentAudio.addEventListener('error', () => {
              URL.revokeObjectURL(blobUrl);
            }, { once: true });
            
          } catch (blobError) {
            console.error('创建音频Blob失败:', blobError);
            isSynthesizing = false;
            showTTSError(btn, '音频格式错误');
            return;
          }
        } else {
          console.error('TTS响应中没有音频数据');
          isSynthesizing = false;
          showTTSError(btn, '无音频数据');
          return;
        }
      } else {
        isSynthesizing = false;
        showTTSError(btn, response.errorMessage || '合成失败');
      }
    } catch (error) {
      console.error('TTS error:', error);
      isSynthesizing = false;
      showTTSError(btn, '请求失败');
    }
  }
  
  /**
   * 更新TTS按钮状态
   * @param {HTMLElement} btn - 按钮元素
   * @param {string} state - 状态：'default', 'loading', 'playing'
   */
  function updateTTSButtonState(btn, state) {
    if (!btn) return;
    
    const icon = btn.querySelector('.ai-translate-tts-icon');
    if (!icon) return;
    
    // 移除所有状态类
    btn.classList.remove('loading', 'playing');
    
    switch (state) {
      case 'loading':
        btn.classList.add('loading');
        // 加载状态 - 显示旋转的加载图标
        icon.innerHTML = '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4 31.4" stroke-dashoffset="0"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></circle>';
        btn.disabled = false;
        btn.title = '正在合成...';
        break;
      case 'playing':
        btn.classList.add('playing');
        // 播放状态 - 显示暂停图标
        icon.innerHTML = '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>';
        btn.disabled = false;
        btn.title = '停止播放';
        break;
      default:
        // 默认状态 - 显示音量图标
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>';
        btn.disabled = false;
        btn.title = state === 'word' ? '播放单词发音' : '播放句子发音';
    }
  }
  
  /**
   * 显示TTS错误
   * @param {HTMLElement} btn - 按钮元素
   * @param {string} message - 错误消息
   */
  function showTTSError(btn, message) {
    if (!btn) return;
    
    const icon = btn.querySelector('.ai-translate-tts-icon');
    if (icon) {
      // 错误状态 - 显示警告图标
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>';
      btn.title = message;
      btn.classList.add('error');
    }
    
    // 2秒后恢复默认状态
    setTimeout(() => {
      btn.classList.remove('error');
      updateTTSButtonState(btn, 'default');
    }, 2000);
  }
  
  /**
   * 停止音频播放
   */
  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    isPlaying = false;
  }
  
  /**
   * 将Base64字符串转换为Blob对象
   * @param {string} base64 - Base64编码的数据
   * @param {string} format - 音频格式（mp3, wav等）
   * @returns {Blob}
   */
  function base64ToBlob(base64, format) {
    try {
      // 清理Base64字符串（移除可能的空白字符和换行符）
      const cleanBase64 = base64.replace(/\s/g, '');
      
      // 确定MIME类型
      let mimeType;
      switch (format.toLowerCase()) {
        case 'wav':
          mimeType = 'audio/wav';
          break;
        case 'opus':
          mimeType = 'audio/opus';
          break;
        case 'aac':
          mimeType = 'audio/aac';
          break;
        case 'flac':
          mimeType = 'audio/flac';
          break;
        case 'pcm':
          // PCM需要转换为WAV格式才能播放
          return pcmToWav(cleanBase64);
        case 'mp3':
        default:
          mimeType = 'audio/mpeg';
          break;
      }
      
      // 解码Base64
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } catch (error) {
      console.error('Base64解码失败:', error);
      console.error('Base64数据预览:', base64.substring(0, 100) + '...');
      throw new Error('音频数据解码失败: ' + error.message);
    }
  }

  /**
   * 将PCM数据转换为WAV格式
   * @param {string} base64Pcm - Base64编码的PCM数据
   * @returns {Blob} WAV格式Blob
   */
  function pcmToWav(base64Pcm) {
    try {
      // 解码Base64获取PCM数据
      const byteCharacters = atob(base64Pcm);
      const pcmData = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        pcmData[i] = byteCharacters.charCodeAt(i);
      }
      
      // WAV文件参数
      const numChannels = 1; // 单声道
      const sampleRate = 24000; // 采样率
      const bitsPerSample = 16; // 每个采样的位数
      const blockAlign = numChannels * (bitsPerSample / 8);
      const byteRate = sampleRate * blockAlign;
      const dataSize = pcmData.length;
      const fileSize = 36 + dataSize;
      
      // 创建WAV文件头
      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      
      // RIFF chunk descriptor
      writeString(view, 0, 'RIFF');
      view.setUint32(4, fileSize, true);
      writeString(view, 8, 'WAVE');
      
      // fmt sub-chunk
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true); // fmt chunk size
      view.setUint16(20, 1, true); // audio format (1 = PCM)
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);
      
      // data sub-chunk
      writeString(view, 36, 'data');
      view.setUint32(40, dataSize, true);
      
      // 合并header和PCM数据
      const wavData = new Uint8Array(44 + dataSize);
      wavData.set(new Uint8Array(wavHeader), 0);
      wavData.set(pcmData, 44);
      
      console.log('PCM转换为WAV成功，文件大小:', wavData.length);
      return new Blob([wavData], { type: 'audio/wav' });
    } catch (error) {
      console.error('PCM转换为WAV失败:', error);
      throw new Error('PCM转换失败: ' + error.message);
    }
  }
  
  /**
   * 检测音频数据的实际格式
   * @param {string} base64Data - Base64编码的音频数据
   * @returns {string|null} 检测到的格式，或null
   */
  function detectAudioFormat(base64Data) {
    try {
      // 解码前几个字节来检测文件头
      const prefix = base64Data.substring(0, 20);
      const bytes = atob(prefix);
      const header = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        header[i] = bytes.charCodeAt(i);
      }
      
      // MP3: 以 0xFF 0xFB 或 0xFF 0xF3 开头，或 ID3 tag
      if ((header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) ||
          (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33)) { // "ID3"
        return 'mp3';
      }
      
      // WAV: 以 "RIFF" 开头
      if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) { // "RIFF"
        return 'wav';
      }
      
      // Opus: 以 "OggS" 开头
      if (header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) { // "OggS"
        return 'opus';
      }
      
      // AAC: 以 0xFF 0xF1 或 0xFF 0xF9 开头
      if (header[0] === 0xFF && (header[1] === 0xF1 || header[1] === 0xF9)) {
        return 'aac';
      }
      
      // FLAC: 以 "fLaC" 开头
      if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) { // "fLaC"
        return 'flac';
      }
      
      // 如果都不匹配，可能是PCM原始数据
      // PCM通常没有特定的文件头，其值较小
      console.log('未检测到知名音频格式，可能是PCM数据');
      return 'pcm';
    } catch (error) {
      console.error('检测音频格式失败:', error);
      return null;
    }
  }
  
  /**
   * 向DataView写入字符串
   */
  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * 关闭弹窗
   */
  function closePopup() {
    // 停止正在播放的音频
    stopAudio();
    
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
    if (currentIcon) {
      currentIcon.remove();
      currentIcon = null;
    }
  }

  /**
   * 获取语言名称
   */
  function getLanguageName(code, languages) {
    const lang = languages.find(l => l.code === code);
    return lang ? lang.name : code;
  }

  /**
   * 获取选中单词的上下文（所在句子）
   */
  function getWordContext() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return '';
    
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    // 获取文本节点的完整内容
    let textContent = '';
    let wordOffset = 0;
    
    if (node.nodeType === Node.TEXT_NODE) {
      textContent = node.textContent || '';
      wordOffset = range.startOffset;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 尝试获取父元素的文本内容
      textContent = node.innerText || node.textContent || '';
    }
    
    if (!textContent) return '';
    
    // 提取包含选中单词的句子
    // 句子分隔符：. ! ? 。！？以及换行
    const sentenceEnders = /[.!?。！？\n]/;
    
    // 向前查找句子开始位置
    let sentenceStart = 0;
    for (let i = wordOffset - 1; i >= 0; i--) {
      if (sentenceEnders.test(textContent[i])) {
        sentenceStart = i + 1;
        break;
      }
    }
    
    // 向后查找句子结束位置
    let sentenceEnd = textContent.length;
    for (let i = wordOffset; i < textContent.length; i++) {
      if (sentenceEnders.test(textContent[i])) {
        sentenceEnd = i + 1;
        break;
      }
    }
    
    // 提取句子并清理
    let sentence = textContent.substring(sentenceStart, sentenceEnd).trim();
    
    // 如果句子太长，截取单词周围的上下文（前后各50个字符）
    if (sentence.length > 150) {
      const wordIndex = sentence.toLowerCase().indexOf(currentSelectedText.toLowerCase());
      if (wordIndex !== -1) {
        const contextStart = Math.max(0, wordIndex - 50);
        const contextEnd = Math.min(sentence.length, wordIndex + currentSelectedText.length + 50);
        sentence = (contextStart > 0 ? '...' : '') + 
                   sentence.substring(contextStart, contextEnd) + 
                   (contextEnd < sentence.length ? '...' : '');
      }
    }
    
    // 确保句子包含选中的单词
    if (sentence.toLowerCase().includes(currentSelectedText.toLowerCase())) {
      return sentence;
    }
    
    return '';
  }

  /**
   * 判断是否为单个单词
   * 支持英文单词（包含连字符的复合词）
   */
  function isSingleWord(text) {
    // 去除首尾空格
    const trimmed = text.trim();
    
    // 空文本不是单词
    if (!trimmed) return false;
    
    // 包含空格或换行，不是单个单词
    if (/\s/.test(trimmed)) return false;
    
    // 英文单词：只包含字母、连字符、撇号（如 don't, self-driving）
    const englishWordPattern = /^[a-zA-Z]+(['-][a-zA-Z]+)*$/;
    
    // 检查是否是英文单词
    if (englishWordPattern.test(trimmed)) {
      return true;
    }
    
    return false;
  }

  /**
   * HTML转义
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
