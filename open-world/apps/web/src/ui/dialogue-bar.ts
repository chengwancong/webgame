// UX-A02：对白条。控制器照旧把 .story-dialogue 整块渲染进 #modal，这里只改呈现：
// 底部锚定、说话人头像、逐字显示、点击/空格先补全再翻页、回看已读句子。对白原文一个字都不动。
import {npcs as npcRows} from '../../../../packages/content/task-tables.ts';
import {motionReduced} from './panel-motion.ts';

const CPS=42;
let heroPortrait='';
export const setDialoguePortrait=(url:string)=>{heroPortrait=url;};

type Line={speaker:string;text:string};
const norm=(s:string)=>s.replace(/\s+/g,' ').trim();
const byName=new Map<string,{id:string;short:string}>();
for(const row of npcRows){byName.set(row.name,{id:row.id,short:row.short});if(row.short)byName.set(row.short,{id:row.id,short:row.short});}
const portraitOf=(id:string)=>id.startsWith('ss-npc-')?`/art/starsea/npc/${id}/portrait.png`:'';

function avatarFor(speaker:string):HTMLElement{
 const box=document.createElement('div');box.className='dlg-avatar';box.setAttribute('aria-hidden','true');
 if(!speaker){box.dataset.kind='none';return box;}
 if(speaker==='你'&&heroPortrait){box.dataset.kind='hero';const img=new Image();img.alt='';img.src=heroPortrait;box.append(img);return box;}
 const hit=byName.get(speaker),src=hit?portraitOf(hit.id):'';
 if(src){box.dataset.kind='npc';const img=new Image();img.alt='';img.src=src;img.onerror=()=>{img.remove();box.dataset.kind='mono';box.textContent=(hit?.short||speaker).slice(-1);};box.append(img);return box;}
 box.dataset.kind='mono';box.textContent=(hit?.short||speaker.replace(/^.*·/,'')||speaker).slice(0,1);return box;
}

