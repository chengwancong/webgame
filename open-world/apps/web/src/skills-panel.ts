import type {Snapshot,SkillAccess,Skill} from '../../../packages/contracts/index.ts';
import {skillCatalog,skillSchools,skillSchoolOf,type SkillSchool} from '../../../packages/content/index.ts';
import {skillBrowseTags,skillTagNames,skillFunctionNames} from '../../../packages/content/skill-tags.ts';
import {skillArt} from './ui-assets.ts';
import {pipsHtml,meterHtml,marksHtml,emptySlotHtml,iconHtml,helpHtml,type SlotMark,statTilesHtml,sectionTitleHtml,esc,itemSlot,buttonHtml,resourceCostHtml,statusBadgeHtml,stateBlockHtml,statRowHtml,tabsHtml,currencyIconHtml,fieldHtml,selectFieldHtml} from './ui-components.ts';
import {hudIcon} from './hud-icons.ts';
import {renderSkillEffectSummary,skillKeyStats,skillUpgradeChanges} from './ui/skill-effects.ts';
import {weaponSchools} from '../../../packages/content/weapon-combos.ts';
/** 当前主手流派与服务端解析的连携（只读展示）。 */
function schoolHtml(s:Snapshot){const weapon=s.stats.weapon;if(!weapon)return '<p class="ui-caption skill-school">无主手流派</p>';const school=weaponSchools[weapon],combos=s.stats.combos??[],detail=[school.summary,...combos.map(r=>r.name+'：'+r.description)].join('\n');return `<p class="ui-caption skill-school" title="${esc(detail)}" aria-label="${esc(school.name+'。'+detail)}">${statusBadgeHtml(school.name,'info',{variant:'inline',title:detail})+helpHtml(detail)}</p>`;}

