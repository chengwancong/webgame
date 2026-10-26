/** Read-only fixtures. No API requests or saved characters. */
import './ui-entry.css';
import './hub/hub-entry.css';
import './u4-u6-qa.css';
import './tactical/tactical.css';
import {buttonHtml,resourcePillHtml,ribbonTitleHtml,rewardRevealHtml,iconHtml} from './ui-components.ts';
import {handleUITabKey} from './ui/interaction.ts';
import {u4QaCases} from './u4-qa-samples.ts';
import {u5QaCases} from './u5-qa-samples.ts';
import {u6QaCases} from './u6-qa-samples.ts';
import {svgQaCases} from './ui-svg-qa-samples.ts';
import {svgFormsQaCases} from './ui-svg-forms-qa.ts';
import {graphicsQaCases} from './ui-svg-graphics-qa.ts';
import {slotQaCases} from './ui-svg-slots-qa.ts';
import {surfaceSvgQaCases} from './ui-svg-surfaces-qa.ts';
import {tacticalCompactQaCases} from './ui-tactical-compact-qa.ts';
export type QaCase={id:string;label:string;render:()=>string;mount?:(root:HTMLElement)=>void|(()=>void);presentation?:'modal'|'stage'};
const cases:QaCase[]=[
 ...tacticalCompactQaCases,
 ...surfaceSvgQaCases,
 ...svgFormsQaCases,
 ...graphicsQaCases,
 ...slotQaCases,
 ...svgQaCases,
 ...u4QaCases,
 ...u5QaCases,
 ...u6QaCases,
 {id:'u0-victory',label:'U0 胜利/品质/零值',render:()=>`<section class="qa-primitives">${ribbonTitleHtml('通关',{stars:3,grade:'S'})}<div class="qa-primitives__resources">${resourcePillHtml('gold',1280,120)}${resourcePillHtml('xp',0)}${resourcePillHtml('material',9,-3)}</div>${rewardRevealHtml([{name:'普通物品',quality:'common',iconHtml:iconHtml('chest')},{name:'魔法物品',quality:'magic'},{name:'稀有物品',quality:'rare',quantity:0},{name:'传说物品',quality:'legendary',isNew:true,isHex:true}])}</section>`},
 {id:'u0-retreat',label:'U0 撤退/空奖励',render:()=>`<section class="qa-primitives">${ribbonTitleHtml('撤退',{tone:'retreat',stars:3})}${rewardRevealHtml([])}</section>`},
 {id:'u0-unlock',label:'U0 解锁/长奖励',render:()=>`<section class="qa-primitives">${ribbonTitleHtml('解锁',{tone:'unlock'})}${rewardRevealHtml(Array.from({length:16},(_,i)=>({name:`占位奖励 ${i+1}`,quality:'rare' as const})))}</section>`},
];
const toolbar=document.querySelector<HTMLElement>('#qa-controls')!,stage=document.querySelector<HTMLElement>('#qa-stage')!;
let current=cases[0].id,reduced=false;
let disposeSample:void|(()=>void);
function show(id:string){
 disposeSample?.();
 const sample=cases.find(item=>item.id===id)!;current=id;
 toolbar.innerHTML=cases.map(item=>buttonHtml(item.label,{action:'qa-case',id:item.id,variant:'secondary',size:'compact',pressed:item.id===id})).join('')+buttonHtml('减少动态：'+(reduced?'开':'关'),{action:'qa-motion',pressed:reduced,size:'compact'})+buttonHtml('重播当前',{action:'qa-replay',size:'compact'});
 stage.innerHTML=sample.presentation==='stage'?sample.render():`<div id="modal" class="open">${sample.render()}</div>`;
 disposeSample=sample.mount?.(stage);
}
toolbar.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;const action=button.dataset.action;if(action==='qa-case')show(button.dataset.id!);if(action==='qa-replay')show(current);if(action==='qa-motion'){reduced=!reduced;document.documentElement.dataset.motionReduced=String(reduced);show(current);}});
document.addEventListener('keydown',handleUITabKey);
show(current);
