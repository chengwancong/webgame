import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import '../packages/content/open-world/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import type {Stats,Spawn} from '../packages/contracts/index.ts';

const stats:Stats={hp:300,attack:20,armor:4,speed:6,mana:100,regen:10,effects:[]};
const region=regionById('ow-graybox-wind'),z1=worldTables.zones.find(z=>z.id==='m0-wind-z1')!,w1=worldTables.waypoints.find(w=>w.id==='m0-wind-w1')!;
const foe=(id:string,x:number,y:number):Spawn=>({id,kind:'melee',name:id,x,y,hp:50,attack:2,elite:false,boss:false,art:'raider'});
const auto=(spawns:Spawn[],next:()=>{x:number;y:number}|undefined)=>{const w=new World(region,stats,skillCatalog,spawns,[],7);w.hero.position={x:w1.x,y:w1.y};w.setMode('auto');w.roamGuide={bounds:z1.rect,next,emptyReason:'本区营地刷新中'};return w;};

it('never roams out of the zone and stops with 本区营地刷新中 when its camps are all empty',()=>{
 // Only an enemy in the next zone: auto does not chase it.
 const outside=foe('far',z1.rect.x+z1.rect.w+20,w1.y),w=auto([outside],()=>undefined);
 for(let i=0;i<30;i++)w.step();
 expect(w.mode).toBe('semi');expect(w.stopReason).toBe('本区营地刷新中');expect(w.hero.position.x).toBeLessThan(z1.rect.x+z1.rect.w);
});

it('walks to the next not-yet-empty camp of the zone, then fights what is alive inside',()=>{
 const camp={x:w1.x+30,y:w1.y+20},w=auto([],()=>camp);
 for(let i=0;i<10;i++)w.step();
 expect(w.mode).toBe('auto');expect(w.anchor).toEqual(camp);
 const inside=auto([foe('near',w1.x+40,w1.y)],()=>undefined);inside.step();
 expect(inside.mode).toBe('auto');expect(inside.anchor).toEqual({x:w1.x+40,y:w1.y});
});

it('aims ground areas at the densest cluster (≥ 3 hits), not at the nearest single enemy',()=>{
 const ember=skillCatalog.find(s=>s.id==='ember')!,h={x:w1.x,y:w1.y};
 const lone=foe('lone',h.x+2,h.y),pack=[0,1,2,3].map(i=>foe('pack'+i,h.x-6+(i%2)*.8,h.y+(i>1?.8:0)));
 const w=new World(region,{...stats,mana:500},[ember],[lone,...pack],[],7);w.hero.position={...h};w.setMode('auto');
 const spot=w.densestSpot(ember.range,ember.radius)!;expect(spot.hits).toBe(4);expect(Math.hypot(spot.point.x-lone.x,spot.point.y-lone.y)).toBeGreaterThan(5);
 // Two enemies only: no cluster worth an area, the old nearest-target behaviour stays.
 const pair=new World(region,stats,[ember],[lone,foe('two',h.x+3,h.y)],[],7);pair.hero.position={...h};expect(pair.densestSpot(ember.range,ember.radius)!.hits).toBe(2);
});
