import type {CharacterState,StoryState,StoryFeature,StoryView} from '../contracts/index.ts';
import {storyChapters,storyFeatures,storyNpcs,storyChapter,starseaFeatureReasons} from '../content/story-campaign.ts';
import {skillCatalog,regionById} from '../content/index.ts';
export const newStoryState=():StoryState=>({version:1,legacyAccess:false,events:{},choices:{}});
/** Missing story data means an existing character; keep previously available systems. */
export function ensureStory(s:CharacterState):StoryState{return s.story??={version:1,legacyAccess:true,events:{},choices:{}};}
export function storyHas(s:CharacterState,event:string){return Boolean(s.story?.events[event]);}
export function storyFeatureReason(s:CharacterState,feature:StoryFeature){return s.starsea?(starseaFeatureReasons[feature]??'该功能尚未开放'):storyFeatures.find(f=>f.id===feature)?.reason??'尚未解锁';}
// 星潮海角色由 NPC 入住表解锁（packages/rules/starsea.ts）。
export function storyFeatureUnlocked(s:CharacterState,feature:StoryFeature){if(s.starsea)return s.starsea.features.includes(feature);const gate=storyFeatures.find(f=>f.id===feature);return !gate||!s.story||s.story.legacyAccess||storyHas(s,gate.event);}
export function storyProgressionFeature(op:string,slot?:number):StoryFeature|undefined{if(op.startsWith('grid.')&&slot!==0)return 'grid';if(op.startsWith('weapon.'))return 'forge';if(op.startsWith('aspect.'))return 'aspects';if(op.startsWith('summon.'))return 'summons';}
export function recordStoryEvent(s:CharacterState,event:string,at:string){const story=ensureStory(s);if(story.events[event])return false;story.events[event]=at;return true;}
export function storyChapterAvailable(s:CharacterState,id:string){const index=storyChapters.findIndex(c=>c.id===id);if(index<0)return false;if(index===0)return true;const prior=storyChapters[index-1];return storyHas(s,prior.id+':return')||Boolean(s.story?.legacyAccess&&s.progress.bosses.includes(prior.boss))||!s.story&&s.progress.bosses.includes(prior.boss);}
export function resolveStory(s:CharacterState,selected?:string):StoryView{
 const chapters=storyChapters.map(c=>({id:c.id,title:c.title,area:c.area,dungeon:'story-'+c.id,available:storyChapterAvailable(s,c.id)&&s.level>=c.level,complete:storyHas(s,c.id+':return'),reason:!storyChapterAvailable(s,c.id)?'先完成上一章并回营报告':s.level<c.level?`需达到 ${c.level} 级`:'',skills:c.skills.map(id=>{const skill=skillCatalog.find(sk=>sk.id===id)!;return {id,name:skill.name,requirement:skill.activation?'首次击败'+regionById(c.boss).spawns.find(m=>m.boss)?.name+'获得技能书':`${skill.unlockLevel} 级可激活`};})}));
 const chapter=storyChapter(selected??'')??storyChapters.find(c=>!storyHas(s,c.id+':return')&&storyChapterAvailable(s,c.id))??storyChapters.at(-1)!;
 const accepted=storyHas(s,chapter.id+':accept'),awaitingReturn=storyHas(s,chapter.id+':boss')&&!storyHas(s,chapter.id+':return'),complete=storyHas(s,chapter.id+':return');
 // 营地 NPC：NPC.xlsx「出现事件」为空的始终在场，其余达成事件后出现。
 const campNpcs=[...storyNpcs.filter(n=>!n.appear),...storyNpcs.filter(n=>n.appear&&storyHas(s,n.appear))].map(n=>n.id);
  return {characterId:s.id,revision:s.revision,campaign:'最后一条归途',chapter:chapter.id,title:chapter.title,accepted,awaitingReturn,complete,giver:chapter.npc,dialogue:awaitingReturn||complete?chapter.returnDialogue:accepted?(chapter.progress?.length?chapter.progress:chapter.intro):chapter.intro,features:storyFeatures.map(f=>({id:f.id,name:f.name,unlocked:storyFeatureUnlocked(s,f.id),reason:f.reason})),chapters,campNpcs:[...new Set([...campNpcs,chapter.npc])],litBeacons:storyChapters.filter(c=>storyHas(s,c.id+':beacon')).map(c=>c.id)};
}
