import {it,expect} from 'vitest';
import {newStarseaState,starseaView,applyStarseaOp} from '../packages/rules/starsea.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {questParameters} from '../packages/content/task-tables.ts';
import {starseaLegacyStateSchema} from '../packages/contracts/starsea.ts';
import type {CharacterState} from '../packages/contracts/index.ts';

const player=():CharacterState=>({id:crypto.randomUUID(),name:'推荐测试',revision:0,build:1,level:3,xp:0,gold:27,material:9,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['ss-map-wind'],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()});
const fallback=()=>{const s=player();s.starsea!.quests={};s.starsea!.tracked=null;s.starsea!.done=['ss-c01-t01'];return s;};
const entrance=worldTables.dungeonEntrances.find(d=>d.region==='ss-map-wind')!;
const dungeon=dungeonContent.definitions.find(d=>d.id===entrance.dungeon)!;
it.each(['v1','v2'] as const)('uses the authored dungeon name for a %s fallback without changing its destination or wealth',version=>{
 const s=fallback();
 if(version==='v1')(s as any).starsea=starseaLegacyStateSchema.parse({version:1,chapter:1,task:0,step:0,attempt:0,wave:null,openingComplete:false,choices:{},done:[],npcs:[],features:[],islands:['ss-map-wind'],bosses:[],hardmode:false,crystals:[]});
 const view=starseaView(s)!;
 expect(view.recommend).toEqual({label:questParameters.recommend_dungeon.replace('{place}',dungeon.name),map:entrance.region,point:entrance,kind:'dungeon'});
 expect(view.recommend!.label).not.toContain(entrance.dungeon);expect(s.starsea!.version).toBe(2);
 expect(s.gold).toBe(27);expect(s.material).toBe(9);expect(s.revision).toBe(0);
 for(const row of worldTables.dungeonEntrances)expect(dungeonContent.definitions.some(d=>d.id===row.dungeon),row.dungeon).toBe(true);
});
it('follows resolved catalogue renames instead of duplicating display text',()=>{
 const name=dungeon.name;
 try{dungeon.name='测试目录名称';expect(starseaView(fallback())!.recommend!.label).toBe(questParameters.recommend_dungeon.replace('{place}',dungeon.name));}
 finally{dungeon.name=name;}
});
it('keeps onboarding and stage guidance ahead of the dungeon fallback',()=>{
 const s=player();expect(starseaView(s)!.recommend!.kind).toBe('onboarding');
 s.level=20;expect(starseaView(s)!.recommend!.kind).toBe('stage');
});
it.each(['v1','v2'] as const)('documents that the %s fallback fixture becomes onboarding on real arrival',version=>{
 const s=fallback();
 if(version==='v1')(s as any).starsea=starseaLegacyStateSchema.parse({version:1,chapter:1,task:0,step:0,attempt:0,wave:null,openingComplete:false,choices:{},done:[],npcs:[],features:[],islands:['ss-map-wind'],bosses:[],hardmode:false,crystals:[]});
 expect(starseaView(s)!.recommend!.kind).toBe('dungeon');
 const before={gold:s.gold,xp:s.xp,material:s.material};
 applyStarseaOp(s,'arrive',{region:'ss-map-wind',position:{x:148,y:167},now:1000});
 const view=starseaView(s)!;
 expect(view.recommend!.kind).toBe('onboarding');
 expect(view.quests.some(q=>q.series==='onboarding')).toBe(true);
 expect({gold:s.gold,xp:s.xp,material:s.material}).toEqual(before);
 // The name fix must not disable authored auto-accept to keep a transient fallback visible.
 expect(view.recommend!.label).not.toContain('field-wind-1');
});
