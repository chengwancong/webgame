// 数值来源已迁到 tools/spine；此入口校验并复用主干已应用计划。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {World} from '../packages/simulation/index.ts';
import {regionById,type Region} from '../packages/content/index.ts';
import {starseaBossMaps} from '../packages/content/starsea/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {versions} from '../packages/contracts/index.ts';
import {worldTiersSchema} from '../packages/contracts/open-world.ts';
export function tierFourBasis(level:number,seed=41,templateId?:string){
 const map=regionById(starseaBossMaps.at(-1)!),original=map.spawns.find(s=>s.boss)!;
 if(!original?.monster)throw Error('Missing declared final story boss');
 const chosen=templateId??original.monster.template;
 const region:Region={...map,width:64,height:64,obstacles:[],safe:{x:30,y:30},spawns:[],landmarks:[]},spawn=resolveMonsterSpawn({id:'tier-basis',template:chosen,level,rank:'boss',x:32,y:30}),world=new World(region,{hp:1e12,attack:0,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[spawn],[],seed);world.mode='manual';
 let damage=0,hits=0;for(let i=0;i<900;i++){world.step();for(const e of world.events)if(e.type==='hit_resolved'&&e.id===world.playerId){damage+=e.amount??0;hits++;}}
 if(damage<=0||!hits||world.hero.hp<=0||world.tick!==900)throw Error('Final boss actual damage probe produced no valid complete stationary window');
 return {template:chosen,level,bossHp:spawn.hp,rawDps:damage/30,hits,seed,seconds:30,versions,limitations:[templateId?'Explicit registered field-boss template and explicitly supplied monster level, controlled empty arena.':'Provisional final-story template; this is not a declared stage24 field-dungeon reference.','Fixed empty arena, stationary zero-armor high-HP target; real boss AI/casts/damage, no victory or natural pacing claim.','Baseline measures full-health boss phase; full wall phase win-rate probes remain separate.']};
}
export function deriveEndgameTiers(raw:unknown,target:{bossHp:number;bossDps:number},basis:ReturnType<typeof tierFourBasis>){
 const source=worldTiersSchema.parse(raw),third=source.tiers[2];if(!third)throw Error('Missing tier3');
 const monster={hp:target.bossHp/basis.bossHp,attack:target.bossDps/basis.rawDps};
 const fourth={tier:4,name:'深渊',summary:source.tiers.find(t=>t.tier===4)!.summary,unlock:{kind:'hardmode_bosses' as const,level:50,bosses:[...starseaBossMaps],text:'达到50级并击败六岛裂星潮首领'},monster,reward:{xp:1.8,gold:2.2,material:2.2,gear:2.2},eliteAffixes:[2,3] as [number,number]};
 return worldTiersSchema.parse({...source,source:'docs/open-world-numeric-flow.md §8; tier4 derived from actual boss basis and stage24 wall target',tiers:[...source.tiers.slice(0,3),fourth],growth:{afterTier:4,maxTier:100,name:'深渊',hp:1.10,attack:1.09,reward:1.08}});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {legacySpineEntry}=await import('./spine/legacy.ts');await legacySpineEntry('apply-world-tier-curve');
}
