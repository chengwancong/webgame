#!/usr/bin/env python3
"""从 V2 标准图提取基础 UI 组件资源"""
import sys
from pathlib import Path
from PIL import Image

# 标准图路径
V2_DIR = Path(__file__).parent.parent.parent / "docs/05-art/ui-standard-v2-20260929"
OUTPUT_DIR = Path(__file__).parent.parent / "apps/web/public/art/ui/v2"

# 确保输出目录存在
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def extract_button_primary():
    """从 04-component-standard.png 提取主要按钮（杏金色）"""
    src = Image.open(V2_DIR / "04-component-standard.png")
    # 主按钮区域 - 需根据实际标准图调整坐标
    # 这里使用占位坐标，实际需要打开图片确认
    print(f"标准图尺寸: {src.size}")
    print("提示：需要手动确认按钮坐标后再提取")
    # 暂时复制现有资源作为占位
    return False

def extract_button_secondary():
    """从 04-component-standard.png 提取次要按钮"""
    print("待实现：次要按钮提取")
    return False

def extract_panel_frame():
    """从 02-inventory-equipment.png 提取面板边框（午夜蓝）"""
    src = Image.open(V2_DIR / "02-inventory-equipment.png")
    print(f"背包标准图尺寸: {src.size}")
    print("提示：需要手动确认面板边框区域")
    return False

def extract_item_slot():
    """从 02-inventory-equipment.png 提取物品槽"""
    print("待实现：物品槽提取")
    return False

def main():
    print("V2 UI 组件资源提取工具")
    print("=" * 50)
    print(f"V2 标准图目录: {V2_DIR}")
    print(f"输出目录: {OUTPUT_DIR}")
    print()
    
    # 检查标准图文件
    standard_files = [
        "01-gameplay-hud.png",
        "02-inventory-equipment.png",
        "03-skill-build.png",
        "04-component-standard.png"
    ]
    
    missing = []
    for f in standard_files:
        path = V2_DIR / f
        if path.exists():
            img = Image.open(path)
            print(f"✓ {f}: {img.size}, {img.mode}")
        else:
            print(f"✗ {f}: 文件不存在")
            missing.append(f)
    
    if missing:
        print(f"\n错误：缺少 {len(missing)} 个标准图文件")
        return 1
    
    print("\n" + "=" * 50)
    print("准备手动切图：")
    print("1. 使用图像编辑器打开 04-component-standard.png")
    print("2. 定位按钮、面板边框等组件的精确坐标")
    print("3. 更新本脚本的提取坐标")
    print("4. 重新运行提取")
    print()
    print("提示：V2 按钮应为杏金色 #FFB65C，面板为午夜蓝 #1A2332/石板蓝 #2D3E54")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
