#!/usr/bin/env python3
"""
将图标背景转换为透明背景
处理白色或浅色背景，将其替换为透明
"""

import os
from PIL import Image

def make_transparent(input_path, output_path, threshold=240):
    """
    将图片的浅色背景转为透明
    
    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径
        threshold: 颜色阈值，RGB值大于此值的像素将变为透明（默认240，适用于白色和浅色背景）
    """
    try:
        # 打开图片并转换为RGBA模式
        img = Image.open(input_path).convert('RGBA')
        
        # 获取图片数据
        datas = img.getdata()
        
        new_data = []
        for item in datas:
            # 如果像素的RGB值都大于阈值（接近白色或浅色），则将其设为透明
            if item[0] > threshold and item[1] > threshold and item[2] > threshold:
                # 完全透明
                new_data.append((255, 255, 255, 0))
            else:
                # 保持原样
                new_data.append(item)
        
        # 更新图片数据
        img.putdata(new_data)
        
        # 保存为PNG格式（支持透明度）
        img.save(output_path, 'PNG')
        print(f"✓ 已处理: {output_path}")
        return True
        
    except Exception as e:
        print(f"✗ 处理 {input_path} 失败: {e}")
        return False

def main():
    # 处理三个尺寸的图标
    icon_files = ['icon16.png', 'icon48.png', 'icon128.png']
    
    print("开始处理图标，将背景转为透明...")
    print("提示：白色或浅色背景（RGB > 240）将被移除")
    print()
    
    success_count = 0
    
    for icon_file in icon_files:
        if os.path.exists(icon_file):
            # 可以先备份原文件
            backup_file = icon_file.replace('.png', '_backup.png')
            if not os.path.exists(backup_file):
                Image.open(icon_file).save(backup_file)
                print(f"  已备份原文件: {backup_file}")
            
            # 处理图标
            if make_transparent(icon_file, icon_file):
                success_count += 1
        else:
            print(f"✗ 找不到文件: {icon_file}")
    
    print()
    print(f"处理完成！成功处理 {success_count}/{len(icon_files)} 个图标")
    print("原始文件已备份为 *_backup.png")

if __name__ == "__main__":
    main()
