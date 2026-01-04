#!/bin/bash
# 图标缩放脚本 - 将源图片转换为不同尺寸的图标

SOURCE_IMAGE="source-icon.png"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "错误: 找不到源图片 $SOURCE_IMAGE"
    echo "请将原图保存为 icons/source-icon.png"
    exit 1
fi

echo "开始转换图标..."

# 使用 sips (macOS 自带工具) 转换图标
sips -z 16 16 "$SOURCE_IMAGE" --out icon16.png
sips -z 48 48 "$SOURCE_IMAGE" --out icon48.png
sips -z 128 128 "$SOURCE_IMAGE" --out icon128.png

echo "图标转换完成！"
echo "已生成: icon16.png, icon48.png, icon128.png"
