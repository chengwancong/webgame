import {it,expect} from 'vitest';
import {makeGearByBase,resolveBuild} from '../packages/rules/index.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
function build(tier:number){const pieces=[...['weapon','armor','helmet','boots'].map(p=>makeGearByBase(`standard-axe-t${tier}-${p}`,crypto.randomUUID())),...['necklace','ring'].map(p=>makeGearByBase(`omega-axe-t${tier}-${p}`,crypto.randomUUID()))];const state:CharacterState={id:'review',name:'狂骨吸血复核',revision:1,build:1,level:50,xp:0,gold:0,material:0,gear:pieces,equipment:Object.fromEntries(pieces.map(p=>[p.slot,p.id])),skills:['rampage'],skillRanks:{rampage:1},progress:{safe:'town',regions:['town'],bosses:[],tasks:[],kills:0}};return resolveBuild(state);}
it.each([{tier:1,hpRatio:.2,multiplier:2},{tier:1,hpRatio:.5,multiplier:1},{tier:3,hpRatio:.2,multiplier:2.5}])('actual lifesteal consumes set conditional at art T$tier and HP $hpRatio',({tier,hpRatio,multiplier})=>{
 const b=build(tier),w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},b.stats,b.resolvedSkills,[{id:'t',name:'靶',kind:'ranged',x:12,y:10,hp:1000000,attack:0,boss:false,elite:false,art:'raider'}]);w.setMode('manual');w.hero.hp=w.stats.hp*hpRatio;const before=w.hero.hp;(w as any).damage(w.enemies[0],100,false,'rampage',{category:'direct',damageType:'physical',skill:w.skills[0],scaled:true});const dealt=w.events.find(e=>e.type==='hit_resolved'&&e.id==='t')!.amount!;expect(dealt).toBeGreaterThan(0);expect(w.hero.hp-before).toBeCloseTo(dealt*(b.stats.lifesteal??0)*multiplier);expect(b.stats.conditional!.find(c=>c.stat==='lifestealMultiplier')!.value).toBe(tier===3?2.5:2);
});
