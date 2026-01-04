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
  let debounceTimer = null;
  let userPreferences = null;

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

    // 构建弹窗HTML
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

    const targetSelect = popup.querySelector('#ai-translate-target-lang');
    targetSelect.addEventListener('change', handleTargetLanguageChange);

    const copyBtn = popup.querySelector('#ai-translate-copy');
    copyBtn.addEventListener('click', handleCopyTranslation);

    // 开始翻译
    performTranslation(detectedLanguage, userPreferences.lastTargetLanguage);
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
  }

  /**
   * 执行翻译
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
      // 调用后台脚本进行翻译
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: currentSelectedText,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      });

      if (response.success) {
        // 显示翻译结果
        resultDiv.innerHTML = escapeHtml(response.translatedText).replace(/\n/g, '<br>');
        copyBtn.disabled = false;
        copyBtn.dataset.translation = response.translatedText;

        // 更新底部信息栏显示模型信息
        const infoDiv = document.querySelector('.ai-translate-popup-info');
        if (infoDiv && response.model) {
          infoDiv.innerHTML = `AI翻译助手<span style="margin: 0 4px; color: #ddd;">|</span><span style="color: #667eea;">${escapeHtml(response.model)}</span>`;
        }

        // 显示缓存提示
        if (response.cached) {
          resultDiv.innerHTML += '<div style="margin-top: 8px; font-size: 11px; color: #999;">(缓存结果)</div>';
        }

        // 翻译完成后重新调整弹窗位置，因为内容高度可能发生变化
        if (currentPopup && currentIcon) {
          // 获取图标位置作为参考点
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
   * 关闭弹窗
   */
  function closePopup() {
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
