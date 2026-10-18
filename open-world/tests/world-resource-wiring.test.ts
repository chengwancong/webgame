import {expect,it} from 'vitest';
import {checkResourceReferences,checkWorldResourceWiring} from '../tools/check-world-resource-wiring.ts';
import {dungeonArtwork} from '../packages/asset-manifest/destination-artwork.ts';
it('resolves configured resources, illustrations and actors across every island and dungeon',()=>{
 const report=checkWorldResourceWiring();expect(report.passed).toBe(true);expect(report.artwork.every(entry=>entry.path.startsWith('/'))).toBe(true);expect(report.references.every(reference=>reference.id&&reference.path)).toBe(true);
});
it('rejects missing entrance and off-screen actor references instead of accepting the currently visible island',()=>{
 expect(()=>checkResourceReferences({islands:[{resource:'registered'},{spawns:[{artId:'missing'}]}]},'all-islands',new Set(['registered']))).toThrow('all-islands.islands.1.spawns.0.artId = missing');
 expect(()=>dungeonArtwork({id:'new-dungeon',area:'new-area'},{id:'new-area',theme:'new-area'},[{dungeon:'new-dungeon',resource:'missing-entrance'}])).toThrow('missing-entrance');
});
it('仅采集点接受交接指定的材料图标回退，普通物件仍拒绝未登记资源',()=>{expect(()=>checkResourceReferences({kind:'gather',resource:'item-material-ore'},'gather',new Set())).not.toThrow();expect(()=>checkResourceReferences({kind:'life',resource:'item-material-ore'},'life',new Set())).toThrow();});
