import './ui-entry.css';
import type {Snapshot} from '../../../packages/contracts/index.ts';
import {BagPanel,bagHeader} from './components/BagPanel.ts';
import {initialBagDraft} from './bag-model.ts';
import type {BagUI} from './bag-controller.ts';
import {renderSkills} from './skills-panel.ts';
import {panelHeaderHtml} from './ui-components.ts';
import {loadWorldFont} from './ui/world-text.ts';

// Read-only layout harness. Same production components/styles, no control lease or writes.
async function start(){
 const r=await fetch('/api/character',{credentials:'same-origin'});if(!r.ok)throw Error('请先在游戏主页登录。');const s:Snapshot=await r.json();
 const params=new URLSearchParams(location.search),skills=params.get('view')==='skills',host=document.querySelector<HTMLElement>('#modal')!;
 const bag:BagUI={...initialBagDraft(),loading:false,quoteTarget:'',quoteCharacter:'',quoteLoading:false,busy:false,message:'',error:'',status:''};
 let query='',filter:'all'|'active'|'eligible'='all';
 function draw(){
  const body=skills?renderSkills({snapshot:s,skillFocus:s.skills[0],skillCategory:'martial',skillQuery:query,skillFilter:filter,processing:false,blocked:false,lastError:'',skillOperation:'',skillOperationId:'',skillStatus:'',skillMessage:''}):BagPanel({snapshot:s,ui:bag,quality:'',slot:'',busy:false,blocked:false,inTown:true});
  host.innerHTML=`<section class="panel panel-wide" data-panel="${skills?'skills':'bag'}" role="dialog" aria-label="${skills?'技能':'背包'}">${panelHeaderHtml(skills?'技能':'背包',{actionsHtml:skills?'':bagHeader(s)})}${body}</section>`;
  const search=host.querySelector<HTMLInputElement>(skills?'#skill-search':'#bag-search');search?.addEventListener('input',()=>{const value=search.value,caret=search.selectionStart;if(skills)query=value;else bag.query=value;draw();const next=host.querySelector<HTMLInputElement>(skills?'#skill-search':'#bag-search')!;next.focus();if(caret!==null)next.setSelectionRange(caret,caret);});
  host.querySelector<HTMLSelectElement>('#skill-filter')?.addEventListener('change',e=>{filter=(e.target as HTMLSelectElement).value as typeof filter;draw();host.querySelector<HTMLElement>('#skill-filter')?.focus();});
  host.querySelectorAll<HTMLElement>('[data-action=bag-category]').forEach(b=>b.onclick=()=>{bag.category=b.dataset.id as BagUI['category'];draw();});
 }
 await loadWorldFont();draw();document.body.dataset.layoutReady='true';
}
void start().catch(e=>{document.querySelector('#modal')!.textContent=e.message;});
