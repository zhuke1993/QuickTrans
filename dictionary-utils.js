/**
 * 词典和TTS相关的共享工具函数
 * 用于 translator.js 和 content.js 之间的代码复用
 */

const DictionaryUtils = {
  /**
   * 格式化词典结果为HTML（支持Markdown渲染）
   * @param {string} text - 原始文本
   * @returns {string} 格式化后的HTML
   */
  formatDictionaryResult(text) {
    if (!text) return '';
    
    // 先转义HTML特殊字符
    let html = this.escapeHtml(text);
    
    // 处理Markdown格式
    // 1. 处理标题 ## -> h4, ### -> h5
    html = html.replace(/^### (.+)$/gm, '<h5 class="dict-h5">$1</h5>');
    html = html.replace(/^## (.+)$/gm, '<h4 class="dict-h4">$1</h4>');
    
    // 2. 处理加粗 **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // 3. 处理斜体 *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // 4. 处理行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code class="dict-code">$1</code>');
    
    // 5. 处理换行
    html = html.replace(/\n/g, '<br>');
    
    // 6. 突出显示词性标记（如 n. v. adj. 等）
    html = html.replace(/\b(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|vt\.|vi\.|aux\.)/g, '<span class="dict-pos">$1</span>');
    
    // 7. 突出显示序号（如 1. 2. 3. 或 ① ② ③）
    html = html.replace(/(^|<br>)(\d+\.\s*)/g, '$1<span class="dict-num">$2</span>');
    html = html.replace(/([\u2460-\u2473])/g, '<span class="dict-num">$1</span>');
    
    // 8. 处理无序列表项 - item
    html = html.replace(/(^|<br>)- /g, '$1<span class="dict-bullet">•</span> ');
    
    return html;
  },

  /**
   * 提取并显示音标
   * @param {string} text - 包含音标的文本
   * @param {HTMLElement} phoneticSpan - 用于显示音标的元素
   */
  extractAndShowPhonetic(text, phoneticSpan) {
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
  },

  /**
   * 检测音频数据的实际格式
   * @param {string} base64Data - Base64编码的音频数据
   * @returns {string|null} 检测到的格式，或null
   */
  detectAudioFormat(base64Data) {
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
      console.log('未检测到知名音频格式，可能是PCM数据');
      return 'pcm';
    } catch (error) {
      console.error('检测音频格式失败:', error);
      return null;
    }
  },

  /**
   * 将 PCM ArrayBuffer 转换为 WAV 格式
   * @param {ArrayBuffer} pcmBuffer - PCM 音频数据
   * @returns {ArrayBuffer} WAV 格式的音频数据
   */
  convertPCMToWAV(pcmBuffer) {
    const pcmData = new Uint8Array(pcmBuffer);
    
    // WAV 文件参数（默认，可能需要根据实际 API 返回调整）
    const numChannels = 1; // 单声道
    const sampleRate = 24000; // 采样率
    const bitsPerSample = 16; // 每个采样的位数
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;
    
    // 创建 WAV 文件头
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    this.writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // 合并 header 和 PCM 数据
    const wavData = new Uint8Array(44 + dataSize);
    wavData.set(new Uint8Array(wavHeader), 0);
    wavData.set(pcmData, 44);
    
    console.log('PCM 转换为 WAV 成功，文件大小:', wavData.length);
    return wavData.buffer;
  },

  /**
   * 向DataView写入字符串
   * @param {DataView} view - DataView对象
   * @param {number} offset - 偏移量
   * @param {string} string - 要写入的字符串
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  },

  /**
   * HTML转义
   * @param {string} text - 需要转义的文本
   * @returns {string} 转义后的HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 判断是否为单个单词
   * 支持英文单词（包含连字符的复合词）
   * @param {string} text - 待检测的文本
   * @returns {boolean} 是否为单个单词
   */
  isSingleWord(text) {
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
};

// 兼容不同的模块系统
if (typeof module !== 'undefined' && module.exports) {
  // Node.js / CommonJS
  module.exports = DictionaryUtils;
} else if (typeof window !== 'undefined') {
  // Browser
  window.DictionaryUtils = DictionaryUtils;
}
