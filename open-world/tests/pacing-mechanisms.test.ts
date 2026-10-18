import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {newAspects,newAspectSchema} from '../packages/content/aspects.ts';
import {createMechanismAspects,mechanismAspectIds} from '../tools/pacing/mechanisms.ts';
import {skillSchema} from '../packages/contracts/index.ts';
const recovery=effectRuleSchema.parse({id:'test-recovery',name:'恢复50%',description:'冷却恢复50%',source:'测试',trigger:'passive',chance:1,icd:0,filter:{},when:[{kind:'self_state',state:'shield'}],action:{type:'buff',duration:30,maxStacks:1,mods:{cooldownRecovery:.5}},scale:[],vfxKey:'player/ward'});
function world(charges=1){const skill=skillSchema.parse({id:'cut',name:'斩击',kind:'single',damage:10,range:2,cost:0,cooldown:300,windup:0,duration:0,radius:0,description:'测试',charges}),w=new World({...regionById('meadow'),spawns:[],obstacles:[]},{hp:1000,attack:10,armor:0,speed:3,mana:100,regen:0,effects:[],rules:[recovery]},[skill],[],[],41);w.setMode('manual');return w;}
it('八套初值均通过内容schema，删除通用注入且新增规则不超过三条',()=>{
 const before=structuredClone(newAspects),next=createMechanismAspects(newAspects);expect(newAspects).toEqual(before);expect(()=>newAspectSchema.array().parse(next)).not.toThrow();
 for(const a of next.filter(a=>mechanismAspectIds.has(a.id))){expect(a.parts.rules.some(r=>r.id.startsWith('pacing-'))).toBe(false);const old=before.find(b=>b.id===a.id)!.parts.rules.filter(r=>!r.id.startsWith('pacing-')).map(r=>r.id);expect(a.parts.rules.filter(r=>!old.includes(r.id)).length).toBeLessThanOrEqual(3);for(const r of a.parts.rules){expect(r.name).not.toMatch(/\d/);if(r.action.type!=='cooldown'||!r.action.reset)expect(r.description).toMatch(/\d/);if(r.trigger==='passive'&&['reduce','amplify','buff'].includes(r.action.type))expect(r.when.length||Object.keys(r.filter).length).toBeGreaterThan(0);}}
});
it('持盾时逐帧恢复剩余冷却，失盾后停止，待命不能储存恢复额度',()=>{
 const w=world();w.hero.shield=100;w.hero.shieldUntil=1000;w.cooldowns.cut=300;for(let i=0;i<60;i++)w.step();expect(w.cooldowns.cut-w.tick).toBe(210);
 w.hero.shield=0;for(let i=0;i<30;i++)w.step();expect(w.cooldowns.cut-w.tick).toBe(180);
 w.cooldowns.cut=0;w.hero.shield=100;for(let i=0;i<100;i++)w.step();expect(w.comboCounts['cooldownRecovery#cut']).toBe(0);
});
it('冷却恢复的零碎帧由检查点保留，复原轨迹相同',()=>{
 const w=world();w.hero.shield=100;w.hero.shieldUntil=1000;w.cooldowns.cut=300;w.step();expect(w.comboCounts['cooldownRecovery#cut']).toBe(.5);const restored=World.restore(w.exportCheckpoint());for(let i=0;i<31;i++){w.step();restored.step();}expect(restored.cooldowns).toEqual(w.cooldowns);expect(restored.comboCounts).toEqual(w.comboCounts);
});
it('充能技能冷却也接受恢复速度，不授予额外充能',()=>{
 const w=world(2);w.hero.shield=100;w.hero.shieldUntil=1000;(w as any).spendCooldown(w.skills[0]);(w as any).spendCooldown(w.skills[0]);for(let i=0;i<60;i++)w.step();expect((w as any).chargeInfo(w.skills[0]).available).toBe(0);expect((w as any).chargeInfo(w.skills[0]).next).toBe(210);
});
it('目标条件被动增益记录实际生效，不因缺少目标上下文漏报或重复计数',()=>{
 const basis=world(),conditional=effectRuleSchema.parse({...recovery,id:'target-buff',when:[{kind:'target_status',statuses:['burn']}],action:{type:'buff',duration:30,maxStacks:1,mods:{damageMult:.2}}}),w=new World(basis.region,{...basis.stats,critChance:0,rules:[conditional]},basis.skills,[{id:'t',name:'目标',kind:'ranged',x:12,y:10,hp:10000,attack:0,elite:false,boss:false,art:'raider'}],[],41);
 (w as any).damage(w.enemies[0],100,true,'probe',{category:'direct',damageType:'pure',scaled:true});expect(w.effectStats['target-buff']).toBeUndefined();
 w.applyStatus('t',{kind:'burn',duration:90,strength:0,scope:'hit',cleanse:true,interval:30,total:30,damageType:'fire'});
 for(let i=0;i<2;i++)(w as any).damage(w.enemies[0],100,true,'probe',{category:'direct',damageType:'pure',scaled:true});expect(w.effectStats['target-buff'].count).toBe(1);expect(w.events.filter(e=>e.type==='hit_resolved').map(e=>e.amount)).toEqual([100,120,120]);
});
