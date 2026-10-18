import type {StoryChapter,StoryWave} from '../content/story-campaign.ts';
import {storyNpcs} from '../content/story-campaign.ts';
import type {StoryEncounterState,StoryEncounterView,StoryObject,Spawn,Vec} from '../contracts/index.ts';
import {World,distance,walkable,findPath} from './index.ts';
import {lineOfSight} from './navigation.ts';
import {resolveMonsterSpawn} from '../rules/monster-stats.ts';
import type {Region} from '../content/index.ts';
export const newStoryEncounter=():StoryEncounterState=>({phase:0,completed:[],choice:null,heldTicks:0,defendActive:false,spawned:[],announced:-1});
function accessible(w:World,desired:Vec,visibleFrom?:Vec){const start=w.region.safe;for(let r=0;r<10;r++)for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){if(r&&Math.abs(x)!==r&&Math.abs(y)!==r)continue;const p={x:desired.x+x,y:desired.y+y};if(p.x>2&&p.y>2&&p.x<w.region.width-2&&p.y<w.region.height-2&&walkable(w.region,p)&&(!visibleFrom||lineOfSight(w.region,visibleFrom,p))&&findPath(w.region,start,p).length)return p;}throw Error('No accessible story point');}
/** Instance-only clearings keep interaction and combat readable; ordinary maps remain intact. */
export function prepareStoryRegion(original:Region):Region{const region=structuredClone(original),bridge=region.landmarks.find(l=>l.kind==='bridge'),base=bridge??{x:region.safe.x+12,y:region.safe.y+10},centers=[{x:base.x-3,y:base.y-2},{x:base.x+7,y:base.y+4},{x:base.x+12,y:base.y+8}];region.presentationKey='story:'+region.id;region.obstacles=region.obstacles.filter(o=>!centers.some(p=>distance(p,{x:Math.max(o.x,Math.min(o.x+o.w,p.x)),y:Math.max(o.y,Math.min(o.y+o.h,p.y))})<7));return region;}
const positionCache=new WeakMap<World,Record<'clue'|'flank'|'front'|'ally'|'beacon',Vec>>();
export function storyPositions(w:World){const cached=positionCache.get(w);if(cached)return cached;const bridge=w.region.landmarks.find(l=>l.kind==='bridge'),base=bridge??{x:w.region.safe.x+12,y:w.region.safe.y+10};const points={clue:accessible(w,{x:base.x-3,y:base.y-2}),flank:accessible(w,{x:base.x+4,y:base.y-5}),front:accessible(w,{x:base.x-4,y:base.y+5}),ally:accessible(w,{x:base.x+7,y:base.y+4}),beacon:accessible(w,{x:base.x+12,y:base.y+8})};positionCache.set(w,points);return points;}
function waveSpawns(w:World,chapter:StoryChapter,state:StoryEncounterState,waves:StoryWave[],instance:string,point:Vec):Spawn[]{
 const phase=chapter.phases[state.phase],out:Spawn[]=[];let n=0;
 for(const wave of waves){const template=w.region.spawns.find(s=>s.art===wave.art&&!s.elite)??w.region.spawns.find(s=>s.art===wave.art);if(!template)throw Error('Missing story monster '+chapter.id+'/'+wave.art);const ranked=template.monster?resolveMonsterSpawn({id:template.id,x:template.x,y:template.y,template:template.monster.template,level:template.monster.level,rank:wave.elite?'elite':'normal'},w.rules.monsters,template.monster.difficulty):undefined;const stats=ranked??(wave.elite?w.region.spawns.find(s=>s.elite)??template:template);
  for(let i=0;i<wave.count;i++){const a=n*2.3999,p=accessible(w,{x:point.x+Math.cos(a)*(5+n%2),y:point.y+Math.sin(a)*(5+n%2)},point);out.push({...template,...ranked,id:instance+':'+chapter.id+':'+phase.id+':'+n++,name:wave.elite?'首领护卫 · '+template.name:template.name,x:p.x,y:p.y,hp:stats.hp,attack:stats.attack,elite:wave.elite===true,boss:false});}
 }
 return out;
}
function spawnWave(w:World,chapter:StoryChapter,state:StoryEncounterState,instance:string,point:Vec,waves:StoryWave[]){const marker=chapter.phases[state.phase].id;if(state.spawned.includes(marker))return;state.spawned.push(marker);w.addSpawns(waveSpawns(w,chapter,state,waves,instance,point));}
function enterPhase(w:World,chapter:StoryChapter,state:StoryEncounterState,instance:string){const phase=chapter.phases[state.phase];if(phase?.kind==='battle'){const points=storyPositions(w),waves=phase.waves??chapter.routes.find(r=>r.id===state.choice)!.waves;spawnWave(w,chapter,state,instance,(phase.spawnAt??(phase.id==='ambush'?'clue':'ally'))==='clue'?points.clue:points.ally,waves);}}
function advance(w:World,chapter:StoryChapter,state:StoryEncounterState,instance:string){const phase=chapter.phases[state.phase];if(!phase)return;state.completed.push(phase.id);state.phase++;state.heldTicks=0;state.defendActive=false;enterPhase(w,chapter,state,instance);return phase.id;}
export function storyObjects(w:World,chapter:StoryChapter,state:StoryEncounterState):StoryObject[]{
 const phase=chapter.phases[state.phase],p=storyPositions(w),npc=storyNpcs.find(n=>n.id===chapter.ally)!;
 const object=(id:string,name:string,kind:StoryObject['kind'],position:Vec,label:string,npcId?:string):StoryObject=>({id,name,kind,position,npcId,enabled:true,label,reason:''});
 const clue=chapter.phases.find(x=>x.kind==='investigate')??chapter.phases[0];const past:StoryObject[]=state.completed.includes(clue.id)?[{...object('clue',clue.title,'clue',p.clue,'已调查'),enabled:false,reason:'线索已记录'}]:[];
 if(!phase)return [...past,{...object('beacon',chapter.phases.at(-1)!.title,'beacon',p.beacon,'归途已点亮'),enabled:false,reason:'守护已经完成'}];
 if(phase.kind==='investigate')return [object('clue',phase.title,'clue',p.clue,'调查线索')];
 if(phase.kind==='choice')return [...past,...chapter.routes.map(r=>object(r.id,r.name,'route',p[r.id as 'flank'|'front'],r.name))];
 if(phase.kind==='battle'&&(phase.allyLocked??phase.id==='guards'))return [...past,{...object('ally',npc.name,'npc',p.ally,'清除守卫后救援',npc.id),enabled:false,reason:'周围仍有守卫'}];
 if(phase.kind==='rescue')return [...past,object('ally',npc.name,'npc',p.ally,'救援并交谈',npc.id)];
 if(phase.kind==='defend'){const player=[...w.players.values()].find(p=>p.active&&p.hero.hp>0),follow=player?{x:player.hero.position.x+.8,y:player.hero.position.y+.8}:p.ally;return [...past,{...object('ally',npc.name,'npc',walkable(w.region,follow)?follow:p.ally,'同伴跟随',npc.id),enabled:false,reason:'同伴正在等待路碑点亮'},object('beacon',phase.title,'beacon',p.beacon,state.defendActive?'守住范围':'启动守护')];}
 return past;
}
export function interactStory(w:World,chapter:StoryChapter,state:StoryEncounterState,instance:string,player:string,target:string){
 const actor=w.players.get(player),object=storyObjects(w,chapter,state).find(o=>o.id===target);if(!actor?.active||!actor.connected||actor.hero.hp<=0||!object?.enabled)throw Error('当前目标尚不能交互。');
 if(distance(actor.hero.position,object.position)>2.8||!lineOfSight(w.region,actor.hero.position,object.position))throw Error('请靠近目标并保持视线畅通。');
 const phase=chapter.phases[state.phase];if(phase.kind==='defend'){if(!state.defendActive){state.defendActive=true;spawnWave(w,chapter,state,instance,object.position,phase.waves!);}return;}
 if(phase.kind==='choice')state.choice=target;
 return advance(w,chapter,state,instance);
}
export function stepStory(w:World,chapter:StoryChapter,state:StoryEncounterState,instance:string){const phase=chapter.phases[state.phase];if(!phase)return;
 if(phase.kind==='battle'&&!w.enemies.some(e=>e.alive))return advance(w,chapter,state,instance);
 if(phase.kind==='defend'&&state.defendActive){const center=storyPositions(w).beacon,guarded=[...w.players.values()].some(p=>p.active&&p.connected&&p.hero.hp>0&&distance(p.hero.position,center)<=4),contested=w.enemies.some(e=>e.alive&&distance(e.position,center)<=4);
  if(guarded&&!contested)state.heldTicks++;if(state.heldTicks>=(phase.seconds??15)*w.rules.settings.tickRate&&!w.enemies.some(e=>e.alive))return advance(w,chapter,state,instance);
 }
}
export function storyEncounterView(w:World,chapter:StoryChapter,state:StoryEncounterState,bossStage=false):StoryEncounterView{const phase=chapter.phases[state.phase],center=bossStage?w.region.safe:storyPositions(w).beacon;return {chapter:chapter.id,title:chapter.title,phase:bossStage?'boss':phase?.id??'checkpoint',objective:bossStage?'击败'+w.enemies.find(e=>e.boss)?.name:phase?.objective??chapter.readyObjective??'准备进入首领结界',speaker:bossStage?chapter.bossSpeaker??'远行者':phase?.speaker??chapter.readySpeaker??'同伴',line:bossStage?chapter.bossLine??'这一次，必须带着所有人回去。':phase?.line??chapter.readyLine??'路已经亮起来了，最后的结界还需要你来打开。',objects:bossStage?[]:storyObjects(w,chapter,state),completed:[...state.completed],choice:state.choice,heldTicks:state.heldTicks,requiredTicks:(phase?.seconds??0)*w.rules.settings.tickRate,readyForBoss:state.phase>=chapter.phases.length,defendActive:state.defendActive,contested:state.defendActive&&w.enemies.some(e=>e.alive&&distance(e.position,center)<=4)};}
