import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {makeGearByBase,resolveBuild,gearBases} from '../packages/rules/index.ts';
import {assignMainStat} from '../packages/rules/main-stats.ts';
import {generateGearAffixes} from '../packages/rules/affix-generator.ts';
import {statDefinition} from '../packages/contracts/stats.ts';
import {affixDisplayValue} from '../packages/contracts/affix-units.ts';
import type {CharacterState,Gear,Stats} from '../packages/contracts/index.ts';
import {effectActionSchema} from '../packages/contracts/effects.ts';
const affix=(stat:string,value:number)=>({id:stat,name:stat,description:stat,tier:3 as const,stat,value});
function state(){const gear=makeGearByBase('blade','00000000-0000-4000-8000-000000000010');const s:CharacterState={id:'review',name:'受控',revision:1,build:1,level:50,xp:0,gold:0,material:0,gear:[gear],equipment:{weapon:gear.id},skills:['cut'],skillRanks:{cut:1},progress:{safe:'town',regions:['town'],bosses:[],tasks:[],kills:0}};return s;}
function world(stats:Stats,skills:ReturnType<typeof resolveBuild>['resolvedSkills']=[]){const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},stats,skills,[{id:'t',name:'靶',kind:'ranged',x:12,y:10,hp:100000,attack:0,elite:false,boss:false,art:'raider'}],[],41);w.setMode('manual');w.enemies[0].cooldown=100000;return w;}
it('reads legacy equipment and stored affixes without granting a new primary or changing values',()=>{
 const s=state();s.gear[0].affixes=[affix('speed',3.7),affix('attack',87)];const before=structuredClone(s.gear);resolveBuild(s);resolveBuild(s);expect(s.gear).toEqual(before);expect(s.gear[0].attributeVersion).toBeUndefined();
});
it('excludes each issued primary and respects secondary slot restrictions across repeated generation',()=>{
 for(const slot of ['helmet','accessory','ring','boots','armor','weapon'] as const){const template=gearBases.find(g=>g.slot===slot)!;expect(template).toBeDefined();for(let seed=0;seed<30;seed++){
  let cursor=seed;const random={int:(min:number,max:number)=>min+(cursor++%(max-min)),float:()=>.5},g=makeGearByBase(template.base,crypto.randomUUID());g.quality='legendary';g.ilvl=50;assignMainStat(g,50,random);const main=g.mainStat?.stat??(g.attack>0?'attack':'armor');
  for(const a of generateGearAffixes(g,3,random)){expect(a.stat).not.toBe(main);expect(statDefinition(a.stat)!.slots).toContain(slot);}
  const issued=structuredClone(g);assignMainStat(g,1,random);expect(g).toEqual(issued);
 }}
});
it('bases chance DOT on the actual direct hit and periodic ticks cannot retrigger it',()=>{
 const s=state();s.gear[0].affixes=[affix('igniteChance',.75)];const b=resolveBuild(s),w=world(b.stats,b.resolvedSkills);w.upperBound=true;expect(w.cast('cut',w.enemies[0])).toBe(true);let dealt=0;for(let i=0;i<5;i++){w.step();dealt+=w.events.filter(e=>e.type==='hit_resolved'&&e.category==='direct').reduce((n,e)=>n+(e.amount??0),0);}
 const dot=w.statuses.find(x=>x.effect.kind==='burn')!;expect(dot).toBeDefined();expect(dot.effect.total).toBe(Math.round(dealt*.3));expect(w.effectStats['stat-igniteChance'].count).toBe(1);
 for(let i=0;i<90;i++)w.step();expect(w.effectStats['stat-igniteChance'].count).toBe(1);
});
it('shows thorns as an armor multiplier and cooldown-on-kill in seconds',()=>{expect(affixDisplayValue('thorns',2)).toBe('×2');expect(affixDisplayValue('cooldownOnKill',.3)).toBe('0.3秒');});
it('applies nonphysical resistance while preserving pure and physical damage',()=>{
 const s=state();s.gear[0].affixes=[affix('allResist',.5)];const b=resolveBuild(s);
 for(const [damageType,expected]of [['fire',50],['physical',100],['pure',100]] as const){const w=world(b.stats),before=w.hero.hp;(w as any).hurt(100,'review',{category:'periodic',damageType,source:'t'});expect(before-w.hero.hp).toBe(expected);}
});
it('healing received increases real recovery without exceeding maximum life',()=>{
 const s=state();s.gear[0].affixes=[affix('healingReceived',.3)];const w=world(resolveBuild(s).stats);w.hero.hp-=100;(w as any).restoreResources(50,0,'review');expect(w.hero.hp).toBe(w.stats.hp-35);(w as any).restoreResources(1000,0,'review');expect(w.hero.hp).toBe(w.stats.hp);
});
it('accepts actual-dealt status budgets without admitting references that their executor does not implement',()=>{
 expect(effectActionSchema.safeParse({type:'status',ref:'dealt',status:'burn',duration:90,strength:0,ratio:.3}).success).toBe(true);
 expect(effectActionSchema.safeParse({type:'status',ref:'maxHp',status:'burn',duration:90,strength:0,ratio:.3}).success).toBe(false);
 expect(effectActionSchema.safeParse({type:'nova',ref:'dealt',ratio:.3,radius:2}).success).toBe(false);
});
