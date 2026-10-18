import {it,expect} from 'vitest';
import {World,distance} from '../packages/simulation/index.ts';
import {regionById,type Region} from '../packages/content/index.ts';
import type {Spawn,Stats} from '../packages/contracts/index.ts';
const stats:Stats={hp:100000,attack:0,armor:0,speed:6,mana:100,regen:0,effects:[]};
const region:Region={...regionById('meadow'),width:64,height:64,safe:{x:10,y:10},portal:{x:10,y:10},obstacles:[],spawns:[],aggroRadius:8,activationRadius:40,roam:false};
const spawn=(id:string,x:number,y:number,kind:Spawn['kind']='melee'):Spawn=>({id,x,y,kind,name:id,hp:1000,attack:2,boss:false,elite:false,art:'raider'});
function run(world:World,ticks=450){const hits=new Set<string>();world.setMode('manual');for(let i=0;i<ticks;i++){world.step();for(const event of world.events)if(event.type==='hit_resolved'&&event.id==='hero'&&event.sourceId)hits.add(event.sourceId);}return hits;}

it('lets a rear ordinary monster pass an aligned ally and actually attack the hero',()=>{
 const world=new World(region,stats,[],[spawn('front',11.3,10),spawn('rear',13,10)]);
 const hits=run(world);expect(hits.has('rear'),JSON.stringify(world.enemies.map(e=>({id:e.id,position:e.position,range:distance(e.position,world.hero.position)})))).toBe(true);
 for(const enemy of world.enemies)expect(distance(enemy.position,world.hero.position)).toBeGreaterThanOrEqual(1.1-1e-5);
});
it('routes around terrain that clears the sight line but blocks the full monster body',()=>{
 const map={...region,safe:{x:10,y:11.3},obstacles:[{x:12,y:9.8,w:.2,h:1.2}]},world=new World(map,stats,[],[spawn('corner',14,11.3)]);
 const hits=run(world);expect(hits.has('corner'),JSON.stringify(world.enemies[0].position)).toBe(true);
});
it('repositions for a clear shot instead of repeatedly attacking a wall from inside nominal range',()=>{
 const map={...region,obstacles:[{x:10.8,y:9,w:.2,h:2}]},world=new World(map,stats,[],[spawn('archer',11.8,10,'ranged')]);
 const hits=run(world);expect(hits.has('archer'),JSON.stringify(world.enemies[0].position)).toBe(true);
});
it('lets a pack engage without permanently queuing behind the front monster',()=>{
 const members=Array.from({length:6},(_,i)=>spawn('pack-'+i,11.3+i*1.2,10)),world=new World(region,stats,[],members);
 expect([...run(world,900)].sort(),JSON.stringify(world.enemies.map(e=>({id:e.id,position:e.position,range:distance(e.position,world.hero.position)})))).toEqual(members.map(e=>e.id).sort());
});
it('uses the same clear-shot pursuit when attacking a defense objective',()=>{
 const map={...region,safe:{x:30,y:10},obstacles:[{x:10.8,y:9,w:.2,h:2}]},world=new World(map,stats,[],[spawn('defender-archer',11.8,10,'ranged')]);
 world.defense={position:{x:10,y:10},hp:1000,maxHp:1000,radius:40,requiredTicks:10000,heldTicks:0,enemyIds:['defender-archer'],failed:false,complete:false};
 run(world);expect(world.defense.hp).toBeLessThan(1000);
});
it('keeps root control effective and resumes pursuit when it expires',()=>{
 const world=new World(region,stats,[],[spawn('rooted',15,10)]);world.setMode('manual');
 world.applyStatus('rooted',{kind:'root',duration:60,strength:0,scope:'hit',cleanse:true});
 const start={...world.enemies[0].position};for(let i=0;i<59;i++)world.step();expect(world.enemies[0].position).toEqual(start);
 expect(run(world).has('rooted')).toBe(true);
});
it('keeps explicit targeting, ranged preference and stable ID ordering with overlapping mobs',()=>{
 const world=new World(region,stats,[],[spawn('z',12,10),spawn('a',12,10),spawn('ranged',15,10,'ranged')]);world.setMode('manual');
 expect(world.closest()?.id).toBe('a');world.targetPriority='ranged';expect(world.closest()?.id).toBe('ranged');world.targetId='z';expect(world.closest()?.id).toBe('z');world.enemies[0].alive=false;expect(world.closest()?.id).toBe('ranged');
});
it('restores an ongoing crowded pursuit without changing positions, attacks or random outcomes',()=>{
 const world=new World(region,stats,[],Array.from({length:4},(_,i)=>spawn('resume-'+i,11.3+i*1.2,10)));world.setMode('manual');for(let i=0;i<30;i++)world.step();
 const restored=World.restore(world.exportCheckpoint());
 for(let i=0;i<180;i++){world.step();restored.step();expect(restored.enemies.map(e=>e.position)).toEqual(world.enemies.map(e=>e.position));expect(restored.hero).toEqual(world.hero);expect(restored.events).toEqual(world.events);}
});
