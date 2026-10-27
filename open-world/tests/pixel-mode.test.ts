import {test,expect,describe,vi} from 'vitest';
// Phaser 需要浏览器环境；单元测试中仅测纯函数，mock 掉整个 Phaser
vi.mock('phaser',()=>({default:{Scenes:{Events:{ADDED_TO_SCENE:'added',PRE_RENDER:'prerender',SHUTDOWN:'shutdown'}},Filters:{Controller:class{}},Renderer:{WebGL:{RenderNodes:{BaseFilterShader:class{}}}}}}));
import {blockPixels,parsePixelSettings,snapToBlock,defaultPixelSettings} from '../apps/web/src/pixel-mode.ts';

// ── parsePixelSettings ────────────────────────────────────────────────────────
describe('parsePixelSettings',()=>{
  test('空对象返回默认值',()=>{
    expect(parsePixelSettings({})).toEqual(defaultPixelSettings);
  });

  test('null 返回默认值',()=>{
    expect(parsePixelSettings(null)).toEqual(defaultPixelSettings);
  });

  test('非对象类型返回默认值',()=>{
    expect(parsePixelSettings('garbage')).toEqual(defaultPixelSettings);
    expect(parsePixelSettings(42)).toEqual(defaultPixelSettings);
    expect(parsePixelSettings(undefined)).toEqual(defaultPixelSettings);
  });

  test('正确解析 on=true,size=2',()=>{
    expect(parsePixelSettings({on:true,size:2})).toEqual({on:true,size:2});
  });

  test('正确解析 on=false,size=4',()=>{
    expect(parsePixelSettings({on:false,size:4})).toEqual({on:false,size:4});
  });

  test('size 非法值降级为默认 2',()=>{
    expect(parsePixelSettings({on:true,size:5})).toEqual({on:true,size:2});
    expect(parsePixelSettings({on:true,size:0})).toEqual({on:true,size:2});
    expect(parsePixelSettings({on:true,size:'中'})).toEqual({on:true,size:2});
  });

  test('on 非 boolean true 视为 false',()=>{
    expect(parsePixelSettings({on:1,size:3})).toEqual({on:false,size:3});
    expect(parsePixelSettings({on:'true',size:3})).toEqual({on:false,size:3});
  });

  test('默认 size 为 2',()=>{
    expect(defaultPixelSettings.size).toBe(2);
  });
});

// ── snapToBlock ───────────────────────────────────────────────────────────────
describe('snapToBlock',()=>{
  test('整除时不变',()=>{
    expect(snapToBlock(48,16)).toBe(48);
    expect(snapToBlock(0,8)).toBe(0);
  });

  test('四舍五入到最近块',()=>{
    expect(snapToBlock(20,16)).toBe(16);  // 20 → 最近 16
    expect(snapToBlock(25,16)).toBe(32);  // 25 → 最近 32（0.5 向上）
    expect(snapToBlock(7,8)).toBe(8);
    expect(snapToBlock(3,8)).toBe(0);
  });

  test('blockWorld<=0 时原值返回',()=>{
    expect(snapToBlock(100,0)).toBe(100);
    expect(snapToBlock(100,-5)).toBe(100);
  });

  test('负坐标仍能对齐',()=>{
    expect(snapToBlock(-16,16)).toBe(-16);
    expect(snapToBlock(-10,16)).toBe(-16); // round(-10/16)= round(-0.625)=-1 → -16
  });
});

describe('blockPixels',()=>{
  test('一格总是整数屏幕像素，窗口小时细<中<粗仍然分得开',()=>{
    for(const scale of [0.8,1,1.25,1.5,2]){
      const [a,b,c]=([2,3,4] as const).map(s=>blockPixels(s,scale));
      for(const v of [a,b,c])expect(Number.isInteger(v)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(2);expect(b).toBeGreaterThan(a);expect(c).toBeGreaterThan(b);
    }
    expect(blockPixels(3,1.5)).toBe(5);// 1920 宽：中档 3 舞台像素 ≈ 4.5 → 5
  });

  test('细档（size=2）为默认档，最小为 2 屏幕像素',()=>{
    expect(blockPixels(2,1)).toBe(2);
    expect(blockPixels(2,0.5)).toBe(2); // 最小夹到 2
  });
});
