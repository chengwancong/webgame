/** Read-only samples of the real chase HUD. No API, enemy AI or reward writes. */
import {hubHudHtml} from './hub/hub-hud.ts';
import {panelHeaderHtml,iconHtml} from './ui-components.ts';
import {treasureChaseGoal,type TreasureChase} from './treasure-chase-view.ts';

const samples:[TreasureChase['phase'],string,number][]=[['waking','宝箱苏醒',0],['running','抢先堵截',1],['staggered','喘息窗口',2],['cornered','堵住宝箱怪',3]];
export const treasureChaseQaCases=samples.map(([phase,label,interceptions])=>({
 id:'treasure-chase-'+phase,label:'寻宝 · '+label,
 render:()=>{
  const chase:TreasureChase={chestId:'qa-chest',enemyId:'qa-mimic',phase,position:{x:12,y:10},intercept:{x:16,y:12},remainingSeconds:phase==='waking'?1:phase==='staggered'?3:20,interceptions};
  const goal=treasureChaseGoal(chase)!;
  return `<section class="qa-primitives">${panelHeaderHtml('追逐寻宝 · '+label)}<div class="hub-hud-row">${hubHudHtml({objective:{kind:'open-chests',text:goal.label,progress:{done:2,total:5},timeLeft:120},segment:{index:1,total:1},chase})}</div><p>${iconHtml('chest')} ${phase==='running'?'世界引导和雷达优先指向前方拦截点。':'世界引导和雷达指向宝箱怪当前所在位置。'}</p><p>这里只查看真实目标行与状态徽记；时长和进度为静态样例，不执行追逐，也不发放奖励。</p></section>`;
 },
}));
