import {it,expect} from 'vitest';
import {World,type CombatEvent} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import '../packages/content/open-world/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {campSpawns} from '../packages/rules/world-camps.ts';
import {applyEliteAffixes,rollEliteAffixes} from '../packages/rules/elite-affixes.ts';
import {eliteAffixes} from '../packages/content/elite-affixes.ts';
import {spawnSchema,type Stats,type Spawn} from '../packages/contracts/index.ts';

const stats:Stats={hp:5000,attack:20,armor:0,speed:6,mana:100,regen:0,effects:[]};
const region=regionById('ow-graybox-wind'),camp=worldTables.camps.find(c=>c.region===region.id&&c.pack.some(p=>p.rank==='elite'))!;
const elite=()=>campSpawns(region,worldTables,camp,1).find(m=>m.elite)!;
const fight=(spawn:Spawn,offset:number)=>{const w=new World(region,stats,skillCatalog,[spawn],[],11);w.hero.position={x:spawn.x+offset,y:spawn.y};w.setMode('manual');return w;};

it('rolls a stable, distinct affix set within the world tier range and freezes it into the spawn',()=>{
 for(let seed=1;seed<200;seed++){const a=rollEliteAffixes([1,2],seed,'c:1:3');expect(a.length).toBeGreaterThanOrEqual(1);expect(a.length).toBeLessThanOrEqual(2);expect(new Set(a).size).toBe(a.length);expect(rollEliteAffixes([1,2],seed,'c:1:3')).toEqual(a);}
 expect(rollEliteAffixes([2,2],5,'x')).toHaveLength(2);expect(()=>rollEliteAffixes([2,1],5,'x')).toThrow();
 const base=elite(),s=applyEliteAffixes(base,['swift','frost_nova']);
 expect(spawnSchema.parse(s).monster!.affixes).toEqual(['swift','frost_nova']);
 expect(s.monster!.ai.speed).toBeCloseTo(base.monster!.ai.speed*eliteAffixes.swift.speed,2);expect(s.monster!.ai.cooldown).toBeLessThan(base.monster!.ai.cooldown);
 expect(s.monster!.skills[0]).toBe('frost_nova');expect(s.name).toBe('迅捷·冰冻新星 '+base.name);expect(base.monster!.affixes).toBeUndefined();
 // Camp cycles freeze affixes on elites only; normals stay plain.
 const rolled=campSpawns(region,worldTables,camp,1,undefined,{range:[1,1],seed:42});
 expect(rolled.filter(m=>m.elite).every(m=>m.monster!.affixes?.length===1)).toBe(true);expect(rolled.filter(m=>!m.elite).every(m=>!m.monster!.affixes)).toBe(true);
 expect(campSpawns(region,worldTables,camp,1,undefined,{range:[1,1],seed:42})).toEqual(rolled);
});

it('frost nova telegraphs on the caster, then hits and slows a hero still inside the radius',()=>{
 const w=fight(applyEliteAffixes(elite(),['frost_nova']),1),events:CombatEvent[]=[];
 for(let i=0;i<400&&!events.some(e=>e.type==='hit_resolved'&&e.skill==='frost_nova');i++){w.step();events.push(...w.events);}
 const cast=events.find(e=>e.type==='cast_started'&&e.skill==='frost_nova')!;expect(cast).toBeDefined();
 expect(cast.target).toEqual(cast.position);
 expect(events.some(e=>e.type==='hit_resolved'&&e.skill==='frost_nova')).toBe(true);
 expect(events.some(e=>e.type==='status_changed'&&e.status==='slow'&&e.change==='applied'&&e.skill==='frost_nova')).toBe(true);
 // A hero outside the radius never draws the nova (it is not wasted at range).
 const far=fight({...applyEliteAffixes(elite(),['frost_nova']),kind:'ranged'},5),seen:CombatEvent[]=[];
 for(let i=0;i<300;i++){far.step();seen.push(...far.events);}
 expect(seen.some(e=>e.type==='cast_started'&&e.skill==='frost_nova')).toBe(false);
});

it('a shielded elite raises its shield once engaged and drains it before HP',()=>{
 // 独立护盾生命周期夹具保留足够生命，完整验证吸收后10点扣血及第二次起盾，断言不放宽。
 const foe=applyEliteAffixes(elite(),['shielded']);foe.hp=Math.max(100,foe.hp);const w=fight(foe,1),e=w.enemies[0],events:CombatEvent[]=[];
 for(let i=0;i<eliteAffixes.shielded.first+5;i++){w.step();events.push(...w.events);}
 const shield=Math.round(e.maxHp*eliteAffixes.shielded.ratio);
 expect(events.some(x=>x.type==='shielded'&&x.id===e.id&&x.shieldPhase==='applied'&&x.amount===shield)).toBe(true);expect(e.shield).toBe(shield);
 const hp=e.hp;(w as any).damage(e,shield-1,false,undefined,{category:'direct',damageType:'pure'});
 expect(e.hp).toBe(hp);expect(e.shield).toBe(1);
 (w as any).damage(e,11,false,undefined,{category:'direct',damageType:'pure'});expect(e.shield).toBe(0);expect(e.hp).toBe(hp-10);
 // The shield lapses after its duration and returns on the next cycle.
 for(let i=0;i<eliteAffixes.shielded.duration;i++)w.step();expect(e.shield).toBe(0);
 let again=false;for(let i=0;i<eliteAffixes.shielded.every&&!again;i++){w.step();again=w.events.some(x=>x.type==='shielded'&&x.id===e.id&&x.shieldPhase==='applied');}
 expect(again).toBe(true);expect(e.shield).toBe(shield);
});
