import type {World,CombatEvent} from '../../../packages/simulation/index.ts';
import {vfxProfiles} from './vfx-profiles.ts';
import {visualSignature} from './vfx-motifs.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {monsterSkills,chapterBossSkills} from '../../../packages/content/chapter-combat.ts';
const titles:Record<string,string>={player:'玩家技能',combo:'连携',monster:'怪物技能',boss:'首领技能',status:'状态',system:'系统'};
const bossNames:Record<string,string>={};for(const b of Object.values(chapterBossSkills))for(const s of b.skills)bossNames[s.id]=s.name;
export function galleryMarkup(){return Object.entries(titles).map(([category,title])=>`<details ${category==='player'?'open':''}><summary>${title} · ${Object.keys(vfxProfiles).filter(k=>k.startsWith(category+'/')).length}</summary><div class="gallery-list">${Object.values(vfxProfiles).filter(p=>p.key.startsWith(category+'/')).map(p=>{const id=p.key.split('/')[1],name=skillCatalog.find(s=>s.id===id)?.name??monsterSkills[id]?.name??bossNames[id]??id;return `<button data-gallery="${p.key}" title="${visualSignature(p)}">${name}</button>`;}).join('')}</div></details>`).join('');}
/** Presentation preview only. Replays keys through the actual SkillEffects consumer. */
export class GalleryReplay{
 constructor(readonly key:string,private start:number){}
 step(w:World){const p=vfxProfiles[this.key],age=w.tick-this.start,sourceId=this.key.startsWith('monster/')||this.key.startsWith('boss/')?'gallery-source':w.playerId,from={x:12,y:12},to={x:17,y:12},castId=700000;
  const event=(type:CombatEvent['type'],position=from):CombatEvent=>({type,id:type==='hit_resolved'?'gallery-target':sourceId,sourceId,targetId:'gallery-target',position,target:to,origin:from,castId,vfxKey:this.key,skill:this.key.split('/')[1],tick:w.tick,windup:15,radius:2,duration:90,...(type==='hit_resolved'?{amount:1}:{})});
  if(age===1){w.events.push(event('cast_started'));if(this.key.startsWith('boss/'))w.events.push(event('danger_started',to));}
  if(age===16){w.events.push(event('cast_released'));if(['projectile','beam'].includes(p.family))w.projectiles.push({id:700001,castId,sourceId,targetId:'gallery-target',owner:sourceId,vfxKey:this.key,skill:this.key.split('/')[1],position:{...from},previous:{...from},origin:{...from},target:to,direction:{x:1,y:0},damage:0,life:90,enemy:false,pierce:false,hit:new Set()});else if(p.family==='zone')w.zones.push({id:700002,castId,sourceId,vfxKey:this.key,position:to,radius:2,damage:0,life:90,delay:1,enemy:false,slow:false});}
  if(age===32)w.events.push(event('hit_resolved',to));
 }
}
