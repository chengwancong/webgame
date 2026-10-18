import {pets as basics,forms,colors,materialNames} from '../v2/definitions.mjs';
export {forms,colors,materialNames};export function palette(){return {};}
const families={wind:['A3','C8'],mist:['D6','D5'],forge:['A1','C4'],frost:['B4','S9'],dragon:['A10','A7'],star:['C5','B7']};
const names={wind:['风芽鹿','岚羽'],mist:['铃沼','竹团'],forge:['铜砾','炉芯'],frost:['霜壳','镜鳍'],dragon:['晓翼','岚鳞'],star:['星尾','灯绫']};
export const pets=basics.flatMap(p=>[{...p,key:p.key+'-free',islandKey:p.key,tier:'free'},...families[p.key].map((family,i)=>({...p,key:p.key+'-'+['light','heavy'][i],name:names[p.key][i],islandKey:p.key,tier:['light','heavy'][i],family,stages:family==='D5'?['a','d','e']:['a','c','e'],fur:['A3','C5','D5'].includes(family)}))]);