export function installDialogueBar(host:HTMLElement){
 let history:Line[]=[],convo='',historyOpen=false,wasOpen=false;
 let typing:{p:HTMLElement;full:string;key:string;shown:number;timer:number}|null=null;
 const done=new Set<string>(),progress=new Map<string,number>();
 const primary=()=>host.querySelector<HTMLButtonElement>('.story-dialogue[data-bar] .story-dialogue-actions button:not([disabled])');
 const finish=()=>{
  if(!typing)return;const t=typing;typing=null;clearInterval(t.timer);t.p.textContent=t.full;t.p.removeAttribute('data-typing');t.p.removeAttribute('aria-label');
  done.add(t.key);progress.delete(t.key);t.p.closest('.story-dialogue')?.removeAttribute('data-typing');
 };
 const typeIn=(p:HTMLElement,key:string,full:string)=>{
  if(done.has(key)||motionReduced()||!full){done.add(key);return;}
  const start=Math.min(progress.get(key)??0,full.length),shown=document.createElement('span'),rest=document.createElement('span');
  rest.className='dlg-rest';rest.setAttribute('aria-hidden','true');shown.textContent=full.slice(0,start);rest.textContent=full.slice(start);
  p.replaceChildren(shown,rest);p.setAttribute('data-typing','');p.setAttribute('aria-label',full);p.closest('.story-dialogue')?.setAttribute('data-typing','');
  const t={p,full,key,shown:start,timer:0};typing=t;let last=performance.now();
  t.timer=window.setInterval(()=>{
   if(typing!==t||!p.isConnected){clearInterval(t.timer);if(typing===t)typing=null;return;}
   const now=performance.now(),n=Math.max(1,Math.floor((now-last)*CPS/1000));last=now;
   t.shown=Math.min(full.length,t.shown+n);progress.set(key,t.shown);shown.textContent=full.slice(0,t.shown);rest.textContent=full.slice(t.shown);
   if(t.shown>=full.length)finish();
  },1000/CPS);
 };
 const historyList=(lines:Line[])=>{
  const ol=document.createElement('ol');ol.className='dlg-history';ol.setAttribute('aria-label','已读对白');
  for(const l of lines){const li=document.createElement('li');if(l.speaker){const b=document.createElement('strong');b.textContent=l.speaker;li.append(b);}const t=document.createElement('span');t.textContent=l.text;li.append(t);ol.append(li);}
  queueMicrotask(()=>{ol.scrollTop=ol.scrollHeight;});return ol;
 };
 const enhance=()=>{
  const open=host.classList.contains('open'),closing=host.classList.contains('is-closing');
  if(wasOpen&&!open&&!closing){history=[];convo='';historyOpen=false;done.clear();progress.clear();if(typing){clearInterval(typing.timer);typing=null;}}
  wasOpen=open;
  const panel=host.querySelector<HTMLElement>('.story-dialogue:not(.starsea-chart)');
  if(!panel||!panel.querySelector('.story-spoken')){if(!closing)delete host.dataset.dialogue;return;}
  if(!closing)host.dataset.dialogue='';
  if(panel.hasAttribute('data-bar'))return;
  panel.dataset.bar='';
  const spoken=panel.querySelector<HTMLElement>('.story-spoken')!,strong=spoken.querySelector('strong'),p=spoken.querySelector<HTMLElement>('p');if(!p)return;
  const speaker=norm(strong?.textContent??''),full=p.textContent??'',label=panel.getAttribute('aria-label')??'';
  if(label!==convo){convo=label;history=[];historyOpen=false;}
  const captions=Array.from(panel.querySelectorAll<HTMLElement>(':scope>.ui-caption')),counter=captions.find(c=>/^\d+ \/ \d+$/.test(norm(c.textContent??'')));
  const key=label+'|'+(counter?.textContent??'')+'|'+speaker+'|'+full;
  const prev=history[history.length-1];if(!prev||prev.speaker!==speaker||prev.text!==full)history.push({speaker,text:full});
  const head=panel.querySelector<HTMLElement>(':scope>.panel-head'),actions=panel.querySelector<HTMLElement>(':scope>.story-dialogue-actions');
  head?.classList.add('dlg-head');counter?.classList.add('dlg-count');spoken.classList.add('dlg-spoken');actions?.classList.add('dlg-actions');
  panel.querySelector(':scope>.story-chapter-title')?.classList.add('dlg-chapter');
  captions.filter(c=>c!==counter).forEach(c=>c.classList.add('dlg-role'));
  panel.prepend(avatarFor(speaker));spoken.dataset.narrator=String(!speaker);
  if(actions){const hint=document.createElement('span');hint.className='dlg-hint';hint.textContent='点击或按空格继续';actions.prepend(hint);if(counter)actions.prepend(counter);}
  if(history.length>1&&head){const log=document.createElement('button');log.type='button';log.className='dlg-log-toggle ui-button ui-button--tertiary ui-button--compact';log.dataset.dlgLog='';log.textContent=historyOpen?'收起回看':'回看';log.setAttribute('aria-expanded',String(historyOpen));head.insertBefore(log,head.querySelector('.close'));}
  if(historyOpen&&history.length>1)panel.append(historyList(history.slice(0,-1)));
  typeIn(p,key,full);
 };
 const observer=new MutationObserver(enhance);observer.observe(host,{childList:true,attributes:true,attributeFilter:['class']});enhance();

 const onClick=(event:MouseEvent)=>{
  const target=event.target as HTMLElement,panel=target.closest<HTMLElement>('.story-dialogue[data-bar]');if(!panel)return;
  if(target.closest('[data-dlg-log]')){
   event.stopPropagation();event.preventDefault();historyOpen=!historyOpen;
   panel.querySelector('.dlg-avatar')?.remove();panel.querySelector('.dlg-hint')?.remove();panel.querySelector('.dlg-log-toggle')?.remove();panel.querySelector('.dlg-history')?.remove();
   if(typing)finish();panel.removeAttribute('data-bar');enhance();return;
  }
  const button=target.closest('button');
  if(typing&&(!button||button===primary())){event.stopPropagation();event.preventDefault();finish();}
 };
 const onKeyDown=(event:KeyboardEvent)=>{
  if(event.code!=='Space'&&event.code!=='Enter')return;if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
  if(!host.querySelector('.story-dialogue[data-bar]'))return;const el=event.target as HTMLElement;
  if(['INPUT','SELECT','TEXTAREA'].includes(el.tagName))return;
  const btn=el.closest?.('button');if(btn&&btn!==primary()&&host.contains(btn))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(typing){finish();return;}primary()?.click();
 };
 /* 空格的原生点击在 keyup 触发，keydown 已处理过，这里拦掉避免翻两页。 */
 const onKeyUp=(event:KeyboardEvent)=>{if(event.code==='Space'&&host.querySelector('.story-dialogue[data-bar]')&&!['INPUT','SELECT','TEXTAREA'].includes((event.target as HTMLElement).tagName))event.preventDefault();};
 host.addEventListener('click',onClick,true);window.addEventListener('keydown',onKeyDown,true);window.addEventListener('keyup',onKeyUp,true);
 return ()=>{observer.disconnect();if(typing)clearInterval(typing.timer);typing=null;host.removeEventListener('click',onClick,true);window.removeEventListener('keydown',onKeyDown,true);window.removeEventListener('keyup',onKeyUp,true);};
}
