import {it,expect} from 'vitest';
import {guideLabelPosition} from '../apps/web/src/guide-label-layout.ts';
for(const labelWidth of [120,380,680])for(const [x,y]of [[-100,360],[1400,360],[640,-100],[640,900]])it(`1280×720 的 ${labelWidth}px 标签在边缘完整保留 ${x}/${y}`,()=>{const v={x,y,width:1280,height:720,labelWidth,labelHeight:24,inset:16},p=guideLabelPosition(v);expect(p.x-labelWidth/2).toBeGreaterThanOrEqual(16);expect(p.x+labelWidth/2).toBeLessThanOrEqual(1264);expect(p.y-12).toBeGreaterThanOrEqual(16);expect(p.y+12).toBeLessThanOrEqual(704);});
