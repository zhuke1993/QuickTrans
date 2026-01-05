/**
 * Popup页面脚本
 * 处理popup菜单的交互
 */

(function() {
  'use strict';

  // 初始化
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // 绑定按钮事件
    document.getElementById('open-translator').addEventListener('click', openTranslator);
    document.getElementById('open-options').addEventListener('click', openOptions);
  }

  /**
   * 打开翻译页面
   */
  function openTranslator() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('translator.html')
    });
    window.close();
  }

  /**
   * 打开设置页面
   */
  function openOptions() {
    chrome.runtime.openOptionsPage();
    window.close();
  }
})();
