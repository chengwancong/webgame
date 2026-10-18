#!/usr/bin/env python3
"""手工制作 V2 风格 UI 组件（基于标准图色值和结构）"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

OUTPUT_DIR = Path(__file__).parent.parent / "apps/web/public/art/ui/v2"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# V2 色值定义
V2_COLORS = {
    'midnight': (26, 35, 50),      # #1A2332 午夜蓝
    'slate': (45, 62, 84),          # #2D3E54 石板蓝
    'cream': (255, 248, 231),       # #FFF8E7 奶油白
    'gold': (255, 182, 92),         # #FFB65C 杏金色
    'magic': (73, 210, 255),        # #49D2FF 魔法蓝
    'coral': (255, 107, 91),        # #FF6B5B 珊瑚红
}

def create_button_primary():
    """创建 V2 主要按钮（杏金色，圆角矩形，三态）"""
    w, h = 120, 36
    radius = 4
    
    # Rest 状态
    img_rest = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_rest)
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=V2_COLORS['gold'], outline=(200, 140, 60), width=1)
    img_rest.save(OUTPUT_DIR / 'btn-primary.png')
    
    # Hover 状态（更亮）
    img_hover = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_hover)
    hover_color = tuple(min(255, c + 20) for c in V2_COLORS['gold'])
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=hover_color, outline=(220, 160, 80), width=1)
    img_hover.save(OUTPUT_DIR / 'btn-primary-hover.png')
    
    # Pressed 状态（更暗）
    img_pressed = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_pressed)
    pressed_color = tuple(max(0, c - 30) for c in V2_COLORS['gold'])
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=pressed_color, outline=(180, 120, 50), width=1)
    img_pressed.save(OUTPUT_DIR / 'btn-primary-pressed.png')
    
    print(f"✓ 创建主按钮三态: {w}×{h}")

def create_button_secondary():
    """创建 V2 次要按钮（石板蓝，透明）"""
    w, h = 120, 36
    radius = 4
    
    # Rest 状态（半透明）
    img_rest = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_rest)
    slate_alpha = V2_COLORS['slate'] + (180,)
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=slate_alpha, outline=(60, 80, 100, 200), width=1)
    img_rest.save(OUTPUT_DIR / 'btn-secondary.png')
    
    # Hover 状态
    img_hover = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_hover)
    hover_alpha = tuple(min(255, c + 15) for c in V2_COLORS['slate']) + (200,)
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=hover_alpha, outline=(80, 100, 120, 220), width=1)
    img_hover.save(OUTPUT_DIR / 'btn-secondary-hover.png')
    
    # Pressed 状态
    img_pressed = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_pressed)
    pressed_alpha = tuple(max(0, c - 10) for c in V2_COLORS['slate']) + (160,)
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=pressed_alpha, outline=(40, 60, 80, 200), width=1)
    img_pressed.save(OUTPUT_DIR / 'btn-secondary-pressed.png')
    
    print(f"✓ 创建次按钮三态: {w}×{h}")

def create_panel_frame():
    """创建 V2 面板边框（九宫格切片用）"""
    # 九宫格尺寸：边框厚度 20px
    w, h = 80, 80
    border = 20
    radius = 6
    
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 外框（午夜蓝）
    draw.rounded_rectangle([0, 0, w-1, h-1], radius=radius, fill=V2_COLORS['midnight'], outline=(40, 50, 70), width=2)
    
    # 内部区域（石板蓝，略亮）
    draw.rounded_rectangle([border, border, w-border-1, h-border-1], radius=radius-2, fill=V2_COLORS['slate'])
    
    img.save(OUTPUT_DIR / 'panel-frame.png')
    print(f"✓ 创建面板边框（九宫格）: {w}×{h}，边框 {border}px")

def create_item_slot():
    """创建 V2 物品槽（装备/技能槽）"""
    size = 56
    radius = 4
    
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 深色背景 + 边框
    bg_color = (15, 20, 28, 255)
    border_color = (60, 75, 95, 255)
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=bg_color, outline=border_color, width=2)
    
    img.save(OUTPUT_DIR / 'item-slot.png')
    print(f"✓ 创建物品槽: {size}×{size}")

def create_close_button():
    """创建 V2 关闭按钮（X 图标）"""
    size = 32
    
    # Rest 状态
    img_rest = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_rest)
    draw.ellipse([0, 0, size-1, size-1], fill=(60, 70, 85, 200), outline=(80, 90, 110), width=1)
    # 绘制 X
    margin = 8
    draw.line([margin, margin, size-margin, size-margin], fill=V2_COLORS['cream'], width=2)
    draw.line([size-margin, margin, margin, size-margin], fill=V2_COLORS['cream'], width=2)
    img_rest.save(OUTPUT_DIR / 'close-default.png')
    
    # Hover 状态（珊瑚红）
    img_hover = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_hover)
    draw.ellipse([0, 0, size-1, size-1], fill=V2_COLORS['coral'], outline=(255, 120, 100), width=1)
    draw.line([margin, margin, size-margin, size-margin], fill=(255, 255, 255), width=2)
    draw.line([size-margin, margin, margin, size-margin], fill=(255, 255, 255), width=2)
    img_hover.save(OUTPUT_DIR / 'close-hover.png')
    
    # Pressed 状态
    img_pressed = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_pressed)
    pressed_coral = tuple(max(0, c - 30) for c in V2_COLORS['coral'])
    draw.ellipse([0, 0, size-1, size-1], fill=pressed_coral, outline=(200, 80, 70), width=1)
    draw.line([margin, margin, size-margin, size-margin], fill=(240, 240, 240), width=2)
    draw.line([size-margin, margin, margin, size-margin], fill=(240, 240, 240), width=2)
    img_pressed.save(OUTPUT_DIR / 'close-pressed.png')
    
    print(f"✓ 创建关闭按钮三态: {size}×{size}")

def main():
    print("=" * 60)
    print("手工制作 V2 UI 组件资源")
    print("=" * 60)
    print(f"输出目录: {OUTPUT_DIR}\n")
    
    create_button_primary()
    create_button_secondary()
    create_panel_frame()
    create_item_slot()
    create_close_button()
    
    print("\n" + "=" * 60)
    print("完成！所有 V2 组件已生成")
    print("=" * 60)
    return 0

if __name__ == "__main__":
    sys.exit(main())
