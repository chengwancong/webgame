import './ui-entry.css';
import './stage.css';
import {mountStage} from './stage.ts';
import {buttonHtml,panelHeaderHtml} from './ui-components.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
mountStage();
const counts=[0,1,2,8,9],waypoints=[...worldTables.waypoints.filter(w=>w.region==='ss-map-dragon'),...worldTables.waypoints.filter(w=>w.region==='ss-map-rift')].slice(0,9);
const root=document.querySelector('#modal')!;
function render(count:number){root.innerHTML=`<section class="panel" data-panel="region-map" role="dialog" aria-label="航标布局样本">${panelHeaderHtml('布局样本，不写存档',{closeAction:'close'})}<p class="ui-caption">1280×720 · ${count} 个航标 · 生产按钮与地图样式</p><div class="region-map-actions" aria-label="样本数量">${counts.map(n=>buttonHtml(String(n)+'个',{action:'sample',id:String(n),variant:n===count?'primary':'secondary'})).join('')}</div><div class="region-map-actions" aria-label="航标传送">${waypoints.slice(0,count).map(w=>buttonHtml('传送 · '+w.name,{action:'sample-travel',id:w.id,variant:'secondary'})).join('')}</div><p role="status" id="sample-status">可连续切换样本检查布局。</p></section>`;}
root.addEventListener('click',event=>{const b=(event.target as Element).closest<HTMLButtonElement>('button[data-action]');if(b?.dataset.action==='sample')render(Number(b.dataset.id));else if(b?.dataset.action==='sample-travel')document.querySelector('#sample-status')!.textContent='布局样本：'+b.getAttribute('aria-label')+'，未发出请求。';});
if(waypoints.length<9)throw Error('Sample requires nine registered Dragon waypoints');render(0);
