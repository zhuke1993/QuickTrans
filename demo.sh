#!/bin/bash

# AI翻译助手 - 快速演示脚本

echo "=========================================="
echo "  AI翻译助手 - Chrome插件项目展示"
echo "=========================================="
echo ""

# 检查项目文件
echo "📁 检查项目文件..."
echo ""

files=(
    "manifest.json:Chrome扩展配置文件"
    "background.js:后台服务脚本"
    "content.js:内容脚本"
    "content.css:内容脚本样式"
    "storage-utils.js:存储工具模块"
    "language-detector.js:语言识别模块"
    "options.html:设置页面"
    "options.css:设置页面样式"
    "options.js:设置页面逻辑"
    "icons/icon16.png:16x16图标"
    "icons/icon48.png:48x48图标"
    "icons/icon128.png:128x128图标"
)

all_exist=true
for file_info in "${files[@]}"; do
    file="${file_info%%:*}"
    desc="${file_info##*:}"
    if [ -f "$file" ]; then
        size=$(ls -lh "$file" | awk '{print $5}')
        echo "  ✅ $file ($size) - $desc"
    else
        echo "  ❌ $file - 缺失"
        all_exist=false
    fi
done

echo ""

if [ "$all_exist" = true ]; then
    echo "✅ 所有必需文件都已创建！"
else
    echo "⚠️  某些文件缺失，请检查"
    exit 1
fi

echo ""
echo "=========================================="
echo "  项目统计信息"
echo "=========================================="
echo ""

# 统计代码行数
echo "📊 代码统计："
echo ""

js_lines=$(find . -name "*.js" -not -path "*/node_modules/*" -not -path "*/.git/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
css_lines=$(find . -name "*.css" -not -path "*/node_modules/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
html_lines=$(find . -name "*.html" -not -path "*/node_modules/*" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')

echo "  JavaScript: $js_lines 行"
echo "  CSS: $css_lines 行"
echo "  HTML: $html_lines 行"
echo "  总计: $((js_lines + css_lines + html_lines)) 行"

echo ""
echo "📦 文件大小："
echo ""

total_size=$(du -sh . | awk '{print $1}')
echo "  项目总大小: $total_size"

echo ""
echo "=========================================="
echo "  安装说明"
echo "=========================================="
echo ""

echo "1️⃣  打开 Chrome 浏览器"
echo "2️⃣  访问 chrome://extensions/"
echo "3️⃣  开启「开发者模式」"
echo "4️⃣  点击「加载已解压的扩展程序」"
echo "5️⃣  选择当前目录: $(pwd)"
echo ""
echo "详细说明请查看: INSTALL.md"

echo ""
echo "=========================================="
echo "  核心功能"
echo "=========================================="
echo ""

echo "✨ 已实现的功能："
echo ""
echo "  ✅ 划词翻译 - 选中文本即可翻译"
echo "  ✅ 智能语言识别 - 自动检测13种语言"
echo "  ✅ 目标语言切换 - 弹窗内实时切换"
echo "  ✅ 多API配置 - 支持添加和切换多个API"
echo "  ✅ 翻译缓存 - 相同内容复用结果"
echo "  ✅ 精美界面 - 渐变色主题，动画流畅"
echo "  ✅ 隐私保护 - 数据仅存储在本地"

echo ""
echo "=========================================="
echo "  文档资源"
echo "=========================================="
echo ""

echo "📖 可用文档："
echo ""
echo "  📄 README.md - 完整使用文档"
echo "  📄 INSTALL.md - 安装指南"
echo "  📄 PROJECT_SUMMARY.md - 项目总结"
echo "  📄 .qoder/quests/word-translation-extension.md - 设计文档"

echo ""
echo "=========================================="
echo "  快速测试"
echo "=========================================="
echo ""

echo "测试步骤："
echo ""
echo "  1. 按照上述步骤安装插件到Chrome"
echo "  2. 打开插件的设置页面"
echo "  3. 添加一个API配置（需要OpenAI API Key）"
echo "  4. 打开任意网页（如Wikipedia）"
echo "  5. 选中一段英文文本"
echo "  6. 查看翻译弹窗！"

echo ""
echo "=========================================="

echo ""
echo "🎉 项目已完成！祝使用愉快！"
echo ""

# 验证 manifest.json 格式
echo "🔍 验证配置文件..."
if python3 -m json.tool manifest.json > /dev/null 2>&1; then
    echo "  ✅ manifest.json 格式正确"
else
    echo "  ❌ manifest.json 格式错误"
fi

echo ""
