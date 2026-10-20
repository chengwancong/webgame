import {expect,it} from 'vitest';
import type {CharacterState} from '../packages/contracts/index.ts';
import {starseaViewSchema} from '../packages/contracts/starsea.ts';
import {newStarseaState,starseaView} from '../packages/rules/starsea.ts';

function viewFor(task:string,step:number){
 const state:CharacterState={id:'fact-view-test',name:'视图验证',revision:0,build:1,level:30,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['ss-map-mist'],bosses:[],safe:'ss-map-mist',tasks:[]},starsea:newStarseaState()};
 state.starsea!.quests={[task]:{step,attempt:0,acceptedAt:1}};
 state.starsea!.tracked=task;
 state.starsea!.trackedManually=true;
 return starseaViewSchema.parse(JSON.parse(JSON.stringify(starseaView(state))));
}

it.each([
 ['ow-mist-side-z1-1',0,'clear_camp'],
 ['ss-c02-n02',1,'gate'],
])('preserves the world fact for %s through the public view schema',(task,index,fact)=>{
 const view=viewFor(task,index);
 expect(view.step).toMatchObject({op:'interact',fact});
 expect(view.quests.find(q=>q.id===task)?.step).toMatchObject({fact});
});

it('keeps ordinary interaction and historical views without a fact compatible',()=>{
 const view=viewFor('ss-c02-t01',0);
 expect(view.step?.op).toBe('interact');
 expect(view.step).not.toHaveProperty('fact');
 expect(starseaViewSchema.parse(view)).toEqual(view);
});
