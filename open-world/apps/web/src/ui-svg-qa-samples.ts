import {buttonHtml,panelHeaderHtml,resourcePillHtml,rewardRevealHtml,stateBlockHtml,tabsHtml} from './ui-components.ts';
import {ToastQueue,toastHtml} from './ui/toast-queue.ts';
import {hudMenuIcon} from './hud-icons.ts';
import {art} from './ui-assets.ts';
import {getEquipmentItem} from '../../../packages/content/index.ts';

const rewardSamples=()=>rewardRevealHtml([
 {base:'standard-sword-t1-weapon',quality:'common' as const},
 {base:'standard-hammer-t2-weapon',quality:'rare' as const},
 {base:'omega-sword-t3-weapon',quality:'legendary' as const},
].map((item,i)=>({name:getEquipmentItem(item.base)!.name,iconHtml:`<img src="${art('gear-'+item.base)}" alt="">`,quality:item.quality,quantity:1,isNew:i===2,isHex:i===2})));

const controlSample=()=>`<section class="qa-primitives">${panelHeaderHtml('按钮与页签',{emblemHtml:hudMenuIcon('settings')})}<div class="qa-primitives__resources">${buttonHtml('出发',{variant:'primary'})}${buttonHtml('整理背包',{variant:'secondary'})}${buttonHtml('返回',{variant:'tertiary'})}${buttonHtml('分解',{variant:'danger'})}${buttonHtml('条件未满足',{disabled:true})}${buttonHtml('领取奖励',{busy:true,busyLabel:'正在核对奖励…'})}</div>${tabsHtml({label:'SVG 页签',action:'qa-vector-tab',selected:'bag',items:[{id:'bag',label:'背包',count:12},{id:'gear',label:'人物装备'},{id:'locked',label:'尚未解锁',disabled:true}]})}${tabsHtml({label:'长文字页签',action:'qa-vector-long-tab',selected:'long',orientation:'vertical',items:[{id:'long',label:'技能成长、武器装配与出战方案的长标题检查',count:8},{id:'short',label:'今日目标'}]})}<p class="ui-caption">可点击页签切换；按钮沿用原按下、禁用、忙碌和焦点样式。</p></section>`;
const controlsMount=(root:HTMLElement)=>{const click=(event:MouseEvent)=>{const tab=(event.target as Element).closest<HTMLButtonElement>('[role=tab]');if(!tab||tab.disabled||!tab.dataset.action?.startsWith('qa-vector-'))return;for(const button of tab.closest('[role=tablist]')!.querySelectorAll<HTMLButtonElement>('[role=tab]')){button.setAttribute('aria-selected',String(button===tab));button.tabIndex=button===tab?0:-1;}};root.addEventListener('click',click);return()=>root.removeEventListener('click',click);};
const toastSample=()=>{const queue=new ToastQueue();queue.push('已领取补给，物品已放入背包。',0,{kind:'loot',ttl:8000});queue.push('新的航线已经开放。',0,{kind:'success',ttl:10000});queue.push('连接正在恢复，已确认的进度会保留。',0,{kind:'error',sticky:true});return `<div id="toast">${queue.visible(0).map(item=>toastHtml(item,0)).join('')}</div>`;};

export const svgQaCases=[
 {id:'svg2-controls',label:'SVG 2 · 按钮与页签',render:controlSample,mount:controlsMount},
 {id:'svg2-toast',label:'SVG 2 · 提示条',render:toastSample,presentation:'stage' as const},
 ...(['empty','loading','error','success'] as const).map(kind=>({id:'svg2-state-'+kind,label:'SVG 2 · '+({empty:'空状态',loading:'读取中',error:'错误',success:'完成'}[kind]),render:()=>`<section class="qa-primitives">${panelHeaderHtml('状态反馈',{emblemHtml:hudMenuIcon('bag')})}${stateBlockHtml({kind,title:{empty:'行囊暂时为空',loading:'正在读取',error:'连接暂时中断',success:'补给领取完成'}[kind],message:{empty:'继续探索后，获得的物品会显示在这里。',loading:'稍等片刻。',error:'已确认的角色进度会保留，可以重新连接。',success:'物品已放入背包，可以继续远行。'}[kind],action:kind==='error'?{label:'重新连接',action:'qa-reconnect'}:undefined})}</section>`})),
 {id:'svg-components',label:'SVG · 公共组件',render:()=>`<section class="qa-primitives">${panelHeaderHtml('远行补给',{emblemHtml:hudMenuIcon('bag')})}<p class="ui-caption">真实公共标题、资源胶囊与品质标签。文字仍是 HTML，图标沿用已登记资源。</p><div class="qa-primitives__resources">${resourcePillHtml('gold',12840)}${resourcePillHtml('xp',3600,120)}${resourcePillHtml('material',36)}</div>${rewardSamples()}<div class="qa-primitives__resources">${buttonHtml('继续远行',{variant:'primary'})}${buttonHtml('整理行囊',{variant:'secondary'})}${buttonHtml('暂不可用',{disabled:true})}</div></section>`},
 {id:'svg-long',label:'SVG · 长文与零值',render:()=>`<section class="qa-primitives">${panelHeaderHtml('远行补给 · 长标题换行与固定关闭按钮检查',{emblemHtml:hudMenuIcon('bag')})}<div class="qa-primitives__resources">${resourcePillHtml('gold',123456789012)}${resourcePillHtml('xp',0)}${resourcePillHtml('material',9,-3)}</div>${rewardSamples()}<div class="qa-primitives__resources">${buttonHtml('正在领取远行补给',{variant:'primary',busy:true,busyLabel:'正在核对这次远行的全部补给…'})}${buttonHtml('返回',{variant:'secondary'})}</div></section>`},
];
