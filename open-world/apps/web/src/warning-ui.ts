import type {World} from '../../../packages/simulation/index.ts';
import {getBossDefinition} from '../../../packages/content/chapter-combat.ts';
/** Screen space contains text only. Ground geometry belongs exclusively to CombatVfx. */
export class WarningUI{
 private container:HTMLDivElement;private title:HTMLDivElement;private detail:HTMLDivElement;private fill:HTMLDivElement;
 constructor(parent:HTMLElement){
  this.container=document.createElement('div');this.container.id='warning-ui';this.container.setAttribute('role','status');this.container.setAttribute('aria-live','polite');
  this.title=document.createElement('div');this.title.className='warning-ui-title';this.detail=document.createElement('div');this.detail.className='warning-ui-detail';
  const track=document.createElement('div');track.setAttribute('aria-hidden','true');track.className='warning-ui-track';this.fill=document.createElement('div');this.fill.className='warning-ui-fill';track.append(this.fill);this.container.append(this.title,this.detail,track);parent.append(this.container);
 }
 render(w:World){
  const cast=w.bossCasts.filter(c=>(!c.resolved||c.interrupted)&&c.expires>w.tick).sort((a,b)=>(a.skill==='ultimate'?-1:0)-(b.skill==='ultimate'?-1:0)||a.ends-b.ends)[0];
  if(!cast||w.hero.hp<=0){this.container.style.display='none';return;}
  const owner=w.enemies.find(e=>e.id===cast.owner),definition=owner?getBossDefinition(owner.art)?.skills.find(s=>s.id===cast.skill):undefined;
  const text=cast.interrupted?'施法已打断':(definition?.name??'敌方施法')+' · '+Math.max(1,Math.ceil((cast.ends-w.tick)/30));
  const detail=cast.interrupted?'危险解除':cast.skill==='ultimate'?'离开光束路径，或利用掩体':cast.skill==='ritual'?'持续攻击可打断':'注意脚下范围，及时避让';
  if(this.title.textContent!==text)this.title.textContent=text;if(this.detail.textContent!==detail)this.detail.textContent=detail;
  this.fill.style.transform='scaleX('+(cast.interrupted?0:Math.max(0,Math.min(1,(w.tick-cast.started)/(cast.ends-cast.started))))+')';this.container.style.display='block';
 }
 destroy(){this.container.remove();}
}
