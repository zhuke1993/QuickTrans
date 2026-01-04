/**
 * 语言识别模块
 * 通过字符Unicode范围进行本地快速识别
 */

const LanguageDetector = {
  /**
   * 支持的语言列表
   */
  languages: {
    zh: { code: 'zh', name: '中文', nativeName: '中文' },
    en: { code: 'en', name: '英语', nativeName: 'English' },
    ja: { code: 'ja', name: '日语', nativeName: '日本語' },
    ko: { code: 'ko', name: '韩语', nativeName: '한국어' },
    fr: { code: 'fr', name: '法语', nativeName: 'Français' },
    de: { code: 'de', name: '德语', nativeName: 'Deutsch' },
    es: { code: 'es', name: '西班牙语', nativeName: 'Español' },
    ru: { code: 'ru', name: '俄语', nativeName: 'Русский' },
    ar: { code: 'ar', name: '阿拉伯语', nativeName: 'العربية' },
    pt: { code: 'pt', name: '葡萄牙语', nativeName: 'Português' },
    it: { code: 'it', name: '意大利语', nativeName: 'Italiano' },
    th: { code: 'th', name: '泰语', nativeName: 'ไทย' },
    vi: { code: 'vi', name: '越南语', nativeName: 'Tiếng Việt' }
  },

  /**
   * 检测文本的语言
   * @param {string} text - 待检测的文本
   * @returns {string} 语言代码
   */
  detect(text) {
    if (!text || text.trim().length === 0) {
      return 'en';
    }

    // 去除空白字符和标点，只分析实际文字
    const cleanText = text.trim();
    const chars = cleanText.split('');
    
    // 统计各种字符类型的数量
    const stats = {
      chinese: 0,      // 中文字符
      japanese: 0,     // 日文假名
      korean: 0,       // 韩文字符
      cyrillic: 0,     // 西里尔字母（俄语等）
      arabic: 0,       // 阿拉伯字符
      thai: 0,         // 泰语字符
      latin: 0,        // 拉丁字母
      other: 0         // 其他字符
    };

    chars.forEach(char => {
      const code = char.charCodeAt(0);
      
      // 中文字符（CJK统一汉字）
      if ((code >= 0x4E00 && code <= 0x9FFF) ||
          (code >= 0x3400 && code <= 0x4DBF) ||
          (code >= 0x20000 && code <= 0x2A6DF)) {
        stats.chinese++;
      }
      // 日文假名（平假名和片假名）
      else if ((code >= 0x3040 && code <= 0x309F) ||
               (code >= 0x30A0 && code <= 0x30FF)) {
        stats.japanese++;
      }
      // 韩文字符
      else if ((code >= 0xAC00 && code <= 0xD7AF) ||
               (code >= 0x1100 && code <= 0x11FF) ||
               (code >= 0x3130 && code <= 0x318F)) {
        stats.korean++;
      }
      // 西里尔字母（俄语等）
      else if (code >= 0x0400 && code <= 0x04FF) {
        stats.cyrillic++;
      }
      // 阿拉伯字符
      else if ((code >= 0x0600 && code <= 0x06FF) ||
               (code >= 0x0750 && code <= 0x077F)) {
        stats.arabic++;
      }
      // 泰语字符
      else if (code >= 0x0E00 && code <= 0x0E7F) {
        stats.thai++;
      }
      // 拉丁字母（英文、法文、德文、西班牙文等）
      else if ((code >= 0x0041 && code <= 0x005A) ||
               (code >= 0x0061 && code <= 0x007A) ||
               (code >= 0x00C0 && code <= 0x00FF)) {
        stats.latin++;
      }
      else if (!/\s/.test(char) && !/[^\w\s]/.test(char)) {
        stats.other++;
      }
    });

    // 根据统计结果判断语言
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    if (total === 0) return 'en';

    // 如果中文字符占比超过30%，判断为中文
    if (stats.chinese / total > 0.3) {
      // 如果同时有日文假名，可能是日文（日文也使用汉字）
      if (stats.japanese / total > 0.1) {
        return 'ja';
      }
      return 'zh';
    }

    // 日文判断
    if (stats.japanese / total > 0.2) {
      return 'ja';
    }

    // 韩文判断
    if (stats.korean / total > 0.3) {
      return 'ko';
    }

    // 俄语判断
    if (stats.cyrillic / total > 0.3) {
      return 'ru';
    }

    // 阿拉伯语判断
    if (stats.arabic / total > 0.3) {
      return 'ar';
    }

    // 泰语判断
    if (stats.thai / total > 0.3) {
      return 'th';
    }

    // 拉丁字母语言需要进一步判断
    if (stats.latin > 0) {
      return this.detectLatinLanguage(cleanText);
    }

    // 默认返回英语
    return 'en';
  },

  /**
   * 检测拉丁字母语言（英语、法语、德语、西班牙语等）
   * 使用简单的特征词判断
   * @param {string} text - 待检测的文本
   * @returns {string} 语言代码
   */
  detectLatinLanguage(text) {
    const lowerText = text.toLowerCase();

    // 英语特征词（优先检测）
    const englishPatterns = [
      ' the ', ' is ', ' are ', ' and ', ' or ', ' to ', ' of ', ' in ', ' for ', ' with ',
      ' that ', ' this ', ' have ', ' has ', ' from ', ' you ', ' your ', ' can ', ' will '
    ];
    const englishScore = englishPatterns.filter(p => lowerText.includes(p)).length;

    // 法语特征词（更具区分性）
    const frenchPatterns = [
      ' le ', ' la ', ' les ', ' des ', ' une ', ' est ', ' sont ', ' dans ', ' avec ', ' cette ',
      ' mais ', ' nous ', ' vous ', ' leur ', ' été '
    ];
    const frenchScore = frenchPatterns.filter(p => lowerText.includes(p)).length;

    // 德语特征词（更具区分性）
    const germanPatterns = [
      ' der ', ' die ', ' das ', ' den ', ' dem ', ' und ', ' ist ', ' sind ', ' mit ', ' für ',
      ' nicht ', ' auch ', ' aber ', ' werden ', ' wurde '
    ];
    const germanScore = germanPatterns.filter(p => lowerText.includes(p)).length;

    // 西班牙语特征词（更具区分性）
    const spanishPatterns = [
      ' el ', ' los ', ' las ', ' del ', ' una ', ' está ', ' son ', ' con ', ' por ', ' para ',
      ' que ', ' pero ', ' también ', ' sido ', ' hacer '
    ];
    const spanishScore = spanishPatterns.filter(p => lowerText.includes(p)).length;

    // 葡萄牙语特征词（更具区分性，避免与英语混淆）
    const portuguesePatterns = [
      ' os ', ' das ', ' uma ', ' está ', ' são ', ' com ', ' para ', ' mais ', ' pelo ',
      ' não ', ' também ', ' seu ', ' seus ', ' sua '
    ];
    const portugueseScore = portuguesePatterns.filter(p => lowerText.includes(p)).length;

    // 意大利语特征词（更具区分性）
    const italianPatterns = [
      ' il ', ' lo ', ' gli ', ' della ', ' delle ', ' con ', ' per ', ' che ', ' sono ',
      ' anche ', ' suo ', ' sua ', ' stati ', ' essere '
    ];
    const italianScore = italianPatterns.filter(p => lowerText.includes(p)).length;

    // 计算所有语言得分
    const scores = {
      en: englishScore,
      fr: frenchScore,
      de: germanScore,
      es: spanishScore,
      pt: portugueseScore,
      it: italianScore
    };

    // 找出得分最高的语言
    let maxScore = 0;
    let detectedLang = 'en';

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    // 英语特殊处理：如果英语得分足够高（>= 3），优先返回英语
    if (englishScore >= 3 && englishScore >= maxScore * 0.7) {
      return 'en';
    }

    // 如果非英语得分太低（< 4），默认为英语
    // 提高阈值以减少误判
    if (detectedLang !== 'en' && maxScore < 4) {
      return 'en';
    }

    return detectedLang;
  },

  /**
   * 获取语言名称
   * @param {string} code - 语言代码
   * @param {boolean} useNative - 是否使用原生语言名称
   * @returns {string} 语言名称
   */
  getLanguageName(code, useNative = false) {
    const lang = this.languages[code];
    if (!lang) return code;
    return useNative ? lang.nativeName : lang.name;
  },

  /**
   * 获取所有支持的语言列表
   * @returns {Array} 语言列表
   */
  getAllLanguages() {
    return Object.values(this.languages);
  },

  /**
   * 检查是否支持某种语言
   * @param {string} code - 语言代码
   * @returns {boolean} 是否支持
   */
  isSupported(code) {
    return code in this.languages;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LanguageDetector;
}
