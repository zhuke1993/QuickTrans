# QuickTrans（快译） - Chrome扩展插件

<div align="center">

![QuickTrans](icons/icon128.png)

**基于大语言模型的快速划词翻译Chrome插件**

支持多语言自动识别 | 支持多API配置 | 支持OpenAI协议

</div>

---

## 📖 功能特性

### 核心功能

- ✅ **划词翻译**：在任意网页上选中文本，即可快速翻译
- 🌍 **智能语言识别**：自动检测源语言类型，支持中、英、日、韩、法、德、西等13种语言
- 🔄 **灵活切换目标语言**：在翻译弹窗中实时切换目标语言
- 🔧 **多API配置管理**：支持添加和切换多个API配置
- 🤖 **OpenAI协议兼容**：支持所有兼容OpenAI Chat Completions API的服务

### 用户体验

- ⚡ **快速响应**：本地语言识别，毫秒级显示翻译图标
- 🌊 **流式输出**（默认启用）：翻译结果逐字显示，首字响应更快，体验如打字机般流畅
- 💾 **智能缓存**：相同内容自动使用缓存，节省API调用
- 🎨 **精美界面**：现代化设计，渐变色主题，动画流畅
- 📋 **一键复制**：快速复制翻译结果到剪贴板
- 🔒 **隐私保护**：所有数据仅存储在本地浏览器

---

## 🚀 快速开始

### 安装步骤

1. **下载插件源码**
   ```bash
   git clone <repository-url>
   cd trans-by-llm
   ```

2. **生成图标文件（可选）**
   
   方法一：使用Python脚本
   ```bash
   python3 icons/create_icons.py
   ```
   
   方法二：打开 `icons/icon-generator.html` 在浏览器中生成

3. **加载到Chrome浏览器**
   - 打开Chrome浏览器，访问 `chrome://extensions/`
   - 开启右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择本项目的根目录

4. **配置API**
   - 点击插件图标，或右键选择"选项"
   - 在设置页面点击"添加新配置"
   - 填写API配置信息：
     - **配置名称**：如 "OpenAI GPT-3.5"
     - **API端点**：如 `https://api.openai.com/v1/chat/completions`
     - **API密钥**：你的API Key
   - 点击"测试连接"验证配置
   - 点击"保存配置"

5. **开始使用**
   - 在任意网页上选中文本
   - 等待翻译图标出现（或自动弹出翻译窗口）
   - 查看翻译结果，可切换目标语言或复制结果

---

## 💡 使用说明

### 划词翻译

1. 在网页上用鼠标选中需要翻译的文本
2. 等待0.5秒，会自动显示翻译弹窗（如果开启了自动显示）
3. 或点击出现的紫色翻译图标

### 切换目标语言

在翻译弹窗的顶部，点击目标语言下拉框，选择新的目标语言，将自动重新翻译。

### 复制翻译结果

点击翻译弹窗底部的"复制译文"按钮，翻译结果将复制到剪贴板。

### 关闭翻译弹窗

- 按 `ESC` 键
- 点击弹窗右上角的 `×` 按钮
- 点击弹窗外的任意区域

### 管理API配置

1. 右键点击插件图标，选择"选项"
2. 在设置页面可以：
   - 添加新的API配置
   - 编辑现有配置
   - 切换激活的配置
   - 删除不需要的配置
   - 测试API连接

### 偏好设置

在设置页面的"偏好设置"部分，可以配置：

- **默认目标语言**：划词时默认翻译到哪种语言
- **自动显示翻译弹窗**：选中文本后是否自动显示翻译结果

---

## 🔧 技术架构

### 项目结构

