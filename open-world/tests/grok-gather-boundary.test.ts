import {expect,it,vi} from 'vitest';
vi.mock('../apps/web/src/starsea-runtime-assets.ts',()=>({starseaAsset:()=>undefined}));
import {GatherNodes} from '../apps/web/src/gather-nodes.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
import type {World} from '../packages/simulation/index.ts';
it('keeps the same precise in-range position in the gather request instead of rounding it outside the radius',async()=>{
 const node=worldTables.objects.find(n=>n.kind==='gather'&&!n.when&&!n.until)!,position={x:node.x+1.351,y:node.y+1.471};
 const write=vi.fn(async(_path:string,_body:object)=> 'success' as const),world={region:{id:node.region},hero:{position}} as World,snapshot={field:{region:node.region,gathered:[]},lastRegion:node.region} as unknown as Snapshot;
 const gather=new GatherNodes({world:()=>world,snapshot:()=>snapshot,ready:()=>true,write,notice:()=>{},lastReceipt:()=>undefined});
 expect(Math.hypot(position.x-node.x,position.y-node.y)).toBeLessThan(2);expect(Math.hypot(Math.round(position.x*10)/10-node.x,Math.round(position.y*10)/10-node.y)).toBeGreaterThan(2);
 await gather.gather(node.id,'manual');expect(write).toHaveBeenCalledOnce();expect(write.mock.calls[0][1]).toMatchObject({position});
});
