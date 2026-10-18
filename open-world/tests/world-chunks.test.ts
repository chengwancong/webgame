import {it,expect} from 'vitest';
import {visibleWorldChunks,inWorldViewport} from '../apps/web/src/world-chunks.ts';
import {project} from '../apps/web/src/iso.ts';
it('bounds camera chunks independently of island size and follows travel',()=>{const p=project({x:256,y:256}),view={x:p.x-640,y:p.y-360,width:1280,height:720},first=visibleWorldChunks(512,512,view),large=visibleWorldChunks(2048,2048,view);expect(first).toEqual(large);expect(first.size).toBeLessThanOrEqual(25);const second=visibleWorldChunks(512,512,{...view,x:view.x+8192});expect([...first].some(key=>second.has(key))).toBe(false);expect(inWorldViewport({x:256,y:256},view)).toBe(true);expect(inWorldViewport({x:40,y:40},view)).toBe(false);});
