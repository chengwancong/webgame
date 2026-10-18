import {it,expect} from 'vitest';
import {assembleBuildVariety,buildVarietyProfiles} from '../tools/build-variety-builds.ts';
import {World,distance} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
it('an orbit-primary auto build closes to its real radius and hits a distant stationary ranged enemy',()=>{
 const b=assembleBuildVariety(buildVarietyProfiles.find(p=>p.id==='blades')!),s=b.build.skills[0],w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},b.build.stats,[s],[{id:'orbit-auto-target',name:'远处靶',kind:'ranged',x:15,y:10,hp:100000000,attack:0,boss:false,elite:false,art:'raider'}],[],41);w.enemies[0].cooldown=100000;w.applyStatus(w.enemies[0].id,{kind:'root',duration:100000,strength:0,scope:'hit',cleanse:true});w.setMode('auto');let hits=0;for(let i=0;i<450;i++){w.step();hits+=w.events.filter(e=>e.type==='hit_resolved'&&e.id==='orbit-auto-target'&&e.skill==='throwing_knife').length;}
 expect(hits).toBeGreaterThan(0);expect(distance(w.hero.position,w.enemies[0].position)).toBeLessThan(s.mechanics!.projectile!.orbit!.radius);expect((w as any).autoAttackStopRange()).toBeCloseTo(s.mechanics!.projectile!.orbit!.radius-.4);
});
