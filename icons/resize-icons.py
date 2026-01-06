#!/usr/bin/env python3
"""
图标缩放脚本 - 将源图片转换为不同尺寸的图标
使用高质量的 Lanczos 重采样算法
"""

import os
from PIL import Image

SOURCE_IMAGE = "source-icon.png"

def resize_icon(source_path, output_path, size):
    """缩放图标到指定尺寸，保持透明背景"""
    try:
        img = Image.open(source_path)
        # 确保图片是RGBA模式，保持透明度
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        # 使用高质量的 Lanczos 重采样
        img_resized = img.resize((size, size), Image.Resampling.LANCZOS)
        img_resized.save(output_path, 'PNG', optimize=True)
        print(f"✓ 已生成: {output_path} ({size}x{size})")
        return True
    except Exception as e:
        print(f"✗ 生成 {output_path} 失败: {e}")
        return False

def main():
    if not os.path.exists(SOURCE_IMAGE):
        print(f"错误: 找不到源图片 {SOURCE_IMAGE}")
        print("请将原图保存为 icons/source-icon.png")
        return
    
    print("开始转换图标...")
    print(f"源图片: {SOURCE_IMAGE}")
    print()
    
    sizes = [16, 48, 128]
    success_count = 0
    
    for size in sizes:
        output_path = f"icon{size}.png"
        if resize_icon(SOURCE_IMAGE, output_path, size):
            success_count += 1
    
    print()
    print(f"图标转换完成！成功生成 {success_count}/{len(sizes)} 个图标")

if __name__ == "__main__":
    main()
