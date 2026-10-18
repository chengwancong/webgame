import {it,expect} from 'vitest';
import {pressure} from '../tools/spine/world.ts';
import {regionById} from '../packages/content/index.ts';
import type {Spawn} from '../packages/contracts/index.ts';
it('地城压力必须包含终局房间随从，不能仅测首领再把其倍率施加给全场',()=>{
 const region={...regionById('meadow'),width:64,height:64,obstacles:[]},boss:Spawn={id:'boss',name:'压力首领',kind:'melee',x:30,y:24,hp:1e9,attack:1,boss:true,elite:false,art:'raider'},adds=[0,1].map(i=>({...boss,id:'add-'+i,x:31+i,y:24,attack:100,boss:false}));
 const single=pressure(region,[boss]),full=pressure(region,[boss,...adds]);
 expect(single.actors).toBe(1);expect(full.actors).toBe(3);expect(full.rawDps).toBeGreaterThan(single.rawDps*3);expect(full.hits).toBeGreaterThan(single.hits);
});
