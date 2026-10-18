import {productionRecipe} from './production-recipes.ts';
import {SoundMixer} from './mixer.ts';
export type MusicState='exploration'|'combat'|'boss';
/** 无已授权音乐时URL保持空；仍运行相同的淡入淡出与脱战防抖。 */
export class MusicStateMachine{state:MusicState='exploration';private lastCombat=-Infinity;update(now:number,fighting:boolean,boss:boolean){if(fighting)this.lastCombat=now;const next=boss?'boss':fighting||now-this.lastCombat<6?'combat':'exploration';const seconds=next==='boss'?1.5:next==='combat'?2:4;const changed=next!==this.state;this.state=next;return {state:next,seconds,changed,url:undefined as string|undefined};}}
export class EnvironmentAudio{
 private region='';private nextDetail=0;private serial=0;private fixed=new Set<string>();readonly music=new MusicStateMachine();
 constructor(private mixer:SoundMixer){}
 update(region:string,boss:boolean,fighting:boolean,tick:number,volume:number,listener={x:0,y:0},landmarks:readonly {kind:string;x:number;y:number}[]=[]){const now=tick/30;this.music.update(now,fighting,boss);const base=/port|town/.test(region)?'port':/mist|forest/.test(region)?'mist':/forge/.test(region)?'forge':/frost|tundra/.test(region)?'frost':/rift|abyss/.test(region)?'rift':/dragon/.test(region)?'dragon':'wind';const key=boss?'boss-arena':/dungeon/.test(region)?'dungeon-'+base:base;
 if(this.region!==key){this.region=key;this.nextDetail=now+4;this.mixer.stream('region','amb/'+key,2);}
 const types:Record<string,string>={waterfall:'waterfall',stream:'stream',fire:'campfire',campfire:'campfire',forge:'forge',steam:'steam',windmill:'windmill',ship:'ship',bell:'bell',portal:'teleport',rift:'rift',chest:'chest',rigging:'rigging'};
 const near=landmarks.map((l,i)=>({key:types[l.kind],slot:'fixed/'+i,distance:Math.hypot(l.x-listener.x,l.y-listener.y)})).filter(l=>l.key&&l.distance<14).sort((a,b)=>a.distance-b.distance).slice(0,3),active=new Set(near.map(l=>l.slot));for(const slot of this.fixed)if(!active.has(slot))this.mixer.stopStream(slot);for(const l of near){this.mixer.stream(l.slot,'source/'+l.key,2);this.mixer.streamLevel(l.slot,Math.pow(1-l.distance/14,2)*.5);}this.fixed=active;
 if(now>=this.nextDetail){const motifs=['bell','rustle','creak','rattle','gust','debris'],i=this.serial++;this.nextDetail=now+4+Math.random()*16;this.mixer.play(productionRecipe('ambient-detail/'+base+'-'+motifs[i%motifs.length]),tick,volume,1,{pan:Math.random()*1.2-.6});}}
 stop(){this.region='';this.mixer.stopStreams();}
}
