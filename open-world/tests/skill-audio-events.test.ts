import {test,expect} from 'vitest';
import {statusEffectSchema} from '../packages/contracts/skill-mechanics.ts';
import {World} from '../packages/simulation/index.ts';
import {skillCatalog,regionById} from '../packages/content/index.ts';
import {CombatSoundEvents} from '../apps/web/src/audio/combat-sound-events.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {soundProfiles} from '../apps/web/src/audio/sound-profiles.ts';
test('each actual player cast carries the matching sound and visual key',()=>{
 for(const s of skillCatalog){const w=new World({...regionById('meadow'),safe:{x:12,y:12},obstacles:[],landmarks:[]},{hp:10000,attack:20,armor:5,speed:6,mana:10000,regen:0,effects:[]},[s],[{id:'one',name:'one',x:13.5,y:12,kind:'ranged',art:'raider',hp:100000,attack:0,boss:false,elite:false}],[],41);w.mode='manual';w.enemies[0].cooldown=999999;if(s.kind==='heal')w.hero.hp=5000;
  if(s.mechanics?.cleanse)w.applyStatus(w.playerId,statusEffectSchema.parse({kind:'slow',duration:120,strength:.3,scope:'hit',cleanse:true}),'one','frost_bolt');
  expect(w.cast(s.id,w.enemies[0],s.mechanics?.targeting==='direction'?{x:12,y:12+Math.min(3,s.range)}:undefined),s.id+':'+w.lastCastFailure).toBe(true);const router=new CombatSoundEvents(),calls=[],keys=[];for(let n=0;n<120;n++){w.step();calls.push(...router.consume(w));keys.push(...w.events.filter(e=>e.type==='cast_started'||e.type==='cast_released').map(e=>e.vfxKey));}
  const key='player/'+s.id;expect(keys,s.id).toContain(key);expect(calls.map(c=>c.key),s.id).toContain(key);expect(vfxProfiles[key]).toBeDefined();expect(soundProfiles[key]).toBeDefined();
 }
});
