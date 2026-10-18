import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {getBossDefinition} from '../packages/content/chapter-combat.ts';
import {blizzardSnow} from '../apps/web/src/blizzard-vfx.ts';
import {isolatePreviewBoss,enemyPreviewDuration} from '../apps/web/src/enemy-preview-scenario.ts';
import {projectFx} from '../apps/web/src/skill-fx-layout.ts';
it('shows the complete real blizzard with no fallback arrows in its preview',()=>{
 const w=new World({...regionById('meadow'),safe:{x:12,y:12},obstacles:[]},{hp:10000,attack:0,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[{id:'queen',name:'queen',x:20,y:12,art:'frost_queen',kind:'shaman',hp:10000,attack:12,boss:true,elite:false}],[],1);
 w.mode='manual';for(const s of getBossDefinition('frost_queen')!.skills)if(s.id!=='blizzard')w.enemies[0].skillCooldowns!.set(s.id,999999);
 let started=0,active=0,hits=0;for(let i=0;i<enemyPreviewDuration('frost');i++){isolatePreviewBoss(w);w.step();expect(w.projectiles).toHaveLength(0);if(w.zones.some(z=>z.skill==='blizzard')){started||=w.tick;active++;}hits+=w.events.filter(e=>e.type==='hit_resolved'&&e.skill==='blizzard').length;}
 expect(started).toBe(120);expect(active).toBe(149);expect(hits).toBe(5);expect(enemyPreviewDuration('frost')).toBeGreaterThan(started+150);
});
it('drops snow from above onto landing points inside the actual projected circle',()=>{
 const center={x:12,y:12},radius=6,c=projectFx(center),first=blizzardSnow(center,radius,0,31,54),next=blizzardSnow(center,radius,.1,31,54);
 for(let i=0;i<first.length;i++){const s=first[i],dx=s.ground.x-c.x,dy=s.ground.y-c.y,worldX=dx/64+dy/36,worldY=dy/36-dx/64;expect(Math.hypot(worldX,worldY)).toBeLessThan(radius);expect(s.position.y).toBeLessThan(s.ground.y);if(s.phase<.7)expect(next[i].position.y).toBeGreaterThan(s.position.y);}
 expect(blizzardSnow(center,radius,0,31,8,true)).toEqual(blizzardSnow(center,radius,100,31,8,true));
});