```
trans-by-llm/
├── manifest.json           # Chrome扩展配置文件
├── background.js          # 后台服务脚本
├── content.js             # 内容脚本（划词监听）
├── content.css            # 内容脚本样式
├── storage-utils.js       # 数据存储工具
├── language-detector.js   # 语言识别模块
├── options.html           # 设置页面HTML
├── options.css            # 设置页面样式
├── options.js             # 设置页面逻辑
└── icons/                 # 图标资源
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 核心模块

#### 1. 语言识别模块（language-detector.js）

- 基于Unicode字符范围的本地快速识别
- 支持中文、日文、韩文、俄文、阿拉伯文、泰文等
- 对拉丁语系通过特征词进一步判断（英、法、德、西、葡、意）

#### 2. 数据存储模块（storage-utils.js）

- 使用Chrome Storage API进行数据持久化
- `storage.local`：存储API配置和翻译缓存
- `storage.sync`：存储用户偏好设置，跨设备同步

#### 3. 后台服务模块（background.js）

- 处理翻译请求
- 调用LLM API
- 管理API配置
- 实现翻译缓存机制

#### 4. 内容脚本模块（content.js）

- 监听用户文本选择事件
- 显示翻译图标和弹窗
- 与后台服务通信
- 管理UI交互

---

## 🌐 支持的语言

| 语言 | 代码 | 检测方式 |
|------|------|----------|
| 中文 | zh | Unicode范围 |
| 英语 | en | 拉丁字母+特征词 |
| 日语 | ja | 假名+汉字 |
| 韩语 | ko | Unicode范围 |
| 法语 | fr | 特征词匹配 |
| 德语 | de | 特征词匹配 |
| 西班牙语 | es | 特征词匹配 |
| 俄语 | ru | 西里尔字母 |
| 阿拉伯语 | ar | Unicode范围 |
| 葡萄牙语 | pt | 特征词匹配 |
| 意大利语 | it | 特征词匹配 |
| 泰语 | th | Unicode范围 |
| 越南语 | vi | 拉丁字母扩展 |

---

## 🔌 API配置说明

### 支持的API服务

本插件支持所有兼容OpenAI Chat Completions API协议的服务，包括但不限于：

- **OpenAI官方API**
  - 端点：`https://api.openai.com/v1/chat/completions`
  - 需要OpenAI API Key

- **Azure OpenAI**
  - 端点：`https://<your-resource>.openai.azure.com/openai/deployments/<deployment-id>/chat/completions?api-version=2023-05-15`
  - 需要Azure API Key

- **其他兼容服务**
  - 国内API代理服务
  - 自建OpenAI兼容API服务

### API请求格式

插件发送的请求格式：

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "你是一个专业的翻译助手..."
    },
    {
      "role": "user",
      "content": "请将以下英语文本翻译成中文：..."
    }
  ],
  "temperature": 0.3,
  "max_tokens": 2000
}
```

---

## ⚙️ 配置选项

### manifest.json权限说明

- `storage`：用于保存API配置和用户偏好
- `activeTab`：访问当前活动标签页（仅在用户触发时）
- `host_permissions`：允许向API端点发送请求

### 性能优化

- **防抖机制**：200ms防抖，避免频繁触发
- **翻译缓存**：相同文本+目标语言的结果会被缓存
- **请求超时**：30秒超时保护
- **轻量级注入**：内容脚本最小化对网页性能的影响

---

## 🛠️ 开发指南

### 调试方法

1. **查看后台服务日志**
   - 访问 `chrome://extensions/`
   - 找到"QuickTrans"，点击"Service Worker"
   - 在控制台查看日志

2. **查看内容脚本日志**
   - 在网页上按 `F12` 打开开发者工具
   - 在控制台查看日志

3. **查看存储数据**
   - 在开发者工具中，进入"Application" -> "Storage"
   - 查看 `chrome.storage.local` 和 `chrome.storage.sync`

### 修改默认模型

编辑 `background.js` 文件，找到 `callLLMAPI` 函数，修改 `model` 参数：

```javascript
body: JSON.stringify({
  model: 'gpt-4', // 改为你想使用的模型
  messages: [...],
  temperature: 0.3,
  max_tokens: 2000
})
```

### 自定义样式

编辑 `content.css` 文件，可以修改翻译弹窗和图标的样式。

---

## 🐛 常见问题

### Q: 翻译失败，提示"未配置API"

A: 请先在设置页面添加至少一个API配置，并确保该配置已激活。

### Q: 提示"API密钥无效"

A: 请检查：
1. API密钥是否正确
2. API端点地址是否正确
3. API账户是否有余额
4. 网络连接是否正常

### Q: 翻译速度很慢

A: 翻译速度取决于：
1. 使用的API服务响应速度
2. 网络连接质量
3. 翻译文本长度
建议：使用响应较快的API服务，或切换到其他API配置。

### Q: 某些网站无法使用

A: 部分网站可能有特殊的安全策略或内容加载方式，可能影响插件功能。如遇问题，请提交Issue反馈。

### Q: 如何删除翻译缓存

A: 访问 `chrome://extensions/`，找到"QuickTrans"，点击"删除扩展数据"，或在开发者工具中手动清除 `chrome.storage.local`。

---

## 📝 更新日志

### v1.0.0 (2025-01-04)

- ✨ 首次发布
- ✅ 实现划词翻译功能
- 🌍 支持13种语言自动识别
- 🔧 支持多API配置管理
- 🎨 精美的UI设计
- 💾 智能翻译缓存
- 🔒 本地数据存储，保护隐私

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 如何贡献

1. Fork本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

## 🙏 致谢

- 感谢OpenAI提供的API服务
- 感谢所有贡献者和用户的支持

---

## 📞 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 [Issue](https://github.com/yourusername/trans-by-llm/issues)
- 发送邮件至：your.email@example.com

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给它一个Star！⭐**

</div>
