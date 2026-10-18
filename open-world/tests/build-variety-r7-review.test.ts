import {it,expect} from 'vitest';
import {augmentById} from '../packages/content/augments.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
const orbit=()=>structuredClone(augmentById.get('aug-p-orbit')!.parts.rules[0]);
const world=()=>{const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{weapon:'wand',hp:1000,attack:100,armor:0,mana:100,speed:6,regen:0,effects:[],critChance:1,critMultiplier:2,lifesteal:1,rules:[orbit()]},[],[{id:'orbit-target',name:'星环靶',kind:'ranged',x:12.5,y:10,hp:1000000,attack:0,boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.hero.hp=100;w.enemies[0].cooldown=100000;w.applyStatus('orbit-target',{kind:'root',duration:100000,strength:0,scope:'hit',cleanse:true});return w;};
it('constant orbit fields deal the declared derived budget without granting direct-hit crit or lifesteal',()=>{
 const w=world(),events:typeof w.events=[];for(let i=0;i<100;i++){w.step();events.push(...w.events);}
 expect(w.projectiles).toHaveLength(3);const hits=events.filter(e=>e.type==='hit_resolved'&&e.ruleId==='aug-p-orbit'&&e.id==='orbit-target');expect(hits.length).toBeGreaterThan(0);
 expect(hits.every(e=>e.category==='derived'&&e.amount===80&&!e.crit)).toBe(true);expect(w.hero.hp).toBe(100);
});
it('orbit angles and independent contact timers survive a real checkpoint without starting a new field',()=>{
 const w=world();for(let i=0;i<95;i++)w.step();const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));
 for(let i=0;i<20;i++){w.step();restored.step();expect(restored.exportCheckpoint()).toEqual(w.exportCheckpoint());}
});
it('rejects orbit-only counts or unsupported anchors and modifiers instead of accepting ignored fields',()=>{
 const rule=orbit();expect(effectRuleSchema.safeParse({...rule,action:{...rule.action,orbit:false,projectiles:3}}).success).toBe(false);
 expect(effectRuleSchema.safeParse({...rule,action:{...rule.action,at:'target'}}).success).toBe(false);
 expect(effectRuleSchema.safeParse({...rule,action:{...rule.action,pull:2}}).success).toBe(false);
 expect(effectRuleSchema.safeParse({...rule,action:{...rule.action,statuses:['burn']}}).success).toBe(false);
});
it('rejects ambiguous double phase tables or an absolute modifier missing from a phase',()=>{
 const coin=structuredClone(augmentById.get('aug-p-coin')!.parts.rules[0]);expect(effectRuleSchema.safeParse({...coin,action:{...coin.action,variants:[{mods:{critChance:1},when:[]},{mods:{critChance:0},when:[]}]}}).success).toBe(false);
 expect(effectRuleSchema.safeParse({...coin,action:{...coin.action,alternate:[{critChance:1},{}]}}).success).toBe(false);
 expect(effectRuleSchema.safeParse(coin).success).toBe(true);
});
