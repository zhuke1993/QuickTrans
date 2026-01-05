/**
 * 翻译页面脚本
 * 实现剪贴板读取、翻译服务和词典查询功能
 */

(function() {
  'use strict';

  // DOM元素
  const elements = {
    inputText: document.getElementById('input-text'),
    resultText: document.getElementById('result-text'),
    resultInfo: document.getElementById('result-info'),
    sourceLang: document.getElementById('source-lang'),
    targetLang: document.getElementById('target-lang'),
    translateBtn: document.getElementById('translate-btn'),
    pasteBtn: document.getElementById('paste-btn'),
    clearBtn: document.getElementById('clear-btn'),
    copyBtn: document.getElementById('copy-btn'),
    retryBtn: document.getElementById('retry-btn'),
    charCount: document.getElementById('char-count'),
    settingsBtn: document.getElementById('settings-btn'),
    dictionaryPopup: document.getElementById('dictionary-popup')
  };

  // 页面状态
  let userPreferences = null;
  let isTranslating = false;
  let currentPort = null;
  let currentDictionaryPopup = null;
  
  // 音频播放状态
  let currentAudio = null;  // 当前正在播放的音频实例
  let isSynthesizing = false;  // 是否正在合成语音
  let isPlaying = false;  // 是否正在播放
  let audioContext = null;  // Web Audio API 上下文
  let audioSource = null;  // 当前音频源节点

  /**
   * 初始化
   */
  async function init() {
    console.log('翻译页面初始化...');
    
    // 加载用户偏好设置
    await loadUserPreferences();
    
    // 加载语言选项
    loadLanguageOptions();
    
    // 检查URL参数中是否有文本（右键菜单传递）
    const urlParams = new URLSearchParams(window.location.search);
    const textFromUrl = urlParams.get('text');
    
    if (textFromUrl) {
      // 如果有URL参数，使用它
      elements.inputText.value = decodeURIComponent(textFromUrl);
      updateCharCount();
      console.log('已从 URL 参数读取文本');
    } else {
      // 否则尝试读取剪贴板
      await readClipboard();
    }
    
    // 绑定事件
    bindEvents();
    
    console.log('翻译页面初始化完成');
  }

  /**
   * 加载用户偏好设置
   */
  async function loadUserPreferences() {
    try {
      const result = await chrome.storage.sync.get('userPreferences');
      userPreferences = result.userPreferences || {
        lastTargetLanguage: 'zh',
        maxTextLength: 5000
      };
      
      // 设置默认目标语言
      if (elements.targetLang) {
        elements.targetLang.value = userPreferences.lastTargetLanguage;
      }
      
      console.log('用户偏好设置已加载:', userPreferences);
    } catch (error) {
      console.error('加载用户偏好设置失败:', error);
    }
  }

  /**
   * 加载语言选项
   */
  function loadLanguageOptions() {
    const languages = LanguageDetector.getAllLanguages();
    
    // 源语言选项（添加"自动检测"）
    elements.sourceLang.innerHTML = '<option value="auto">自动检测</option>' +
      languages.map(lang => `<option value="${lang.code}">${lang.name}</option>`).join('');
    
    // 目标语言选项
    elements.targetLang.innerHTML = languages.map(lang => 
      `<option value="${lang.code}">${lang.name}</option>`
    ).join('');
    
    // 设置默认目标语言
    if (userPreferences) {
      elements.targetLang.value = userPreferences.lastTargetLanguage;
    }
  }

  /**
   * 读取剪贴板内容
   */
  async function readClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      
      if (text && text.trim()) {
        // 验证文本长度
        const maxLength = userPreferences?.maxTextLength || 5000;
        if (text.length > maxLength) {
          console.warn(`剪贴板文本过长 (${text.length} > ${maxLength})`);
          showToast(`⚠️ 剪贴板文本过长（${text.length}字符，限制${maxLength}字符）`, 'warning');
        }
        
        elements.inputText.value = text;
        updateCharCount();
        console.log('已从剪贴板读取文本');
      }
    } catch (error) {
      console.log('无法读取剪贴板:', error.message);
      // 不显示错误提示，保持静默
    }
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    // 翻译按钮
    elements.translateBtn.addEventListener('click', handleTranslate);
    
    // 粘贴按钮
    elements.pasteBtn.addEventListener('click', handlePaste);
    
    // 清空按钮
    elements.clearBtn.addEventListener('click', handleClear);
    
    // 复制按钮
    elements.copyBtn.addEventListener('click', handleCopy);
    
    // 重试按钮
    elements.retryBtn.addEventListener('click', handleRetry);
    
    // 设置按钮
    elements.settingsBtn.addEventListener('click', handleSettings);
    
    // 输入框变化
    elements.inputText.addEventListener('input', updateCharCount);
    
    // 目标语言变化
    elements.targetLang.addEventListener('change', handleTargetLanguageChange);
    
    // 输入框划词事件（词典查询）
    elements.inputText.addEventListener('mouseup', handleTextSelection);
    
    // 快捷键支持
    elements.inputText.addEventListener('keydown', handleKeyDown);
    
    // 点击其他区域关闭词典弹窗
    document.addEventListener('mousedown', handleDocumentClick);
  }

  /**
   * 处理翻译
   */
  async function handleTranslate() {
    const text = elements.inputText.value.trim();
    
    if (!text) {
      showToast('⚠️ 请输入待翻译的文本', 'warning');
      return;
    }
    
    // 检测源语言
    const sourceLang = elements.sourceLang.value;
    const detectedLanguage = sourceLang === 'auto' 
      ? LanguageDetector.detect(text) 
      : sourceLang;
    
    const targetLang = elements.targetLang.value;
    
    // 如果源语言和目标语言相同
    if (detectedLanguage === targetLang) {
      showToast('ℹ️ 源语言和目标语言相同', 'info');
      elements.resultText.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
      elements.copyBtn.disabled = false;
      elements.retryBtn.disabled = false;
      return;
    }
    
    // 开始翻译
    isTranslating = true;
    elements.translateBtn.disabled = true;
    elements.translateBtn.classList.add('loading');
    elements.copyBtn.disabled = true;
    elements.retryBtn.disabled = true;
    
    // 显示加载状态
    elements.resultText.innerHTML = `
      <div class="result-loading">
        <div class="result-loading-spinner"></div>
        <div class="result-loading-text">正在翻译...</div>
      </div>
    `;
    
    try {
      // 建立流式连接
      currentPort = chrome.runtime.connect({ name: 'translation-stream' });
      
      let fullTranslation = '';
      let isStreamStarted = false;
      
      // 监听流式数据
      currentPort.onMessage.addListener((msg) => {
        if (msg.type === 'chunk') {
          // 第一次收到数据时，清除加载动画
          if (!isStreamStarted) {
            isStreamStarted = true;
            elements.resultText.innerHTML = '';
          }
          
          // 实时更新翻译结果
          fullTranslation = msg.fullText;
          elements.resultText.innerHTML = escapeHtml(fullTranslation).replace(/\n/g, '<br>');
          
        } else if (msg.type === 'complete') {
          const response = msg.result;
          
          if (response.success) {
            // 如果是缓存结果或源目标语言相同，直接显示
            if (response.cached || response.message) {
              elements.resultText.innerHTML = escapeHtml(response.translatedText).replace(/\n/g, '<br>');
            }
            
            // 显示缓存提示
            if (response.cached) {
              elements.resultText.innerHTML += '<div style="margin-top: 12px; font-size: 12px; color: #999; text-align: right;">(缓存结果)</div>';
            }
            
            // 更新底部信息栏显示模型信息和token消耗
            if (elements.resultInfo && response.model) {
              let infoHtml = `AI翻译助手<span style="margin: 0 8px; color: #ddd;">|</span><span style="color: #667eea;">${escapeHtml(response.model)}</span>`;
              
              // 添加token消耗信息
              if (response.usage) {
                infoHtml += `<span style="margin: 0 8px; color: #ddd;">|</span><span style="color: #48bb78; font-size: 12px;" title="输入Token/输出Token/总Token">${response.usage.prompt_tokens || 0}/${response.usage.completion_tokens || 0}/${response.usage.total_tokens || 0} tokens</span>`;
              }
              
              elements.resultInfo.innerHTML = infoHtml;
              elements.resultInfo.style.display = 'block';
            }
            
            // 启用按钮
            elements.copyBtn.disabled = false;
            elements.retryBtn.disabled = false;
            
            showToast('✓ 翻译完成', 'success');
            
          } else {
            // 显示错误
            showError(response.errorMessage, response.errorCode);
          }
          
          // 完成翻译
          isTranslating = false;
          elements.translateBtn.disabled = false;
          elements.translateBtn.classList.remove('loading');
          
          // 断开连接
          if (currentPort) {
            currentPort.disconnect();
            currentPort = null;
          }
        }
      });
      
      // 发送翻译请求
      currentPort.postMessage({
        action: 'translate-stream',
        text: text,
        sourceLanguage: detectedLanguage,
        targetLanguage: targetLang
      });
      
    } catch (error) {
      console.error('翻译失败:', error);
      showError('翻译失败，请稍后重试', 'UNKNOWN_ERROR');
      
      isTranslating = false;
      elements.translateBtn.disabled = false;
      elements.translateBtn.classList.remove('loading');
    }
  }

  /**
   * 处理粘贴按钮
   */
  async function handlePaste() {
    await readClipboard();
  }

  /**
   * 处理清空按钮
   */
  function handleClear() {
    elements.inputText.value = '';
    elements.resultText.innerHTML = '<div class="result-placeholder">翻译结果将在此显示</div>';
    elements.copyBtn.disabled = true;
    elements.retryBtn.disabled = true;
    // 隐藏信息栏
    if (elements.resultInfo) {
      elements.resultInfo.style.display = 'none';
      elements.resultInfo.innerHTML = 'AI翻译助手';
    }
    updateCharCount();
  }

  /**
   * 处理复制按钮
   */
  async function handleCopy() {
    const resultText = elements.resultText.textContent.trim();
    
    if (!resultText) return;
    
    try {
      await navigator.clipboard.writeText(resultText);
      
      // 显示复制成功
      const originalText = elements.copyBtn.innerHTML;
      elements.copyBtn.innerHTML = '✓ 已复制';
      elements.copyBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
      
      setTimeout(() => {
        elements.copyBtn.innerHTML = originalText;
        elements.copyBtn.style.background = '';
      }, 2000);
      
      showToast('✓ 已复制到剪贴板', 'success');
    } catch (error) {
      console.error('复制失败:', error);
      showToast('✗ 复制失败', 'error');
    }
  }

  /**
   * 处理重试按钮
   */
  function handleRetry() {
    handleTranslate();
  }

  /**
   * 处理设置按钮
   */
  function handleSettings() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * 更新字符计数
   */
  function updateCharCount() {
    const count = elements.inputText.value.length;
    elements.charCount.textContent = `${count} 字符`;
    
    // 如果超过限制，显示警告
    const maxLength = userPreferences?.maxTextLength || 5000;
    if (count > maxLength) {
      elements.charCount.style.color = '#e53e3e';
      elements.charCount.textContent = `${count} / ${maxLength} 字符 (超出限制)`;
    } else {
      elements.charCount.style.color = '';
    }
  }

  /**
   * 处理目标语言变更
   */
  async function handleTargetLanguageChange() {
    const targetLang = elements.targetLang.value;
    
    // 保存到用户偏好
    userPreferences.lastTargetLanguage = targetLang;
    await chrome.storage.sync.set({ userPreferences });
  }

  /**
   * 处理快捷键
   */
  function handleKeyDown(e) {
    // Ctrl/Cmd + Enter 翻译
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
  }

  /**
   * 处理输入框划词（词典查询）
   */
  function handleTextSelection(e) {
    // 延迟一点以确保选择完成
    setTimeout(() => {
      const selectedText = window.getSelection().toString().trim();
      
      // 检查是否为单个单词
      if (!selectedText || selectedText.length < 2 || selectedText.length > 50) {
        return;
      }
      
      if (!isSingleWord(selectedText)) {
        return;
      }
      
      // 获取上下文
      const inputValue = elements.inputText.value;
      const context = getWordContext(selectedText, inputValue);
      
      // 显示词典弹窗
      showDictionaryPopup(selectedText, context, e);
    }, 50);
  }

  /**
   * 判断是否为单个单词
   */
  function isSingleWord(text) {
    return DictionaryUtils.isSingleWord(text);
  }

  /**
   * 获取单词上下文
   */
  function getWordContext(word, fullText) {
    if (!fullText) return '';
    
    // 查找单词在文本中的位置
    const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
    const match = fullText.match(wordRegex);
    
    if (!match) return '';
    
    const wordIndex = match.index;
    
    // 提取包含该单词的句子
    const beforeText = fullText.substring(0, wordIndex);
    const afterText = fullText.substring(wordIndex + word.length);
    
    // 查找句子边界
    const sentenceStart = Math.max(
      beforeText.lastIndexOf('.'),
      beforeText.lastIndexOf('!'),
      beforeText.lastIndexOf('?'),
      beforeText.lastIndexOf('\n'),
      0
    );
    
    const sentenceEnd = Math.min(
      afterText.indexOf('.') !== -1 ? afterText.indexOf('.') + 1 : afterText.length,
      afterText.indexOf('!') !== -1 ? afterText.indexOf('!') + 1 : afterText.length,
      afterText.indexOf('?') !== -1 ? afterText.indexOf('?') + 1 : afterText.length,
      afterText.indexOf('\n') !== -1 ? afterText.indexOf('\n') : afterText.length
    );
    
    const sentence = (
      fullText.substring(sentenceStart, wordIndex) +
      word +
      afterText.substring(0, sentenceEnd)
    ).trim();
    
    return sentence.length > 200 ? '' : sentence;
  }

  /**
   * 显示词典弹窗
   */
  async function showDictionaryPopup(word, context, mouseEvent) {
    // 关闭已存在的弹窗
    closeDictionaryPopup();
    
    // 创建弹窗
    const popup = document.createElement('div');
    popup.className = 'dictionary-popup';
    popup.innerHTML = `
      <div class="dict-header">
        <div class="dict-title">📖 词典</div>
        <button class="dict-close">×</button>
      </div>
      <div class="dict-content">
        <div class="dict-word">
          <div class="dict-word-row">
            <div class="dict-word-info">
              <span class="dict-word-text">${escapeHtml(word)}</span>
              <span class="dict-phonetic" id="dict-phonetic"></span>
            </div>
            <button class="dict-tts-btn" id="dict-word-tts" title="播放单词发音">
              <svg class="dict-tts-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
              </svg>
            </button>
          </div>
        </div>
        ${context ? `
          <div class="dict-context">
            <div class="dict-context-header">
              <div class="dict-context-label">📝 上下文</div>
              <button class="dict-tts-btn dict-tts-btn-small" id="dict-sentence-tts" title="播放句子发音">
                <svg class="dict-tts-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                </svg>
              </button>
            </div>
            <div class="dict-context-text">${escapeHtml(context).replace(
              new RegExp(`(${escapeHtml(word)})`, 'gi'),
              '<mark class="dict-highlight">$1</mark>'
            )}</div>
            <div class="dict-context-trans" id="dict-context-trans"></div>
          </div>
        ` : ''}
        <div class="dict-result" id="dict-result">
          <div class="dict-loading">
            <div class="dict-loading-spinner"></div>
            <div>正在查询...</div>
          </div>
        </div>
      </div>
      <div class="dict-footer">
        <button class="dict-copy-btn" id="dict-copy-btn" disabled>复制释义</button>
      </div>
    `;
    
    elements.dictionaryPopup.appendChild(popup);
    elements.dictionaryPopup.style.display = 'block';
    currentDictionaryPopup = popup;
    
    // 定位弹窗
    positionDictionaryPopup(popup, mouseEvent);
    
    // 绑定关闭按钮
    popup.querySelector('.dict-close').addEventListener('click', closeDictionaryPopup);
    
    // 绑定复制按钮
    popup.querySelector('#dict-copy-btn').addEventListener('click', handleDictCopy);
    
    // 绑定TTS按钮
    const wordTtsBtn = popup.querySelector('#dict-word-tts');
    if (wordTtsBtn) {
      wordTtsBtn.addEventListener('click', () => handleTTS(word, 'word'));
    }
    
    const sentenceTtsBtn = popup.querySelector('#dict-sentence-tts');
    if (sentenceTtsBtn) {
      sentenceTtsBtn.addEventListener('click', () => handleTTS(context, 'sentence'));
    }
    
    // 执行词典查询
    performDictionaryLookup(word, context, popup);
  }

  /**
   * 定位词典弹窗
   */
  function positionDictionaryPopup(popup, mouseEvent) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupWidth = 450;
    const popupHeight = 500;
    const margin = 20;
    
    let x = mouseEvent.pageX + 10;
    let y = mouseEvent.pageY + 10;
    
    // 调整水平位置
    if (x + popupWidth > viewportWidth - margin) {
      x = viewportWidth - popupWidth - margin;
    }
    if (x < margin) {
      x = margin;
    }
    
    // 调整垂直位置
    if (y + popupHeight > viewportHeight + window.scrollY - margin) {
      y = mouseEvent.pageY - popupHeight - 10;
    }
    if (y < window.scrollY + margin) {
      y = window.scrollY + margin;
    }
    
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
  }

  /**
   * 执行词典查询
   */
  async function performDictionaryLookup(word, context, popup) {
    const resultDiv = popup.querySelector('#dict-result');
    const phoneticSpan = popup.querySelector('#dict-phonetic');
    const copyBtn = popup.querySelector('#dict-copy-btn');
    const contextTransDiv = popup.querySelector('#dict-context-trans');
    
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
          resultDiv.innerHTML = DictionaryUtils.formatDictionaryResult(fullResult);
          
          // 提取音标
          DictionaryUtils.extractAndShowPhonetic(fullResult, phoneticSpan);
          
        } else if (msg.type === 'complete') {
          const response = msg.result;
          
          if (response.success) {
            // 如果是缓存结果，直接显示
            if (response.cached) {
              resultDiv.innerHTML = DictionaryUtils.formatDictionaryResult(response.definition);
              DictionaryUtils.extractAndShowPhonetic(response.definition, phoneticSpan);
            }
            
            // 显示上下文翻译
            if (contextTransDiv && response.contextTranslation) {
              contextTransDiv.innerHTML = `<span style="color: #667eea; font-weight: 500;">译文：</span>${DictionaryUtils.escapeHtml(response.contextTranslation)}`;
              contextTransDiv.style.display = 'block';
            }
            
            // 启用复制按钮
            copyBtn.disabled = false;
            copyBtn.dataset.definition = response.definition || fullResult;
            
          } else {
            // 显示错误
            resultDiv.innerHTML = `<div style="color: #e53e3e; padding: 20px;">${DictionaryUtils.escapeHtml(response.errorMessage)}</div>`;
          }
          
          // 断开连接
          port.disconnect();
        }
      });
      
      // 发送词典查询请求
      port.postMessage({
        action: 'dictionary-lookup',
        word: word,
        context: context
      });
      
    } catch (error) {
      console.error('词典查询失败:', error);
      resultDiv.innerHTML = `<div style="color: #e53e3e; padding: 20px;">查询失败，请稍后重试</div>`;
    }
  }

  /**
   * 格式化词典结果
   */
  function formatDictionaryResult(text) {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    // 处理Markdown格式
    html = html.replace(/^### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^## (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }

  /**
   * 提取并显示音标
   */
  function extractAndShowPhonetic(text, phoneticSpan) {
    if (!phoneticSpan || !text) return;
    
    const phoneticPatterns = [
      /\/([ɐ-˿\w\s]+)\//,
      /\[([ɐ-˿\w\s]+)\]/,
      /UK:\s*\/([ɐ-˿\w\s]+)\/\s*US:\s*\/([ɐ-˿\w\s]+)\//
    ];
    
    for (const pattern of phoneticPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (match[2]) {
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
   * 关闭词典弹窗
   */
  function closeDictionaryPopup() {
    // 停止正在播放的音频
    stopAudio();
    
    if (currentDictionaryPopup) {
      currentDictionaryPopup.remove();
      currentDictionaryPopup = null;
    }
    elements.dictionaryPopup.style.display = 'none';
  }

  /**
   * 处理文档点击（关闭词典弹窗）
   */
  function handleDocumentClick(e) {
    if (currentDictionaryPopup && !currentDictionaryPopup.contains(e.target)) {
      closeDictionaryPopup();
    }
  }

  /**
   * 处理词典复制
   */
  async function handleDictCopy(e) {
    const btn = e.target;
    const definition = btn.dataset.definition;
    
    if (!definition) return;
    
    try {
      await navigator.clipboard.writeText(definition);
      
      const originalText = btn.innerHTML;
      btn.innerHTML = '✓ 已复制';
      btn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 2000);
      
    } catch (error) {
      console.error('复制失败:', error);
    }
  }

  /**
   * 显示错误信息
   */
  function showError(message, errorCode) {
    let actionButtons = '';
    
    if (errorCode === 'NO_API_CONFIG') {
      actionButtons = `
        <div class="result-error-actions">
          <button class="error-btn" onclick="chrome.runtime.openOptionsPage()">前往设置</button>
        </div>
      `;
    } else if (errorCode === 'RATE_LIMIT' || errorCode === 'API_ERROR') {
      actionButtons = `
        <div class="result-error-actions">
          <button class="error-btn" id="error-retry-btn">重试</button>
          <button class="error-btn" onclick="chrome.runtime.openOptionsPage()">切换API</button>
        </div>
      `;
    }
    
    elements.resultText.innerHTML = `
      <div class="result-error">
        <div class="result-error-title">✗ 翻译失败</div>
        <div>${escapeHtml(message)}</div>
        ${actionButtons}
      </div>
    `;
    
    // 绑定重试按钮
    const retryBtn = elements.resultText.querySelector('#error-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', handleTranslate);
    }
  }

  /**
   * 显示提示消息
   */
  function showToast(message, type = 'info') {
    // 简单的提示实现（可以后续优化为更美观的Toast组件）
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  /**
   * 处理TTS请求（文本转语音）
   * @param {string} text - 待合成的文本
   * @param {string} type - 类型：'word' 或 'sentence'
   */
  async function handleTTS(text, type) {
    if (!text || isSynthesizing) return;
    
    // 获取对应的按钮
    const btnId = type === 'word' ? 'dict-word-tts' : 'dict-sentence-tts';
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
        // 使用 Web Audio API 绕过 CSP 限制
        try {
          // 初始化 AudioContext
          if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
          }
          
          // 如果有正在播放的音频，停止它
          if (audioSource) {
            try {
              audioSource.stop();
            } catch (e) {
              // 忽略停止错误
            }
            audioSource = null;
          }
          
          if (response.audioUrl) {
            // 如果是 URL，使用 fetch 获取
            const audioResponse = await fetch(response.audioUrl);
            const arrayBuffer = await audioResponse.arrayBuffer();
            playAudioBuffer(arrayBuffer, btn);
          } else if (response.audioData) {
            // 如果是 Base64 数据
            console.log('TTS返回音频数据，Base64长度:', response.audioData.length);
            
            // 检测音频格式
            const detectedFormat = DictionaryUtils.detectAudioFormat(response.audioData);
            console.log('检测到的音频格式:', detectedFormat);
            
            // 将 Base64 转为 ArrayBuffer
            const binaryString = atob(response.audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            console.log('音频数据大小:', bytes.length, 'bytes');
            
            // 如果是 PCM 原始数据，需要先转换为 WAV
            if (!detectedFormat || detectedFormat === 'pcm') {
              console.log('检测为 PCM 数据，将转换为 WAV 格式');
              const wavBuffer = DictionaryUtils.convertPCMToWAV(bytes.buffer);
              playAudioBuffer(wavBuffer, btn);
            } else {
              playAudioBuffer(bytes.buffer, btn);
            }
          } else {
            console.error('TTS响应中没有音频数据');
            isSynthesizing = false;
            showTTSError(btn, '无音频数据');
            return;
          }
        } catch (error) {
          console.error('Web Audio API 错误:', error);
          isSynthesizing = false;
          showTTSError(btn, '播放失败');
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
    
    const icon = btn.querySelector('.dict-tts-icon');
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
    
    const icon = btn.querySelector('.dict-tts-icon');
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
   * 使用 Web Audio API 播放音频缓冲区
   * @param {ArrayBuffer} arrayBuffer - 音频数据
   * @param {HTMLElement} btn - TTS按钮
   */
  async function playAudioBuffer(arrayBuffer, btn) {
    try {
      console.log('开始解码音频数据...');
      
      // 解码音频数据
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('音频解码成功，时长:', audioBuffer.duration, '秒');
      
      // 创建音频源节点
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(audioContext.destination);
      
      // 监听播放结束
      audioSource.onended = () => {
        console.log('音频播放结束');
        isPlaying = false;
        isSynthesizing = false;
        updateTTSButtonState(btn, 'default');
        audioSource = null;
      };
      
      // 开始播放
      audioSource.start(0);
      isPlaying = true;
      isSynthesizing = false;
      updateTTSButtonState(btn, 'playing');
      console.log('开始播放音频');
      
    } catch (error) {
      console.error('音频解码或播放错误:', error);
      isSynthesizing = false;
      isPlaying = false;
      showTTSError(btn, '音频格式错误');
    }
  }
  
  /**
   * 停止音频播放
   */
  function stopAudio() {
    // 停止 Web Audio API 播放
    if (audioSource) {
      try {
        audioSource.stop();
      } catch (e) {
        // 忽略错误
      }
      audioSource = null;
    }
    
    // 也处理传统的 Audio 元素（如果有）
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    
    isPlaying = false;
  }
  
  /**
   * 检测音频数据的实际格式
   */
  function detectAudioFormat(base64Data) {
    return DictionaryUtils.detectAudioFormat(base64Data);
  }
  
  /**
   * 将 PCM ArrayBuffer 转换为 WAV 格式
   */
  function convertPCMToWAV(pcmBuffer) {
    return DictionaryUtils.convertPCMToWAV(pcmBuffer);
  }
  
  /**
   * HTML转义
   */
  function escapeHtml(text) {
    return DictionaryUtils.escapeHtml(text);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
