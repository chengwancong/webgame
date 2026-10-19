import {expect,it,vi} from 'vitest';
vi.mock('../apps/web/src/starsea-runtime-assets.ts',()=>({starseaAsset:()=>undefined}));
import {GatherNodes} from '../apps/web/src/gather-nodes.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
import type {World} from '../packages/simulation/index.ts';
it('站在高石堆画面上按 E：排队后走进采集距离自动采一次，走远就取消',async()=>{
 const node=worldTables.objects.find(n=>n.kind==='gather'&&!n.when&&!n.until)!,position={x:node.x,y:node.y-3.5};
 const write=vi.fn(async(_path:string,_body:object)=> 'success' as const),world={region:{id:node.region},hero:{position},mode:'semi',paused:false} as unknown as World,snapshot={field:{region:node.region,gathered:[]},lastRegion:node.region} as unknown as Snapshot;
 const gather=new GatherNodes({world:()=>world,snapshot:()=>snapshot,ready:()=>true,write,notice:()=>{},lastReceipt:()=>undefined});
 expect(gather.nearest()).toBeUndefined();expect(gather.nearest(5)?.id).toBe(node.id);
 gather.queue(node.id);gather.step();expect(write).not.toHaveBeenCalled();
 world.hero.position={x:node.x,y:node.y-1.2};gather.step();await Promise.resolve();expect(write).toHaveBeenCalledOnce();
 gather.queue(node.id);world.hero.position={x:node.x+9,y:node.y};gather.step();world.hero.position={x:node.x,y:node.y-1};gather.step();expect(write).toHaveBeenCalledOnce();
});