type SkillsView={snapshot:Snapshot;skillFocus:string;skillCategory:SkillSchool|'all';skillTags?:readonly string[];skillQuery?:string;skillFilter?:'all'|'active'|'eligible';skillLocked?:boolean;frozenSkills?:Skill[];processing:boolean;blocked:boolean;lastError:string;skillOperation:''|'activate'|'upgrade'|'equip'|'unequip';skillOperationId:string;skillStatus:''|'success'|'error'|'pending';skillMessage:string};
const icon=(id:string,cls='')=>`<img class="${cls}" src="${skillArt(id)}" alt="" draggable="false">`;
function conditionText(q:SkillAccess){
 const a=q.activation;
 return a.type==='book'?`需${a.name} ×${a.required}`:a.type==='recovery'?`待找回：完成「${a.name}」`:a.type==='task'?`完成「${a.name}」后获得`:a.type==='island'&&a.current>=a.required?`需到过${a.islandName}`:`需角色${a.required}级`;
}
function activationInfo(q:SkillAccess){
 const a=q.activation;
 if(a.type==='level')return `${sectionTitleHtml('等级激活')}<div class="skill-requirements">${statRowHtml({label:'角色等级',value:`${a.current} / ${a.required}`,secondary:q.eligible?'已达成':`还需提升${Math.max(0,a.required-a.current)}级`,valueTone:q.eligible?'positive':'negative'})}${statRowHtml({label:'激活消耗',value:'无'})}</div>`;
 if(a.type==='task')return `${sectionTitleHtml('任务获得')}<div class="skill-requirements">${statRowHtml({label:'获得任务',value:a.name,secondary:q.eligible?'已完成':'未完成',valueTone:q.eligible?'positive':'negative'})}${statRowHtml({label:'激活消耗',value:'无'})}</div><p class="ui-caption">完成这个任务时自动获得，有空位就直接装上。</p>`;
 if(a.type==='recovery')return `${sectionTitleHtml('招牌技 · 待找回')}<div class="skill-requirements">${statRowHtml({label:'找回任务',value:a.name,secondary:q.eligible?'已完成':`第 ${a.order} 次找回`,valueTone:q.eligible?'positive':'negative'})}${statRowHtml({label:'激活消耗',value:'无'})}</div><p class="ui-caption">开场被收走的招式之一，完成这个任务时自动回来。</p>`;
 if(a.type==='island')return `${sectionTitleHtml('等级 + 岛屿激活')}<div class="skill-requirements">${statRowHtml({label:'角色等级',value:`${a.current} / ${a.required}`,secondary:a.current>=a.required?'已达成':`还需提升${Math.max(0,a.required-a.current)}级`,valueTone:a.current>=a.required?'positive':'negative'})}${statRowHtml({label:'所属岛',value:a.islandName,secondary:a.visited?'已到过':'还没到过',valueTone:a.visited?'positive':'negative'})}${statRowHtml({label:'激活消耗',value:'无'})}</div>`;
 return `${sectionTitleHtml('技能书激活')}${resourceCostHtml([{id:a.book,label:a.name,amount:a.required,owned:a.current,availability:q.eligible?'enough':'short',iconHtml:hudIcon('build')}],'激活消耗',{compact:true})}<p class="condition-result">${q.eligible?iconHtml('check',{size:16,label:'技能书足够'}):`<span class="ui-warning">还缺${Math.max(0,a.required-a.current)}本</span>`}</p><p class="book-source">来源：${esc(a.source)}</p>`;
}
function upgradeInfo(q:SkillAccess,s:Snapshot){
 if(q.max)return '';
 const cost=q.cost,changes=q.current&&q.next?skillUpgradeChanges(q.current,q.next):[];
 const diff=changes.length?`<ul class="skill-upgrade-changes">${changes.map(c=>`<li>${statRowHtml({label:c.label,previousValue:c.before,value:c.after,className:'ui-stat--delta'})}</li>`).join('')}</ul>`:'';
 return `${sectionTitleHtml(`升级到 Lv.${q.rank+1}`)}${diff}${resourceCostHtml([{id:'gold',label:'金币',amount:cost?.gold??null,owned:s.gold,availability:cost?(s.gold>=cost.gold?'enough':'short'):'unknown',iconHtml:currencyIconHtml('gold')}], '升级消耗',{compact:true})}`;
}
/** 技能册页签：三系＋全部。 */
export const skillBookTabs={...skillSchools,all:'全部'} as const;
const tagOrder=['physical','fire','cold','lightning','arcane','shadow','poison','single','area','projectile','dot','chain','dash','control','execute','heal','shield','buff'];
const tagName=(t:string)=>(skillTagNames as Record<string,string>)[t]??(skillFunctionNames as Record<string,string>)[t]??t;
const browseTags=new Map(skillCatalog.map(sk=>[sk.id,skillBrowseTags(sk)]));
/** 武器亲和由服务端按主手倾向解析；只对造成伤害的武技／法术显示。 */
const affinityText=(q:{mainHandAffinity?:'martial'|'spell'|null;affinityBonus?:number}|undefined,sk:{damage:number;kind:string})=>!q?.mainHandAffinity||sk.damage<=0||['shield','heal'].includes(sk.kind)?'':(q.affinityBonus??1)>1?` · 受到主手加成`:` · 未获主手加成`;
export const skillTagsOf=(id:string):readonly string[]=>browseTags.get(id)??[];
const tagLine=(sk:typeof skillCatalog[number])=>[skillSchools[skillSchoolOf(sk.category)],...skillTagsOf(sk.id).map(tagName)].join(' · ');
const inSchool=(sk:typeof skillCatalog[number],school:SkillSchool|'all')=>school==='all'||skillSchoolOf(sk.category)===school;
const keyStatsHtml=(skill:Skill)=>statTilesHtml(skillKeyStats(skill).map(k=>({label:k.label,value:k.text})));
export function renderSkills(view:SkillsView){
 const s=view.snapshot,access=new Map(s.skillAccess.map(sk=>[sk.id,sk]));
 const active=(id:string)=>access.get(id)?.activated??false;
 const query=(view.skillQuery??'').trim().toLocaleLowerCase(),filter=view.skillFilter??'all';
 const selectedTags=view.skillTags??[],page=skillCatalog.filter(sk=>inSchool(sk,view.skillCategory));
 const library=skillCatalog.filter(sk=>(query?`${sk.name} ${sk.id} ${sk.description}`.toLocaleLowerCase().includes(query):inSchool(sk,view.skillCategory)&&selectedTags.every(t=>skillTagsOf(sk.id).includes(t)))&&(filter==='all'||filter==='active'&&active(sk.id)||filter==='eligible'&&!active(sk.id)&&access.get(sk.id)?.eligible)).sort((a,b)=>{const priority=(id:string)=>active(id)?0:access.get(id)?.eligible?1:2;return priority(a.id)-priority(b.id)||a.unlockLevel-b.unlockLevel;});
 const focus=skillCatalog.find(sk=>sk.id===view.skillFocus)??library.find(sk=>sk.id===s.skills[0])??library[0]??skillCatalog[0];
 if(!focus)return stateBlockHtml({kind:'empty',title:'暂无技能',message:'这一类还没有技能。'});
 const q=access.get(focus.id),ready=Boolean(q&&(q.max||(q.activated?q.action==='upgrade'&&q.cost&&q.current&&q.next:q.action==='activate')));
 const busy=view.processing||view.blocked||view.skillLocked;
 const equipped=s.skills.includes(focus.id),loadoutOperation=equipped?'unequip':'equip';
 const slots=s.skillRecovery?.slots??4,sealed=new Set(s.skillRecovery?.sealed??[]);
 const loadoutReason=!equipped&&q?.weaponCompatible===false?(q.weaponRequirement??'主手武器不匹配。'):view.skillLocked?'本场技能和装备已锁定，结束副本后可调整。':!q?.activated?'请先激活该技能。':equipped&&s.skills.length===1?'至少保留一个已装配技能。':!equipped&&s.skills.length>=slots?'技能位已满，请先卸下一个技能。':'';
 const tabs=tabsHtml({label:'技能分类',action:'skill-category',selected:view.skillCategory,controls:`skill-page-${view.skillCategory}`,className:'skill-categories',items:Object.entries(skillBookTabs).map(([id,name])=>{const list=skillCatalog.filter(sk=>inSchool(sk,id as SkillSchool|'all'));return {id,label:name,count:`${list.filter(sk=>active(sk.id)).length}/${list.length}`,tabId:`skill-tab-${id}`,disabled:view.processing};})});
 const pageTags=tagOrder.filter(t=>page.some(sk=>skillTagsOf(sk.id).includes(t))||selectedTags.includes(t));
 const tagFilter=query?'':`<div class="skill-tags" role="group" aria-label="按标签筛选">${pageTags.map(t=>buttonHtml(tagName(t),{action:'skill-tag',id:t,variant:'quiet',size:'compact',pressed:selectedTags.includes(t),disabled:view.processing,className:'skill-tag'})).join('')}${selectedTags.length?buttonHtml('清除',{action:'skill-tag',id:'',variant:'tertiary',size:'compact',className:'skill-tag-clear'}):''}</div>`;
 const cards=library.map(sk=>{
  const item=access.get(sk.id),activated=item?.activated??false,equipped=s.skills.includes(sk.id),state=item?.max?'maxed':activated?'learned':item?.eligible?'available':'locked';
  const status=!item?'信息待同步':activated?(equipped?'已装配':item.max?'已满级':'已激活'):item.eligible?'可激活':conditionText(item);
  const marks:SlotMark[]=[];
  if(equipped){marks.push({corner:'tr',kind:'check',label:'已装配'});marks.push({corner:'tl',kind:'order',value:s.skills.indexOf(sk.id)+1,label:'装配顺序 '+(s.skills.indexOf(sk.id)+1)});}else if(item?.max)marks.push({corner:'tr',kind:'check',label:'已满级'});
  if(!activated&&!item?.eligible&&item){const a=item.activation;marks.push(a.type==='level'||a.type==='island'&&a.current<a.required?{corner:'tr',kind:'level',value:a.required,label:conditionText(item)}:a.type==='book'?{corner:'tr',kind:'count',value:'×'+a.required,iconHtml:iconHtml('book',{size:16}),label:conditionText(item)}:{corner:'tr',kind:'lock',label:conditionText(item)});}
  const label=`查看${sk.name}，${status}，等级 ${item?.rank??'未同步'}/5，${sk.description}`;
  return `<div class="lib-card ui-card ${sk.id===focus.id?'is-focus':''}" data-state="${state}"><button type="button" class="lib-pick" data-action="skill-focus" data-id="${sk.id}" aria-label="${esc(label)}" title="${esc(label)}" aria-pressed="${sk.id===focus.id}"><span class="ui-node ui-node--skill" data-state="${state}"><img class="ui-node__art" src="${skillArt(sk.id)}" alt="" draggable="false">${marksHtml(marks)}</span><span class="skill-card-copy"><span class="skill-card-title"><b class="ui-card__name">${esc(sk.name)}</b>${activated?pipsHtml({value:item!.rank,max:5,label:sk.name+'等级',size:'sm'}):''}</span><span class="skill-card-tags ui-caption">${esc(tagLine(sk))}</span><span class="skill-card-description ui-card__body">${esc(sk.description)}</span>${item?.weaponCompatible===false?`<span class="ui-warning" title="${esc(item.weaponRequirement??'主手不匹配')}">主手不匹配</span>`:''}</span></button></div>`;
 }).join('');
 const loadout=Array.from({length:slots},(_,i)=>{
  const sk=skillCatalog.find(sk=>sk.id===s.skills[i]),locked=Boolean(sk&&sealed.has(sk.id));
  return `<div class="loadout-step ${sk?'':'is-empty'}${locked?' is-sealed':''}">${sk?itemSlot({action:'skill-locate',id:sk.id,label:locked?`${sk.name}（待找回）`:`查看${sk.name}`,src:skillArt(sk.id),className:'skill',pressed:sk.id===focus.id,state:locked?'locked':undefined,marks:[{corner:'tl',kind:'order',value:i+1,label:'装配顺序 '+(i+1)},...(locked?[{corner:'tr' as const,kind:'lock' as const,label:'待找回'}]:[])]}):emptySlotHtml({label:'第 '+(i+1)+' 个技能位未装配'})}<div>${sk?`<b>${esc(sk.name)}</b>${locked?'<span class="ui-caption">待找回</span>':''}`:''}</div></div>`;
 }).join('');
 const current=q?.current??q?.next;
 const operation=q?.activated?'upgrade':'activate';
 const operating=view.skillOperation===operation&&view.skillOperationId===focus.id;
 const operationText=view.blocked&&view.skillStatus==='pending'?'结果待确认':!ready?'信息待同步':q!.max?'升级已满':q!.activated?'升级':'激活';
 const reason=view.skillLocked?'本场技能和装备已锁定，结束副本后可再培养和装配。':!ready?'正在同步…':q!.max?'已达到最高等级':q!.blocked==='level'?'角色等级不足':q!.blocked==='book'?'缺少对应技能书':q!.blocked==='recovery'?'完成找回任务后自动回来':q!.blocked==='task'?'完成对应任务后获得':q!.blocked==='island'?'还没到过所属岛':q!.blocked==='resource'?'金币不足':'';
 const related=!view.skillOperationId||view.skillOperationId===focus.id||view.blocked;
 const notice=related?(view.skillMessage||(!view.skillStatus?view.lastError:'')):'';
 return `<div class="build-layout skill-book" data-count="${library.length}">
  <div class="skill-main">
   <section class="skill-library">${tabs}<div class="skill-search">${fieldHtml({id:'skill-search',label:'跨分类搜索',type:'search',value:view.skillQuery??'',placeholder:'搜索技能',compact:true})}${selectFieldHtml({id:'skill-filter',label:'技能可用筛选',value:filter,compact:true,options:[{value:'all',label:'全部'},{value:'active',label:'已激活'},{value:'eligible',label:'可激活'}]})}</div>${tagFilter}${query?`<p class="ui-caption skill-search-result">跨分类结果 ${library.length} 个</p>`:''}<div class="library" role="tabpanel" id="skill-page-${view.skillCategory}" aria-labelledby="skill-tab-${view.skillCategory}" tabindex="0"><div class="category-skills">${cards||stateBlockHtml({kind:'empty',title:'没有匹配技能',message:'调整搜索或筛选，已选技能和已装配技能仍然保留。',compact:true})}</div></div></section>
   <aside class="skill-detail" aria-label="技能详情" data-skill="${esc(focus.id)}" data-lifecycle="${!ready?'syncing':q!.max?'max':q!.activated?'active':'inactive'}"><div class="skill-detail-heading">${icon(focus.id)}<div><h3>${esc(focus.name)}</h3>${q?.activated?pipsHtml({value:q.rank,max:5,label:focus.name+'等级',size:'md'})+(q.max?iconHtml('check',{size:16,label:'已满级'}):''):q?iconHtml('lock',{size:16,label:'未激活'}):'<span class="ui-warning">信息待同步</span>'}</div></div><div class="skill-detail-content"><p class="skill-detail-tags ui-caption">${esc(tagLine(focus))} · ${esc(q?.weaponRequirement??'')}${affinityText(q,focus)}</p><p class="skill-detail-desc">${esc(focus.description)}</p>${q?.weaponCompatible===false?`<p class="condition-result">${statusBadgeHtml((q.weaponRequirement??'主手武器不匹配')+' · 当前主手不匹配','warning',{variant:'inline'})}</p>`:''}${current?keyStatsHtml(current):'<p class="condition-result">技能数值待同步。</p>'}<div class="skill-detail-body">${view.skillLocked?`<section class="skill-frozen">${sectionTitleHtml('本场已锁定')}<p>本场保持入场时的技能与属性。结束副本后可培养和调整装配，下一场入场生效。</p>${view.frozenSkills?.find(sk=>sk.id===focus.id)?renderSkillEffectSummary(view.frozenSkills.find(sk=>sk.id===focus.id)!):'<p>该技能未装配到本场。</p>'}</section>${sectionTitleHtml('角色持久技能')}`:''}${current?`<details class="skill-more"><summary>详细数值</summary>${renderSkillEffectSummary(current)}${q?.mainHandAffinity?statRowHtml({label:'主手加成',value:Number((((q.affinityBonus??1)-1)*100).toFixed(2))+'%'}):''}</details>`:''}</div><section class="skill-training">${view.blocked&&view.skillStatus!=='success'?'<p class="condition-result">请先恢复连接，核对技能状态与最新资源。</p>':!ready?'<p>技能信息正在同步，暂不可操作。</p>':q!.activated?upgradeInfo(q!,s):activationInfo(q!)}</section></div><div class="skill-feedback ${view.skillStatus}" role="${view.skillStatus==='error'?'alert':'status'}">${notice?esc(notice):!ready?esc(reason):''}${view.blocked?buttonHtml('恢复连接',{action:'recover',size:'compact',busy:view.processing,busyLabel:'恢复中…'}):''}</div><div class="ops">${buttonHtml(operationText,{action:`skill-${operation}`,id:focus.id,variant:'primary',size:'action',className:'skill-command skill-primary',disabled:!ready||busy||!q!.affordable||q!.max,busy:operating,busyLabel:operation==='activate'?'激活中…':'升级中…',attributes:{title:reason}})}${buttonHtml(equipped?'卸下':'装配',{action:'skill-'+loadoutOperation,id:focus.id,variant:'secondary',className:'skill-command',disabled:busy||Boolean(loadoutReason),busy:view.skillOperation===loadoutOperation&&view.skillOperationId===focus.id,busyLabel:equipped?'卸下中…':'装配中…',attributes:{title:loadoutReason}})}${loadoutReason?`<p class="condition-result">${esc(loadoutReason)}</p>`:''}</div></aside>
  </div>
  <section class="skill-loadout"><div class="loadout-caption">${sectionTitleHtml('技能装配',{count:`${s.skills.length}/${slots}`,className:'ui-section-title--stacked-count'})}${schoolHtml(s)}</div><div class="loadout">${loadout}</div></section>
 </div>`;
}
