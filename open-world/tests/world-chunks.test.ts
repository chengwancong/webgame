import {it,expect} from 'vitest';
import {visibleWorldChunks,inWorldViewport,ChunkBuildBudget,chunkBuild} from '../apps/web/src/world-chunks.ts';
import {project} from '../apps/web/src/iso.ts';
it('bounds camera chunks independently of island size and follows travel',()=>{const p=project({x:256,y:256}),view={x:p.x-640,y:p.y-360,width:1280,height:720},first=visibleWorldChunks(512,512,view),large=visibleWorldChunks(2048,2048,view);expect(first).toEqual(large);expect(first.size).toBeLessThanOrEqual(25);const second=visibleWorldChunks(512,512,{...view,x:view.x+8192});expect([...first].some(key=>second.has(key))).toBe(false);expect(inWorldViewport({x:256,y:256},view)).toBe(true);expect(inWorldViewport({x:40,y:40},view)).toBe(false);});
it('does not give a walking player the startup budget when they catch a pending chunk',()=>{
 const budget=new ChunkBuildBudget();
 expect(budget.next({x:31.8,y:16},true,true)).toBe(chunkBuild.entryBudgetMs);
 expect(budget.next({x:31.9,y:16},false,false)).toBe(chunkBuild.stepBudgetMs);
 for(let i=0;i<10;i++)expect(budget.next({x:32+i*.1,y:16},true,true)).toBe(chunkBuild.urgentBudgetMs);
 expect(budget.next({x:33,y:16},false,false)).toBe(chunkBuild.stepBudgetMs);
});
it('re-arms startup loading for a teleport and keeps it until the destination chunk is ready',()=>{
 const budget=new ChunkBuildBudget();
 budget.next({x:10,y:10},false,false);
 expect(budget.next({x:70,y:70},true,true)).toBe(chunkBuild.entryBudgetMs);
 expect(budget.next({x:70.1,y:70},true,true)).toBe(chunkBuild.entryBudgetMs);
 expect(budget.next({x:70.2,y:70},false,true)).toBe(chunkBuild.urgentBudgetMs);
 expect(budget.next({x:70.3,y:70},true,true)).toBe(chunkBuild.urgentBudgetMs);
});
it('does not leave startup loading armed after a teleport to a cached destination',()=>{
 const budget=new ChunkBuildBudget();
 budget.next({x:10,y:10},false,false);
 expect(budget.next({x:63.9,y:10},false,false)).toBe(chunkBuild.stepBudgetMs);
 expect(budget.next({x:64.1,y:10},true,true)).toBe(chunkBuild.urgentBudgetMs);
});
