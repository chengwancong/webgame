import {it,expect} from 'vitest';
import {generateFieldDungeonStage} from '../tools/generate-field-dungeon.ts';
import {catalogues} from './fixtures/production-island.ts';
import {monsterContent} from '../packages/content/monsters.ts';
it('generates 48-cell real dungeon stages from island art and declared fixed-level packs; configuration edits alter actual enemies and geometry',()=>{
 const normal=monsterContent.templates.find(t=>t.curve==='starsea'&&!t.bossKey)!,boss=monsterContent.templates.find(t=>t.bossKey)!,base={id:'ss-dg-fixture-first',name:'正式地城生成样本',island:'ss-map-wind',artIsland:'mist',chapter:1,stage:1,seed:41,level:4,safe:{x:5,y:24},portal:{x:42,y:24},pack:[{template:normal.id,rank:'normal',count:4,center:{x:24,y:24},radius:3}],boss:false,backdrop:'ss-scene-sky'},one=generateFieldDungeonStage(base,catalogues),two=generateFieldDungeonStage({...base,seed:73,pack:[{...base.pack[0],count:7}]},catalogues);expect(one.region.width).toBe(48);expect(one.region.spawns).toHaveLength(4);expect(two.region.spawns).toHaveLength(7);expect(two.region.obstacles).not.toEqual(one.region.obstacles);expect(one.region.spawns.every(s=>s.monster?.level===4)).toBe(true);
 const last=generateFieldDungeonStage({...base,id:'ss-dg-fixture-final',stage:2,boss:true,pack:[{template:boss.id,rank:'boss',count:1,center:{x:24,y:24},radius:2}]},catalogues);expect(last.report.bosses).toBe(1);expect(last.region.spawns[0].monster!.template).toBe(boss.id);expect(last.map.groundResource).toBeTruthy();
});
