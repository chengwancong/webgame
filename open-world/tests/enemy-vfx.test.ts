import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {warningPhase,enemyPresentation,enemyFlightStyles,castVfxGroup} from '../apps/web/src/enemy-vfx-style.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {enemyCircleWarning} from '../apps/web/src/enemy-vfx-drawing.ts';
import {resolvedToken} from '../apps/web/src/ui/tokens.ts';
const world=(art:string,kind:'ranged'|'shaman'='ranged')=>{const w=new World({...regionById('meadow'),safe:{x:12,y:12},obstacles:[]},{hp:10000,attack:0,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[{id:'enemy',name:'enemy',x:20,y:12,art,kind,hp:10000,attack:12,boss:false,elite:false}],[],1);w.mode='manual';w.enemies[0].cooldown=0;return w;};
it('associates ordinary arrow launch and actual collision to the same source and instance',()=>{
 const w=world('archer');w.step();const release=w.events.find(e=>e.type==='cast_released')!,p=w.projectiles[0];expect(release.tick).toBe(1);expect(p.castId).toBe(release.castId);expect(p.sourceId).toBe('enemy');
 let hit;for(let i=0;i<30&&!hit;i++){w.step();hit=w.events.find(e=>e.type==='hit_resolved');}
 expect(hit?.castId).toBe(release.castId);expect(hit?.sourceId).toBe('enemy');expect(hit?.contact).toBeDefined();expect(w.hero.hp).toBe(9988);
});
it('keeps one continuous warning clock across monster windup and armed delay, with pause preserving impact time',()=>{
 const w=world('ice_elemental','shaman');w.step();const cast=w.events.find(e=>e.type==='cast_started')!,expected=cast.tick+cast.windup!+25-1;
 while(!w.zones.length)w.step();const z=w.zones[0];expect(z.castId).toBe(cast.castId);expect(w.tick+z.delay).toBe(expected);const before=warningPhase(w.tick,cast.tick,expected);w.paused=true;for(let i=0;i<20;i++)w.step();expect(warningPhase(w.tick,cast.tick,w.tick+z.delay)).toEqual(before);w.paused=false;
 let hit;while(w.tick<=expected&&!hit){w.step();hit=w.events.find(e=>e.type==='hit_resolved');}expect(hit?.tick).toBe(expected);expect(hit?.castId).toBe(cast.castId);
});
it('keeps ordinary danger ownership and separates visual spell families without assigning combat attributes',()=>{
 const w=world('caster','shaman');w.step();const z=w.zones[0];expect(z.sourceId).toBe('enemy');expect(z.vfxKey).toBe('monster/basic-area');expect(z.damage).toBe(12);expect(z.radius).toBe(2.3);
 const p=enemyPresentation(vfxProfiles[z.vfxKey!],w.enemies[0]);expect(p.element).toBe('shadow');expect(p.motif).toBe('ritual');expect(enemyFlightStyles['monster/bone_spear'].body).toBe('bone');expect(enemyFlightStyles['monster/ice_arrow'].body).toBe('ice');
});
it('makes urgency depend on actual remaining ticks and clamps completed warning motion',()=>{
 expect(warningPhase(92,10,100)).toMatchObject({urgent:true,remaining:8});expect(warningPhase(50,10,100).urgent).toBe(false);expect(warningPhase(120,10,100)).toMatchObject({progress:1,remaining:0});expect(warningPhase(5,10,100).progress).toBe(0);
});
it('does not reuse a boss trap timer for a later ordinary attack with the same local number',()=>{
 const owner={id:'boss',sourceId:'boss',castId:1};expect(castVfxGroup({...owner,vfxKey:'boss/ice_prison'})).not.toBe(castVfxGroup({...owner,vfxKey:'boss/basic-area'}));
 expect(castVfxGroup({...owner,vfxKey:'boss/ice_prison'})).toBe(castVfxGroup({id:200,sourceId:'boss',castId:1,vfxKey:'boss/ice_prison'}));
});
it('never sends overflowing alpha to the GPU or loses the threat edge during urgent pulses',()=>{
 const strokes:{color:number;alpha:number}[]=[],g:any={lineStyle(_width:number,color:number,alpha:number){strokes.push({color,alpha});return this;}};
 for(const method of ['fillStyle','fillEllipse','beginPath','moveTo','lineTo','closePath','strokePath','fillPath','fillCircle'])g[method]=()=>g;
 const edge=parseInt(resolvedToken('Color.Combat.WarningEdge').slice(1),16);
 for(let clock=0;clock<30;clock+=.25){strokes.length=0;enemyCircleWarning(g,{x:0,y:0},3,clock,0,25,vfxProfiles['monster/basic-area'],false);expect(strokes.every(s=>s.alpha>=0&&s.alpha<=1)).toBe(true);expect(Math.max(...strokes.filter(s=>s.color===edge).map(s=>s.alpha))).toBeGreaterThanOrEqual(.85);}
});
it('tags real destruction-breath damage as a boss hit instead of a nonexistent player skill',()=>{
 const w=world('dragon_king');w.enemies[0].boss=true;w.enemies[0].hp=2000;for(const skill of ['claw_swipe','flame_breath','tail_slam','dive_bomb','fire_rain','summon_whelps','dragon_roar'])w.enemies[0].skillCooldowns!.set(skill,999999);
 let hit;for(let i=0;i<300&&!hit;i++){w.step();hit=w.events.find(e=>e.type==='hit_resolved'&&e.skill==='ultimate');}
 expect(hit?.vfxKey).toBe('boss/ultimate');expect(hit?.sourceId).toBe('enemy');expect(hit?.castId).toBeDefined();expect(hit?.amount).toBe(48);
});
