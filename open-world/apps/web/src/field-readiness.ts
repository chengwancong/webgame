import type {Snapshot} from '../../../packages/contracts/index.ts';
export const fullBagMessage='背包满了，全自动已停止。回港整理后再开启。';
export function bagFull(s:Pick<Snapshot,'gear'|'capacity'>){return s.gear.length>=s.capacity;}
export function autoBattleBlock(s:Pick<Snapshot,'gear'|'capacity'>,hp:number){return hp<=0?'你已倒下，请返回归途营地。':bagFull(s)?fullBagMessage:'';}
