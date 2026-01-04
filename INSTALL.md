# AI翻译助手 - 安装指南

## 快速安装

### 步骤1：准备图标文件

插件已经包含了基础的占位图标。如果需要更美观的图标，可以：

**选项A：使用浏览器生成（推荐）**

1. 用浏览器打开 `icons/icon-generator.html`
2. 分别点击三个按钮下载图标：
   - 下载 16x16 图标
   - 下载 48x48 图标
   - 下载 128x128 图标
3. 将下载的文件放到 `icons/` 目录下

**选项B：使用Python脚本**

```bash
cd icons
python3 create_icons.py
```

### 步骤2：加载到Chrome

1. 打开Chrome浏览器
2. 在地址栏输入：`chrome://extensions/`
3. 打开右上角的"开发者模式"开关
4. 点击"加载已解压的扩展程序"按钮
5. 选择本项目的根目录（包含manifest.json的文件夹）
6. 确认加载

### 步骤3：配置API

1. 点击Chrome工具栏上的插件图标
2. 或者在扩展管理页面点击"详细信息" -> "扩展程序选项"
3. 在设置页面点击"添加新配置"
4. 填写以下信息：
   - **配置名称**：例如 "OpenAI GPT-3.5"
   - **API端点**：`https://api.openai.com/v1/chat/completions`
   - **API密钥**：你的OpenAI API Key（以sk-开头）
5. 点击"测试连接"验证配置是否正确
6. 点击"保存配置"

### 步骤4：开始使用

1. 打开任意网页
2. 用鼠标选中一段文本
3. 等待翻译图标出现（或自动弹出翻译窗口）
4. 查看翻译结果！

## API配置示例

### OpenAI官方API

```
配置名称: OpenAI GPT-3.5
API端点: https://api.openai.com/v1/chat/completions
API密钥: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### OpenAI GPT-4

```
配置名称: OpenAI GPT-4
API端点: https://api.openai.com/v1/chat/completions
API密钥: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

注意：使用GPT-4需要修改 `background.js` 中的模型参数。

### 自定义API端点

如果你使用的是第三方API服务或自建服务，只需：

1. 确保API兼容OpenAI Chat Completions格式
2. 填写正确的API端点地址
3. 填写对应的API密钥

## 常见问题

### Q: 加载插件时提示错误

**检查清单：**
- [ ] 确保manifest.json文件存在且格式正确
- [ ] 确保icons目录下有icon16.png、icon48.png、icon128.png文件
- [ ] 确保所有JavaScript文件没有语法错误

### Q: 插件图标不显示

这是正常的，因为使用了简单的占位图标。可以使用 `icons/icon-generator.html` 生成更好的图标。

### Q: 翻译功能无响应

**排查步骤：**

1. 检查是否已配置API
2. 打开Chrome开发者工具（F12），查看Console是否有错误
3. 访问 `chrome://extensions/`，点击插件的"Service Worker"查看后台日志
4. 尝试在其他网页测试

### Q: 如何卸载

1. 访问 `chrome://extensions/`
2. 找到"AI翻译助手"
3. 点击"移除"按钮

## 高级配置

### 修改默认模型

编辑 `background.js`，找到第130行左右的代码：

```javascript
body: JSON.stringify({
  model: 'gpt-3.5-turbo', // 修改这里
  messages: [...],
  ...
})
```

可用的模型：
- `gpt-3.5-turbo` - 快速且经济
- `gpt-4` - 更准确但较慢
- `gpt-4-turbo-preview` - GPT-4的加速版本

### 调整翻译参数

在同一位置，还可以调整：

- `temperature`: 0.3（创造性，0-2之间）
- `max_tokens`: 2000（最大返回长度）

### 自定义翻译提示词

编辑 `background.js` 的第73-78行，修改系统提示：

```javascript
const systemPrompt = `你是一个专业的翻译助手。请将用户提供的文本翻译成${targetLangName}。
要求：
1. 只返回翻译结果，不要添加任何解释或说明
2. 保持原文的语气和风格
3. 对于专业术语，提供准确的翻译
4. 保持原文的格式（如换行、段落等）`;
```

## 获取帮助

如遇到问题，请：

1. 查看 [README.md](README.md) 获取详细文档
2. 检查Chrome开发者工具的控制台输出
3. 在GitHub上提交Issue（如果有仓库地址）

---

祝使用愉快！🎉
