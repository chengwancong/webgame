import {createHash} from 'node:crypto';
// 全参数与全帧原样参与比较；大体积原始轨迹留本地，入库固定SHA256期望。
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
import {combatOutcomeEvents} from './fixtures/combat-outcome-events.ts';
import {it,expect} from 'vitest';
import before from './fixtures/build-variety-rs/poison-before.json';
import golden from './fixtures/numeric-spine/poison-summary.json';
import visuals from './fixtures/build-variety-rs/visuals-before.json';
import {World,type CombatEvent} from '../packages/simulation/index.ts';
import {skillCatalog,type Region} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {skillCoefficientBase} from '../packages/rules/damage-zones.ts';
import {skillTags} from '../packages/content/skill-tags.ts';
import {skillSourceClip,skillProjectileClip} from '../apps/web/src/skill-fx-layout.ts';
import {vfxProfile} from '../apps/web/src/vfx-profiles.ts';
import type {CharacterState,Skill,Stats} from '../packages/contracts/index.ts';

const cases=[['frost_blade','cold','slow'],['thunder_dash','lightning','shock'],['magma_slam','fire','burn'],['venom_cleave','poison','poison'],['frost_quake','cold','slow'],['fire_arrow','fire','burn'],['thunder_arrow','lightning','shock'],['night_volley','shadow','blind'],['toxic_bomb','poison','poison'],['shadow_blade','shadow',''],['night_veil','shadow','blind'],['static_field','lightning','shock'],['dark_grasp','shadow','fear'],['miasma','poison','poison']] as const;
function resolved(id:string,level=50,rank=1){const s:CharacterState={id:'fixture',name:'受控授予',level,revision:1,build:1,xp:0,gold:10000,material:0,gear:[],equipment:{},skills:[id],skillRanks:{[id]:rank},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};const b=resolveBuild(s);return {stats:b.stats,skill:b.skillAccess.find(k=>k.id===id)!.current!};}
function makeWorld(skill:Skill,stats:Stats,kind:'ranged'|'melee'='melee'){const w=new World(before.region as Region,{...stats,weapon:undefined,hp:100000,mana:10000,regen:0,critChance:0,lifesteal:0},[skill],[{id:'target',name:'靶',x:12,y:10,hp:1000000,attack:0,kind,boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.enemies.forEach(e=>e.cooldown=100000);return w;}
function step(w:World,n:number){const events:CombatEvent[]=[];for(let i=0;i<n;i++){w.step();events.push(...w.events);}return events;}

it.each(before.rows)('current $id L$level/rank$rank matches versioned parameters and frame-by-frame events',sample=>{
 const {stats,skill}=resolved(sample.id,sample.level,sample.rank);expect(digest(skill)).toBe(golden.find(g=>g.id===sample.id&&g.level===sample.level&&g.rank===sample.rank)!.skill);
 const w=new World(before.region as Region,{...stats,weapon:undefined,hp:100000,mana:10000,regen:0,critChance:.2,lifesteal:.1},[skill],[{id:'target',name:'靶',x:12,y:10,hp:1000000,attack:0,kind:'ranged',boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.enemies.forEach(e=>e.cooldown=100000);expect(w.cast(sample.id)).toBe(true);
 const events=step(w,before.ticks).filter(e=>['cast_started','cast_released','hit_resolved','status_applied','status_expired'].includes(e.type));expect(digest(combatOutcomeEvents(events))).toBe(golden.find(g=>g.id===sample.id&&g.level===sample.level&&g.rank===sample.rank)!.events);
});
it('retains historical material slots while dedicated motifs evolve',()=>{
 for(const old of visuals){const s=skillCatalog.find(s=>s.id===old.id)!;expect(skillSourceClip(s)).toBe(old.source);expect(skillProjectileClip(s)).toBe(old.projectile);const {sourceClip,projectileClip,motif,...profile}=vfxProfile('player/'+s.id);const {motif:oldMotif,...oldProfile}=old.profile;expect(JSON.parse(JSON.stringify(profile))).toEqual(oldProfile);}
 expect(skillCatalog).toHaveLength(83);
});
it.each(cases)('%s pays once, hits, applies its configured status and derives the correct element tag',(id,type,status)=>{
 const {stats,skill}=resolved(id),w=makeWorld(skill,stats),mana=w.hero.mana;expect(w.cast(id)).toBe(true);const events=step(w,240),hits=events.filter(e=>e.type==='hit_resolved'&&e.skill===id&&e.id==='target');expect(hits.length).toBeGreaterThan(0);expect(hits.some(e=>e.damageType===type&&e.amount!>0)).toBe(true);
 if(status)expect(events.some(e=>e.type==='status_changed'&&e.change==='applied'&&e.status===status&&e.id==='target')).toBe(true);
 expect(events.filter(e=>e.type==='cast_started'&&e.skill===id)).toHaveLength(1);expect(w.hero.mana).toBe(mana-skill.cost);
 expect(skillTags(skill)).toContain(type);expect(vfxProfile('player/'+id)).toBeDefined();
});
it.each([['miasma',6],['toxic_bomb',8]] as const)('%s applies the configured extra poison budget on contact, then deals exactly that budget after exit',(id,total)=>{
 const {stats,skill}=resolved(id,20),raw=skillCatalog.find(s=>s.id===id)!,scale=stats.attack/skillCoefficientBase*(1+(stats.damageAdd??0))*(stats.damageMult??1);
 expect(skill.mechanics!.statuses.find(s=>s.kind==='poison')!.total).toBe(Math.round(total*scale));
 const w=makeWorld(skill,stats);expect(w.cast(id)).toBe(true);let applied=false;
 for(let i=0;i<100;i++){w.step();if(w.events.some(e=>e.type==='status_changed'&&e.change==='applied'&&e.status==='poison')){applied=true;break;}}
 expect(applied).toBe(true);expect(w.tick).toBeGreaterThanOrEqual(skill.windup+29);const active=w.statuses.find(s=>s.effect.kind==='poison')!;expect(active.effect.total).toBe(Math.round(total*scale));
 // Leaving the cloud ends refreshes; its remaining single-application budget is independent of zone damage.
 w.zones=[];const dot=step(w,100).filter(e=>e.type==='hit_resolved'&&e.skill===id&&e.id==='target');expect(dot).toHaveLength(3);expect(dot.reduce((n,e)=>n+e.amount!,0)).toBe(Math.round(total*scale));
 expect(raw.mechanics!.statuses.find(s=>s.kind==='poison')!.total).toBe(total);
});
it('venom cleave resolves to 18 direct plus 18 poison at coefficient attack 30',()=>{
 const raw=structuredClone(skillCatalog.find(s=>s.id==='venom_cleave')!),w=makeWorld(raw,{hp:1000,attack:30,armor:0,speed:6,mana:1000,regen:0,effects:[]});w.cast(raw.id);const hits=step(w,120).filter(e=>e.type==='hit_resolved'&&e.skill===raw.id&&e.id==='target');expect(hits.filter(e=>e.category==='direct').reduce((n,e)=>n+e.amount!,0)).toBe(18);expect(hits.filter(e=>e.category==='periodic').reduce((n,e)=>n+e.amount!,0)).toBe(18);
});
