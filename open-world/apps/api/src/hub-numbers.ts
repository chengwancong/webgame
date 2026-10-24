import {readFileSync} from 'node:fs';
import {hubChartContent} from '../../../packages/content/hub-chart.ts';
import {parseHubOutsideNumbers} from '../../../packages/content/hub-outside-numbers.ts';
import {pendingHubOutsideNumbers,type HubOutsideNumbers} from './hub-outside-service.ts';

/** Both the managed API and isolated autopilot load the same workbook export.
 * A partial B4 export must not silently run a mixture of real and pending rates.
 * This module stays server-only: browser content never imports node:fs. */
export function loadHubOutsideNumbers():HubOutsideNumbers{
 const ready=hubChartContent.nodes.filter(node=>node.budgetReady).length;
 let raw:string;
 try{raw=readFileSync(new URL('../../../packages/content/hub-outside-numbers.json',import.meta.url),'utf8');}
 catch(error){
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  if(ready!==0)throw Error('HUB节点预算已应用，但缺少港口收益工作簿导出；请完成配置导出后再启动。');
  return structuredClone(pendingHubOutsideNumbers);
 }
 if(ready!==hubChartContent.nodes.length)throw Error('HUB节点预算与港口收益应用状态不一致；请完成同一B4计划的配置导出。');
 const numbers=parseHubOutsideNumbers(JSON.parse(raw));
 for(const region of new Set(hubChartContent.nodes.map(n=>n.region)))if(!numbers.dockRates[region])throw Error('HUB航区缺少同批派遣收益：'+region);
 return numbers;
}
