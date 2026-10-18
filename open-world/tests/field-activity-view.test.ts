import {it,expect,vi} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {fieldActivityView,type FieldActivity} from '../apps/api/src/field-activities.ts';
it('reads authoritative HUD counters without reconstructing combat and keeps the checkpoint intact',()=>{
 const world=new World(regionById('meadow'),{hp:100,attack:1,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[],[],1);
 world.defense={position:{x:5,y:5},hp:73,maxHp:100,radius:10,requiredTicks:300,heldTicks:30,enemyIds:[],failed:false,complete:false};
 const battle=world.exportCheckpoint(),data={instance:'test',kind:'event',status:'running',target:'target',region:world.region.id,name:'test',position:{x:5,y:5},tick:30,waves:1,waveCount:3,startedAt:0,cooldownUntil:0,reason:'',definition:{durationSeconds:90},battle,renderEvents:[{type:'healed',tick:30,id:'hero',position:{x:5,y:5}}]} as FieldActivity;
 const restore=vi.spyOn(World,'restore');
 try{const view=fieldActivityView(data,1000);expect(restore).not.toHaveBeenCalled();expect(view).toMatchObject({objectiveHp:73,objectiveMaxHp:100,total:0,killed:0,remainingSeconds:89});expect((view.battle as typeof battle).data.events).toEqual(data.renderEvents);expect(battle.data.events).toEqual([]);expect(fieldActivityView(data,1000,false).battle).toBeUndefined();}
 finally{restore.mockRestore();}
});
