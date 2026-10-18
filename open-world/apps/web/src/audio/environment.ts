import {productionRecipe} from './production-recipes.ts';
import {SoundMixer} from './mixer.ts';
import {musicUrl} from './music.ts';
export type MusicState='exploration'|'combat'|'boss';
/** 野外一直在自动挂机，交战不换曲（否则几秒一切）；只有副本里交战才切战斗曲，首领在场切首领曲。脱战 6 秒防抖。 */
export class MusicStateMachine{state:MusicState='exploration';private lastCombat=-Infinity;update(now:number,fighting:boolean,boss:boolean,dungeon=true){if(fighting&&dungeon)this.lastCombat=now;const next=boss?'boss':dungeon&&(fighting||now-this.lastCombat<6)?'combat':'exploration';const seconds=next==='boss'?1.5:next==='combat'?2:4;const changed=next!==this.state;this.state=next;return {state:next,seconds,changed};}}
export class EnvironmentAudio{
 private region='';private nextDetail=0;private serial=0;private fixed=new Set<string>();readonly music=new MusicStateMachine();
 constructor(private mixer:SoundMixer){}
 update(region:string,boss:boolean,fighting:boolean,tick:number,volume:number,listener={x:0,y:0},landmarks:readonly {kind:string;x:number;y:number}[]=[]){const now=tick/30,dungeon=/dungeon/.test(region),music=this.music.update(now,fighting,boss,dungeon);const base=/port|town/.test(region)?'port':/mist|forest/.test(region)?'mist':/forge/.test(region)?'forge':/frost|tundra/.test(region)?'frost':/rift|abyss/.test(region)?'rift':/dragon/.test(region)?'dragon':'wind';const key=boss?'boss-arena':/dungeon/.test(region)?'dungeon-'+base:base;
 if(this.region!==key){this.region=key;this.nextDetail=now+4;this.mixer.stream('region','amb/'+key,2);}
 this.playMusic(music.state==='boss'?'boss':music.state==='combat'?'combat':dungeon?'dungeon':base,music.seconds);
 const types:Record<string,string>={waterfall:'waterfall',stream:'stream',fire:'campfire',campfire:'campfire',forge:'forge',steam:'steam',windmill:'windmill',ship:'ship',bell:'bell',portal:'teleport',rift:'rift',chest:'chest',rigging:'rigging'};
 const near=landmarks.map((l,i)=>({key:types[l.kind],slot:'fixed/'+i,distance:Math.hypot(l.x-listener.x,l.y-listener.y)})).filter(l=>l.key&&l.distance<14).sort((a,b)=>a.distance-b.distance).slice(0,3),active=new Set(near.map(l=>l.slot));for(const slot of this.fixed)if(!active.has(slot))this.mixer.stopStream(slot);for(const l of near){this.mixer.stream(l.slot,'source/'+l.key,2);this.mixer.streamLevel(l.slot,Math.pow(1-l.distance/14,2)*.5);}this.fixed=active;
 if(now>=this.nextDetail){const motifs=['bell','rustle','creak','rattle','gust','debris'],i=this.serial++;this.nextDetail=now+4+Math.random()*16;this.mixer.play(productionRecipe('ambient-detail/'+base+'-'+motifs[i%motifs.length]),tick,volume,1,{pan:Math.random()*1.2-.6});}}
 private track='';
 /** 登录/建角界面的标题曲；进入世界后由 update 换成区域曲。 */
 title(){this.playMusic('title',2);}
 private playMusic(key:string,seconds:number){if(this.track===key)return;const url=musicUrl('music/'+key);if(!url)return;this.track=key;this.mixer.streamUrl('music',url,seconds,'music');}
 stop(){this.region='';this.track='';this.mixer.stopStreams();}
}
