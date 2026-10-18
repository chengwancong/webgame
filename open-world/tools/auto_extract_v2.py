#!/usr/bin/env python3
"""智能分析 V2 标准图并自动提取 UI 组件（纯 Pillow 实现）"""
import sys
from pathlib import Path
from PIL import Image

V2_DIR = Path(__file__).parent.parent.parent / "docs/05-art/ui-standard-v2-20260929"
OUTPUT_DIR = Path(__file__).parent.parent / "apps/web/public/art/ui/v2"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def color_distance(c1, c2):
    """计算两个 RGB 颜色的欧几里得距离"""
    return sum((a - b) ** 2 for a, b in zip(c1[:3], c2[:3])) ** 0.5

def find_color_region(img, target_color, tolerance=30):
    """找到包含目标颜色的区域边界"""
    width, height = img.size
    pixels = img.load()
    
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    found = False
    
    for y in range(height):
        for x in range(width):
            pixel = pixels[x, y][:3] if isinstance(pixels[x, y], tuple) else (pixels[x, y],) * 3
            if color_distance(pixel, target_color) < tolerance:
                found = True
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x), max(max_y, y)
    
    return (min_x, min_y, max_x, max_y) if found else None

def extract_button_from_standard(standard_img):
    """从 04-component-standard.png 提取按钮样本"""
    # V2 杏金色按钮 #FFB65C (255, 182, 92)
    gold_color = (255, 182, 92)
    
    # 查找金色按钮区域
    region = find_color_region(standard_img, gold_color, tolerance=40)
    
    if region:
        x1, y1, x2, y2 = region
        # 扩展边界以包含完整按钮
        margin = 20
        x1, y1 = max(0, x1 - margin), max(0, y1 - margin)
        x2, y2 = min(standard_img.width, x2 + margin), min(standard_img.height, y2 + margin)
        
        button_img = standard_img.crop((x1, y1, x2, y2))
        return button_img, (x1, y1, x2, y2)
    
    return None, None

def extract_panel_from_inventory(inv_img):
    """从 02-inventory-equipment.png 提取面板边框"""
    # V2 午夜蓝 #1A2332 (26, 35, 50) 或石板蓝 #2D3E54 (45, 62, 84)
    midnight = (26, 35, 50)
    slate = (45, 62, 84)
    
    # 查找深色面板区域
    midnight_region = find_color_region(inv_img, midnight, tolerance=25)
    slate_region = find_color_region(inv_img, slate, tolerance=25)
    
    if midnight_region or slate_region:
        region = midnight_region if midnight_region else slate_region
        x1, y1, x2, y2 = region
        
        # 面板通常在画面中央，取一个合理的边框样本
        # 取左上角区域作为边框样本
        sample_w, sample_h = 100, 100
        x2, y2 = min(x1 + sample_w, inv_img.width), min(y1 + sample_h, inv_img.height)
        
        panel_sample = inv_img.crop((x1, y1, x2, y2))
        return panel_sample, (x1, y1, x2, y2)
    
    return None, None

def analyze_and_extract():
    """分析标准图并提取组件"""
    print("=" * 60)
    print("自动分析 V2 标准图并提取组件")
    print("=" * 60)
    
    # 1. 分析 04-component-standard.png
    standard_path = V2_DIR / "04-component-standard.png"
    if standard_path.exists():
        print(f"\n分析 {standard_path.name}...")
        img = Image.open(standard_path)
        
        button, btn_coords = extract_button_from_standard(img)
        if button:
            print(f"  ✓ 找到金色按钮区域: {btn_coords}")
            button.save(OUTPUT_DIR / "button-primary-sample.png")
            print(f"  → 保存到 v2/button-primary-sample.png")
        else:
            print(f"  ✗ 未找到金色按钮（#FFB65C）")
    
    # 2. 分析 02-inventory-equipment.png
    inv_path = V2_DIR / "02-inventory-equipment.png"
    if inv_path.exists():
        print(f"\n分析 {inv_path.name}...")
        img = Image.open(inv_path)
        
        panel, panel_coords = extract_panel_from_inventory(img)
        if panel:
            print(f"  ✓ 找到面板区域: {panel_coords}")
            panel.save(OUTPUT_DIR / "panel-sample.png")
            print(f"  → 保存到 v2/panel-sample.png")
        else:
            print(f"  ✗ 未找到午夜蓝/石板蓝面板")
    
    print("\n" + "=" * 60)
    print("提示：自动提取可能不精确，建议手动确认并精细切图")
    print("=" * 60)

def main():
    try:
        analyze_and_extract()
        return 0
    except Exception as e:
        print(f"\n错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
